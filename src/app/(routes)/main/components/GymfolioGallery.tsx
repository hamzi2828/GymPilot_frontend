"use client";
import React, { useMemo, useState } from "react";
import Image from "next/image";
import {
  DEFAULT_GALLERY,
  GALLERY_PAGE_SIZE,
  GalleryContent,
  normalizeGalleryContent,
  resolveMediaUrl,
} from "../services/homeService";
import { SectionHeading, Reveal } from "./SectionHeading";

/**
 * Photo gallery split into admin-defined sub-sections (Strength, Cardio, …).
 * Photos render 4 per row, at most 2 rows per page; a slider pages through
 * anything beyond the first 8.
 */
const GymfolioGallery = ({ content = DEFAULT_GALLERY }: { content?: GalleryContent }) => {
  const normalized = useMemo(() => normalizeGalleryContent(content), [content]);
  const groups = normalized.groups;

  const [activeGroup, setActiveGroup] = useState(0);
  const [page, setPage] = useState(0);

  const group = groups[Math.min(activeGroup, groups.length - 1)];
  const images = group?.images ?? [];
  const pageCount = Math.max(1, Math.ceil(images.length / GALLERY_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = images.slice(safePage * GALLERY_PAGE_SIZE, safePage * GALLERY_PAGE_SIZE + GALLERY_PAGE_SIZE);

  const selectGroup = (idx: number) => {
    setActiveGroup(idx);
    setPage(0);
  };

  const prevPage = () => setPage((p) => (p <= 0 ? pageCount - 1 : p - 1));
  const nextPage = () => setPage((p) => (p >= pageCount - 1 ? 0 : p + 1));

  if (groups.length === 0) return null;

  return (
    <section className="section surface-paper gymfolio6-gallery-bg">
      <div className="mx-auto">
        {/* Header */}
        <Reveal>
          <SectionHeading badge={normalized.badge} heading={normalized.heading} className="mb-8 lg:mb-10" />
        </Reveal>

        {/* Sub-section pills */}
        {groups.length > 1 && (
          <Reveal delay={80}>
            <div className="flex flex-wrap items-center justify-center gap-2 mb-10" role="tablist" aria-label="Gallery categories">
              {groups.map((g, idx) => (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={idx === activeGroup}
                  onClick={() => selectGroup(idx)}
                  className={`home-gallery-pill ${idx === activeGroup ? "is-active" : ""}`}
                >
                  {g.title || `Set ${idx + 1}`}
                </button>
              ))}
            </div>
          </Reveal>
        )}

        {/* Photo grid: 4 per row, max 2 rows per page */}
        <Reveal delay={140}>
          <div
            key={`${activeGroup}-${safePage}`}
            className="home-gallery-page grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-6"
          >
            {visible.map((image, index) => {
              const src = resolveMediaUrl(image.src);
              return (
                <figure key={`${safePage}-${index}`} className="home-gallery-tile group">
                  <Image
                    src={src}
                    alt={image.alt || group.title || "Gym gallery image"}
                    width={420}
                    height={320}
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    loading="lazy"
                    unoptimized={/^https?:\/\//i.test(src)}
                  />
                </figure>
              );
            })}
          </div>

          {/* Slider controls appear only past 8 photos */}
          {pageCount > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <button type="button" onClick={prevPage} aria-label="Previous photos" className="home-gallery-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path
                    d="M15 19.9201L8.47997 13.4001C7.70997 12.6301 7.70997 11.3701 8.47997 10.6001L15 4.08008"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeMiterlimit="10"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <div className="flex items-center gap-1.5" role="tablist" aria-label="Photo pages">
                {Array.from({ length: pageCount }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-label={`Go to photo page ${i + 1}`}
                    aria-selected={i === safePage}
                    onClick={() => setPage(i)}
                    className={`home-gallery-dot ${i === safePage ? "is-active" : ""}`}
                  />
                ))}
              </div>

              <button type="button" onClick={nextPage} aria-label="Next photos" className="home-gallery-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path
                    d="M8.9101 20.67C8.7201 20.67 8.5301 20.6 8.3801 20.45C8.0901 20.16 8.0901 19.68 8.3801 19.39L14.9001 12.87C15.3801 12.39 15.3801 11.61 14.9001 11.13L8.3801 4.61002C8.0901 4.32002 8.0901 3.84002 8.3801 3.55002C8.6701 3.26002 9.1501 3.26002 9.4401 3.55002L15.9601 10.07C16.4701 10.58 16.7601 11.27 16.7601 12C16.7601 12.73 16.4801 13.42 15.9601 13.93L9.4401 20.45C9.2901 20.59 9.1001 20.67 8.9101 20.67Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
};

export default GymfolioGallery;
