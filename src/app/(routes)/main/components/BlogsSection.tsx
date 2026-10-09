"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "@fortawesome/fontawesome-free/css/all.css";
import Image from "next/image";
import { blogService, type BlogData } from "../../blogs/services/blogService";
import { excerptOf } from "@/helper/sanitize";
import { BlogsContent, DEFAULT_BLOGS } from "../services/homeService";
import { SectionHeading, Reveal } from "./SectionHeading";

/** Shown while the request is in flight, so the section doesn't pop in. */
const CARD_SKELETONS = [0, 1, 2];

const BlogsSection = ({ content = DEFAULT_BLOGS }: { content?: BlogsContent }) => {
  const [blogs, setBlogs] = useState<BlogData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const latest = await blogService.getLatestBlogs(3);
        if (!cancelled) setBlogs(latest);
      } catch {
        // A failed blog fetch shouldn't blank the homepage — the section just
        // hides itself below.
        if (!cancelled) setBlogs([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing published yet: drop the section rather than show placeholder posts.
  if (!isLoading && blogs.length === 0) return null;

  return (
    <section id="blogs" className="section surface-paper">
      <Reveal>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12 lg:mb-16">
          <SectionHeading badge={content.badge} heading={content.heading} align="left" />
          <Link href="/blogs" className="btn btn--outline flex-shrink-0">
            <span>All articles</span>
            <i className="fas fa-arrow-right text-xs" aria-hidden="true"></i>
          </Link>
        </div>
      </Reveal>

      <div className="home-post-grid">
        {isLoading
          ? CARD_SKELETONS.map((i) => (
              <div key={i} className="u-card home-post home-post--skeleton" aria-hidden="true">
                <div className="home-post__media" />
                <div className="home-post__body">
                  <div className="home-post__line" />
                  <div className="home-post__line home-post__line--short" />
                </div>
              </div>
            ))
          : blogs.map((blog, i) => (
              <Reveal key={blog._id} delay={i * 100} className="h-full">
                <Link
                  href={`/blogs-detail?slug=${encodeURIComponent(blog.slug)}`}
                  className="u-card home-post"
                >
                  <div className="home-post__media">
                    <Image
                      src={blog.thumbnail || blog.image || "/images/class-placeholder.svg"}
                      alt={blog.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      // Only the lead card is above the fold on most viewports.
                      priority={i === 0}
                    />
                    {blog.categoryId?.name && (
                      <span className="home-post__chip">{blog.categoryId.name}</span>
                    )}
                  </div>

                  <div className="home-post__body">
                    <h3 className="home-post__title">{blog.title}</h3>
                    <p className="home-post__excerpt">
                      {blog.excerpt || excerptOf(blog.content, 160)}
                    </p>
                    <span className="home-post__more">
                      {blog.readingTime ? `${blog.readingTime} min read` : "Read article"}
                      <i className="fas fa-arrow-right text-xs" aria-hidden="true"></i>
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
      </div>
    </section>
  );
};

export default BlogsSection;
