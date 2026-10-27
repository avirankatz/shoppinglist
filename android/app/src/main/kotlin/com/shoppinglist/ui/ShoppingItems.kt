package com.shoppinglist.ui

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.key.*
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.shoppinglist.R
import com.shoppinglist.data.ShoppingItem
import com.shoppinglist.data.ShoppingState
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState

internal fun movedItemIds(ids: List<String>, fromId: String, toId: String): List<String> {
    val from = ids.indexOf(fromId)
    val to = ids.indexOf(toId)
    if (from < 0 || to < 0 || from == to) return ids
    return ids.toMutableList().apply { add(to, removeAt(from)) }
}

@Composable
internal fun ShoppingItems(
    state: ShoppingState,
    busy: Boolean,
    onCheck: (ShoppingItem) -> Unit,
    onEdit: (ShoppingItem) -> Unit,
    onDelete: (ShoppingItem) -> Unit,
    onReorder: (List<String>, () -> Unit) -> Unit,
    onClear: () -> Unit,
    onRestore: () -> Unit,
) {
    var previewOrder by remember(state.list?.id) { mutableStateOf<List<String>?>(null) }
    val pending = state.items.filterNot { it.checked }
    val ranks = previewOrder?.withIndex()?.associate { it.value to it.index }
    val unchecked = if (ranks == null) pending else pending.sortedBy { ranks[it.id] ?: Int.MAX_VALUE }
    val checked = state.items.filter { it.checked }
    val ids = unchecked.map { it.id }
    val haptic = LocalHapticFeedback.current
    val listState = rememberLazyListState()
    val reorderable = rememberReorderableLazyListState(listState) { from, to ->
        previewOrder = movedItemIds(ids, from.key as String, to.key as String)
        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
    }
    val enabled = !busy && !reorderable.isAnyItemDragging
    val moveUp = text(R.string.move_up)
    val moveDown = text(R.string.move_down)

    fun saveOrder(order: List<String>) {
        // Preview changes synchronously during a drag; persist only once on release.
        previewOrder = order
        onReorder(order) { previewOrder = null }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(), state = listState,
        contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            Text(text(R.string.list_counts, unchecked.size, checked.size, state.memberCount), style = MaterialTheme.typography.bodyMedium)
            if (state.pendingCount > 0) Text(
                text(R.string.pending_changes, state.pendingCount),
                Modifier.padding(top = 8.dp).semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.primary,
            )
            Text(text(R.string.personal_order), Modifier.padding(top = 8.dp), style = MaterialTheme.typography.bodySmall)
        }
        if (state.items.isEmpty()) item { Text(text(R.string.no_items), Modifier.padding(vertical = 32.dp)) }
        if (unchecked.isNotEmpty()) item { SectionTitle(text(R.string.needs_buying)) }
        itemsIndexed(unchecked, key = { _, item -> item.id }) { index, item ->
            val actions = if (!enabled) emptyList() else buildList {
                if (index > 0) add(CustomAccessibilityAction(moveUp) {
                    saveOrder(movedItemIds(ids, item.id, ids[index - 1])); true
                })
                if (index < ids.lastIndex) add(CustomAccessibilityAction(moveDown) {
                    saveOrder(movedItemIds(ids, item.id, ids[index + 1])); true
                })
            }
            ReorderableItem(reorderable, key = item.id) { dragging ->
                ItemRow(
                    item, enabled,
                    onCheck = { onCheck(item) }, onEdit = { onEdit(item) }, onDelete = { onDelete(item) },
                    isDragging = dragging, reorderActions = actions,
                    dragHandle = {
                        val label = text(R.string.reorder_item, item.text)
                        Box(
                            Modifier.size(48.dp)
                                .draggableHandle(
                                    enabled = !busy,
                                    onDragStarted = {
                                        previewOrder = ids
                                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                    },
                                    onDragStopped = { previewOrder?.let(::saveOrder) },
                                )
                                .onKeyEvent { event ->
                                    val offset = when (event.key) { Key.DirectionUp -> -1; Key.DirectionDown -> 1; else -> 0 }
                                    val target = ids.getOrNull(index + offset)
                                    if (enabled && event.type == KeyEventType.KeyDown && offset != 0 && target != null) {
                                        saveOrder(movedItemIds(ids, item.id, target)); true
                                    } else false
                                }
                                .focusable(enabled)
                                .semantics {
                                    contentDescription = label
                                    customActions = actions
                                    if (busy) disabled()
                                },
                            contentAlignment = Alignment.Center,
                        ) { Icon(painterResource(R.drawable.ic_drag_handle), contentDescription = null) }
                    },
                )
            }
        }
        if (checked.isNotEmpty()) {
            item { SectionTitle(text(R.string.done)) }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = onClear, enabled = enabled) { Text(text(R.string.clear_done)) }
                    TextButton(onClick = onRestore, enabled = enabled) { Text(text(R.string.restore_done)) }
                }
            }
            items(checked, key = { it.id }) { item ->
                ItemRow(item, enabled, onCheck = { onCheck(item) }, onEdit = { onEdit(item) }, onDelete = { onDelete(item) })
            }
        }
    }
}

@Composable
internal fun ItemRow(
    item: ShoppingItem, enabled: Boolean,
    onCheck: () -> Unit, onEdit: () -> Unit, onDelete: () -> Unit,
    isDragging: Boolean = false,
    reorderActions: List<CustomAccessibilityAction> = emptyList(),
    dragHandle: (@Composable () -> Unit)? = null,
) {
    var menu by remember { mutableStateOf(false) }
    val elevation by animateDpAsState(if (isDragging) 6.dp else 0.dp, label = "Drag elevation")
    Surface(shape = MaterialTheme.shapes.medium, tonalElevation = 1.dp, shadowElevation = elevation) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            dragHandle?.invoke()
            Row(
                Modifier.weight(1f).heightIn(min = 56.dp)
                    .toggleable(item.checked, enabled = enabled, role = Role.Checkbox, onValueChange = { onCheck() })
                    .semantics { customActions = reorderActions }
                    .padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(item.checked, onCheckedChange = null, enabled = enabled, modifier = Modifier.padding(horizontal = 12.dp))
                Text(item.text, Modifier.padding(end = 8.dp),
                    textDecoration = if (item.checked) TextDecoration.LineThrough else null,
                    color = if (item.checked) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface)
            }
            Box {
                IconButton(onClick = { menu = true }, enabled = enabled) {
                    Icon(Icons.Default.MoreVert, text(R.string.item_actions, item.text))
                }
                DropdownMenu(menu, onDismissRequest = { menu = false }) {
                    DropdownMenuItem(text = { Text(text(R.string.edit_item)) }, enabled = enabled, onClick = { menu = false; onEdit() })
                    DropdownMenuItem(text = { Text(text(R.string.delete_item)) }, enabled = enabled, onClick = { menu = false; onDelete() })
                }
            }
        }
    }
}
