import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "My Account",
    description: "Manage your profile and view your membership orders.",
    path: "/user-detail",
    noIndex: true,
  });
}

export default function UserDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
