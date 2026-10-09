import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

// The general title, for when the class itself cannot be read; page.tsx
// replaces it with the class's own name and description.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Class Details",
    description: "What this class is and when it runs.",
    path: "/classdetail",
  });
}

export default function ClassdetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
