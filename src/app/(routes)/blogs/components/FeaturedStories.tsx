"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, FolderOpen } from "lucide-react";
import { heroSectionService, FeaturedCategoryWithBlogs } from "../services/heroSectionService";
import { excerptOf } from "@/helper/sanitize";
import BlogCard from "./BlogCard";
import TiltCard from "@/components/site/TiltCard";
import Reveal from "@/components/site/Reveal";
import { SectionHeading, surfaceClass } from "@/components/site/PageHero";

const PLACEHOLDER = "/images/class-placeholder.svg";

function blogImage(thumbnail?: string) {
  if (thumbnail?.startsWith("/uploads/")) return `${process.env.NEXT_PUBLIC_BACKEND_URL}${thumbnail}`;
  return thumbnail || PLACEHOLDER;
}

const FeaturedStories: React.FC = () => {
  const [featuredCategories, setFeaturedCategories] = useState<FeaturedCategoryWithBlogs[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFeaturedData = async () => {
      try {
        setIsLoading(true);
        const data = await heroSectionService.getFeaturedCategoriesWithSixBlogs();
        setFeaturedCategories(data);
      } catch (error) {
        console.error('Error fetching featured categories:', error);
        setFeaturedCategories([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeaturedData();
  }, []);

  const lead = featuredCategories[0];

  return (
    <section id="featured" className={`${surfaceClass} px-4 sm:px-8 lg:px-20 py-20 lg:py-28`} aria-labelledby="featured-title">
      <div className="relative mx-auto max-w-[1400px]">
        <SectionHeading id="featured-title" eyebrow="Blog" title="Featured stories" center />

        {isLoading && (
          <div className="h-96 rounded-3xl bg-[var(--surface)] animate-pulse" aria-busy="true" aria-label="Loading featured stories" />
        )}

        {!isLoading && featuredCategories.length === 0 && (
          <div className="py-12 text-center">
            <p className="mb-6 text-[var(--text-muted)]">No featured stories yet.</p>
            <Link href="/classes" className="btn btn--primary">
              <span>Browse our classes</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        )}

        {/* The lead category, as a wide banner */}
        {!isLoading && lead && (
          <Reveal className="mb-20">
            <TiltCard max={3} className="relative h-[420px] overflow-hidden rounded-[32px] border border-[var(--border-subtle)] lg:h-[520px]">
              <Image
                src={lead.bannerUrl || lead.thumbnailUrl || PLACEHOLDER}
                alt=""
                fill
                sizes="100vw"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" aria-hidden="true" />
              <div
                className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full"
                style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 35%, transparent), transparent 65%)" }}
                aria-hidden="true"
              />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10 lg:p-14">
                <span className="inline-block rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--on-accent)]">
                  {lead.name}
                </span>
                <h3 className="mt-4 max-w-3xl font-['Montserrat'] text-3xl font-extrabold leading-tight text-white lg:text-5xl">
                  {lead.description || lead.name}
                </h3>
                <p className="mt-4 inline-flex items-center gap-2 text-sm text-white/75 sm:text-base">
                  <FolderOpen size={16} className="text-[var(--accent)]" aria-hidden="true" />
                  {lead.blogs?.length || 0} articles
                </p>
              </div>
            </TiltCard>
          </Reveal>
        )}

        {/* Each featured category and its articles */}
        {!isLoading &&
          featuredCategories.map((category) => (
            <div key={category.id} className="mb-20 last:mb-0">
              <Reveal>
                <div className="mb-8 flex items-center gap-4">
                  {category.thumbnailUrl && (
                    <Image
                      src={category.thumbnailUrl}
                      alt=""
                      width={56}
                      height={56}
                      className="h-14 w-14 flex-none rounded-2xl border border-[var(--border-subtle)] object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="font-['Montserrat'] text-2xl font-extrabold uppercase tracking-tight text-white sm:text-3xl">
                      {category.name}
                    </h3>
                    {category.description && <p className="mt-1 text-[var(--text-muted)]">{category.description}</p>}
                  </div>
                </div>
              </Reveal>

              <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {category.blogs?.slice(0, 6).map((blog, i) => (
                  <Reveal as="li" key={blog._id} delay={(i % 3) * 0.08}>
                    <BlogCard
                      href={`/blogs-detail?slug=${blog.slug}`}
                      image={blogImage(blog.thumbnail)}
                      title={blog.title}
                      excerpt={excerptOf(blog.content, 150)}
                      category={category.name}
                      metaLeft={blog.author?.name ? `By ${blog.author.name}` : undefined}
                      metaRight={`${blog.views || 0} views`}
                    />
                  </Reveal>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </section>
  );
};

export default FeaturedStories;
