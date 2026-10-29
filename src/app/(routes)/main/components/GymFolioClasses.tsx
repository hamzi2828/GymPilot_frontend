"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { gymClassService, GymClass } from "../services/gymClassService";
import { DEFAULT_CLASSES, SectionHeaderContent } from "../services/homeService";
import { SectionHeading, Reveal } from "./SectionHeading";
import { Tilt3D, prefersReducedMotion } from "./motion3d";
import s from "./home3d.module.css";

const AUTO_INTERVAL = 5000;
const SWIPE_THRESHOLD = 40;
/** Cards further than this from the centre are hidden. */
const VISIBLE_RANGE = 2;

/** Signed distance of card `i` from the active one, wrapping round the loop. */
function offsetOf(i: number, active: number, n: number): number {
  let d = i - active;
  if (n > 2) {
    const half = Math.floor(n / 2);
    if (d > half) d -= n;
    if (d < -half) d += n;
    // Even counts: keep the opposite card on one side only.
    if (n % 2 === 0 && d === half) d = -half;
  }
  return d;
}

/** "45 min · Beginner" from whatever the class has filled in. */
function metaLine(c: GymClass): string {
  return [c.duration ? `${c.duration} min` : "", c.difficulty || ""].filter(Boolean).join(" · ");
}

const GymFolioClasses = ({ content = DEFAULT_CLASSES }: { content?: SectionHeaderContent }) => {
  const [active, setActive] = useState(0);
  const [classesData, setClassesData] = useState<GymClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const dragStart = useRef<number | null>(null);
  const dragged = useRef(false);

  const total = classesData.length;

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

  const goTo = useCallback(
    (i: number) => {
      if (!total) return;
      setActive(((i % total) + total) % total);
    },
    [total]
  );
  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  // Auto-advance, paused on hover/focus and for reduced motion.
  useEffect(() => {
    if (paused || total < 2 || prefersReducedMotion()) return;
    const timer = setInterval(() => setActive((i) => (i + 1) % total), AUTO_INTERVAL);
    return () => clearInterval(timer);
  }, [paused, total, active]);

  // Swipe / drag with any pointer.
  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientX;
    dragged.current = false;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    const diff = dragStart.current - e.clientX;
    dragStart.current = null;
    if (Math.abs(diff) > SWIPE_THRESHOLD) {
      dragged.current = true;
      if (diff > 0) next();
      else prev();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    }
  };

  // No classes on the gym's books yet: the section is left out rather than
  // shown as a heading over an empty band.
  if (!loading && !error && classesData.length === 0) return null;

  return (
    <section className="section surface-dark home-dark-section relative overflow-hidden">
      <span className="section-seam section-seam--top" aria-hidden="true" />
      <div className="mx-auto">
        <Reveal>
          <SectionHeading
            dark
            badge={content.badge}
            heading={content.heading}
            description={content.description}
            className="mb-12 lg:mb-16"
          />
        </Reveal>

        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)]"></div>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-900/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-xl text-center">
            {error}
          </div>
        )}

        {/* 3D coverflow: the active class faces the visitor, its neighbours
            turn away into depth. Arrows, dots, swipe and arrow keys move it. */}
        {!loading && !error && total > 0 && (
          <div
            className={s.flow}
            role="region"
            aria-roledescription="carousel"
            aria-label="Classes"
            tabIndex={0}
            onKeyDown={onKeyDown}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            <div
              className={s.flowStage}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              onPointerCancel={() => (dragStart.current = null)}
            >
              {classesData.map((c, i) => {
                const d = offsetOf(i, active, total);
                const ad = Math.abs(d);
                const isActive = d === 0;
                const hidden = ad > VISIBLE_RANGE;
                const meta = metaLine(c);
                const blurb = c.shortDescription || "";
                return (
                  <div
                    key={c._id}
                    className={`${s.flowCard} ${isActive ? s.active : ""} ${hidden ? s.hidden : ""}`}
                    style={{ "--d": d, "--ad": ad, zIndex: 20 - ad } as React.CSSProperties}
                    aria-hidden={!isActive}
                  >
                    <Tilt3D disabled={!isActive} max={7} radius={22}>
                      <Link
                        href={`/classdetail?id=${c._id}`}
                        className={s.flowLink}
                        tabIndex={isActive ? 0 : -1}
                        draggable={false}
                        aria-label={`${c.name}${meta ? `, ${meta}` : ""}`}
                        onClick={(e) => {
                          // A drag, or a tap on a side card, only moves the carousel.
                          if (dragged.current || !isActive) {
                            e.preventDefault();
                            dragged.current = false;
                            if (!isActive) goTo(i);
                          }
                        }}
                      >
                        <span
                          className={s.flowImg}
                          style={{ backgroundImage: `url('${c.thumbnail || "/images/class-placeholder.svg"}')` }}
                          aria-hidden="true"
                        />
                        <span className={s.flowScrim} aria-hidden="true" />
                        <div className={s.flowTop}>
                          {c.category ? <span className={s.flowChip}>{c.category}</span> : <span />}
                          {meta && (
                            <span className={s.flowMeta}>
                              <Clock size={13} strokeWidth={2.2} aria-hidden="true" />
                              {meta}
                            </span>
                          )}
                        </div>
                        <div className={s.flowBody}>
                          <h3 className={s.flowName}>{c.name}</h3>
                          {blurb && <p className={s.flowDesc}>{blurb}</p>}
                          <span className={s.flowCta}>
                            View class
                            <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
                          </span>
                        </div>
                      </Link>
                    </Tilt3D>
                  </div>
                );
              })}
            </div>

            {total > 1 && (
              <div className={s.flowControls}>
                <button type="button" onClick={prev} className={s.flowArrow} aria-label="Previous class">
                  <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
                </button>
                <div className={s.flowDots}>
                  {classesData.map((c, i) => (
                    <button
                      key={c._id}
                      type="button"
                      className={s.flowDotHit}
                      onClick={() => goTo(i)}
                      aria-label={`Show ${c.name}`}
                      aria-current={i === active ? "true" : undefined}
                    >
                      <span className={`${s.flowDot} ${i === active ? s.on : ""}`} />
                    </button>
                  ))}
                </div>
                <button type="button" onClick={next} className={s.flowArrow} aria-label="Next class">
                  <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default GymFolioClasses;
