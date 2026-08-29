import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Fitness Blog",
    description: "Training guides, nutrition advice and member stories from our coaching team.",
    path: "/blogs",
  });
}

export default function BlogsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
