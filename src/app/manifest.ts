// The web app manifest, built per gym so the installed app carries the
// gym's own name and logo. Served at /manifest.webmanifest.

import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/helper/siteMetadata";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSiteSettings();
  const name = settings.siteName || "GymPilot";
  // The gym's own logo joins the icons when it has one; the neutral app icon
  // is always there.
  const logo = settings.logoUrl && /^https?:\/\//.test(settings.logoUrl) ? settings.logoUrl : "";

  return {
    name,
    short_name: name.length > 12 ? name.slice(0, 12).trim() : name,
    description: `${name} — classes, memberships and check-in`,
    start_url: "/user-detail",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icons/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      ...(logo ? [{ src: logo, sizes: "any", type: "image/png" }] : []),
    ],
  };
}
