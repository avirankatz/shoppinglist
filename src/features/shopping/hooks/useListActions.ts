import { useCallback, useState, useTransition } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ShoppingItem, ShoppingList } from "../types";
import { supabase } from "../../../lib/supabase";
import { enqueueOperation, STORAGE_SESSION } from "../storageUtils";
import type { textByLanguage, Language } from "../copy";

type TextMap = (typeof textByLanguage)[Language];

export function useListActions({
  activeList,
  setActiveList,
  isOnline,
  loadListState,
  setItems,
  setNewItemText,
  t,
  setErrorText,
}: {
  activeList: ShoppingList | null;
  setActiveList: Dispatch<SetStateAction<ShoppingList | null>>;
  isOnline: boolean;
  loadListState: (listId: string) => Promise<void>;
  setItems: Dispatch<SetStateAction<ShoppingItem[]>>;
  setNewItemText: Dispatch<SetStateAction<string>>;
  t: TextMap;
  setErrorText: (v: string) => void;
}) {
  const [listRename, setListRename] = useState("");
  const [isPending, startTransition] = useTransition();

  const renameList = useCallback(async () => {
    if (!supabase || !activeList) return;
    const trimmed = listRename.trim();
    if (!trimmed) return;

    setActiveList((cur) => (cur ? { ...cur, name: trimmed } : cur));

    if (!isOnline) {
      enqueueOperation(activeList.id, { type: "rename", name: trimmed });
      setListRename("");
      setErrorText(t.offlineQueued);
      return;
    }

    const { error } = await supabase
      .from("shopping_lists")
      .update({ name: trimmed })
      .eq("id", activeList.id);

    if (!error) {
      setListRename("");
      return;
    }
    setErrorText(t.saveFailed);
    await loadListState(activeList.id);
  }, [
    activeList,
    isOnline,
    listRename,
    loadListState,
    setActiveList,
    t,
    setErrorText,
  ]);

  const resetApp = useCallback(() => {
    startTransition(() => {
      setActiveList(null);
      setItems([]);
      setNewItemText("");
      localStorage.removeItem(STORAGE_SESSION);
    });
  }, [setActiveList, setItems, setNewItemText]);

  return {
    listRename,
    setListRename,
    renameList,
    resetApp,
    isPending,
  };
}
