'use client';

import { usePathname } from 'next/navigation';
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const hideLayout =
    ['/authentication'].some(route => pathname.startsWith(route)) ||
    pathname.startsWith('/admin') ||
    // The platform panel is not part of any gym's website.
    pathname.startsWith('/super-admin') ||
    // The door kiosk is a full-screen tool, not a page of the site.
    pathname.startsWith('/kiosk');

  return (
    <>
      {!hideLayout && <Header />}
      <main>{children}</main>
      {!hideLayout && <Footer />}
    </>
  );
}