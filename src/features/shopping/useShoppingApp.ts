import { useCallback, useMemo, useState } from "react";

import { hasSupabaseConfig } from "../../lib/supabase";
import { useAuth } from "./hooks/useAuth";
import { useListSync } from "./hooks/useListSync";
import { useLanguage } from "./hooks/useLanguage";
import { usePWAInstall } from "./hooks/usePWAInstall";
import { useClipboard } from "./hooks/useClipboard";
import { useOnboarding } from "./hooks/useOnboarding";
import { useItemActions } from "./hooks/useItemActions";
import { useListActions } from "./hooks/useListActions";

export function useShoppingApp() {
  const { language, t, isRtl, toggleLanguage } = useLanguage();
  const { installVisible, requestInstall } = usePWAInstall();
  const { copied, copyToClipboard } = useClipboard();

  const [errorText, setErrorText] = useState("");
  const [showAuthRetry, setShowAuthRetry] = useState(false);

  const { authUser, setAuthUser, authLoading, retryAuth } = useAuth({
    language,
    setErrorText,
    setShowAuthRetry,
  });

  const {
    urlJoinCode,
    activeList,
    setActiveList,
    items,
    setItems,
    memberCount,
    setLocalOrder,
    isOnline,
    sortedItems,
    inviteLink,
    loadListState,
  } = useListSync();

  const {
    mode,
    setMode,
    userName,
    setUserName,
    listName,
    setListName,
    joinCode,
    setJoinCode,
    onSubmitOnboarding,
  } = useOnboarding({
    language,
    t,
    isOnline,
    authUser,
    setAuthUser,
    setActiveList,
    urlJoinCode,
    setErrorText,
    setShowAuthRetry,
  });

  const {
    newItemText,
    setNewItemText,
    addItem,
    toggleItem,
    editItem,
    removeItem,
    reorderItems,
    removeAllDoneItems,
    restoreAllDoneItems,
  } = useItemActions({
    activeList,
    isOnline,
    items,
    setItems,
    sortedItems,
    setLocalOrder,
    loadListState,
    t,
    setErrorText,
  });

  const { listRename, setListRename, renameList, resetApp, isPending } =
    useListActions({
      activeList,
      setActiveList,
      isOnline,
      loadListState,
      setItems,
      setNewItemText,
      t,
      setErrorText,
    });

  const onRefresh = useCallback(
    () =>
      activeList ? loadListState(activeList.id) : Promise.resolve(),
    [activeList, loadListState],
  );

  const peerLabel = useMemo(
    () =>
      memberCount <= 1 ? t.youOnly : `${memberCount} ${t.membersConnected}`,
    [memberCount, t],
  );

  const retryAuthAndReset = useCallback(() => {
    retryAuth();
    setAuthUser(null);
  }, [retryAuth, setAuthUser]);

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
    installVisible,
    isPending,
    authLoading,
    onToggleLanguage: toggleLanguage,
    onRetryAuth: retryAuthAndReset,
    onSubmitOnboarding,
    onCopy: copyToClipboard,
    onAddItem: addItem,
    onToggleItem: toggleItem,
    onEditItem: editItem,
    onRemoveItem: removeItem,
    onRenameList: renameList,
    onInstall: requestInstall,
    onLeaveList: resetApp,
    onReorderItems: reorderItems,
    onRemoveAllDoneItems: removeAllDoneItems,
    onRestoreAllDoneItems: restoreAllDoneItems,
    onRefresh,
  };
}

export type ShoppingAppVM = ReturnType<typeof useShoppingApp>;
