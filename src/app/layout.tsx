// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google"; // Using Inter instead of Geist
import ClientLayout from "@/components/ClientLayout";
import ThemeProvider from "@/components/ThemeProvider";
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
  const { siteName, siteUrl } = await getSiteSettings();

  return {
    // `template` lets every page set just its own name — "Classes" becomes
    // "Classes | <business>" — while the homepage uses `default`.
    title: {
      default: `${siteName} — Gym, Classes & Personal Training`,
      template: `%s | ${siteName}`,
    },
    description:
      "Train with expert coaches in a fully equipped gym. Browse classes, meet our trainers and pick the membership that fits you.",
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
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased bg-white text-gray-900 min-h-screen`}>
        <ThemeProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}