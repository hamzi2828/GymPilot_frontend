"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import TiltCard from "@/components/site/TiltCard";

/** One article card, shared by the blog list and the related articles. */
export default function BlogCard({
  href,
  image,
  title,
  excerpt,
  category,
  metaLeft,
  metaRight,
  compact = false,
}: {
  href: string;
  image: string;
  title: string;
  excerpt?: string;
  category?: string;
  metaLeft?: React.ReactNode;
  metaRight?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <TiltCard max={7} className="group h-full rounded-3xl">
      <Link
        href={href}
        className="flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] transition-colors duration-300 hover:border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
      >
        <div className={`relative overflow-hidden ${compact ? "h-44" : "h-56"}`}>
          <Image
            src={image}
            alt=""
            fill
            sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-transparent to-transparent" aria-hidden="true" />
          {category && (
            <span className="absolute left-4 top-4 rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--on-accent)]">
              {category}
            </span>
          )}
          <span
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-colors group-hover:bg-[var(--accent)] group-hover:text-[var(--on-accent)]"
            aria-hidden="true"
          >
            <ArrowUpRight size={16} />
          </span>
        </div>
        <div className={`flex flex-1 flex-col ${compact ? "p-5" : "p-6"}`}>
          <h3 className={`line-clamp-2 font-['Montserrat'] font-extrabold leading-snug text-white transition-colors group-hover:text-[var(--accent)] ${compact ? "text-base" : "text-xl"}`}>
            {title}
          </h3>
          {excerpt && (
            <p className={`mt-3 text-sm leading-relaxed text-[var(--text-muted)] ${compact ? "line-clamp-2" : "line-clamp-3"}`}>{excerpt}</p>
          )}
          {(metaLeft || metaRight) && (
            <div className="mt-auto pt-5">
              <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-muted)]">
                <span className="min-w-0 truncate">{metaLeft}</span>
                <span className="flex-none">{metaRight}</span>
              </div>
            </div>
          )}
        </div>
      </Link>
    </TiltCard>
  );
}
