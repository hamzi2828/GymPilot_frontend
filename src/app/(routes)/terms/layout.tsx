import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Terms and Conditions",
    description: "The terms that apply to membership, class bookings and use of the gym.",
    path: "/terms",
  });
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
