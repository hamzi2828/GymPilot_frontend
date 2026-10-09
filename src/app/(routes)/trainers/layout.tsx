import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Our Trainers",
    description: "Meet our trainers.",
    path: "/trainers",
  });
}

export default function TrainersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
