// src/helper/siteMetadata.ts
//
// Server-side access to the admin-managed site settings, for page <title>,
// descriptions and Open Graph tags. ThemeProvider reads the same endpoint on
// the client for colours and logos; this is the render-time equivalent so
// crawlers get the real business name instead of a hardcoded one.

import type { Metadata } from "next";
import { serverTenantFetch } from "@/helper/tenant.server";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

/** Used when the settings request fails or hasn't been configured yet. */
const FALLBACK = {
  siteName: "GymPilot",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
};

export type OpeningHour = { day: string; open: string; close: string; closed: boolean };

type PublicSettings = {
  siteName?: string;
  siteUrl?: string;
  logoUrl?: string;
  address?: string;
  mobileNumber?: string;
  contactEmail?: string;
  siteDescription?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  twitterUrl?: string;
  tiktokUrl?: string;
  seo?: { title?: string; description?: string; keywords?: string; ogImage?: string };
  maps?: { embedUrl?: string; placeUrl?: string; latitude?: number | null; longitude?: number | null };
  openingHours?: OpeningHour[];
  locale?: { language?: string; direction?: "ltr" | "rtl" };
};

export type SiteSettingsForSeo = Required<Pick<PublicSettings, "siteName" | "siteUrl">> & PublicSettings;

/**
 * Reads the public settings document.
 *
 * Cached for an hour: the business name changes rarely, and a metadata lookup
 * must never be the reason a page fails to render — any error falls back to
 * the defaults above.
 *
 * Sent with the visitor's domain, so the API answers for THIS gym: every gym
 * on the platform has its own site, and this render has to know which one it
 * is. serverTenantFetch also keys the cache on the domain.
 */
export async function getSiteSettings(): Promise<Required<Pick<PublicSettings, "siteName" | "siteUrl">> & PublicSettings> {
  try {
    const res = await serverTenantFetch(`${API_BASE}/settings/public`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return FALLBACK;
    const json = await res.json();
    const data: PublicSettings = json?.data ?? {};
    return {
      ...data,
      siteName: data.siteName?.trim() || FALLBACK.siteName,
      siteUrl: data.siteUrl?.trim() || FALLBACK.siteUrl,
    };
  } catch {
    return FALLBACK;
  }
}

/**
 * Builds page metadata from a title and description.
 *
 * `title` is the page's own name — the business name is appended by the root
 * layout's title template, so pass "Classes", not "Classes | GymPilot".
 */
export async function pageMetadata({
  title,
  description,
  path,
  image,
  noIndex,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  noIndex?: boolean;
}): Promise<Metadata> {
  const { siteName, siteUrl } = await getSiteSettings();
  const url = `${siteUrl.replace(/\/$/, "")}${path}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      title: `${title} | ${siteName}`,
      description,
      url,
      siteName,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${siteName}`,
      description,
      images: image ? [image] : undefined,
    },
  };
}

/**
 * One public record, read on the server for a detail page's metadata (a blog
 * post, a class). Null on any failure: the page then keeps its layout's
 * general title rather than failing to render.
 */
export async function fetchForMetadata<T>(path: string): Promise<T | null> {
  try {
    const res = await serverTenantFetch(`${API_BASE}${path}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data as T) ?? null;
  } catch {
    return null;
  }
}

/** Plain text for a meta description: markup removed, cut at a word. */
export function metaText(html: string | null | undefined, max = 160): string {
  const text = (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 30)).trim()}…`;
}

/** Uploaded media is stored as a path on the API host; a link preview needs a full URL. */
export function absoluteMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith("/uploads") ? `${API_BASE}${url}` : undefined;
}
