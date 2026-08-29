import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Article",
    description: "Training and nutrition advice from our coaching team.",
    path: "/blogs-detail",
  });
}

export default function BlogsDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
