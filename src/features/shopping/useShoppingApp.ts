import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { DEFAULT_LIST_NAME, textByLanguage, type Language } from "./copy";
import type { ShoppingItem, ShoppingList } from "./types";
import { hasSupabaseConfig, supabase } from "../../lib/supabase";
import { useAuth } from "./hooks/useAuth";
import { useListSync, createInviteCode } from "./hooks/useListSync";
import {
  PERSONAL_ORDER_STORAGE_PREFIX,
  STORAGE_LANG,
  STORAGE_NAME,
  STORAGE_SESSION,
  enqueueOperation,
} from "./storageUtils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const createLocalId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `local-${crypto.randomUUID()}`
    : `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const copyWithFallback = (value: string): boolean => {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
};

const getInitialLanguage = (): Language => {
  const saved = localStorage.getItem(STORAGE_LANG);
  if (saved === "en" || saved === "he") return saved;
  return navigator.language.toLowerCase().startsWith("he") ? "he" : "en";
};

export function useShoppingApp() {
  // ─── Language ──────────────────────────────────────────────────────────────

  const [language, setLanguage] = useState<Language>(() =>
    getInitialLanguage(),
  );
  const t = textByLanguage[language];
  const isRtl = language === "he";

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    localStorage.setItem(STORAGE_LANG, language);
  }, [isRtl, language]);

  const toggleLanguage = useCallback(() => {
    setLanguage((cur) => (cur === "en" ? "he" : "en"));
  }, []);

  // ─── UI state ──────────────────────────────────────────────────────────────

  const [mode, setMode] = useState<"create" | "join">("create");
  const [userName, setUserName] = useState(
    () => localStorage.getItem(STORAGE_NAME) ?? "",
  );
  const [listName, setListName] = useState(
    () => DEFAULT_LIST_NAME[getInitialLanguage()],
  );
  const [joinCode, setJoinCode] = useState("");
  const [newItemText, setNewItemText] = useState("");
  const [listRename, setListRename] = useState("");
  const [copied, setCopied] = useState("");
  const [errorText, setErrorText] = useState("");
  const [showAuthRetry, setShowAuthRetry] = useState(false);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    localStorage.setItem(STORAGE_NAME, userName);
  }, [userName]);

  // ─── Sub-hooks ─────────────────────────────────────────────────────────────

  const { authUser, setAuthUser, authLoading, retryAuth } = useAuth({
    language,
    setErrorText,
    setShowAuthRetry,
  });

  const {
    urlJoinCode,
    activeList,
    setActiveList,
    items: _items,
    setItems,
    memberCount,
    localOrder: _localOrder,
    setLocalOrder,
    isOnline,
    sortedItems,
    inviteLink,
    loadListState,
  } = useListSync();

  // ─── Pre-fill join code from URL ───────────────────────────────────────────

  useEffect(() => {
    if (!urlJoinCode) return;
    setMode("join");
    setJoinCode(urlJoinCode);
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("join");
    window.history.replaceState({}, "", cleanUrl.toString());
  }, [urlJoinCode]);

  // ─── Install prompt ────────────────────────────────────────────────────────

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const requestInstall = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }, [installPrompt]);

  // ─── Clipboard ─────────────────────────────────────────────────────────────

  const copyToClipboard = useCallback(async (value: string, key: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (!copyWithFallback(value)) return;
    } catch {
      if (!copyWithFallback(value)) return;
    }
    setCopied(key);
    setTimeout(() => setCopied(""), 1400);
  }, []);

  // ─── Derived ───────────────────────────────────────────────────────────────

  const peerLabel = useMemo(
    () =>
      memberCount <= 1 ? t.youOnly : `${memberCount} ${t.membersConnected}`,
    [memberCount, t],
  );

  const handleCreate = useCallback(async () => {
    if (!supabase) return;
    const trimmedList = listName.trim();
    if (!trimmedList) return;
    if (!isOnline) {
      setErrorText(t.saveFailed);
      return;
    }
    setErrorText("");

    let currentUser = authUser;
    if (!currentUser) {
      const { data } = await supabase.auth.getUser();
      currentUser = data.user;
    }
    if (!currentUser) {
      const result = await supabase.auth.signInAnonymously();
      if (result.error || !result.data.user) {
        setErrorText(t.authSetup);
        setShowAuthRetry(true);
        return;
      }
      currentUser = result.data.user;
      setAuthUser(currentUser);
    }

    let inviteCode = createInviteCode();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data, error } = await supabase.rpc("create_list", {
        invite_code_input: inviteCode,
        name_input: trimmedList,
        display_name_input: userName.trim() || null,
      });
      if (!error && data && Array.isArray(data) && data.length > 0) {
        setActiveList(data[0] as ShoppingList);
        return;
      }
      if (error?.code && error.code !== "23505") break;
      inviteCode = createInviteCode();
    }
    setErrorText(t.saveFailed);
  }, [authUser, isOnline, listName, t, userName, setAuthUser, setActiveList]);

  const handleJoin = useCallback(async () => {
    if (!supabase) return;
    const trimmedCode = joinCode.trim().toUpperCase();
    if (!trimmedCode) return;
    if (!isOnline) {
      setErrorText(t.joinFailed);
      return;
    }
    setErrorText("");

    const { data, error } = await supabase.rpc("join_list_by_code", {
      invite_code_input: trimmedCode,
      display_name_input: userName.trim() || null,
    });
    if (error || !data || !Array.isArray(data) || data.length === 0) {
      setErrorText(t.joinFailed);
      return;
    }
    setActiveList(data[0] as ShoppingList);
  }, [isOnline, joinCode, t, userName, setActiveList]);

  const handleSubmitOnboarding = useCallback(() => {
    if (mode === "create") {
      void handleCreate();
      return;
    }
    void handleJoin();
  }, [handleCreate, handleJoin, mode]);

  const retryAuthAndReset = useCallback(() => {
    retryAuth();
    setAuthUser(null);
  }, [retryAuth, setAuthUser]);

  // ─── List actions ──────────────────────────────────────────────────────────

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
  }, [activeList, isOnline, listRename, loadListState, setActiveList, t]);

  const resetApp = useCallback(() => {
    startTransition(() => {
      setActiveList(null);
      setItems([]);
      setNewItemText("");
      localStorage.removeItem(STORAGE_SESSION);
    });
  }, [setActiveList, setItems]);

  // ─── Item actions ──────────────────────────────────────────────────────────

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
  }, [activeList, isOnline, newItemText, t, loadListState, setItems]);

  const toggleItem = useCallback(
    async (item: ShoppingItem) => {
      if (!supabase || !activeList) return;
      const nextChecked = !item.checked;
      setItems((cur) =>
        cur.map((i) => (i.id === item.id ? { ...i, checked: nextChecked } : i)),
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
    [activeList, isOnline, loadListState, setItems, t],
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
    [activeList, isOnline, loadListState, setItems, t],
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
    [activeList, isOnline, loadListState, setItems, t],
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

  // ─── Public API ────────────────────────────────────────────────────────────

  return {
    hasSupabaseConfig,
    t,
    isRtl,
    mode,
    setMode,
    userName,
    setUserName,
    listName,
    setListName,
    joinCode,
    setJoinCode,
    errorText,
    showAuthRetry,
    activeList,
    peerLabel,
    copied,
    inviteLink,
    sortedItems,
    newItemText,
    setNewItemText,
    listRename,
    setListRename,
    installVisible: Boolean(installPrompt),
    isPending,
    authLoading,
    onToggleLanguage: toggleLanguage,
    onRetryAuth: retryAuthAndReset,
    onSubmitOnboarding: handleSubmitOnboarding,
    onCopy: copyToClipboard,
    onAddItem: addItem,
    onToggleItem: toggleItem,
    onEditItem: editItem,
    onRemoveItem: removeItem,
    onRenameList: renameList,
    onInstall: requestInstall,
    onLeaveList: resetApp,
    onReorderItems: reorderItems,
  };
}

export type ShoppingAppVM = ReturnType<typeof useShoppingApp>;
