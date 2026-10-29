"use client";

import React from "react";
import Image from "next/image";
import { ArrowDown, CalendarDays, Clock, Eye } from "lucide-react";
import PageHero from "@/components/site/PageHero";

interface HeroSectionProps {
  title: string;
  backgroundImage?: string;
  author?: {
    name: string;
    avatar?: string;
  };
  readingTime?: string;
  publishDate?: string;
  views?: number;
  category?: {
    name: string;
    slug?: string;
  };
}

const HeroSection: React.FC<HeroSectionProps> = ({
  title,
  // A post without a cover photo gets the plain dark banner, not a stock
  // photograph the gym never chose.
  backgroundImage,
  author,
  readingTime,
  publishDate,
  views = 0,
  category
}) => {
  const meta = "inline-flex items-center gap-2";
  return (
    <PageHero
      title={title}
      eyebrow={category?.name}
      image={backgroundImage}
      crumbs={[{ label: "Home", href: "/" }, { label: "Blog", href: "/blogs" }, { label: "Article" }]}
      tall
      lead={
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[15px] text-white/75">
          {author && (
            <span className="inline-flex items-center gap-3">
              {author.avatar && (
                <Image src={author.avatar} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover ring-2 ring-[var(--accent)]" />
              )}
              <span className="font-medium text-white">By {author.name}</span>
            </span>
          )}
          {readingTime && (
            <span className={meta}>
              <Clock size={16} className="text-[var(--accent)]" aria-hidden="true" />
              {readingTime}
            </span>
          )}
          {publishDate && (
            <span className={meta}>
              <CalendarDays size={16} className="text-[var(--accent)]" aria-hidden="true" />
              {publishDate}
            </span>
          )}
          <span className={meta}>
            <Eye size={16} className="text-[var(--accent)]" aria-hidden="true" />
            {views.toLocaleString()} views
          </span>
        </div>
      }
      actions={
        <a href="#article" className="btn btn--primary btn--lg">
          <span>Start Reading</span>
          <ArrowDown size={17} strokeWidth={2.4} aria-hidden="true" />
        </a>
      }
    />
  );
};

export default HeroSection;
