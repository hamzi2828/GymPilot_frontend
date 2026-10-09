import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Contact Us",
    description: "Get in touch about memberships, classes or anything else.",
    path: "/contact-us",
  });
}

export default function ContactUsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
