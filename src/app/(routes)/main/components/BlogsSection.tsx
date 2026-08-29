"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "@fortawesome/fontawesome-free/css/all.css";
import Image from "next/image";
import { blogService, type BlogData } from "../../blogs/services/blogService";
import { excerptOf } from "@/helper/sanitize";
import { BlogsContent, DEFAULT_BLOGS } from "../services/homeService";

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
    <section
      id="blogs"
      className="section7-teampy-16 md:py-20 px-4 md:px-8 lg:px-20 relative overflow-hidden-member"
    >
      <div className="section7-context">
        <div className="section7-header">
          <div className="section7-badge">
            <div className="section7-icon"></div>
            <div className="section7-text">{content.badge}</div>
          </div>
          <p className="section7-read-for-been-update">{content.heading}</p>
        </div>
      </div>

      <div className="section7-container">
        <div className="section7-content">
          {isLoading
            ? CARD_SKELETONS.map((i) => (
                <div
                  key={i}
                  className={i === 0 ? "section7-blog-post-card" : "section7-blog-post-card2"}
                  aria-hidden="true"
                >
                  <div className="h-full w-full animate-pulse bg-neutral-200/60" />
                </div>
              ))
            : blogs.map((blog, i) => (
                <div
                  key={blog._id}
                  className={i === 0 ? "section7-blog-post-card" : "section7-blog-post-card2"}
                >
                  <Link
                    href={`/blogs-detail?slug=${encodeURIComponent(blog.slug)}`}
                    className="relative flex flex-col h-full"
                  >
                    <div className="section7-content2">
                      <div className="section7-heading-and-subheading">
                        <div className="section7-heading-and-text">
                          <div className="section7-heading-and-icon">
                            <div className="section7-heading">{blog.title}</div>
                            <div className="section7-icon-wrap">
                              <i
                                className="fas fa-up-right-from-square section7-arrow-up-right"
                                aria-hidden="true"
                              ></i>
                            </div>
                          </div>
                          <div className="section7-supporting-text">
                            {blog.excerpt || excerptOf(blog.content, 160)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Image
                      className={i === 0 ? "section7-image" : "section7-image2"}
                      src={blog.thumbnail || blog.image || "/images/gym-blog-1.svg"}
                      alt={blog.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      // Only the lead card is above the fold on most viewports.
                      priority={i === 0}
                    />
                  </Link>
                </div>
              ))}
        </div>
      </div>
    </section>
  );
};

export default BlogsSection;
