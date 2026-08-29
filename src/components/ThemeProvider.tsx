"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { applyTheme, getTheme, DEFAULT_THEME_KEY } from "@/theme/themes";

const THEME_CACHE_KEY = "site_theme";
const NAME_CACHE_KEY = "site_name";
const DEFAULT_SITE_NAME = "Gymfolio";

type SiteSettings = {
  siteName: string;
  theme: string;
  logoUrl: string;
  logoWidth: number;
  logoHeight: number;
  footerLogoUrl: string;
  footerLogoWidth: number;
  footerLogoHeight: number;
  // Contact details and social profiles, so the footer and contact page show
  // the real business rather than hardcoded placeholders. Empty string means
  // "not configured" — callers hide the element rather than linking nowhere.
  mobileNumber: string;
  address: string;
  facebookUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  twitterUrl: string;
  tiktokUrl: string;
};

const DEFAULT_LOGO = "/images/logo.png";

const DEFAULTS: SiteSettings = {
  siteName: DEFAULT_SITE_NAME,
  theme: DEFAULT_THEME_KEY,
  logoUrl: DEFAULT_LOGO,
  logoWidth: 160,
  logoHeight: 56,
  footerLogoUrl: "",
  footerLogoWidth: 120,
  footerLogoHeight: 40,
  mobileNumber: "",
  address: "",
  facebookUrl: "",
  instagramUrl: "",
  youtubeUrl: "",
  twitterUrl: "",
  tiktokUrl: "",
};

const SiteSettingsContext = createContext<SiteSettings>(DEFAULTS);

/** Business name, logo and palette, sourced from admin settings. */
export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}

function readCache(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Private mode or blocked storage — fall through to the server value.
    return null;
  }
}

function writeCache(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* non-fatal: the value still applies for this page view */
  }
}

/**
 * Applies the admin-selected colour scheme and exposes the business name.
 *
 * Both live in the settings document so they apply to every visitor. Cached
 * values are used immediately on mount and then reconciled with the server,
 * otherwise the site would paint with defaults on every load while the settings
 * request is in flight.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULTS);

  useEffect(() => {
    const cachedTheme = readCache(THEME_CACHE_KEY);
    const cachedName = readCache(NAME_CACHE_KEY);

    if (cachedTheme) applyTheme(getTheme(cachedTheme));
    if (cachedTheme || cachedName) {
      setSettings((prev) => ({
        ...prev,
        siteName: cachedName || DEFAULT_SITE_NAME,
        theme: cachedTheme || DEFAULT_THEME_KEY,
      }));
    }

    const base = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!base) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${base}/settings/public`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;

        const themeKey: string = json?.data?.theme || DEFAULT_THEME_KEY;
        const siteName: string = json?.data?.siteName || DEFAULT_SITE_NAME;

        // Always write the server values back, even when unchanged. Persisting
        // only on change let the cache drift out of sync with the server, which
        // showed as a flash of the wrong palette on the next load.
        writeCache(THEME_CACHE_KEY, themeKey);
        writeCache(NAME_CACHE_KEY, siteName);

        if (themeKey !== cachedTheme) applyTheme(getTheme(themeKey));

        const d = json?.data || {};
        setSettings({
          siteName,
          theme: themeKey,
          logoUrl: d.logoUrl || DEFAULT_LOGO,
          logoWidth: Number(d.logoWidth) || DEFAULTS.logoWidth,
          logoHeight: Number(d.logoHeight) || DEFAULTS.logoHeight,
          footerLogoUrl: d.footerLogoUrl || "",
          footerLogoWidth: Number(d.footerLogoWidth) || DEFAULTS.footerLogoWidth,
          footerLogoHeight: Number(d.footerLogoHeight) || DEFAULTS.footerLogoHeight,
          mobileNumber: d.mobileNumber || "",
          address: d.address || "",
          facebookUrl: d.facebookUrl || "",
          instagramUrl: d.instagramUrl || "",
          youtubeUrl: d.youtubeUrl || "",
          twitterUrl: d.twitterUrl || "",
          tiktokUrl: d.tiktokUrl || "",
        });
      } catch {
        // Offline or API down — CSS defaults in globals.css still apply.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return <SiteSettingsContext.Provider value={settings}>{children}</SiteSettingsContext.Provider>;
}

/** Lets the admin settings page preview/persist a choice without a reload. */
export function setActiveTheme(key: string) {
  applyTheme(getTheme(key));
  writeCache(THEME_CACHE_KEY, key);
}
