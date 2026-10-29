"use client";

import React, { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { heroSectionService, HeroSectionData } from "../services/heroSectionService";
import PageHero from "@/components/site/PageHero";

const HeroSection: React.FC = () => {
  const [heroData, setHeroData] = useState<HeroSectionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHeroData = async () => {
      try {
        setIsLoading(true);
        const data = await heroSectionService.getActiveHeroSection();
        setHeroData(data);
      } catch (error) {
        console.error('Error fetching hero data:', error);
        setHeroData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHeroData();
  }, []);

  if (isLoading) {
    return (
      <section className="relative flex min-h-[60vh] items-center justify-center bg-[var(--base)]" aria-busy="true">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-b-[var(--accent)]" />
      </section>
    );
  }

  // No banner set up for the blog, or it could not be loaded: the page gets a
  // plain heading. A visitor is never shown a note meant for the gym's admin.
  if (!heroData) {
    return <PageHero title="Blog" crumbs={[{ label: "Home", href: "/" }, { label: "Blog" }]} />;
  }

  return (
    <PageHero
      title={heroData.title || "Blog"}
      lead={heroData.subtitle || undefined}
      image={heroData.backgroundImage || undefined}
      crumbs={[{ label: "Home", href: "/" }, { label: "Blog" }]}
      tall
      actions={
        (heroData.primaryButtonText && heroData.primaryButtonLink) || (heroData.secondaryButtonText && heroData.secondaryButtonLink) ? (
          <>
            {/* A button with no text or no link set is left out. */}
            {heroData.primaryButtonText && heroData.primaryButtonLink && (
              <a href={heroData.primaryButtonLink} className="btn btn--primary btn--lg">
                <span>{heroData.primaryButtonText}</span>
                <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
              </a>
            )}
            {heroData.secondaryButtonText && heroData.secondaryButtonLink && (
              <a href={heroData.secondaryButtonLink} className="btn btn--glass btn--lg">
                <span>{heroData.secondaryButtonText}</span>
              </a>
            )}
          </>
        ) : undefined
      }
    />
  );
};

export default HeroSection;
