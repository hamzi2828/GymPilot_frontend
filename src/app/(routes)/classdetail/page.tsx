// app/(routes)/classdetail/page.tsx
import type { Metadata } from "next";
import { absoluteMediaUrl, fetchForMetadata, metaText, pageMetadata } from "@/helper/siteMetadata";
import ClassDetailPage from "./ClassDetailPage";

type Props = { searchParams: Promise<{ id?: string | string[] }> };

// The class's own name and description, for the browser tab, search results
// and link previews. Every class used to be called "Class Details". When the
// class cannot be read, the layout's general title stands.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { id: raw } = await searchParams;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) return {};

  const gymClass = await fetchForMetadata<{
    name?: string;
    shortDescription?: string;
    description?: string;
    thumbnail?: string;
  }>(`/api/gymfolio/gym-classes/${encodeURIComponent(id)}`);
  if (!gymClass?.name) return {};

  return pageMetadata({
    title: gymClass.name,
    description: metaText(gymClass.shortDescription || gymClass.description) || gymClass.name,
    path: `/classdetail?id=${encodeURIComponent(id)}`,
    image: absoluteMediaUrl(gymClass.thumbnail),
  });
}

export default function Page() {
  return <ClassDetailPage />;
}
