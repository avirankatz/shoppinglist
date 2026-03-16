import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabase";
import type { ShoppingItem, ShoppingList } from "../types";
import {
  PERSONAL_ORDER_STORAGE_PREFIX,
  STORAGE_SESSION,
  getCachedState,
  getPendingQueue,
  parseJson,
  parseStoredSession,
  setCachedState,
  setPendingQueue,
} from "../storageUtils";
import type { PendingOperation } from "../storageUtils";

const createInviteCode = () =>
  Array.from(crypto.getRandomValues(new Uint32Array(3)))
    .map((v) => v.toString(36).toUpperCase().slice(0, 4))
    .join("-");

export { createInviteCode };

export function useListSync() {
  const urlJoinCode = useMemo(() => {
    const query = new URLSearchParams(window.location.search);
    return query.get("join")?.toUpperCase() || "";
  }, []);

  const restoredSession = useMemo(() => parseStoredSession(), []);

  const [activeList, setActiveList] = useState<ShoppingList | null>(() => {
    if (
      urlJoinCode &&
      restoredSession &&
      restoredSession.inviteCode.toUpperCase() !== urlJoinCode
    ) {
      return null;
    }
    return restoredSession
      ? {
          id: restoredSession.listId,
          name: restoredSession.listName,
          invite_code: restoredSession.inviteCode,
          owner_id: "",
        }
      : null;
  });

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [memberCount, setMemberCount] = useState(1);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // ─── Online / offline tracking ─────────────────────────────────────────────

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // ─── Load list state from Supabase ─────────────────────────────────────────

  const loadListState = useCallback(async (listId: string) => {
    if (!supabase) return;

    const [listResult, itemsResult, membersResult] = await Promise.all([
      supabase
        .from("shopping_lists")
        .select("id, invite_code, name, owner_id")
        .eq("id", listId)
        .single(),
      supabase
        .from("shopping_items")
        .select("id, list_id, text, checked, updated_at")
        .eq("list_id", listId)
        .order("updated_at", { ascending: false }),
      supabase.from("list_members").select("user_id").eq("list_id", listId),
    ]);

    if (
      listResult.error ||
      !listResult.data ||
      itemsResult.error ||
      !itemsResult.data
    ) {
      const cached = getCachedState(listId);
      if (cached) {
        setActiveList(cached.list);
        setItems(cached.items);
        setMemberCount(cached.memberCount);
      }
      return;
    }

    const nextList = listResult.data as ShoppingList;
    const nextItems = itemsResult.data as ShoppingItem[];
    const nextMemberCount =
      !membersResult.error && membersResult.data
        ? Math.max(1, membersResult.data.length)
        : 1;

    setActiveList(nextList);
    setItems(nextItems);
    setMemberCount(nextMemberCount);
    localStorage.setItem(
      STORAGE_SESSION,
      JSON.stringify({
        listId: nextList.id,
        listName: nextList.name,
        inviteCode: nextList.invite_code,
      }),
    );
    setCachedState({
      list: nextList,
      items: nextItems,
      memberCount: nextMemberCount,
    });
  }, []);

  // ─── Flush offline queue when back online ──────────────────────────────────

  const flushPendingOperations = useCallback(async () => {
    if (!supabase || !activeList || !isOnline) return;

    const queue = getPendingQueue(activeList.id);
    if (queue.length === 0) return;

    const remaining: PendingOperation[] = [];

    for (const op of queue) {
      if (op.type === "add") {
        const { error } = await supabase.from("shopping_items").insert({
          list_id: activeList.id,
          text: op.text,
          checked: op.checked,
        });
        if (error) {
          remaining.push(op);
          break;
        }
      }

      if (op.type === "toggle") {
        if (op.itemId.startsWith("local-")) continue;
        const { error } = await supabase
          .from("shopping_items")
          .update({ checked: op.checked })
          .eq("id", op.itemId);
        if (error) {
          remaining.push(op);
          break;
        }
      }

      if (op.type === "remove") {
        if (op.itemId.startsWith("local-")) continue;
        const { error } = await supabase
          .from("shopping_items")
          .delete()
          .eq("id", op.itemId);
        if (error) {
          remaining.push(op);
          break;
        }
      }

      if (op.type === "edit") {
        if (op.itemId.startsWith("local-")) continue;
        const { error } = await supabase
          .from("shopping_items")
          .update({ text: op.text })
          .eq("id", op.itemId);
        if (error) {
          remaining.push(op);
          break;
        }
      }

      if (op.type === "rename") {
        const { error } = await supabase
          .from("shopping_lists")
          .update({ name: op.name })
          .eq("id", activeList.id);
        if (error) {
          remaining.push(op);
          break;
        }
      }
    }

    setPendingQueue(activeList.id, remaining);
    await loadListState(activeList.id);
  }, [activeList, isOnline, loadListState]);

  // ─── Load from cache and saved order when list changes ─────────────────────

  useEffect(() => {
    if (!activeList?.id) {
      setLocalOrder([]);
      return;
    }
    const cached = getCachedState(activeList.id);
    if (cached) {
      setItems(cached.items);
      setMemberCount(cached.memberCount);
      setActiveList(cached.list);
    }
    const savedOrder = localStorage.getItem(
      `${PERSONAL_ORDER_STORAGE_PREFIX}${activeList.id}`,
    );
    setLocalOrder(parseJson<string[]>(savedOrder) ?? []);
  }, [activeList?.id]);

  // ─── Initial fetch when list changes ───────────────────────────────────────

  useEffect(() => {
    if (!activeList?.id) return;
    void loadListState(activeList.id);
  }, [activeList?.id, loadListState]);

  // ─── Flush pending when back online ────────────────────────────────────────

  useEffect(() => {
    void flushPendingOperations();
  }, [flushPendingOperations, isOnline]);

  // ─── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    if (!supabase || !activeList?.id) {
      if (channelRef.current) {
        void supabase?.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const client = supabase;
    const channel = client
      .channel(`list-${activeList.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_items",
          filter: `list_id=eq.${activeList.id}`,
        },
        () => {
          void loadListState(activeList.id);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_lists",
          filter: `id=eq.${activeList.id}`,
        },
        () => {
          void loadListState(activeList.id);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "list_members",
          filter: `list_id=eq.${activeList.id}`,
        },
        () => {
          void loadListState(activeList.id);
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        void client.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [activeList?.id, loadListState]);

  // ─── Derived values ────────────────────────────────────────────────────────

  const sortedItems = useMemo(() => {
    const unchecked = items.filter((i) => !i.checked);
    const checked = items.filter((i) => i.checked);

    const orderedUnchecked = [...unchecked].sort((a, b) => {
      const aIdx = localOrder.indexOf(a.id);
      const bIdx = localOrder.indexOf(b.id);
      if (aIdx === -1 && bIdx === -1)
        return (
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      if (aIdx === -1) return 1; // not in saved order → put at end
      if (bIdx === -1) return -1; // not in saved order → put at end
      return aIdx - bIdx;
    });

    const sortedChecked = [...checked].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );

    return [...orderedUnchecked, ...sortedChecked];
  }, [items, localOrder]);

  const inviteLink = useMemo(() => {
    if (!activeList) return "";
    const url = new URL(window.location.href);
    url.searchParams.set("join", activeList.invite_code);
    url.hash = "";
    return url.toString();
  }, [activeList]);

  return {
    urlJoinCode,
    activeList,
    setActiveList,
    items,
    setItems,
    memberCount,
    localOrder,
    setLocalOrder,
    isOnline,
    sortedItems,
    inviteLink,
    loadListState,
  };
}
