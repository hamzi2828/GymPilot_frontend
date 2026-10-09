import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

// The general title, for when the post itself cannot be read; page.tsx
// replaces it with the post's own title and description.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Article",
    description: "An article from our blog.",
    path: "/blogs-detail",
  });
}

export default function BlogsDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
