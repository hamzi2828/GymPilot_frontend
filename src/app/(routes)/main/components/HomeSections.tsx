"use client";

import React, { useEffect, useState } from "react";
import {
  AboutContent,
  BlogsContent,
  ContactContent,
  DEFAULT_ABOUT,
  DEFAULT_BLOGS,
  DEFAULT_CLASSES,
  DEFAULT_CONTACT,
  DEFAULT_SECTIONS,
  DEFAULT_STATS,
  DEFAULT_TESTIMONIALS_HEADER,
  DEFAULT_TRAINERS,
  DEFAULT_VIDEOS,
  HomeSection,
  SectionHeaderContent,
  StatsContent,
  TrainersContent,
  VideosContent,
  homeService,
  mergeContent,
  normalizeGalleryContent,
} from "../services/homeService";
import GymAboutSection from "./GymAboutSection";
import StatsSection from "./StatsSection";
import GymFolioClasses from "./GymFolioClasses";
import GymfolioGallery from "./GymfolioGallery";
import VideosSection from "./VideosSection";
import GymTrainersSection from "./GymTrainersSection";
import TestimonialsSection from "./TestimonialsSection";
import ContactSection from "./ContactSection";
import BlogsSection from "./BlogsSection";

/**
 * Everything on the homepage below the hero banner.
 *
 * Section order, visibility and content come from the admin panel
 * (/admin/homepage → /home-sections API). Unknown keys are skipped so an
 * older frontend never crashes on a newer backend.
 */
export default function HomeSections() {
  const [sections, setSections] = useState<HomeSection[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await homeService.getSections();
        if (!cancelled) setSections(data.length ? data : DEFAULT_SECTIONS);
      } catch {
        // API down — render the built-in defaults rather than a blank page.
        if (!cancelled) setSections(DEFAULT_SECTIONS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The hero above already fills the viewport; sections appear as one batch
  // once the config lands, which avoids a flash of default copy.
  if (!sections) return null;

  const ordered = [...sections]
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <>
      {ordered.map((section) => {
        switch (section.key) {
          case "about":
            return (
              <GymAboutSection
                key={section.key}
                content={mergeContent<AboutContent>(DEFAULT_ABOUT, section.content)}
              />
            );
          case "stats":
            return (
              <StatsSection
                key={section.key}
                content={mergeContent<StatsContent>(DEFAULT_STATS, section.content)}
              />
            );
          case "classes":
            return (
              <GymFolioClasses
                key={section.key}
                content={mergeContent<SectionHeaderContent>(DEFAULT_CLASSES, section.content)}
              />
            );
          case "gallery":
            // Gallery has its own normaliser: it also converts legacy flat
            // image lists, which a plain field merge would mask with defaults.
            return <GymfolioGallery key={section.key} content={normalizeGalleryContent(section.content)} />;
          case "videos":
            return (
              <VideosSection
                key={section.key}
                content={mergeContent<VideosContent>(DEFAULT_VIDEOS, section.content)}
              />
            );
          case "trainers":
            return (
              <GymTrainersSection
                key={section.key}
                content={mergeContent<TrainersContent>(DEFAULT_TRAINERS, section.content)}
              />
            );
          case "testimonials":
            return (
              <TestimonialsSection
                key={section.key}
                content={mergeContent<SectionHeaderContent>(DEFAULT_TESTIMONIALS_HEADER, section.content)}
              />
            );
          case "contact":
            return (
              <ContactSection
                key={section.key}
                content={mergeContent<ContactContent>(DEFAULT_CONTACT, section.content)}
              />
            );
          case "blogs":
            return (
              <BlogsSection
                key={section.key}
                content={mergeContent<BlogsContent>(DEFAULT_BLOGS, section.content)}
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
}
