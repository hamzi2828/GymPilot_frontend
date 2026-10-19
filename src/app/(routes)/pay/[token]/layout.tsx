import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

// A payment link is one member's own: never indexed, and its canonical
// address leaves the token out.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Pay your membership",
    description: "Pay your membership online or by bank transfer.",
    path: "/pay",
    noIndex: true,
  });
}

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
