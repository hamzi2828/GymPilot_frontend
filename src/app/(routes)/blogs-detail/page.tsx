// app/(routes)/blogs-detail/page.tsx
import type { Metadata } from "next";
import { absoluteMediaUrl, fetchForMetadata, metaText, pageMetadata } from "@/helper/siteMetadata";
import BlogDetailPage from "./BlogDetailPage";

type Props = { searchParams: Promise<{ slug?: string | string[] }> };

// The post's own title and opening words, for the browser tab, search results
// and link previews. Every post used to be called "Article". When the post
// cannot be read, the layout's general title stands.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { slug: raw } = await searchParams;
  const slug = Array.isArray(raw) ? raw[0] : raw;
  if (!slug) return {};

  // Without `view=true`, so reading the title is not counted as a visit.
  const post = await fetchForMetadata<{
    title?: string;
    excerpt?: string;
    content?: string;
    image?: string;
    thumbnail?: string;
  }>(`/blogs/slug/${encodeURIComponent(slug)}`);
  if (!post?.title) return {};

  return pageMetadata({
    title: post.title,
    description: metaText(post.excerpt || post.content) || post.title,
    path: `/blogs-detail?slug=${encodeURIComponent(slug)}`,
    image: absoluteMediaUrl(post.image || post.thumbnail),
  });
}

export default function Page() {
  return <BlogDetailPage />;
}
