"use client";

// Which language the site reads in. The gym's choice (Settings → General)
// is the default; a visitor may switch from the header, and the choice is
// remembered in this browser. Right-to-left languages flip the document.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSiteSettings } from "@/components/ThemeProvider";
import { LANGUAGES, dirFor, isLang, translate, type DictKey, type Lang } from "./dictionaries";

const STORAGE_KEY = "site_lang";

interface LanguageState {
  lang: Lang;
  dir: "ltr" | "rtl";
  languages: typeof LANGUAGES;
  setLang: (lang: Lang) => void;
  t: (key: DictKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageState>({
  lang: "en",
  dir: "ltr",
  languages: LANGUAGES,
  setLang: () => {},
  t: (key, vars) => translate("en", key, vars),
});

function readOverride(): Lang | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isLang(value) ? value : null;
  } catch {
    return null;
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const settings = useSiteSettings();
  const gymDefault: Lang = isLang(settings.locale.language) ? settings.locale.language : "en";
  const [override, setOverride] = useState<Lang | null>(null);

  useEffect(() => {
    setOverride(readOverride());
  }, []);

  const lang = override || gymDefault;
  const dir = dirFor(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = useCallback((next: Lang) => {
    setOverride(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* fine */
    }
  }, []);

  const t = useCallback((key: DictKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);

  const value = useMemo(() => ({ lang, dir, languages: LANGUAGES, setLang, t }), [lang, dir, setLang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/** A small select for the header. */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, languages, setLang, t } = useLanguage();
  return (
    <select aria-label={t("nav.language")} value={lang} onChange={(e) => setLang(e.target.value as Lang)} className={`rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-xs ${className}`}>
      {languages.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
