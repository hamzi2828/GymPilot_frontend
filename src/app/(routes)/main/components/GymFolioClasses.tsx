"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { gymClassService, GymClass } from "../services/gymClassService";
import { DEFAULT_CLASSES, SectionHeaderContent } from "../services/homeService";
import { SectionHeading, Reveal } from "./SectionHeading";

/** Gap between cards, in px. Mirrors `--card-gap` in the stylesheet. */
const CARD_GAP = 24;
/** Ideal card width — the number of visible cards is derived from it. */
const IDEAL_CARD = 320;
const AUTO_INTERVAL = 5000;
const SWIPE_THRESHOLD = 50;

const GymFolioClasses = ({ content = DEFAULT_CLASSES }: { content?: SectionHeaderContent }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardsToShow, setCardsToShow] = useState(3);
  const [classesData, setClassesData] = useState<GymClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchLastX = useRef<number | null>(null);

  const totalCards = classesData.length;
  const maxIndex = Math.max(0, totalCards - cardsToShow);
  const canSlide = totalCards > cardsToShow;

  // Fetch classes on component mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await gymClassService.getActiveClasses();
        if (!cancelled) setClassesData(data);
      } catch (err) {
        console.error("Error fetching gym classes:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load classes");
          setClassesData([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* How many cards fit is measured from the track itself rather than read off a
     breakpoint table. The old fixed 302px card left a band of dead space on
     wide screens once the carousel reached its last index. */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const measure = () => {
      const width = el.clientWidth;
      if (!width) return;
      const fit = Math.floor((width + CARD_GAP) / (IDEAL_CARD + CARD_GAP));
      setCardsToShow(Math.max(1, Math.min(4, fit)));
    };

    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
    // The track only exists once the fetch resolves, so the observer has to be
    // attached again when it mounts — an empty dep list measured a null ref.
  }, [loading, classesData.length]);

  // Never leave the track scrolled past its last full page.
  useEffect(() => {
    setCurrentIndex((i) => Math.min(i, maxIndex));
  }, [maxIndex]);

  const next = useCallback(() => {
    setCurrentIndex((i) => (i >= maxIndex ? 0 : i + 1));
  }, [maxIndex]);

  const prev = useCallback(() => {
    setCurrentIndex((i) => (i <= 0 ? maxIndex : i - 1));
  }, [maxIndex]);

  useEffect(() => {
    if (paused || !canSlide) return;
    const timer = setInterval(next, AUTO_INTERVAL);
    return () => clearInterval(timer);
  }, [paused, canSlide, next, currentIndex]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX;
    touchLastX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    touchLastX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchLastX.current === null) return;
    const diff = touchStartX.current - touchLastX.current;
    if (Math.abs(diff) > SWIPE_THRESHOLD) {
      if (diff > 0) next();
      else prev();
    }
    touchStartX.current = null;
    touchLastX.current = null;
  };

  // No classes on the gym's books yet: the section is left out rather than
  // shown as a heading over an empty band.
  if (!loading && !error && classesData.length === 0) return null;

  return (
    <section className="section surface-dark home-dark-section relative overflow-hidden">
      <span className="section-seam section-seam--top" aria-hidden="true" />
      <div className="mx-auto">
        {/* Header Section */}
        <Reveal>
          <SectionHeading
            dark
            badge={content.badge}
            heading={content.heading}
            description={content.description}
            className="mb-16"
          />
        </Reveal>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)]"></div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-900/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-xl text-center">
            {error}
          </div>
        )}

        {/* Carousel */}
        {!loading && !error && classesData.length > 0 && (
          <Reveal>
            <div
              className="gymfolio4-carousel"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              <div
                ref={viewportRef}
                className="gymfolio4-carousel-container"
                style={
                  {
                    "--cards": cardsToShow,
                    "--index": currentIndex,
                    "--card-gap": `${CARD_GAP}px`,
                  } as React.CSSProperties
                }
              >
                <div
                  className="gymfolio4-carousel-track"
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  {classesData.map((classItem) => (
                    <Link
                      key={classItem._id}
                      href={`/classdetail?id=${classItem._id}`}
                      className="gymfolio4-carousel-card group"
                    >
                      <div
                        className="gymfolio4-card-image"
                        style={{
                          backgroundImage: `url('${
                            classItem.thumbnail || "/images/class-placeholder.svg"
                          }')`,
                        }}
                      ></div>
                      <div className="gymfolio4-card-overlay">
                        <h3 className="gymfolio4-card-title">{classItem.name}</h3>
                        <span className="gymfolio4-plus-icon" aria-hidden="true">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M6 12H18"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                            <path
                              d="M12 18V6"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                          </svg>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Arrows only earn their place when there is somewhere to go. */}
              {canSlide && (
                <>
                  <button
                    type="button"
                    onClick={prev}
                    className="gymfolio4-navigation-btn gymfolio4-navigation-btn--prev"
                    aria-label="Previous classes"
                  >
                    <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    className="gymfolio4-navigation-btn gymfolio4-navigation-btn--next"
                    aria-label="Next classes"
                  >
                    <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
};

export default GymFolioClasses;
