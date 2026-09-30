// Structured data for search engines: the gym as a local business with
// its address, phone, opening hours, map position and social profiles --
// all from the admin settings. That is text an admin typed, and this sits in
// the root layout on every page, so it is serialised with scriptJson: plain
// JSON.stringify would let a "</script>" in it end the element early.

import type { SiteSettingsForSeo } from "@/helper/siteMetadata";
import { scriptJson } from "@/helper/scriptJson";

export default function SiteJsonLd({ settings }: { settings: SiteSettingsForSeo }) {
  const hours = (settings.openingHours || []).filter((h) => h && !h.closed && h.open && h.close);
  const socials = [settings.facebookUrl, settings.instagramUrl, settings.youtubeUrl, settings.twitterUrl, settings.tiktokUrl].filter((u): u is string => !!u);
  const image = settings.logoUrl && /^https?:\/\//.test(settings.logoUrl) ? settings.logoUrl : `${settings.siteUrl.replace(/\/$/, "")}${settings.logoUrl || "/images/logo.png"}`;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": ["HealthClub", "LocalBusiness"],
    name: settings.siteName,
    url: settings.siteUrl,
    image,
    ...(settings.seo?.description || settings.siteDescription ? { description: settings.seo?.description || settings.siteDescription } : {}),
    ...(settings.mobileNumber ? { telephone: settings.mobileNumber } : {}),
    ...(settings.contactEmail ? { email: settings.contactEmail } : {}),
    ...(settings.address ? { address: { "@type": "PostalAddress", streetAddress: settings.address } } : {}),
    ...(settings.maps?.latitude != null && settings.maps?.longitude != null ? { geo: { "@type": "GeoCoordinates", latitude: settings.maps.latitude, longitude: settings.maps.longitude } } : {}),
    ...(settings.maps?.placeUrl ? { hasMap: settings.maps.placeUrl } : {}),
    ...(hours.length ? { openingHoursSpecification: hours.map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: h.day, opens: h.open, closes: h.close })) } : {}),
    ...(socials.length ? { sameAs: socials } : {}),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: scriptJson(data) }} />;
}
