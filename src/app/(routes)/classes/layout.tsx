import type { Metadata } from "next";
import { pageMetadata } from "@/helper/siteMetadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Classes",
    description: "Browse every class on the timetable — strength, conditioning, mobility and more — with schedules and difficulty levels.",
    path: "/classes",
  });
}

export default function ClassesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
