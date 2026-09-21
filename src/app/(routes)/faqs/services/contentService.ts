// Content pages (FAQs, privacy policy, terms) come from the admin CMS.
//
// These three used to be hardcoded React components — the FAQ still asked
// "How Do I Shop?" — so a gym could not correct a single word without a
// developer. They are now editable under Admin → Pages.

import { serverTenantFetch } from "@/helper/tenant.server";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export type ContentSlug = "faqs" | "privacy-policy" | "terms";

export interface FaqItem {
  _id?: string;
  question: string;
  answer: string;
  order?: number;
}

export interface ContentSection {
  _id?: string;
  heading: string;
  body?: string;
  items: FaqItem[];
  order?: number;
}

export interface ContentPage {
  slug: ContentSlug;
  title: string;
  subtitle?: string;
  type: "faq" | "richtext";
  body?: string;
  sections?: ContentSection[];
  seo?: { metaTitle?: string; metaDescription?: string };
  effectiveFrom?: string | null;
  updatedAt?: string;
}

/**
 * Fetched on the server so the words are in the HTML for crawlers — a privacy
 * policy that only appears after hydration is not much of a published policy.
 *
 * Returns null rather than throwing when the page is missing or the API is
 * down, so the route can render its own fallback instead of a 500.
 *
 * Sent with the visitor's domain so the API answers with THIS gym's page, and
 * so the cache below is kept per gym rather than shared by every site.
 */
export async function getContentPage(slug: ContentSlug): Promise<ContentPage | null> {
  try {
    const res = await serverTenantFetch(`${API_BASE}/content/${slug}`, {
      // Revalidated rather than cached forever: an admin editing the terms
      // should see the change without a redeploy, but every visitor should not
      // cost a database read.
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return (body?.data as ContentPage) ?? null;
  } catch {
    return null;
  }
}
