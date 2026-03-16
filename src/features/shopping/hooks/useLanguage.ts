import { useCallback, useEffect, useState } from "react";
import { textByLanguage, type Language } from "../copy";
import { STORAGE_LANG } from "../storageUtils";

const getInitialLanguage = (): Language => {
  const saved = localStorage.getItem(STORAGE_LANG);
  if (saved === "en" || saved === "he") return saved;
  return navigator.language.toLowerCase().startsWith("he") ? "he" : "en";
};

export function useLanguage() {
  // rerender-lazy-state-init: pass function reference, not call result
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const isRtl = language === "he";
  const t = textByLanguage[language];

  // rerender-dependencies: compute dir inline from `language` to avoid derived `isRtl` dep
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "he" ? "rtl" : "ltr";
    localStorage.setItem(STORAGE_LANG, language);
  }, [language]);

  const toggleLanguage = useCallback(() => {
    setLanguage((cur) => (cur === "en" ? "he" : "en"));
  }, []);

  return { language, t, isRtl, toggleLanguage };
}
