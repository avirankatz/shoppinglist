import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ShoppingItem, ShoppingList } from "../types";
import { supabase } from "../../../lib/supabase";
import {
  PERSONAL_ORDER_STORAGE_PREFIX,
  enqueueOperation,
} from "../storageUtils";
import type { textByLanguage, Language } from "../copy";

type TextMap = (typeof textByLanguage)[Language];

const createLocalId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `local-${crypto.randomUUID()}`
    : `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export function useItemActions({
  activeList,
  isOnline,
  items,
  setItems,
  sortedItems,
  setLocalOrder,
  loadListState,
  t,
  setErrorText,
}: {
  activeList: ShoppingList | null;
  isOnline: boolean;
  items: ShoppingItem[];
  setItems: Dispatch<SetStateAction<ShoppingItem[]>>;
  sortedItems: ShoppingItem[];
  setLocalOrder: Dispatch<SetStateAction<string[]>>;
  loadListState: (listId: string) => Promise<void>;
  t: TextMap;
  setErrorText: (v: string) => void;
}) {
  const [newItemText, setNewItemText] = useState("");

  // rerender-defer-reads: keep items in a ref so removeAll/restoreAll don't
  // subscribe to item-level re-renders just to read IDs at call time
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const addItem = useCallback(async () => {
    if (!supabase || !activeList) return;
    const trimmed = newItemText.trim();
    if (!trimmed) return;
    setErrorText("");

    if (!isOnline) {
      const localItem: ShoppingItem = {
        id: createLocalId(),
        list_id: activeList.id,
        text: trimmed,
        checked: false,
        updated_at: new Date().toISOString(),
      };
      setItems((cur) => [localItem, ...cur]);
      enqueueOperation(activeList.id, {
        type: "add",
        text: trimmed,
        checked: false,
      });
      setNewItemText("");
      setErrorText(t.offlineQueued);
      return;
    }

    const { error, data } = await supabase
      .from("shopping_items")
      .insert({ list_id: activeList.id, text: trimmed, checked: false })
      .select();

    if (!error && data && data.length > 0) {
      const serverItem = data[0] as ShoppingItem;
      setItems((cur) =>
        cur.some((i) => i.id === serverItem.id) ? cur : [serverItem, ...cur],
      );
      setNewItemText("");
      return;
    }
    if (!error) {
      void loadListState(activeList.id);
      setNewItemText("");
      return;
    }
    setErrorText(t.saveFailed);
  }, [
    activeList,
    isOnline,
    newItemText,
    t,
    loadListState,
    setItems,
    setErrorText,
  ]);

  const toggleItem = useCallback(
    async (item: ShoppingItem) => {
      if (!supabase || !activeList) return;
      const nextChecked = !item.checked;
      setItems((cur) =>
        cur.map((i) =>
          i.id === item.id
            ? {
                ...i,
                checked: nextChecked,
                ...(nextChecked && { updated_at: new Date().toISOString() }),
              }
            : i,
        ),
      );

      if (!isOnline || item.id.startsWith("local-")) {
        enqueueOperation(activeList.id, {
          type: "toggle",
          itemId: item.id,
          checked: nextChecked,
        });
        setErrorText(t.offlineQueued);
        return;
      }

      const { error } = await supabase
        .from("shopping_items")
        .update({ checked: nextChecked })
        .eq("id", item.id);
      if (error) {
        setErrorText(t.saveFailed);
        await loadListState(activeList.id);
      }
    },
    [activeList, isOnline, loadListState, setItems, t, setErrorText],
  );

  const removeItem = useCallback(
    async (id: string) => {
      if (!supabase || !activeList) return;
      setItems((cur) => cur.filter((i) => i.id !== id));

      if (!isOnline || id.startsWith("local-")) {
        enqueueOperation(activeList.id, { type: "remove", itemId: id });
        setErrorText(t.offlineQueued);
        return;
      }

      const { error } = await supabase
        .from("shopping_items")
        .delete()
        .eq("id", id);
      if (error) {
        setErrorText(t.saveFailed);
        await loadListState(activeList.id);
      }
    },
    [activeList, isOnline, loadListState, setItems, t, setErrorText],
  );

  const editItem = useCallback(
    async (id: string, text: string) => {
      if (!supabase || !activeList) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      setItems((cur) =>
        cur.map((item) =>
          item.id === id
            ? { ...item, text: trimmed, updated_at: new Date().toISOString() }
            : item,
        ),
      );

      if (!isOnline || id.startsWith("local-")) {
        enqueueOperation(activeList.id, {
          type: "edit",
          itemId: id,
          text: trimmed,
        });
        setErrorText(t.offlineQueued);
        return;
      }

      const { error } = await supabase
        .from("shopping_items")
        .update({ text: trimmed })
        .eq("id", id);
      if (error) {
        setErrorText(t.saveFailed);
        await loadListState(activeList.id);
      }
    },
    [activeList, isOnline, loadListState, setItems, t, setErrorText],
  );

  const reorderItems = useCallback(
    (sourceIndex: number, destinationIndex: number) => {
      if (sourceIndex === destinationIndex || !activeList) return;
      const uncheckedItems = sortedItems.filter((i) => !i.checked);
      const newOrder = uncheckedItems.map((i) => i.id);
      const [removed] = newOrder.splice(sourceIndex, 1);
      newOrder.splice(destinationIndex, 0, removed);
      setLocalOrder(newOrder);
      localStorage.setItem(
        `${PERSONAL_ORDER_STORAGE_PREFIX}${activeList.id}`,
        JSON.stringify(newOrder),
      );
    },
    [activeList, sortedItems, setLocalOrder],
  );

  // rerender-defer-reads: read from ref so callbacks aren't recreated on every item change
  const removeAllDoneItems = useCallback(async () => {
    if (!supabase || !activeList) return;
    const doneIds = itemsRef.current.filter((i) => i.checked).map((i) => i.id);
    if (doneIds.length === 0) return;
    setItems((cur) => cur.filter((i) => !i.checked));

    const localIds = doneIds.filter((id) => id.startsWith("local-"));
    const remoteIds = doneIds.filter((id) => !id.startsWith("local-"));

    for (const id of localIds) {
      enqueueOperation(activeList.id, { type: "remove", itemId: id });
    }

    if (!isOnline || remoteIds.length === 0) {
      if (doneIds.length > 0) setErrorText(t.offlineQueued);
      return;
    }

    const { error } = await supabase
      .from("shopping_items")
      .delete()
      .in("id", remoteIds);
    if (error) {
      setErrorText(t.saveFailed);
      await loadListState(activeList.id);
    }
  }, [activeList, isOnline, loadListState, setItems, t, setErrorText]);

  // rerender-defer-reads: same ref pattern — items not in deps
  const restoreAllDoneItems = useCallback(async () => {
    if (!supabase || !activeList) return;
    const doneItems = itemsRef.current.filter((i) => i.checked);
    if (doneItems.length === 0) return;
    setItems((cur) =>
      cur.map((i) => (i.checked ? { ...i, checked: false } : i)),
    );

    const localIds = doneItems
      .filter((i) => i.id.startsWith("local-"))
      .map((i) => i.id);
    const remoteIds = doneItems
      .filter((i) => !i.id.startsWith("local-"))
      .map((i) => i.id);

    for (const id of localIds) {
      enqueueOperation(activeList.id, {
        type: "toggle",
        itemId: id,
        checked: false,
      });
    }

    if (!isOnline || remoteIds.length === 0) {
      if (doneItems.length > 0) setErrorText(t.offlineQueued);
      return;
    }

    const { error } = await supabase
      .from("shopping_items")
      .update({ checked: false })
      .in("id", remoteIds);
    if (error) {
      setErrorText(t.saveFailed);
      await loadListState(activeList.id);
    }
  }, [activeList, isOnline, loadListState, setItems, t, setErrorText]);

  return {
    newItemText,
    setNewItemText,
    addItem,
    toggleItem,
    editItem,
    removeItem,
    reorderItems,
    removeAllDoneItems,
    restoreAllDoneItems,
  };
}
