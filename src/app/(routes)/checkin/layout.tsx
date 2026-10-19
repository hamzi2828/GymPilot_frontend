import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Check in",
    description: "Check in at the front desk by scanning the code on the screen.",
    path: "/checkin",
    noIndex: true,
  });
}

export default function CheckinLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
