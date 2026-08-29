import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Sign In",
    description: "Sign in to manage your membership, or create an account to get started.",
    path: "/authentication",
    noIndex: true,
  });
}

export default function AuthenticationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
