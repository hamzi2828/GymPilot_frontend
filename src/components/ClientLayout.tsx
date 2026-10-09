'use client';

import { usePathname } from 'next/navigation';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnnouncementsBar from "@/components/AnnouncementsBar";
import WhatsAppButton from "@/components/WhatsAppButton";
import PwaRegister from "@/components/PwaRegister";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const hideLayout =
    ['/authentication'].some(route => pathname.startsWith(route)) ||
    pathname.startsWith('/admin') ||
    // The door kiosk is a full-screen tool, not a page of the site.
    pathname.startsWith('/kiosk') ||
    // Pages made to sit inside another website's <iframe>.
    pathname.startsWith('/embed');

  return (
    <>
      <PwaRegister />
      {!hideLayout && <AnnouncementsBar />}
      {!hideLayout && <Header />}
      {/* Each page brings its own <main>; wrapping them in another one here
          nested two main landmarks on almost every page. */}
      {children}
      {!hideLayout && <Footer />}
      {!hideLayout && <WhatsAppButton />}
    </>
  );
}