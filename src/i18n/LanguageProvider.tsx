"use client";

// Which language the site reads in. For now that is English, everywhere:
// translation is switched off (no picker in the header, no language setting
// in the admin). The dictionaries and t() stay, so turning it back on is a
// matter of choosing the language here again. A choice a visitor made while
// switching was on is cleared, so nobody is left reading the site in another
// language.

import { createContext, useContext, useEffect } from "react";
import { LANGUAGES, translate, type DictKey, type Lang } from "./dictionaries";

const STORAGE_KEY = "site_lang";
const LANG: Lang = "en";

interface LanguageState {
  lang: Lang;
  dir: "ltr" | "rtl";
  languages: typeof LANGUAGES;
  setLang: (lang: Lang) => void;
  t: (key: DictKey, vars?: Record<string, string | number>) => string;
}

const ENGLISH: LanguageState = {
  lang: LANG,
  dir: "ltr",
  languages: LANGUAGES,
  setLang: () => {},
  t: (key, vars) => translate(LANG, key, vars),
};

const LanguageContext = createContext<LanguageState>(ENGLISH);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = LANG;
    document.documentElement.dir = "ltr";
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* fine */
    }
  }, []);

  return <LanguageContext.Provider value={ENGLISH}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
