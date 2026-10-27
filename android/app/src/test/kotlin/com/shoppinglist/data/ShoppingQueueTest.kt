package com.shoppinglist.data

import kotlinx.serialization.json.Json
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.CancellationException
import java.io.IOException
import org.junit.Assert.*
import org.junit.Test

class ShoppingQueueTest {
    private val list = ShoppingList("list", "CODE", "Groceries", "owner")
    private val base = Snapshot(list = list)
    private fun op(type: String, id: String = "item", text: String = "", checked: Boolean = false) =
        Operation(type, list.id, id, text, checked, "2026-10-12T10:00:00Z")

    @Test fun failedReplayStopsBeforeTailAndRetriesInOrder() = runBlocking {
        val operations = listOf(op("add", text = "Milk"), op("edit", text = "Oat milk"), op("check", checked = true))
        var queue = operations
        val attempts = mutableListOf<Operation>()
        try {
            replayQueue({ queue.firstOrNull() }, {
                attempts += it
                if (it.type == "edit") throw IOException("Offline")
            }, { queue = acknowledge(queue, it) })
            fail("Expected network failure")
        } catch (_: IOException) { }
        assertEquals(operations.take(2), attempts)
        assertEquals(operations.drop(1), queue)
        replayQueue({ queue.firstOrNull() }, { attempts += it }, { queue = acknowledge(queue, it) })
        assertTrue(queue.isEmpty())
        assertEquals(listOf("add", "edit", "edit", "check"), attempts.map { it.type })
    }

    @Test fun cancellationRetainsAmbiguousRequestAndConcurrentTail() = runBlocking {
        val add = op("add", id = "7e36da56-5576-4d54-a99d-37d00bcaec17", text = "Milk")
        val edit = op("edit", id = add.id, text = "Oat milk")
        var queue = listOf(add)
        try {
            replayQueue({ queue.firstOrNull() }, {
                queue = queue + edit
                throw CancellationException("Caller stopped after server accepted add")
            }, { queue = acknowledge(queue, it) })
            fail("Expected cancellation")
        } catch (_: CancellationException) { }
        assertEquals(listOf(add, edit), queue)
        var server = base.applyOperations(listOf(add))
        replayQueue({ queue.firstOrNull() }, { server = server.applyOperations(listOf(it)) }, { queue = acknowledge(queue, it) })
        assertEquals(1, server.items.size)
        assertEquals(add.id, server.items.single().id)
        assertEquals("Oat milk", server.items.single().text)
    }

    @Test fun offlineAddEditToggleSurvivesSerializationAndKeepsIdentity() {
        val queue = listOf(op("add", text = "Milk"), op("edit", text = "Oat milk"), op("check", checked = true))
        val json = Json { encodeDefaults = true }
        val session = Session("access", "refresh", "owner", 1_800_000_000)
        val restored = json.decodeFromString<Snapshot>(json.encodeToString(Snapshot.serializer(), base.copy(session = session, queue = queue)))
        val applied = restored.applyOperations(restored.queue)
        assertEquals(session, applied.session)
        assertEquals(listOf(ShoppingItem("item", "list", "Oat milk", true, queue.last().timestamp)), applied.items)
        assertEquals(queue, applied.queue)
    }

    @Test fun legacyLanguageIsIgnoredWithoutLosingSnapshotData() {
        val snapshot = base.copy(
            session = Session("access", "refresh", "owner", 1_800_000_000),
            items = listOf(ShoppingItem("item", list.id, "Milk")),
            members = 2,
            userName = "Alex",
            queue = listOf(op("edit", text = "Oat milk")),
            orders = mapOf(list.id to listOf("item")),
        )
        val encoded = dataJson.encodeToString(Snapshot.serializer(), snapshot)
        val legacy = "{\"language\":\"he\"," + encoded.drop(1)
        val restored = dataJson.decodeFromString<Snapshot>(legacy)
        assertEquals(snapshot, restored)
        assertFalse(dataJson.encodeToString(Snapshot.serializer(), restored).contains("\"language\""))
    }

    @Test fun deleteAfterUnsentAddDoesNotResurrectItem() {
        val queue = listOf(op("add", text = "Milk"), op("delete"))
        assertTrue(base.applyOperations(queue).items.isEmpty())
        val serverAfterAdd = base.applyOperations(queue.take(1))
        assertTrue(serverAfterAdd.applyOperations(queue.drop(1)).items.isEmpty())
    }

    @Test fun replayDuplicateAddDoesNotOverwriteServerItem() {
        val server = base.copy(items = listOf(ShoppingItem("item", "list", "Remote edit")))
        assertEquals(server.items, server.applyOperations(listOf(op("add", text = "Old text"))).items)
    }

    @Test fun acknowledgedPrefixRetainsFailedHeadTailAndConcurrentAppend() {
        val first = op("add", text = "Milk")
        val failed = op("edit", text = "Oat milk")
        val tail = op("check", checked = true)
        val appended = op("rename", text = "New name")
        val remaining = acknowledge(listOf(first, failed, tail, appended), first)
        assertEquals(listOf(failed, tail, appended), remaining)
        assertEquals("New name", base.applyOperations(listOf(first) + remaining).list?.name)
    }

    @Test(expected = IllegalArgumentException::class)
    fun cannotAcknowledgeOutOfOrder() {
        acknowledge(listOf(op("add"), op("delete")), op("delete"))
    }

    @Test(expected = IllegalArgumentException::class)
    fun cannotReplayQueueAgainstAnotherList() {
        base.applyOperations(listOf(op("add").copy(listId = "other")))
    }

    @Test fun personalOrderOnlyAppliesToUncheckedAndTimestampsUseInstants() {
        val items = listOf(
            ShoppingItem("a", "list", "A", updated_at = "2026-10-12T10:00:00Z"),
            ShoppingItem("b", "list", "B", updated_at = "2026-10-12T11:00:00Z"),
            ShoppingItem("c", "list", "C", true, "2026-10-12T12:00:00+02:00"),
            ShoppingItem("d", "list", "D", true, "2026-10-12T10:30:00Z"),
            ShoppingItem("e", "list", "E", updated_at = "invalid"),
        )
        assertEquals(listOf("a", "b", "e", "d", "c"), orderedItems(items, listOf("missing", "c", "a")).map { it.id })
    }

    @Test fun pendingEditsOverlayFreshRemoteState() {
        val server = base.copy(items = listOf(ShoppingItem("item", "list", "Server"), ShoppingItem("remote", "list", "Other")))
        val result = server.applyOperations(listOf(op("edit", text = "Offline"), op("rename", text = "Home")))
        assertEquals(listOf("Offline", "Other"), result.items.map { it.text })
        assertEquals("Home", result.list?.name)
    }
}
