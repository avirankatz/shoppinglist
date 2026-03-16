import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { User } from "@supabase/supabase-js";
import { DEFAULT_LIST_NAME, type Language, textByLanguage } from "../copy";
import type { ShoppingList } from "../types";
import { supabase } from "../../../lib/supabase";
import { STORAGE_NAME } from "../storageUtils";
import { createInviteCode } from "./useListSync";

type TextMap = (typeof textByLanguage)[Language];

export function useOnboarding({
  language,
  t,
  isOnline,
  authUser,
  setAuthUser,
  setActiveList,
  urlJoinCode,
  setErrorText,
  setShowAuthRetry,
}: {
  language: Language;
  t: TextMap;
  isOnline: boolean;
  authUser: User | null;
  setAuthUser: Dispatch<SetStateAction<User | null>>;
  setActiveList: Dispatch<SetStateAction<ShoppingList | null>>;
  urlJoinCode: string;
  setErrorText: (v: string) => void;
  setShowAuthRetry: (v: boolean) => void;
}) {
  const [mode, setMode] = useState<"create" | "join">(() =>
    urlJoinCode ? "join" : "create",
  );
  // rerender-lazy-state-init: pass function reference for lazy init
  const [userName, setUserName] = useState(
    () => localStorage.getItem(STORAGE_NAME) ?? "",
  );
  // js-cache-storage: use `language` already resolved by useLanguage — no second localStorage read
  const [listName, setListName] = useState(() => DEFAULT_LIST_NAME[language]);
  const [joinCode, setJoinCode] = useState(() => urlJoinCode);

  useEffect(() => {
    localStorage.setItem(STORAGE_NAME, userName);
  }, [userName]);

  // Clean URL after reading join code; urlJoinCode is stable so this runs at most once
  useEffect(() => {
    if (!urlJoinCode) return;
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("join");
    window.history.replaceState({}, "", cleanUrl.toString());
  }, [urlJoinCode]);

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
  }, [
    authUser,
    isOnline,
    listName,
    t,
    userName,
    setAuthUser,
    setActiveList,
    setErrorText,
    setShowAuthRetry,
  ]);

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
  }, [isOnline, joinCode, t, userName, setActiveList, setErrorText]);

  const onSubmitOnboarding = useCallback(() => {
    if (mode === "create") {
      void handleCreate();
      return;
    }
    void handleJoin();
  }, [handleCreate, handleJoin, mode]);

  return {
    mode,
    setMode,
    userName,
    setUserName,
    listName,
    setListName,
    joinCode,
    setJoinCode,
    onSubmitOnboarding,
  };
}
