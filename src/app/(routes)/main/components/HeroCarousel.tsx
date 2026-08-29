"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { heroService, type HeroSlide } from "../services/heroService";

const AUTO_INTERVAL = 4000;

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

const HeroCarousel: React.FC = () => {
  const [active, setActive] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        console.error('Failed to fetch hero slides:', err);
        setError('Failed to load carousel content');
        setSlides(FALLBACK_SLIDES);
      } finally {
        setLoading(false);
      }
    };

    fetchSlides();
  }, []);

  // Auto-play functionality
  React.useEffect(() => {
    if (!autoPlay || slides.length === 0) return;
    const timer = setInterval(() => {
      setActive((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, AUTO_INTERVAL);
    return () => clearInterval(timer);
  }, [autoPlay, active, slides.length]);

  const pauseAndMove = (moveFn: () => void) => {
    setAutoPlay(false);
    moveFn();
    setTimeout(() => setAutoPlay(true), AUTO_INTERVAL);
  };

  const handlePrev = () =>
    pauseAndMove(() =>
      setActive((prev) => (prev === 0 ? slides.length - 1 : prev - 1))
    );
  const handleNext = () =>
    pauseAndMove(() =>
      setActive((prev) => (prev === slides.length - 1 ? 0 : prev + 1))
    );
  const goTo = (idx: number) => pauseAndMove(() => setActive(idx));

  // Loading state
  if (loading) {
    return (
      <section
        id="hero"
        className="hero-section relative overflow-hidden"
        role="banner"
        aria-label="Loading carousel"
      >
        <div className="hero-carousel relative flex items-center justify-center min-h-[500px] bg-gray-100">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="text-gray-600">Loading carousel...</span>
          </div>
        </div>
      </section>
    );
  }

  // Error state with fallback
  if (error && slides.length === 0) {
    return (
      <section
        id="hero"
        className="hero-section relative overflow-hidden"
        role="banner"
        aria-label="Carousel error"
      >
        <div className="hero-carousel relative flex items-center justify-center min-h-[500px] bg-gray-100">
          <div className="text-center">
            <p className="text-red-600 mb-2">{error}</p>
            <p className="text-gray-500">Please refresh the page to try again.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="hero"
      className="hero-section relative overflow-hidden"
      role="banner"
      aria-label="Fashion showcase carousel"
    >
      <div className="hero-carousel relative" id="hero-carousel">
        {slides.map((slide, idx) => (
          <article
            key={slide._id}
            className={`hero-slide${active === idx ? " active" : ""}`}
            role="tabpanel"
            aria-label={`Slide ${idx + 1} of ${slides.length}`}
            id={`slide-${idx + 1}`}
            style={{ display: active === idx ? "block" : "none" }}
          >
            <div
              className="hero-background-image"
              style={{ backgroundImage: `url('${resolveSlideImage(slide.imageUrl)}')` }}
              role="img"
              aria-label={slide.ariaLabel || slide.title}
            >
              <div className="hero-overlay" aria-hidden="true"></div>
              <div className="hero-content">
                <div className="hero-text-content">
                  <header className="hero-header-lines">
                    <h1 className="hero-heading">{slide.title}</h1>
                    <p className="hero-description">{slide.description}</p>
                  </header>
                  <nav className="hero-buttons" aria-label="Shop categories">
                    {slide.buttonText && slide.buttonLink && (
                      <Link
                        href={slide.buttonLink}
                        className="hero-cta-button"
                        role="button"
                        aria-label={slide.buttonText}
                      >
                        <span className="hero-cta-text">{slide.buttonText}</span>
                        <i className="fas fa-arrow-right" aria-hidden="true"></i>
                      </Link>
                    )}
                    {slide.secondButtonText && slide.secondButtonLink && (
                      <Link
                        href={slide.secondButtonLink}
                        className="hero-cta-button"
                        role="button"
                        aria-label={slide.secondButtonText}
                      >
                        <span className="hero-cta-text">{slide.secondButtonText}</span>
                        <i className="fas fa-arrow-right" aria-hidden="true"></i>
                      </Link>
                    )}
                  </nav>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
      {slides.length > 1 && (
        <nav
          className="hero-navigation"
          role="tablist"
          aria-label="Carousel navigation"
        >
          <button
            className="hero-nav-btn hero-prev-btn"
            aria-label="Previous slide"
            aria-controls="hero-carousel"
            type="button"
            onClick={handlePrev}
          >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M14.9998 19.92L8.47984 13.4C7.70984 12.63 7.70984 11.37 8.47984 10.6L14.9998 4.08002"
              stroke="white"
              strokeWidth="1.5"
              strokeMiterlimit="10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="hero-indicators" role="tablist" aria-label="Slide indicators">
          {slides.map((_, idx) => (
            <button
              key={idx}
              className={`hero-indicator${active === idx ? " active" : ""}`}
              data-slide={idx}
              role="tab"
              aria-selected={active === idx}
              aria-controls={`slide-${idx + 1}`}
              aria-label={`Go to slide ${idx + 1}`}
              type="button"
              onClick={() => goTo(idx)}
            ></button>
          ))}
        </div>
        <button
          className="hero-nav-btn hero-next-btn"
          aria-label="Next slide"
          aria-controls="hero-carousel"
          type="button"
          onClick={handleNext}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M8.91156 20.67C8.72156 20.67 8.53156 20.6 8.38156 20.45C8.09156 20.16 8.09156 19.68 8.38156 19.39L14.9016 12.87C15.3816 12.39 15.3816 11.61 14.9016 11.13L8.38156 4.61002C8.09156 4.32002 8.09156 3.84002 8.38156 3.55002C8.67156 3.26002 9.15156 3.26002 9.44156 3.55002L15.9616 10.07C16.4716 10.58 16.7616 11.27 16.7616 12C16.7616 12.73 16.4816 13.42 15.9616 13.93L9.44156 20.45C9.29156 20.59 9.10156 20.67 8.91156 20.67Z"
              fill="white"
            />
          </svg>
        </button>
        </nav>
      )}
    </section>
  );
};

export default HeroCarousel;