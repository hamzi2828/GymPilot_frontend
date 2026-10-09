"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { heroService, type HeroSlide } from "../services/heroService";
import { resolveMediaUrl } from "../services/homeService";
import { useSiteSettings } from "@/components/ThemeProvider";

/** How long a slide holds before advancing. Slower than a typical banner on
 *  purpose — the imagery is the product, and fast cuts read as cheap. */
const AUTO_INTERVAL = 6500;

// Shown when the gym has no active slides yet, or the request fails, so the
// banner never renders as an empty block: the gym's own name and the two
// pages a visitor most often wants. No photograph and no offer, because the
// gym has supplied neither.
const fallbackSlide = (siteName: string): HeroSlide => ({
  _id: "fallback",
  title: siteName ? `Welcome to ${siteName}` : "Welcome",
  description: "",
  imageUrl: "",
  buttonText: "View Packages",
  buttonLink: "/packages",
  secondButtonText: "Browse Classes",
  secondButtonLink: "/classes",
  isActive: true,
  order: 1,
  platform: "gymfolio",
  createdAt: "",
  updatedAt: "",
});

/**
 * `compact` shortens the banner for interior pages, where a full-screen hero
 * would push the page's actual content below the fold.
 */
const HeroCarousel: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [fetched, setFetched] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const { siteName } = useSiteSettings();
  // The gym's slides, or the one neutral slide when it has none to show.
  const slides = useMemo(
    () => (fetched.length ? fetched : [fallbackSlide(siteName)]),
    [fetched, siteName]
  );
  const sectionRef = useRef<HTMLElement>(null);

  // Fetch hero slides from API
  useEffect(() => {
    const fetchSlides = async () => {
      try {
        setLoading(true);
        const data = await heroService.getActiveSlides();
        setFetched([...data].sort((a, b) => a.order - b.order));
        setActive(0); // Reset to first slide when data changes
      } catch (err) {
        // The neutral slide stands in; a visitor is not shown an error for a
        // banner.
        console.error("Failed to fetch hero slides:", err);
        setFetched([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSlides();
  }, []);

  // Auto-play. Pausing on hover/focus and while the tab is hidden keeps the
  // slide the visitor is actually reading on screen.
  useEffect(() => {
    if (paused || slides.length < 2) return;
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, AUTO_INTERVAL);
    return () => clearInterval(timer);
  }, [paused, slides.length, active]);

  const goTo = useCallback(
    (idx: number) => {
      if (!slides.length) return;
      setActive(((idx % slides.length) + slides.length) % slides.length);
    },
    [slides.length]
  );

  const handlePrev = useCallback(() => goTo(active - 1), [active, goTo]);
  const handleNext = useCallback(() => goTo(active + 1), [active, goTo]);

  // Arrow keys move the carousel while it holds focus.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      handlePrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      handleNext();
    }
  };

  const scrollPastHero = () => {
    const next = sectionRef.current?.nextElementSibling;
    if (next) next.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
  };

  // Loading state — a dark plate rather than a grey box, so the fold does not
  // flash white before the artwork arrives.
  if (loading) {
    return (
      <section className="hero hero--placeholder" aria-label="Loading banner" aria-busy="true">
        <div className="hero__loader" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>
    );
  }

  const slide = slides[Math.min(active, slides.length - 1)];

  return (
    <section
      ref={sectionRef}
      id="hero"
      className={`hero${compact ? " hero--compact" : ""}`}
      aria-roledescription="carousel"
      aria-label="Featured highlights"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Stage: every slide stays mounted so the cross-fade has something to
          fade between, and only the active one is exposed to assistive tech. */}
      <div className="hero__stage" aria-live="polite">
        {slides.map((s, idx) => {
          // The gym's own upload, or the plain dark plate: never a stock photo.
          const image = resolveMediaUrl(s.imageUrl);
          return (
            <div
              key={s._id}
              className={`hero__slide${active === idx ? " is-active" : ""}`}
              aria-hidden={active !== idx}
            >
              {image && (
                <div
                  className="hero__media"
                  style={{ backgroundImage: `url('${image}')` }}
                  role="img"
                  aria-label={s.ariaLabel || s.title}
                />
              )}
            </div>
          );
        })}
        <div className="hero__scrim" aria-hidden="true" />
        <div className="hero__vignette" aria-hidden="true" />
      </div>

      <div className="hero__inner">
        {/* Remounting on slide change is what replays the staggered entrance. */}
        <div className="hero__content" key={slide._id}>
          {siteName && (
            <span className="hero__eyebrow">
              <span className="hero__eyebrow-dot" aria-hidden="true" />
              {siteName}
            </span>
          )}

          <h1 className="hero__title">{slide.title}</h1>

          {slide.description && <p className="hero__lede">{slide.description}</p>}

          <div className="hero__actions">
            {slide.buttonText && slide.buttonLink && (
              <Link href={slide.buttonLink} className="btn btn--primary btn--lg">
                <span>{slide.buttonText}</span>
                <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            )}
            {slide.secondButtonText && slide.secondButtonLink && (
              <Link href={slide.secondButtonLink} className="btn btn--glass btn--lg">
                <span>{slide.secondButtonText}</span>
                <ArrowRight size={17} strokeWidth={2.2} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      {slides.length > 1 && (
        <div className="hero__controls">
          <span className="hero__counter" aria-hidden="true">
            <b>{String(active + 1).padStart(2, "0")}</b>
            <i />
            {String(slides.length).padStart(2, "0")}
          </span>

          <div className="hero__dots" role="tablist" aria-label="Choose a slide">
            {slides.map((s, idx) => (
              <button
                key={s._id}
                type="button"
                role="tab"
                aria-selected={active === idx}
                aria-label={`Slide ${idx + 1}: ${s.title}`}
                className={`hero__dot${active === idx ? " is-active" : ""}`}
                onClick={() => goTo(idx)}
              >
                <span
                  className="hero__dot-fill"
                  // The fill runs for exactly one autoplay cycle, so the bar is
                  // an honest countdown rather than decoration.
                  style={{
                    animationDuration: `${AUTO_INTERVAL}ms`,
                    animationPlayState: paused || active !== idx ? "paused" : "running",
                  }}
                />
              </button>
            ))}
          </div>

          <div className="hero__arrows">
            <button type="button" className="hero__arrow" aria-label="Previous slide" onClick={handlePrev}>
              <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
            </button>
            <button type="button" className="hero__arrow" aria-label="Next slide" onClick={handleNext}>
              <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <button type="button" className="hero__scroll-cue" onClick={scrollPastHero} aria-label="Scroll to content">
        <span className="hero__scroll-track" aria-hidden="true">
          <span className="hero__scroll-thumb" />
        </span>
        <span className="hero__scroll-label">Scroll</span>
      </button>
    </section>
  );
};

export default HeroCarousel;
