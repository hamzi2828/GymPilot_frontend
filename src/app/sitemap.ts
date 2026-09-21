import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/helper/siteMetadata";
import { serverTenantFetch } from "@/helper/tenant.server";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

/** Static pages, with a rough priority for crawl ordering. */
const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/packages", priority: 0.9, changeFrequency: "weekly" },
  { path: "/classes", priority: 0.9, changeFrequency: "weekly" },
  { path: "/trainers", priority: 0.8, changeFrequency: "monthly" },
  { path: "/about-us", priority: 0.6, changeFrequency: "monthly" },
  { path: "/blogs", priority: 0.7, changeFrequency: "weekly" },
  { path: "/contact-us", priority: 0.6, changeFrequency: "monthly" },
  { path: "/faqs", priority: 0.5, changeFrequency: "monthly" },
  { path: "/privacy-policy", priority: 0.3, changeFrequency: "yearly" },
];

/** Fetches a list endpoint, returning [] rather than failing the whole sitemap. */
async function fetchList<T>(path: string): Promise<T[]> {
  try {
    const res = await serverTenantFetch(`${API_BASE}${path}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { siteUrl } = await getSiteSettings();
  const base = siteUrl.replace(/\/$/, "");

  const [classes, blogs] = await Promise.all([
    fetchList<{ _id: string; updatedAt?: string }>("/api/gymfolio/gym-classes/active"),
    // The API pages blogs 10 at a time by default; a sitemap wants all of them.
    fetchList<{ slug: string; updatedAt?: string }>("/blogs?status=published&limit=1000"),
  ]);

  return [
    ...STATIC_ROUTES.map((r) => ({
      url: `${base}${r.path}`,
      lastModified: new Date(),
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    })),
    // Detail pages are query-param routes today, so they're listed in that form.
    ...classes.map((c) => ({
      url: `${base}/classdetail?id=${c._id}`,
      lastModified: c.updatedAt ? new Date(c.updatedAt) : new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...blogs
      .filter((b) => !!b.slug)
      .map((b) => ({
        url: `${base}/blogs-detail?slug=${encodeURIComponent(b.slug)}`,
        lastModified: b.updatedAt ? new Date(b.updatedAt) : new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
  ];
}
