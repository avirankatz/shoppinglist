package com.shoppinglist.data

import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.HttpUrl.Companion.toHttpUrl
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import java.util.concurrent.atomic.AtomicLong

internal fun realtimeSubscriptions(listId: String): JsonArray = buildJsonArray {
    for (table in listOf("shopping_items", "shopping_lists", "list_members")) {
        for (event in listOf("INSERT", "UPDATE", "DELETE")) add(buildJsonObject {
            put("event", event); put("schema", "public"); put("table", table)
            // Supabase cannot filter DELETE events; any visible delete invalidates the list.
            if (event != "DELETE") put("filter", "${if (table == "shopping_lists") "id" else "list_id"}=eq.$listId")
        })
    }
}

internal class RealtimeInvalidation(
    private val api: SupabaseTransport,
    private val scope: CoroutineScope,
    private val invalidate: suspend () -> Unit,
    private val report: (String) -> Unit,
) {
    private var job: Job? = null
    private var identity: Pair<String, String>? = null
    private val refs = AtomicLong()

    @Synchronized fun start(listId: String, token: String, expires: Long) {
        val next = listId to token
        if (identity == next && job?.isActive == true) return
        stop()
        identity = next
        job = scope.launch {
            var backoff = 1_000L
            while (isActive) {
                val ended = CompletableDeferred<Unit>()
                val changes = Channel<Unit>(Channel.CONFLATED)
                val topic = "realtime:list-$listId"
                val heartbeat = AtomicReference<String?>(null)
                val joined = AtomicBoolean(false)
                val socket = api.client.newWebSocket(Request.Builder().url(
                    api.url.toHttpUrl().newBuilder().addPathSegments("realtime/v1/websocket")
                        .addQueryParameter("apikey", api.key).addQueryParameter("vsn", "1.0.0").build(),
                ).build(), object : WebSocketListener() {
                    override fun onOpen(webSocket: WebSocket, response: Response) {
                        webSocket.send(frame(topic, "phx_join", buildJsonObject {
                            put("access_token", token)
                            put("config", buildJsonObject {
                                put("broadcast", buildJsonObject { put("self", false) })
                                put("presence", buildJsonObject { put("key", "") })
                                put("postgres_changes", realtimeSubscriptions(listId))
                            })
                        }, refs.incrementAndGet().toString()))
                    }
                    override fun onMessage(webSocket: WebSocket, text: String) {
                        try {
                            val message = dataJson.parseToJsonElement(text).jsonObject
                            when (message["event"]?.jsonPrimitive?.content) {
                                "postgres_changes" -> changes.trySend(Unit)
                                "phx_reply" -> {
                                    heartbeat.compareAndSet(message["ref"]?.jsonPrimitive?.content, null)
                                    if (message["topic"]?.jsonPrimitive?.content == topic) {
                                        val payload = message.getValue("payload").jsonObject
                                        if (payload["status"]?.jsonPrimitive?.content != "ok") {
                                            report("Realtime subscription rejected; foreground sync remains available")
                                            ended.complete(Unit)
                                        } else { joined.set(true); changes.trySend(Unit) }
                                    }
                                }
                                "phx_error", "phx_close" -> ended.complete(Unit)
                                "system" -> {
                                    val payload = message["payload"]?.jsonObject
                                    if (payload?.get("status")?.jsonPrimitive?.content == "error") {
                                        report("Realtime unavailable; foreground sync remains available")
                                        ended.complete(Unit)
                                    }
                                }
                            }
                        } catch (_: Exception) {
                            report("Invalid realtime message; reconnecting")
                            ended.complete(Unit)
                        }
                    }
                    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) { ended.complete(Unit) }
                    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) { ended.complete(Unit) }
                    override fun onClosing(webSocket: WebSocket, code: Int, reason: String) { ended.complete(Unit) }
                })
                val consumer = launch { for (change in changes) { delay(200); invalidate() } }
                val refresh = launch {
                    delay(((expires - java.time.Instant.now().epochSecond - 45) * 1_000).coerceAtLeast(1_000))
                    invalidate()
                    // Failed refresh must not leave a stale authenticated socket running forever.
                    ended.complete(Unit)
                }
                val pulse = launch {
                    delay(10_000)
                    if (!joined.get()) { ended.complete(Unit); return@launch }
                    while (isActive) {
                        if (heartbeat.get() != null) { ended.complete(Unit); break }
                        val ref = refs.incrementAndGet().toString()
                        heartbeat.set(ref)
                        if (!socket.send(frame("phoenix", "heartbeat", buildJsonObject {}, ref))) { ended.complete(Unit); break }
                        delay(25_000)
                    }
                }
                try { ended.await() } finally {
                    refresh.cancel(); pulse.cancel(); consumer.cancel(); changes.close(); socket.cancel()
                }
                if (joined.get()) backoff = 1_000
                delay(backoff)
                backoff = (backoff * 2).coerceAtMost(30_000)
                // Sync refreshes expiring auth and replaces this connection when its token changes.
                invalidate()
            }
        }
    }

    @Synchronized fun stop() { identity = null; job?.cancel(); job = null }

    private fun frame(topic: String, event: String, payload: JsonObject, ref: String) = buildJsonObject {
        put("topic", topic); put("event", event); put("payload", payload); put("ref", ref)
    }.toString()
}
