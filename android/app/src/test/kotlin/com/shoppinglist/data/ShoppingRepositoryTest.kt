package com.shoppinglist.data

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.*
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException
import java.util.concurrent.CopyOnWriteArrayList

class ShoppingRepositoryTest {
    private val listId = "f23580e7-5b9a-488b-a608-421543e0dc2b"
    private val itemId = "7e36da56-5576-4d54-a99d-37d00bcaec17"
    private val list = ShoppingList(listId, "CODE", "Groceries", "owner")
    private val session = Session("access", "refresh", "owner", Long.MAX_VALUE)
    private val base = Snapshot(session = session, list = list)
    private val listJson = dataJson.encodeToString(ShoppingList.serializer(), list)
    private fun op(type: String, id: String = itemId, text: String = "") = Operation(type, listId, id, text)

    private inner class Harness(
        initial: Snapshot = base,
        private val respond: (Request) -> Pair<Int, String> = { request ->
            when (request.url.encodedPath) {
                "/rest/v1/shopping_lists" -> 200 to "[$listJson]"
                "/rest/v1/shopping_items", "/rest/v1/list_members" -> 200 to "[]"
                else -> throw IOException("Unexpected request: ${request.url}")
            }
        },
    ) : AutoCloseable {
        var persisted = initial
        var readFailure: IOException? = null
        var writeFailure: IOException? = null
        val requests = CopyOnWriteArrayList<Request>()
        private val client = OkHttpClient.Builder().addInterceptor { chain ->
            val request = chain.request()
            requests += request
            val (status, body) = respond(request)
            Response.Builder().request(request).protocol(Protocol.HTTP_1_1)
                .code(status).message("Test response").body(body.toResponseBody()).build()
        }.build()
        val repository = ShoppingRepository(
            SupabaseTransport("https://example.supabase.co", "anon-key", client),
            { readFailure?.let { throw it }; persisted },
            { writeFailure?.let { throw it }; persisted = it },
        )
        override fun close() {
            repository.close()
            client.dispatcher.executorService.shutdown()
        }
    }

    @Test fun storageFailureDoesNotCreateIdentityAndStartupCanRetry() = runBlocking {
        Harness().use { h ->
            h.readFailure = IOException("Storage unavailable")
            h.repository.start()
            assertEquals("Storage unavailable", h.repository.state.value.error)
            assertFalse(h.repository.state.value.syncing)
            assertTrue(h.requests.isEmpty())
            assertEquals(base, h.persisted)

            h.repository.stopRealtime()
            h.readFailure = null
            h.repository.sync()
            assertNull(h.repository.state.value.error)
            assertEquals(session.userId, h.repository.state.value.userId)
            assertEquals(session, h.persisted.session)
            assertTrue(h.requests.none { it.url.encodedPath.startsWith("/auth/") })
        }
    }

    @Test fun rejoiningCurrentListPreservesCacheWhenRefreshFails() = runBlocking {
        val initial = base.copy(items = listOf(ShoppingItem(itemId, listId, "Milk")), members = 3)
        Harness(initial) { request ->
            when (request.url.encodedPath) {
                "/rest/v1/rpc/join_list_by_code", "/rest/v1/shopping_lists" -> 200 to "[$listJson]"
                else -> throw IOException("Refresh unavailable")
            }
        }.use { h ->
            assertTrue(h.repository.joinList("CODE", "Alex"))
            assertEquals(initial.items, h.persisted.items)
            assertEquals(initial.items, h.repository.state.value.items)
            assertEquals(3, h.repository.state.value.memberCount)
            assertEquals("Alex", h.persisted.userName)
            assertEquals("Refresh unavailable", h.repository.state.value.error)
        }
    }

    @Test fun rejectedJoinDoesNotReportSuccessOrChangeCache() = runBlocking {
        val initial = base.copy(items = listOf(ShoppingItem(itemId, listId, "Milk")))
        Harness(initial) { 400 to "Join rejected" }.use { h ->
            assertFalse(h.repository.joinList("CODE", "Alex"))
            assertEquals(initial, h.persisted)
            assertNotNull(h.repository.state.value.error)
        }
    }

    @Test fun switchingToDifferentListClearsPreviousCacheEvenWhenRefreshFails() = runBlocking {
        val initial = base.copy(items = listOf(ShoppingItem(itemId, listId, "Milk")), members = 3)
        val nextList = list.copy(id = itemId, invite_code = "OTHER")
        Harness(initial) { request ->
            if (request.url.encodedPath.endsWith("join_list_by_code")) {
                200 to dataJson.encodeToString(listOf(nextList))
            } else throw IOException("Refresh unavailable")
        }.use { h ->
            assertTrue(h.repository.joinList("OTHER", "Alex"))
            assertEquals(nextList, h.persisted.list)
            assertTrue(h.persisted.items.isEmpty())
            assertEquals(1, h.persisted.members)
        }
    }

    @Test fun existingListWithoutSessionNeverSignsUp() = runBlocking {
        Harness(base.copy(session = null)).use { h ->
            h.repository.sync()
            assertTrue(h.repository.state.value.error!!.contains("no recoverable session"))
            assertTrue(h.requests.isEmpty())
            assertEquals(list, h.persisted.list)
        }
    }

    @Test fun refreshFailureRetainsIdentityAndOfflineQueue() = runBlocking {
        val pending = listOf(op("edit", text = "Offline"))
        val initial = base.copy(session = session.copy(expires = 0), queue = pending)
        Harness(initial) { 400 to "Refresh rejected" }.use { h ->
            h.repository.sync()
            assertEquals(initial, h.persisted)
            assertEquals(1, h.repository.state.value.pendingCount)
            assertEquals("owner", h.repository.state.value.userId)
            assertEquals(listOf("/auth/v1/token"), h.requests.map { it.url.encodedPath })
        }
    }

    @Test fun deletedItemEditsAndChecksDoNotBlockLaterAdds() = runBlocking {
        val pending = listOf(op("edit", text = "Offline"), op("check"), op("add", id = listId, text = "Bread"))
        Harness(base.copy(queue = pending)) { request ->
            when (request.url.encodedPath) {
                "/rest/v1/shopping_lists" -> 200 to "[$listJson]"
                "/rest/v1/shopping_items", "/rest/v1/list_members" -> 200 to "[]"
                else -> throw IOException("Unexpected request")
            }
        }.use { h ->
            h.repository.sync()
            assertNull(h.repository.state.value.error)
            assertTrue(h.persisted.queue.isEmpty())
            assertEquals(listOf("PATCH", "PATCH", "POST"), h.requests.filter { it.method != "GET" }.map { it.method })
            assertTrue(h.repository.state.value.items.isEmpty())
        }
    }

    @Test fun accessLostAfterEmptyPatchRetainsHeadAndTail() = runBlocking {
        var listReads = 0
        val pending = listOf(op("edit", text = "Offline"), op("add", id = listId, text = "Bread"))
        Harness(base.copy(queue = pending)) { request ->
            if (request.url.encodedPath == "/rest/v1/shopping_lists" && ++listReads == 1) 200 to "[$listJson]"
            else 200 to "[]"
        }.use { h ->
            h.repository.sync()
            assertEquals(pending, h.persisted.queue)
            assertTrue(h.repository.state.value.error!!.contains("access was denied"))
            assertTrue(h.requests.none { it.method == "POST" })
        }
    }

    @Test fun emptyPatchOnVisibleItemIsNotAcknowledged() = runBlocking {
        val pending = listOf(op("edit", text = "Offline"))
        Harness(base.copy(queue = pending)) { request ->
            when {
                request.url.encodedPath == "/rest/v1/shopping_lists" -> 200 to "[$listJson]"
                request.method == "PATCH" -> 200 to "[]"
                else -> 200 to "[{\"id\":\"$itemId\"}]"
            }
        }.use { h ->
            h.repository.sync()
            assertEquals(pending, h.persisted.queue)
            assertTrue(h.repository.state.value.error!!.contains("update was denied"))
        }
    }

    @Test fun failedAcknowledgementWriteKeepsQueueForIdempotentRetry() = runBlocking {
        val pending = listOf(op("delete"))
        Harness(base.copy(queue = pending)).use { h ->
            h.writeFailure = IOException("Disk full")
            h.repository.sync()
            assertEquals(pending, h.persisted.queue)
            assertEquals(1, h.repository.state.value.pendingCount)
            assertEquals("Disk full", h.repository.state.value.error)
            h.writeFailure = null
            h.repository.sync()
            assertTrue(h.persisted.queue.isEmpty())
            assertEquals(2, h.requests.count { it.method == "DELETE" })
        }
    }

    @Test fun switchingRetriesUnauthorizedWithSameIdentityWithoutDeadlock() = runBlocking {
        var attempts = 0
        Harness(base.copy(list = null)) { request ->
            when (request.url.encodedPath) {
                "/rest/v1/rpc/join_list_by_code" -> if (++attempts == 1) 401 to "Expired" else 200 to "[$listJson]"
                "/auth/v1/token" -> 200 to "{\"access_token\":\"rotated\",\"refresh_token\":\"rotated-refresh\",\"expires_at\":9223372036854775807,\"user\":{\"id\":\"owner\"}}"
                "/rest/v1/shopping_lists" -> 200 to "[$listJson]"
                else -> 200 to "[]"
            }
        }.use { h ->
            withTimeout(5_000) { h.repository.joinList("code", "Alex") }
            assertNull(h.repository.state.value.error)
            assertEquals(list, h.persisted.list)
            assertEquals("Alex", h.persisted.userName)
            assertEquals("owner", h.persisted.session?.userId)
            assertEquals("rotated-refresh", h.persisted.session?.refresh)
            val joins = h.requests.filter { it.url.encodedPath.endsWith("join_list_by_code") }
            assertEquals(listOf("Bearer access", "Bearer rotated"), joins.map { it.header("Authorization") })
            assertTrue(h.requests.none { it.url.encodedPath.endsWith("signup") })
        }
    }

    @Test fun localWritesDuringSwitchAreRejectedWithoutHoldingSnapshotLock() = runBlocking {
        val received = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        Harness { request ->
            when (request.url.encodedPath) {
                "/rest/v1/rpc/join_list_by_code" -> {
                    received.complete(Unit)
                    runBlocking { withTimeout(5_000) { release.await() } }
                    200 to "[$listJson]"
                }
                "/rest/v1/shopping_lists" -> 200 to "[$listJson]"
                else -> 200 to "[]"
            }
        }.use { h ->
            val switching = async { h.repository.joinList("CODE", "Alex") }
            try {
                withTimeout(5_000) {
                    received.await()
                    h.repository.addItem("Must not attach to old list")
                }
                assertTrue(h.repository.state.value.error!!.contains("list switching"))
                assertEquals(base, h.persisted)
                assertTrue(h.persisted.queue.isEmpty())
            } finally {
                release.complete(Unit)
            }
            withTimeout(5_000) { switching.await() }
            assertEquals("Alex", h.persisted.userName)
            assertFalse(h.repository.state.value.syncing)
        }
    }

    @Test fun cancelledSwitchStillPersistsAcceptedList() = runBlocking {
        val received = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        Harness(base.copy(list = null)) { request ->
            if (request.url.encodedPath.endsWith("join_list_by_code")) {
                received.complete(Unit)
                runBlocking { withTimeout(5_000) { release.await() } }
                200 to "[$listJson]"
            } else throw IOException("Cancelled switch must not start another sync")
        }.use { h ->
            val switching = async { h.repository.joinList("CODE", "Alex") }
            try {
                withTimeout(5_000) { received.await() }
                switching.cancel()
            } finally {
                release.complete(Unit)
            }
            withTimeout(5_000) { switching.join() }
            assertEquals(list, h.persisted.list)
            assertEquals("Alex", h.persisted.userName)
            assertEquals(session, h.persisted.session)
            assertFalse(h.repository.state.value.syncing)
        }
    }

    @Test fun refreshCannotReplacePersistentIdentity() = runBlocking {
        val initial = base.copy(session = session.copy(expires = 0))
        Harness(initial) {
            200 to "{\"access_token\":\"other\",\"refresh_token\":\"other-refresh\",\"expires_in\":3600,\"user\":{\"id\":\"other-user\"}}"
        }.use { h ->
            h.repository.sync()
            assertEquals(initial, h.persisted)
            assertEquals("owner", h.repository.state.value.userId)
            assertTrue(h.repository.state.value.error!!.contains("authenticated identity"))
        }
    }

    @Test fun reorderingStaysLocalAndMergesItemsChangedDuringDrag() = runBlocking {
        val breadId = "cba6fc05-aaed-4afb-a710-00e7d840b672"
        val doneId = "fdb1b2d8-b2e5-4294-a5f5-f80e7a1d8ee9"
        val initial = base.copy(items = listOf(
            ShoppingItem(itemId, listId, "Milk"),
            ShoppingItem(breadId, listId, "Bread"),
            ShoppingItem(doneId, listId, "Eggs", checked = true),
        ))
        Harness(initial).use { h ->
            h.repository.reorderItems(listOf(breadId, itemId))
            assertEquals(listOf(breadId, itemId, doneId), h.repository.state.value.items.map { it.id })
            assertTrue(h.persisted.queue.isEmpty())
            assertTrue(h.requests.isEmpty())
            h.repository.deleteItem(itemId)
            h.repository.addItem("Apples")
            val newId = h.repository.state.value.items.single { it.text == "Apples" }.id
            val pending = h.persisted.queue
            h.repository.reorderItems(listOf(itemId, breadId, breadId, doneId))
            assertEquals(listOf(breadId, newId), h.persisted.orders[listId])
            assertEquals(pending, h.persisted.queue)
            assertTrue(h.requests.isEmpty())
            Harness(h.persisted).use { restored ->
                restored.repository.reorderItems(listOf(breadId, newId))
                assertEquals(listOf(breadId, newId, doneId), restored.repository.state.value.items.map { it.id })
            }
        }
    }

    @Test fun realtimeDeletesAreUnfilteredAndOtherEventsStayScoped() {
        val subscriptions = realtimeSubscriptions(listId).map { it.jsonObject }
        for (table in listOf("shopping_items", "shopping_lists", "list_members")) {
            val entries = subscriptions.filter { it.getValue("table").jsonPrimitive.content == table }
            assertEquals(setOf("INSERT", "UPDATE", "DELETE"), entries.map { it.getValue("event").jsonPrimitive.content }.toSet())
            val deletes = entries.filter { it.getValue("event").jsonPrimitive.content == "DELETE" }
            assertFalse(deletes.single().containsKey("filter"))
            val filter = "${if (table == "shopping_lists") "id" else "list_id"}=eq.$listId"
            assertTrue(entries.filterNot { it in deletes }.all { it.getValue("filter").jsonPrimitive.content == filter })
        }
    }
}
