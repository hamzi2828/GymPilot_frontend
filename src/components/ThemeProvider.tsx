"use client";

import { useEffect } from "react";
import { applyTheme, getTheme, DEFAULT_THEME_KEY } from "@/theme/themes";

const CACHE_KEY = "site_theme";

/**
 * Applies the admin-selected colour scheme at runtime.
 *
 * The chosen preset lives in Settings.theme on the backend so it applies to
 * every visitor. We cache the key in localStorage and apply it immediately on
 * mount, then reconcile with the server — otherwise the site would paint in the
 * default palette on every load while the settings request is in flight.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 1. Apply the cached choice straight away to avoid a flash of the default.
    let cached: string | null = null;
    try {
      cached = localStorage.getItem(CACHE_KEY);
    } catch {
      /* private mode / blocked storage — fall through to the server value */
    }
    if (cached) applyTheme(getTheme(cached));

    // 2. Reconcile with the server so an admin's change reaches every visitor.
    const base = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!base) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${base}/settings/public`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const key: string = json?.data?.theme || DEFAULT_THEME_KEY;
        if (cancelled) return;

        // Always write the server value back, even when it matches what we
        // applied from cache. Persisting only on change let the cache drift out
        // of sync with the server, which showed as a flash of the wrong palette
        // on the next load.
        try {
          localStorage.setItem(CACHE_KEY, key);
        } catch {
          /* non-fatal: the theme still applies for this page view */
        }

        if (key !== cached) applyTheme(getTheme(key));
      } catch {
        /* offline or API down — the CSS defaults in globals.css still apply */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
}

/** Lets the admin settings page preview/persist a choice without a reload. */
export function setActiveTheme(key: string) {
  applyTheme(getTheme(key));
  try {
    localStorage.setItem(CACHE_KEY, key);
  } catch {
    /* non-fatal */
  }
}
