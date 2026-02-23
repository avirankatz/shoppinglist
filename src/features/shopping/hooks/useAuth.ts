import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { textByLanguage, type Language } from "../copy";
import { hasSupabaseConfig, supabase } from "../../../lib/supabase";

export function useAuth({
  language,
  setErrorText,
  setShowAuthRetry,
}: {
  language: Language;
  setErrorText: (v: string) => void;
  setShowAuthRetry: (v: boolean) => void;
}) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authRetryTick, setAuthRetryTick] = useState(0);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setAuthLoading(false);
      return;
    }

    const client = supabase;
    let cancelled = false;

    const initAuth = async () => {
      const { data: sessionData } = await client.auth.getSession();

      if (!sessionData.session) {
        const anonymousSignInResult = await client.auth.signInAnonymously();
        if (anonymousSignInResult.error && !cancelled) {
          setErrorText(textByLanguage[language].authSetup);
          setShowAuthRetry(true);
          setAuthLoading(false);
          return;
        }
      }

      const { data } = await client.auth.getUser();
      if (!cancelled) {
        setAuthUser(data.user);
        if (!data.user) {
          setErrorText(textByLanguage[language].authSetup);
          setShowAuthRetry(true);
        } else {
          setErrorText("");
          setShowAuthRetry(false);
        }
        setAuthLoading(false);
      }
    };

    void initAuth();

    const { data: authSubscription } = client.auth.onAuthStateChange(
      (_event, session) => {
        setAuthUser(session?.user ?? null);
      },
    );

    return () => {
      cancelled = true;
      authSubscription.subscription.unsubscribe();
    };
  }, [authRetryTick, language, setErrorText, setShowAuthRetry]);

  const retryAuth = useCallback(() => {
    setErrorText("");
    setShowAuthRetry(false);
    setAuthLoading(true);
    setAuthUser(null);
    setAuthRetryTick((v) => v + 1);
  }, [setErrorText, setShowAuthRetry]);

  return { authUser, setAuthUser, authLoading, retryAuth };
}
