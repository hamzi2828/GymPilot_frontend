// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Using Inter instead of Geist
import ClientLayout from "@/components/ClientLayout";
import "./globals.css";
import '@fortawesome/fontawesome-free/css/all.css';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gymwear - Premium Fitness Apparel",
  description: "High-quality gym and fitness apparel for men and women",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased bg-white text-gray-900 min-h-screen`}>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}