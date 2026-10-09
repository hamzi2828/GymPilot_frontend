import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Blog",
    description: "Our latest articles and news.",
    path: "/blogs",
  });
}

export default function BlogsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
