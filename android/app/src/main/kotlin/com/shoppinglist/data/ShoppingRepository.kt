package com.shoppinglist.data

import android.content.Context
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.*
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID

class ShoppingRepository internal constructor(
    private val api: SupabaseTransport,
    private val readSnapshot: () -> Snapshot,
    private val writeSnapshot: (Snapshot) -> Unit,
) {
    constructor(context: Context, url: String, anonKey: String) : this(
        SupabaseTransport(url.trimEnd('/'), anonKey),
        lazy {
            val namespace = MessageDigest.getInstance("SHA-256").digest(url.trimEnd('/').toByteArray())
                .joinToString("") { "%02x".format(it) }
            SecureStore(context.applicationContext, namespace)
        },
    )

    private constructor(api: SupabaseTransport, store: Lazy<SecureStore>) : this(
        api, { store.value.read() }, { store.value.write(it) },
    )
    private val mutex = Mutex()
    private val syncMutex = Mutex()
    private val authMutex = Mutex()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val mutableState = MutableStateFlow(ShoppingState())
    val state: StateFlow<ShoppingState> = mutableState.asStateFlow()
    private var snapshot = Snapshot()
    private var loaded = false
    private var switching = false
    @Volatile private var closed = false
    @Volatile private var realtimeEnabled = false
    private val realtime = RealtimeInvalidation(api, scope, { sync() }, { message ->
        scope.launch { mutex.withLock { mutableState.value = mutableState.value.copy(error = message) } }
    })

    private fun publish() {
        mutableState.value = mutableState.value.copy(
            list = snapshot.list,
            items = orderedItems(snapshot.items, snapshot.orders[snapshot.list?.id].orEmpty()),
            memberCount = snapshot.members, userId = snapshot.session?.userId.orEmpty(),
            userName = snapshot.userName, pendingCount = snapshot.queue.size,
        )
    }

    private suspend fun load() {
        if (!loaded) {
            snapshot = withContext(Dispatchers.IO) { readSnapshot() }
            loaded = true
            publish()
        }
    }

    // Disk commit and in-memory publication are indivisible even if the caller is cancelled.
    private suspend fun commit(next: Snapshot) = withContext(NonCancellable + Dispatchers.IO) {
        writeSnapshot(next)
        snapshot = next
        publish()
    }

    private suspend fun guarded(block: suspend () -> Unit) {
        try {
            check(!closed) { "Repository is closed" }
            block()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            mutex.withLock { mutableState.value = mutableState.value.copy(error = e.message ?: "Request failed") }
        }
    }

    private suspend fun token(force: Boolean = false): String = authMutex.withLock {
        val current = mutex.withLock {
            load()
            check(snapshot.session != null || (snapshot.list == null && snapshot.queue.isEmpty())) { "Existing list has no recoverable session" }
            snapshot.session
        }
        if (!force && current != null && current.expires > Instant.now().epochSecond + 60) return@withLock current.access
        // Refresh failure deliberately preserves identity and all queued data. Never fall back to signup.
        val path = if (current == null) "/auth/v1/signup" else "/auth/v1/token?grant_type=refresh_token"
        val body = if (current == null) buildJsonObject { put("data", buildJsonObject {}) }
            else buildJsonObject { put("refresh_token", current.refresh) }
        // Token rotation must finish its bounded request and persist the result even on cancellation.
        withContext(NonCancellable) {
            val response = dataJson.parseToJsonElement(api.request(path, null, "POST", body)).jsonObject
            val userId = response.getValue("user").jsonObject.getValue("id").jsonPrimitive.content
            check(current == null || current.userId == userId) { "Refresh changed the authenticated identity" }
            val session = Session(response.getValue("access_token").jsonPrimitive.content,
                response.getValue("refresh_token").jsonPrimitive.content, userId,
                response["expires_at"]?.jsonPrimitive?.long ?: (Instant.now().epochSecond + response.getValue("expires_in").jsonPrimitive.long))
            mutex.withLock { commit(snapshot.copy(session = session)) }
        }
        currentCoroutineContext().ensureActive()
        mutex.withLock { snapshot.session!!.access }
    }

    private suspend fun request(path: String, method: String = "GET", body: JsonElement? = null, prefer: String? = null): String {
        val access = token()
        return try { api.request(path, access, method, body, prefer) }
        catch (e: ApiException) {
            if (e.status != 401) throw e
            api.request(path, token(force = true), method, body, prefer)
        }
    }

    suspend fun start() {
        realtimeEnabled = true
        sync()
        if (mutex.withLock { loaded && snapshot.queue.isNotEmpty() }) scheduleSync()
    }

    suspend fun sync() = guarded {
        syncMutex.withLock {
            mutex.withLock { load(); mutableState.value = mutableState.value.copy(syncing = true, error = null) }
            try {
                token()
                val activeId = mutex.withLock { snapshot.list?.id }
                if (activeId != null) requireRemoteList(activeId)
                replayQueue(
                    next = { mutex.withLock { snapshot.queue.firstOrNull() } },
                    send = { send(it) },
                    acknowledge = { op -> mutex.withLock { commit(snapshot.copy(queue = acknowledge(snapshot.queue, op))) } },
                )
                val listId = mutex.withLock { snapshot.list?.id }
                if (listId != null) {
                    val lists = dataJson.decodeFromString<List<ShoppingList>>(request("/rest/v1/shopping_lists?id=eq.$listId&select=id,invite_code,name,owner_id"))
                    val list = lists.singleOrNull() ?: error("List is unavailable; local changes have been retained")
                    val items = dataJson.decodeFromString<List<ShoppingItem>>(request("/rest/v1/shopping_items?list_id=eq.$listId&select=id,list_id,text,checked,updated_at"))
                    val members = dataJson.parseToJsonElement(request("/rest/v1/list_members?list_id=eq.$listId&select=user_id")).jsonArray.size.coerceAtLeast(1)
                    mutex.withLock {
                        check(snapshot.list?.id == listId) { "Active list changed during sync" }
                        val next = snapshot.copy(list = list, items = items, members = members).applyOperations(snapshot.queue)
                        commit(next)
                    }
                }
                mutex.withLock { updateRealtime() }
            } finally {
                withContext(NonCancellable) { mutex.withLock { mutableState.value = mutableState.value.copy(syncing = false) } }
            }
        }
    }

    private suspend fun send(op: Operation) {
        UUID.fromString(op.listId)
        if (op.type != "rename") UUID.fromString(op.id)
        val itemPath = "/rest/v1/shopping_items?list_id=eq.${op.listId}&id=eq.${op.id}"
        when (op.type) {
            "add" -> request("/rest/v1/shopping_items?on_conflict=id", "POST", buildJsonObject {
                put("id", op.id); put("list_id", op.listId); put("text", op.text); put("checked", op.checked)
            }, "resolution=ignore-duplicates,return=minimal")
            "edit", "check" -> {
                val rows = dataJson.parseToJsonElement(request(itemPath, "PATCH", buildJsonObject {
                    if (op.type == "edit") put("text", op.text) else put("checked", op.checked)
                }, "return=representation")).jsonArray
                if (rows.isEmpty()) {
                    // A concurrent delete wins, but loss of access must retain the queue.
                    requireRemoteList(op.listId)
                    val remaining = dataJson.parseToJsonElement(request("$itemPath&select=id")).jsonArray
                    check(remaining.isEmpty()) { "Item update was denied; pending changes retained" }
                }
            }
            "delete" -> {
                request(itemPath, "DELETE")
                // A zero-row DELETE is idempotent only while this identity can still access the list.
                requireRemoteList(op.listId)
            }
            "rename" -> {
                val rows = dataJson.parseToJsonElement(request("/rest/v1/shopping_lists?id=eq.${op.listId}", "PATCH",
                    buildJsonObject { put("name", op.text) }, "return=representation")).jsonArray
                check(rows.isNotEmpty()) { "Rename was denied; only the list owner can rename it" }
            }
            else -> error("Unknown queued operation: ${op.type}")
        }
    }

    private suspend fun requireRemoteList(id: String) {
        UUID.fromString(id)
        val rows = dataJson.parseToJsonElement(request("/rest/v1/shopping_lists?id=eq.$id&select=id")).jsonArray
        check(rows.size == 1) { "List is unavailable or access was denied; pending changes retained" }
    }

    private suspend fun mutate(block: (Snapshot) -> Snapshot) = guarded {
        val pending = mutex.withLock {
            check(!switching) { "Wait for list switching to finish" }
            load()
            commit(block(snapshot))
            mutableState.value = mutableState.value.copy(error = null)
            snapshot.queue.isNotEmpty()
        }
        if (pending && realtimeEnabled) scheduleSync()
    }

    private var retryJob: Job? = null
    @Synchronized private fun scheduleSync() {
        if (retryJob?.isActive == true || closed) return
        retryJob = scope.launch {
            try {
                var delayMillis = 1_000L
                do {
                    sync()
                    val pending = mutex.withLock { snapshot.queue.isNotEmpty() }
                    if (!pending || !realtimeEnabled) break
                    delay(delayMillis)
                    delayMillis = (delayMillis * 2).coerceAtMost(30_000)
                } while (isActive)
            } finally {
                val finished = currentCoroutineContext()[Job]
                synchronized(this@ShoppingRepository) {
                    if (retryJob === finished) retryJob = null
                }
                if (isActive && realtimeEnabled && mutex.withLock { snapshot.queue.isNotEmpty() }) scheduleSync()
            }
        }
    }

    private fun enqueue(value: Snapshot, operations: List<Operation>): Snapshot =
        value.applyOperations(operations).copy(queue = value.queue + operations)

    private fun active(value: Snapshot) = value.list ?: error("Choose a list first")
    private fun text(value: String): String = value.trim().also { require(it.isNotEmpty()) { "Text cannot be empty" } }
    private fun item(value: Snapshot, id: String) = value.items.firstOrNull { it.id == id } ?: error("Item no longer exists")
    private fun operation(value: Snapshot, type: String, id: String = "", text: String = "", checked: Boolean = false) =
        Operation(type, active(value).id, id, text, checked, Instant.now().toString())

    suspend fun addItem(text: String) = mutate { value ->
        enqueue(value, listOf(operation(value, "add", UUID.randomUUID().toString(), text(text))))
    }
    suspend fun editItem(id: String, text: String) = mutate { value ->
        item(value, id); enqueue(value, listOf(operation(value, "edit", id, text(text))))
    }
    suspend fun setChecked(id: String, checked: Boolean) = mutate { value ->
        item(value, id); enqueue(value, listOf(operation(value, "check", id, checked = checked)))
    }
    suspend fun deleteItem(id: String) = mutate { value ->
        item(value, id); enqueue(value, listOf(operation(value, "delete", id)))
    }
    suspend fun clearDone() = mutate { value ->
        active(value); enqueue(value, value.items.filter { it.checked }.map { operation(value, "delete", it.id) })
    }
    suspend fun restoreDone() = mutate { value ->
        active(value); enqueue(value, value.items.filter { it.checked }.map { operation(value, "check", it.id, checked = false) })
    }
    suspend fun renameList(name: String) = mutate { value ->
        check(active(value).owner_id == value.session?.userId) { "Only the list owner can rename it" }
        enqueue(value, listOf(operation(value, "rename", text = text(name))))
    }
    suspend fun leaveList() = mutate { value ->
        check(value.queue.isEmpty()) { "Sync pending changes before leaving the list" }
        check(!mutableState.value.syncing) { "Wait for sync to finish" }
        realtime.stop()
        value.copy(list = null, items = emptyList(), members = 1)
    }
    suspend fun reorderItems(ids: List<String>) = mutate { value ->
        val list = active(value)
        val current = orderedItems(value.items, value.orders[list.id].orEmpty()).filterNot { it.checked }.map { it.id }
        // Merge against current items: live additions/deletions must not invalidate a drag.
        val order = ids.distinct().filter { it in current } + current.filterNot { it in ids }
        value.copy(orders = value.orders + (list.id to order))
    }

    suspend fun createList(name: String, displayName: String) = switchList(true, name, displayName)
    suspend fun joinList(code: String, displayName: String) = switchList(false, code, displayName)

    private suspend fun switchList(create: Boolean, input: String, displayName: String) = guarded {
        // Serialize switching with sync; reject local writes until the new list is committed.
        check(syncMutex.tryLock()) { "Wait for sync to finish" }
        try {
            mutex.withLock {
                load()
                check(snapshot.queue.isEmpty()) { "Sync pending changes before switching lists" }
                switching = true
                mutableState.value = mutableState.value.copy(syncing = true, error = null)
            }
            val trimmed = text(input)
            val code = if (create) UUID.randomUUID().toString().replace("-", "").take(12).uppercase().chunked(4).joinToString("-") else trimmed.uppercase()
            val body = buildJsonObject {
                put("invite_code_input", code)
                if (create) put("name_input", trimmed)
                put("display_name_input", displayName.trim())
            }
            val path = "/rest/v1/rpc/${if (create) "create_list" else "join_list_by_code"}"
            // Once sent, finish the bounded RPC and persist its result even on backgrounding.
            withContext(NonCancellable) {
                val list = dataJson.decodeFromString<List<ShoppingList>>(request(path, "POST", body)).single()
                UUID.fromString(list.id)
                mutex.withLock {
                    commit(snapshot.copy(list = list, items = emptyList(), members = 1, userName = displayName.trim()))
                    updateRealtime()
                }
            }
            currentCoroutineContext().ensureActive()
        } finally {
            withContext(NonCancellable) {
                mutex.withLock {
                    switching = false
                    mutableState.value = mutableState.value.copy(syncing = false)
                }
            }
            syncMutex.unlock()
        }
        sync()
    }

    private fun updateRealtime() {
        val list = snapshot.list
        val session = snapshot.session
        if (realtimeEnabled && list != null && session != null && !closed) realtime.start(list.id, session.access, session.expires)
        else realtime.stop()
    }
    fun clearError() {
        scope.launch { mutex.withLock { mutableState.value = mutableState.value.copy(error = null) } }
    }
    @Synchronized fun stopRealtime() { realtimeEnabled = false; realtime.stop(); retryJob?.cancel() }
    fun close() {
        closed = true
        stopRealtime()
        scope.cancel()
        api.client.dispatcher.cancelAll()
        api.client.connectionPool.evictAll()
    }
}
