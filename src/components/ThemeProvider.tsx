"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { applyTheme, getTheme, DEFAULT_THEME_KEY } from "@/theme/themes";
import TenantUnavailable from "@/components/TenantUnavailable";
import { gymDateKey } from "@/helper/date";

// The API's answer when the domain is not (or no longer) serving a gym.
// `renewable` comes with a lapsed subscription: the gym's owner can still
// sign in and pay from that page.
const UNAVAILABLE_CODES = new Set(["TENANT_NOT_FOUND", "TENANT_SUSPENDED", "SUBSCRIPTION_INACTIVE"]);
type Unavailable = { code: string; message?: string; host?: string | null; renewable?: boolean };

const THEME_CACHE_KEY = "site_theme";
const NAME_CACHE_KEY = "site_name";
const LOGO_CACHE_KEY = "site_logo";
// Until the gym's own name is known, no name is shown: never another brand's.
const DEFAULT_SITE_NAME = "";

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
  contactEmail: string;
  facebookUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  twitterUrl: string;
  tiktokUrl: string;
  // The floating WhatsApp button, when the gym has switched it on.
  whatsappButton: { number: string; message: string } | null;
  // Set when the gym has push notifications on; members subscribe with it.
  pushPublicKey: string;
  // The language the site reads in and its direction (Settings → General).
  locale: { language: string; direction: "ltr" | "rtl" };
  // Where the gym is, for the contact page.
  maps: { embedUrl: string; placeUrl: string };
  openingHours: { day: string; open: string; close: string; closed: boolean }[];
  // The gym's IANA timezone, for "today" on the admin pages; "" until known.
  ianaTimezone: string;
};

// What stands where the logo goes until the gym's own is known: a transparent
// pixel, so the header keeps its shape and shows no stand-in brand.
const BLANK_LOGO = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/**
 * The gym's name set as a wordmark, for a gym that has uploaded no logo. The
 * header and footer are dark in every palette, so the lettering is white.
 */
function wordmark(name: string): string {
  const text = name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Wide enough for capitals in a bold face; spare width only adds margin.
  const width = Math.max(56, name.length * 20 + 8);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="56" viewBox="0 0 ${width} 56">` +
    `<text x="50%" y="50%" dy=".35em" text-anchor="middle" fill="#ffffff" font-family="Montserrat, Arial, sans-serif" font-size="30" font-weight="700">${text}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// What the API sends for a gym that has uploaded no logo: the path of a
// bundled picture of the word "LOGO". It is not the gym's, so it counts as none.
const PLACEHOLDER_LOGO = "/images/logo.png";

/** The gym's logo; failing that its name as a wordmark; failing both, nothing. */
function logoFor(logoUrl: string | null | undefined, siteName: string): string {
  if (logoUrl && logoUrl !== PLACEHOLDER_LOGO) return logoUrl;
  return siteName ? wordmark(siteName) : BLANK_LOGO;
}

const DEFAULTS: SiteSettings = {
  siteName: DEFAULT_SITE_NAME,
  theme: DEFAULT_THEME_KEY,
  logoUrl: BLANK_LOGO,
  logoWidth: 160,
  logoHeight: 56,
  footerLogoUrl: "",
  footerLogoWidth: 120,
  footerLogoHeight: 40,
  mobileNumber: "",
  address: "",
  contactEmail: "",
  facebookUrl: "",
  instagramUrl: "",
  youtubeUrl: "",
  twitterUrl: "",
  tiktokUrl: "",
  whatsappButton: null,
  pushPublicKey: "",
  locale: { language: "en", direction: "ltr" },
  maps: { embedUrl: "", placeUrl: "" },
  openingHours: [],
  ianaTimezone: "",
};

const SiteSettingsContext = createContext<SiteSettings>(DEFAULTS);

/** Business name, logo and palette, sourced from admin settings. */
export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}

/**
 * Today's date at the gym ('YYYY-MM-DD'; helper/date.ts gymDateKey), as a
 * function rather than a value so a preset pressed after midnight gets the
 * new day.
 */
export function useGymToday(): () => string {
  const { ianaTimezone } = useSiteSettings();
  return useCallback(() => gymDateKey(ianaTimezone), [ianaTimezone]);
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
 * values (palette, name, logo) are used immediately on mount and then
 * reconciled with the server, otherwise the site would paint without them on
 * every load while the settings request is in flight. On a first visit, with
 * nothing cached, the name and logo are simply absent until they arrive.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULTS);
  const [unavailable, setUnavailable] = useState<Unavailable | null>(null);

  useEffect(() => {
    const cachedTheme = readCache(THEME_CACHE_KEY);
    const cachedName = readCache(NAME_CACHE_KEY);
    // null: never fetched. "": fetched, and the gym has no logo of its own.
    const cachedLogo = readCache(LOGO_CACHE_KEY);

    if (cachedTheme) applyTheme(getTheme(cachedTheme));
    if (cachedTheme || cachedName || cachedLogo !== null) {
      setSettings((prev) => ({
        ...prev,
        siteName: cachedName || DEFAULT_SITE_NAME,
        theme: cachedTheme || DEFAULT_THEME_KEY,
        // The wordmark only once it is known there is no logo to wait for.
        logoUrl: cachedLogo === null ? BLANK_LOGO : logoFor(cachedLogo, cachedName || ""),
      }));
    }

    const base = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!base) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${base}/settings/public`, { cache: "no-store" });
        if (!res.ok) {
          // A domain with no gym behind it (or a gym that is switched off) is
          // told so plainly rather than shown a default-branded site. Any
          // other failure keeps the old behaviour: defaults, no message.
          try {
            const err = await res.json();
            if (err && UNAVAILABLE_CODES.has(err.code) && !cancelled) {
              setUnavailable({ code: err.code, message: err.message, host: err.host || window.location.host, renewable: err.renewable === true });
            }
          } catch {
            /* not JSON -- treat as an ordinary outage */
          }
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        setUnavailable(null);

        const themeKey: string = json?.data?.theme || DEFAULT_THEME_KEY;
        const siteName: string = json?.data?.siteName || DEFAULT_SITE_NAME;

        // Always write the server values back, even when unchanged. Persisting
        // only on change let the cache drift out of sync with the server, which
        // showed as a flash of the wrong palette on the next load.
        writeCache(THEME_CACHE_KEY, themeKey);
        writeCache(NAME_CACHE_KEY, siteName);
        writeCache(LOGO_CACHE_KEY, json?.data?.logoUrl || "");

        if (themeKey !== cachedTheme) applyTheme(getTheme(themeKey));

        const d = json?.data || {};
        setSettings({
          siteName,
          theme: themeKey,
          logoUrl: logoFor(d.logoUrl, siteName),
          logoWidth: Number(d.logoWidth) || DEFAULTS.logoWidth,
          logoHeight: Number(d.logoHeight) || DEFAULTS.logoHeight,
          footerLogoUrl: d.footerLogoUrl && d.footerLogoUrl !== PLACEHOLDER_LOGO ? d.footerLogoUrl : "",
          footerLogoWidth: Number(d.footerLogoWidth) || DEFAULTS.footerLogoWidth,
          footerLogoHeight: Number(d.footerLogoHeight) || DEFAULTS.footerLogoHeight,
          mobileNumber: d.mobileNumber || "",
          address: d.address || "",
          contactEmail: d.contactEmail || "",
          facebookUrl: d.facebookUrl || "",
          instagramUrl: d.instagramUrl || "",
          youtubeUrl: d.youtubeUrl || "",
          twitterUrl: d.twitterUrl || "",
          tiktokUrl: d.tiktokUrl || "",
          whatsappButton: d.whatsappButton && d.whatsappButton.number ? { number: String(d.whatsappButton.number), message: String(d.whatsappButton.message || "") } : null,
          pushPublicKey: d.pushPublicKey || "",
          locale: { language: (d.locale && d.locale.language) || "en", direction: d.locale && d.locale.direction === "rtl" ? "rtl" : "ltr" },
          maps: { embedUrl: (d.maps && d.maps.embedUrl) || "", placeUrl: (d.maps && d.maps.placeUrl) || "" },
          openingHours: Array.isArray(d.openingHours) ? d.openingHours : [],
          ianaTimezone: typeof d.ianaTimezone === "string" ? d.ianaTimezone : "",
        });
      } catch {
        // Offline or API down — CSS defaults in globals.css still apply.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SiteSettingsContext.Provider value={settings}>
      {unavailable ? (
        <TenantUnavailable code={unavailable.code} message={unavailable.message} host={unavailable.host} renewable={unavailable.renewable} />
      ) : (
        children
      )}
    </SiteSettingsContext.Provider>
  );
}

/** Lets the admin settings page preview/persist a choice without a reload. */
export function setActiveTheme(key: string) {
  applyTheme(getTheme(key));
  writeCache(THEME_CACHE_KEY, key);
}
