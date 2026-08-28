'use client';

import { usePathname } from 'next/navigation';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Script from "next/script";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const hideLayout = ['/authentication'].some(route => pathname.startsWith(route)) || pathname.startsWith('/admin');

  return (
    <>
      {!hideLayout && <Header />}
      <main>{children}</main>
      <Script src="/script.js" strategy="afterInteractive" />
      {!hideLayout && <Footer />}
    </>
  );
}