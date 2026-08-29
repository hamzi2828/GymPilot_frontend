import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "FAQs",
    description: "Answers to the questions we get asked most about memberships, classes and facilities.",
    path: "/faqs",
  });
}

export default function FaqsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
