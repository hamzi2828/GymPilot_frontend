import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Privacy Policy",
    description: "How we collect, use and protect your personal information.",
    path: "/privacy-policy",
  });
}

export default function PrivacyPolicyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
