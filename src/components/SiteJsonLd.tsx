// Structured data for search engines: the gym as a local business with
// its address, phone, opening hours, map position and social profiles --
// all from the admin settings.

import type { SiteSettingsForSeo } from "@/helper/siteMetadata";

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
    ...(settings.seo?.description ? { description: settings.seo.description } : {}),
    ...(settings.mobileNumber ? { telephone: settings.mobileNumber } : {}),
    ...(settings.address ? { address: { "@type": "PostalAddress", streetAddress: settings.address } } : {}),
    ...(settings.maps?.latitude != null && settings.maps?.longitude != null ? { geo: { "@type": "GeoCoordinates", latitude: settings.maps.latitude, longitude: settings.maps.longitude } } : {}),
    ...(settings.maps?.placeUrl ? { hasMap: settings.maps.placeUrl } : {}),
    ...(hours.length ? { openingHoursSpecification: hours.map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: h.day, opens: h.open, closes: h.close })) } : {}),
    ...(socials.length ? { sameAs: socials } : {}),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
