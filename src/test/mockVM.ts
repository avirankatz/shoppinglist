import { vi } from "vitest";
import type { ShoppingAppVM } from "../features/shopping/useShoppingApp";
import { textByLanguage } from "../features/shopping/copy";

export const MOCK_LIST = {
  id: "list-1",
  invite_code: "ABCD-EFGH-IJKL",
  name: "Test List",
  owner_id: "user-1",
};

export const MOCK_ITEM = {
  id: "item-1",
  list_id: "list-1",
  text: "Milk",
  checked: false,
  updated_at: "2026-01-01T00:00:00Z",
};

export const makeVM = (
  overrides: Partial<ShoppingAppVM> = {},
): ShoppingAppVM => ({
  hasSupabaseConfig: false,
  t: textByLanguage.en,
  isRtl: false,
  mode: "create",
  setMode: vi.fn(),
  userName: "Tester",
  setUserName: vi.fn(),
  listName: "Test List",
  setListName: vi.fn(),
  joinCode: "",
  setJoinCode: vi.fn(),
  errorText: "",
  showAuthRetry: false,
  activeList: MOCK_LIST,
  peerLabel: "You only",
  copied: null,
  inviteLink: "http://localhost/?join=ABCD-EFGH-IJKL",
  sortedItems: [],
  newItemText: "",
  setNewItemText: vi.fn(),
  listRename: "",
  setListRename: vi.fn(),
  installVisible: false,
  isPending: false,
  authLoading: false,
  onToggleLanguage: vi.fn(),
  onRetryAuth: vi.fn(),
  onSubmitOnboarding: vi.fn(),
  onCopy: vi.fn(),
  onAddItem: vi.fn(),
  onToggleItem: vi.fn(),
  onEditItem: vi.fn(),
  onRemoveItem: vi.fn(),
  onRenameList: vi.fn(),
  onInstall: vi.fn(),
  onLeaveList: vi.fn(),
  onReorderItems: vi.fn(),
  ...overrides,
});
