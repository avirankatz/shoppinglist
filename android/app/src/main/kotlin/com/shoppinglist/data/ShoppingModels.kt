package com.shoppinglist.data

import kotlinx.serialization.Serializable
import java.time.Instant

@Serializable
data class ShoppingList(val id: String, val invite_code: String, val name: String, val owner_id: String)

@Serializable
data class ShoppingItem(val id: String, val list_id: String, val text: String, val checked: Boolean = false, val updated_at: String = "")

data class ShoppingState(
    val list: ShoppingList? = null,
    val items: List<ShoppingItem> = emptyList(),
    val memberCount: Int = 1,
    val userId: String = "",
    val userName: String = "",
    val pendingCount: Int = 0,
    val syncing: Boolean = false,
    val error: String? = null,
)

@Serializable
internal data class Session(val access: String, val refresh: String, val userId: String, val expires: Long)

@Serializable
internal data class Operation(
    val type: String,
    val listId: String,
    val id: String = "",
    val text: String = "",
    val checked: Boolean = false,
    val timestamp: String = "",
)

@Serializable
internal data class Snapshot(
    val session: Session? = null,
    val list: ShoppingList? = null,
    val items: List<ShoppingItem> = emptyList(),
    val members: Int = 1,
    val userName: String = "",
    val queue: List<Operation> = emptyList(),
    val orders: Map<String, List<String>> = emptyMap(),
)

internal fun Snapshot.applyOperations(operations: List<Operation>): Snapshot {
    var result = this
    for (op in operations) {
        require(result.list?.id == op.listId) { "Queued operation belongs to another list" }
        result = when (op.type) {
            "add" -> if (result.items.any { it.id == op.id }) result else result.copy(
                items = result.items + ShoppingItem(op.id, op.listId, op.text, op.checked, op.timestamp),
            )
            "edit" -> result.copy(items = result.items.map { if (it.id == op.id) it.copy(text = op.text, updated_at = op.timestamp) else it })
            "check" -> result.copy(items = result.items.map { if (it.id == op.id) it.copy(checked = op.checked, updated_at = op.timestamp) else it })
            "delete" -> result.copy(items = result.items.filterNot { it.id == op.id })
            "rename" -> result.copy(list = result.list?.copy(name = op.text))
            else -> error("Unknown queued operation: ${op.type}")
        }
    }
    return result
}

internal fun orderedItems(items: List<ShoppingItem>, order: List<String>): List<ShoppingItem> {
    val ranks = order.withIndex().associate { it.value to it.index }
    fun time(item: ShoppingItem) = runCatching { Instant.parse(item.updated_at) }.getOrDefault(Instant.EPOCH)
    return items.filterNot { it.checked }.sortedWith(
        compareBy<ShoppingItem> { ranks[it.id] ?: Int.MAX_VALUE }.thenByDescending { time(it) }.thenBy { it.id },
    ) + items.filter { it.checked }.sortedWith(compareByDescending<ShoppingItem> { time(it) }.thenBy { it.id })
}

internal suspend fun replayQueue(
    next: suspend () -> Operation?,
    send: suspend (Operation) -> Unit,
    acknowledge: suspend (Operation) -> Unit,
) {
    while (true) {
        val operation = next() ?: return
        send(operation)
        acknowledge(operation)
    }
}

// Acknowledge only the exact head; never discard operations appended during a request.
internal fun acknowledge(queue: List<Operation>, sent: Operation): List<Operation> {
    require(queue.firstOrNull() == sent) { "Queue head changed during sync" }
    return queue.drop(1)
}
