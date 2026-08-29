import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/helper/siteMetadata";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { siteUrl } = await getSiteSettings();
  const base = siteUrl.replace(/\/$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Account, admin and purchase pages carry nothing a search result should
      // ever land someone on.
      disallow: ["/admin", "/admin/", "/user-detail", "/checkout", "/authentication"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
