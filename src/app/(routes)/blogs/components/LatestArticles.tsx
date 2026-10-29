"use client";

import React, { useEffect, useState } from "react";
import { blogService, type BlogData } from "../services/blogService";
import { excerptOf } from "@/helper/sanitize";
import BlogCard from "./BlogCard";
import Reveal from "@/components/site/Reveal";
import { SectionHeading, surfaceClass } from "@/components/site/PageHero";

const LatestArticles: React.FC = () => {
  const [blogs, setBlogs] = useState<BlogData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLatestBlogs = async () => {
      try {
        setIsLoading(true);
        const latestBlogs = await blogService.getLatestBlogs(4);
        setBlogs(latestBlogs);
      } catch (error) {
        console.error('Error fetching latest blogs:', error);
        setBlogs([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLatestBlogs();
  }, []);
  return (
    <section className={`${surfaceClass} px-4 sm:px-8 lg:px-20 py-20 lg:py-28`} aria-labelledby="latest-title">
      <div className="relative mx-auto max-w-[1400px]">
        {/* No "View all articles" button: this page is the list. */}
        <SectionHeading id="latest-title" eyebrow="Fresh off the press" title="Latest articles" />

        {isLoading && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Loading articles">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-80 rounded-3xl bg-[var(--surface)] animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && blogs.length === 0 && (
          <p className="py-8 text-center text-[var(--text-muted)]">No articles yet.</p>
        )}

        {!isLoading && blogs.length > 0 && (
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {blogs.map((blog, i) => (
              <Reveal as="li" key={blog._id} delay={i * 0.08}>
                <BlogCard
                  compact
                  href={`/blogs-detail?slug=${blog.slug}`}
                  image={blog.thumbnail || blog.image || "/images/class-placeholder.svg"}
                  title={blog.title}
                  excerpt={excerptOf(blog.content, 100)}
                  category={blog.categoryId?.name || "Article"}
                  metaLeft={blogService.estimateReadingTime(blog.content)}
                  metaRight={blogService.formatTimeAgo(blog.createdAt)}
                />
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default LatestArticles;