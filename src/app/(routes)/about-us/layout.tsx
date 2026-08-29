import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "About Us",
    description: "Meet the team, the facility and the training philosophy behind the gym.",
    path: "/about-us",
  });
}

export default function AboutUsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
