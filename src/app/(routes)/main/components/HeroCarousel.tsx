"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { heroService, type HeroSlide } from "../services/heroService";
import { useSiteSettings } from "@/components/ThemeProvider";

/** How long a slide holds before advancing. Slower than a typical banner on
 *  purpose — the imagery is the product, and fast cuts read as cheap. */
const AUTO_INTERVAL = 6500;

// Shown when the API has no active slides yet, or the request fails, so the
// banner never renders as an empty block.
const FALLBACK_SLIDES: HeroSlide[] = [
  {
    _id: "fallback-1",
    title: "Train Hard. Feel Unstoppable.",
    description:
      "State-of-the-art equipment, expert coaching and a community that shows up. Your first session is on us.",
    imageUrl: "/images/hero.webp",
    buttonText: "View Packages",
    buttonLink: "/packages",
    secondButtonText: "Browse Classes",
    secondButtonLink: "/classes",
    isActive: true,
    order: 1,
    ariaLabel: "Athlete training in the gym",
    platform: "gymfolio",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "fallback-2",
    title: "Coaching Built Around You",
    description:
      "Work one-to-one with certified trainers who tailor every session to your goals, your pace and your schedule.",
    imageUrl: "/images/gym-large.webp",
    buttonText: "Meet the Trainers",
    buttonLink: "/trainers",
    secondButtonText: "Get in Touch",
    secondButtonLink: "/contact-us",
    isActive: true,
    order: 2,
    ariaLabel: "Personal trainer coaching a client",
    platform: "gymfolio",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Slides stored by the CMS use backend-relative upload paths; bundled assets in
// /public must be served by Next, not the API host.
const resolveSlideImage = (imageUrl: string): string => {
  if (!imageUrl) return "/images/hero.webp";
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  if (imageUrl.startsWith("/uploads")) {
    return `${process.env.NEXT_PUBLIC_BACKEND_URL ?? ""}${imageUrl}`;
  }
  return imageUrl;
};

/**
 * `compact` shortens the banner for interior pages, where a full-screen hero
 * would push the page's actual content below the fold.
 */
const HeroCarousel: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { siteName } = useSiteSettings();
  const sectionRef = useRef<HTMLElement>(null);

  // Fetch hero slides from API
  useEffect(() => {
    const fetchSlides = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await heroService.getActiveSlides();
        // An empty result is a valid response, not an error — still fall back so
        // the banner is never blank.
        const sortedSlides = data.length
          ? [...data].sort((a, b) => a.order - b.order)
          : FALLBACK_SLIDES;
        setSlides(sortedSlides);
        setActive(0); // Reset to first slide when data changes
      } catch (err) {
        console.error("Failed to fetch hero slides:", err);
        setError("Failed to load carousel content");
        setSlides(FALLBACK_SLIDES);
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

  if (error && slides.length === 0) {
    return (
      <section className="hero hero--placeholder" aria-label="Banner unavailable">
        <div className="hero__inner">
          <p className="hero__lede">{error}</p>
          <p className="hero__lede">Please refresh the page to try again.</p>
        </div>
      </section>
    );
  }

  const slide = slides[active];

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
        {slides.map((s, idx) => (
          <div
            key={s._id}
            className={`hero__slide${active === idx ? " is-active" : ""}`}
            aria-hidden={active !== idx}
          >
            <div
              className="hero__media"
              style={{ backgroundImage: `url('${resolveSlideImage(s.imageUrl)}')` }}
              role="img"
              aria-label={s.ariaLabel || s.title}
            />
          </div>
        ))}
        <div className="hero__scrim" aria-hidden="true" />
        <div className="hero__vignette" aria-hidden="true" />
      </div>

      <div className="hero__inner">
        {/* Remounting on slide change is what replays the staggered entrance. */}
        <div className="hero__content" key={slide._id}>
          <span className="hero__eyebrow">
            <span className="hero__eyebrow-dot" aria-hidden="true" />
            {siteName}
          </span>

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
