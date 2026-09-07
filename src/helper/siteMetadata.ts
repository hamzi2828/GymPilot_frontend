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

type PublicSettings = {
  siteName?: string;
  siteUrl?: string;
  logoUrl?: string;
};

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
