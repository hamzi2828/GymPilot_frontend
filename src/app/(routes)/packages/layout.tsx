import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Membership Packages",
    description: "Compare membership packages and pick the plan that matches how you train.",
    path: "/packages",
  });
}

export default function PackagesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
