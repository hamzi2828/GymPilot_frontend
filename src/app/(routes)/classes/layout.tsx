import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Classes",
    description: "Browse our classes and see when each one runs.",
    path: "/classes",
  });
}

export default function ClassesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
