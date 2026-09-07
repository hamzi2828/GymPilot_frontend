// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google"; // Using Inter instead of Geist
import ClientLayout from "@/components/ClientLayout";
import ThemeProvider from "@/components/ThemeProvider";
import SiteJsonLd from "@/components/SiteJsonLd";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { getSiteSettings } from "@/helper/siteMetadata";
import "./globals.css";
import '@fortawesome/fontawesome-free/css/all.css';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Built from the admin-managed settings so the business name in search results
// matches the one on the site, rather than a hardcoded brand.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const { siteName, siteUrl } = settings;
  const seo = settings.seo || {};
  const description = seo.description || "Train with expert coaches in a fully equipped gym. Browse classes, meet our trainers and pick the membership that fits you.";

  return {
    // `template` lets every page set just its own name — "Classes" becomes
    // "Classes | <business>" — while the homepage uses `default`. The gym's
    // own title and description (Settings → General → Search & social)
    // take precedence when set.
    title: {
      default: seo.title || `${siteName} — Gym, Classes & Personal Training`,
      template: `%s | ${siteName}`,
    },
    description,
    keywords: seo.keywords ? seo.keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
    metadataBase: new URL(siteUrl),
    applicationName: siteName,
    // Installable as an app on phones and desktops (see src/app/manifest.ts
    // and public/sw.js).
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: siteName, statusBarStyle: "black" },
    openGraph: {
      type: "website",
      siteName,
      url: siteUrl,
      description,
      images: seo.ogImage ? [{ url: seo.ogImage }] : undefined,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The gym's language and direction are set on the document up front so the
  // first paint is already right-to-left where it should be; the client
  // provider then honours a visitor's own choice.
  const settings = await getSiteSettings();
  const lang = settings.locale?.language || "en";
  const dir = settings.locale?.direction === "rtl" ? "rtl" : "ltr";
  return (
    <html lang={lang} dir={dir}>
      <body className={`${inter.variable} antialiased bg-white text-gray-900 min-h-screen`}>
        <SiteJsonLd settings={settings} />
        <ThemeProvider>
          <LanguageProvider>
            <ClientLayout>
              {children}
            </ClientLayout>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}