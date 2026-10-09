import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "About Us",
    description: "Who we are, what we offer and how to get in touch.",
    path: "/about-us",
  });
}

export default function AboutUsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
