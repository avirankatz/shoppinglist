import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  parseJson,
  parseStoredSession,
  getPendingQueue,
  setPendingQueue,
  enqueueOperation,
  getCachedState,
  setCachedState,
  getQueueKey,
  getCacheKey,
  STORAGE_SESSION,
  STORAGE_LANG,
  STORAGE_NAME,
  PERSONAL_ORDER_STORAGE_PREFIX,
} from "../storageUtils";
import type { ShoppingItem, ShoppingList } from "../types";

const MOCK_LIST: ShoppingList = {
  id: "list-1",
  invite_code: "ABCD-EFGH-IJKL",
  name: "Test List",
  owner_id: "user-1",
};

const MOCK_ITEM: ShoppingItem = {
  id: "item-1",
  list_id: "list-1",
  text: "Milk",
  checked: false,
  updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

// ─── Storage constants ────────────────────────────────────────────────────────

describe("storage key constants", () => {
  it("exports correct key prefixes", () => {
    expect(STORAGE_SESSION).toBe("family-shopping:session");
    expect(STORAGE_LANG).toBe("family-shopping:lang");
    expect(STORAGE_NAME).toBe("family-shopping:name");
    expect(PERSONAL_ORDER_STORAGE_PREFIX).toBe("family-shopping:order:");
  });

  it("getQueueKey returns correct key", () => {
    expect(getQueueKey("list-1")).toBe("family-shopping:queue:list-1");
  });

  it("getCacheKey returns correct key", () => {
    expect(getCacheKey("list-1")).toBe("family-shopping:cache:list-1");
  });
});

// ─── parseJson ────────────────────────────────────────────────────────────────

describe("parseJson", () => {
  it("parses valid JSON", () => {
    expect(parseJson<{ x: number }>('{"x":1}')).toEqual({ x: 1 });
  });

  it("returns null for null input", () => {
    expect(parseJson(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseJson("")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseJson("not-json")).toBeNull();
  });
});

// ─── parseStoredSession ───────────────────────────────────────────────────────

describe("parseStoredSession", () => {
  it("returns null when nothing is stored", () => {
    expect(parseStoredSession()).toBeNull();
  });

  it("returns the stored session object", () => {
    const session = {
      listId: "list-1",
      listName: "Test",
      inviteCode: "ABCD-1234-WXYZ",
    };
    localStorage.setItem(STORAGE_SESSION, JSON.stringify(session));
    expect(parseStoredSession()).toEqual(session);
  });

  it("returns null when stored value is malformed", () => {
    localStorage.setItem(STORAGE_SESSION, "corrupted");
    expect(parseStoredSession()).toBeNull();
  });
});

// ─── Offline queue ─────────────────────────────────────────────────────────────

describe("getPendingQueue", () => {
  it("returns empty array when queue does not exist", () => {
    expect(getPendingQueue("list-1")).toEqual([]);
  });

  it("returns stored queue", () => {
    const queue = [{ type: "add" as const, text: "Eggs", checked: false }];
    localStorage.setItem(getQueueKey("list-1"), JSON.stringify(queue));
    expect(getPendingQueue("list-1")).toEqual(queue);
  });
});

describe("setPendingQueue", () => {
  it("writes queue to localStorage", () => {
    const queue = [{ type: "remove" as const, itemId: "item-1" }];
    setPendingQueue("list-1", queue);
    expect(getPendingQueue("list-1")).toEqual(queue);
  });

  it("overwrites existing queue", () => {
    setPendingQueue("list-1", [{ type: "remove" as const, itemId: "a" }]);
    setPendingQueue("list-1", [{ type: "remove" as const, itemId: "b" }]);
    expect(getPendingQueue("list-1")).toEqual([
      { type: "remove", itemId: "b" },
    ]);
  });
});

describe("enqueueOperation", () => {
  it("appends an operation to an empty queue", () => {
    enqueueOperation("list-1", { type: "add", text: "Bread", checked: false });
    expect(getPendingQueue("list-1")).toHaveLength(1);
    expect(getPendingQueue("list-1")[0]).toMatchObject({
      type: "add",
      text: "Bread",
    });
  });

  it("appends multiple operations in order", () => {
    enqueueOperation("list-1", { type: "add", text: "Bread", checked: false });
    enqueueOperation("list-1", {
      type: "toggle",
      itemId: "item-1",
      checked: true,
    });
    enqueueOperation("list-1", { type: "remove", itemId: "item-1" });

    const queue = getPendingQueue("list-1");
    expect(queue).toHaveLength(3);
    expect(queue[0].type).toBe("add");
    expect(queue[1].type).toBe("toggle");
    expect(queue[2].type).toBe("remove");
  });

  it("does not affect queues of other lists", () => {
    enqueueOperation("list-1", { type: "add", text: "A", checked: false });
    expect(getPendingQueue("list-2")).toHaveLength(0);
  });

  it("supports all operation types", () => {
    enqueueOperation("list-1", { type: "add", text: "A", checked: false });
    enqueueOperation("list-1", { type: "toggle", itemId: "i", checked: true });
    enqueueOperation("list-1", { type: "edit", itemId: "i", text: "B" });
    enqueueOperation("list-1", { type: "remove", itemId: "i" });
    enqueueOperation("list-1", { type: "rename", name: "New Name" });
    expect(getPendingQueue("list-1")).toHaveLength(5);
  });
});

// ─── List cache ───────────────────────────────────────────────────────────────

describe("getCachedState / setCachedState", () => {
  it("returns null if no cache entry", () => {
    expect(getCachedState("list-1")).toBeNull();
  });

  it("round-trips the cached state", () => {
    const state = { list: MOCK_LIST, items: [MOCK_ITEM], memberCount: 2 };
    setCachedState(state);
    expect(getCachedState(MOCK_LIST.id)).toEqual(state);
  });

  it("overwrites existing cache", () => {
    const stateV1 = { list: MOCK_LIST, items: [MOCK_ITEM], memberCount: 1 };
    const stateV2 = {
      list: { ...MOCK_LIST, name: "Renamed" },
      items: [],
      memberCount: 3,
    };
    setCachedState(stateV1);
    setCachedState(stateV2);
    expect(getCachedState(MOCK_LIST.id)?.list.name).toBe("Renamed");
    expect(getCachedState(MOCK_LIST.id)?.memberCount).toBe(3);
  });
});
