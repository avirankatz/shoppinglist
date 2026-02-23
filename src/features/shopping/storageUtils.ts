import type { ShoppingItem, ShoppingList } from "./types";

// ─── Storage keys ───────────────────────────────────────────────────────────

export const STORAGE_SESSION = "family-shopping:session";
export const STORAGE_LANG = "family-shopping:lang";
export const STORAGE_NAME = "family-shopping:name";
export const PERSONAL_ORDER_STORAGE_PREFIX = "family-shopping:order:";

const STORAGE_CACHE_PREFIX = "family-shopping:cache:";
const STORAGE_QUEUE_PREFIX = "family-shopping:queue:";

// ─── Pending operation types ─────────────────────────────────────────────────

export type PendingOperation =
  | { type: "add"; text: string; checked: boolean }
  | { type: "toggle"; itemId: string; checked: boolean }
  | { type: "edit"; itemId: string; text: string }
  | { type: "remove"; itemId: string }
  | { type: "rename"; name: string };

// ─── Cached list state ───────────────────────────────────────────────────────

export type CachedListState = {
  list: ShoppingList;
  items: ShoppingItem[];
  memberCount: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const parseJson = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const parseStoredSession = (): {
  listId: string;
  listName: string;
  inviteCode: string;
} | null =>
  parseJson<{ listId: string; listName: string; inviteCode: string }>(
    localStorage.getItem(STORAGE_SESSION),
  );

// ─── Offline queue ────────────────────────────────────────────────────────────

export const getQueueKey = (listId: string) =>
  `${STORAGE_QUEUE_PREFIX}${listId}`;
export const getCacheKey = (listId: string) =>
  `${STORAGE_CACHE_PREFIX}${listId}`;

export const getPendingQueue = (listId: string): PendingOperation[] =>
  parseJson<PendingOperation[]>(localStorage.getItem(getQueueKey(listId))) ??
  [];

export const setPendingQueue = (listId: string, queue: PendingOperation[]) =>
  localStorage.setItem(getQueueKey(listId), JSON.stringify(queue));

export const enqueueOperation = (
  listId: string,
  operation: PendingOperation,
) => {
  const queue = getPendingQueue(listId);
  queue.push(operation);
  setPendingQueue(listId, queue);
};

// ─── List cache ───────────────────────────────────────────────────────────────

export const setCachedState = (state: CachedListState) =>
  localStorage.setItem(getCacheKey(state.list.id), JSON.stringify(state));

export const getCachedState = (listId: string): CachedListState | null =>
  parseJson<CachedListState>(localStorage.getItem(getCacheKey(listId)));
