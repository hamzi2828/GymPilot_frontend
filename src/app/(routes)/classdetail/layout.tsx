import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Class Details",
    description: "Full details for this class: what to expect, the weekly schedule and the coaches who run it.",
    path: "/classdetail",
  });
}

export default function ClassdetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
