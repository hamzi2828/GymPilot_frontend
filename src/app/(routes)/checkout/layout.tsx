import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Checkout",
    description: "Complete your membership purchase.",
    path: "/checkout",
    noIndex: true,
  });
}

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
