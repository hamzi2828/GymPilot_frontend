"use client";

import React, { useEffect, useRef, useState } from "react";
import { DEFAULT_STATS, StatsContent } from "../services/homeService";
import { Depth, Tilt3D } from "./motion3d";
import s from "./home3d.module.css";

const COUNT_DURATION = 1400;

/**
 * Counts a stat up from 0 the first time it scrolls into view. Non-numeric
 * values (e.g. "24/7") render as-is; reduced-motion users get the final
 * value immediately.
 */
function CountUp({ value }: { value: string }) {
  const target = Number(String(value).replace(/[^0-9.]/g, ""));
  const isNumeric = Number.isFinite(target) && String(value).trim() !== "" && /[0-9]/.test(value);
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(isNumeric ? "0" : value);

  useEffect(() => {
    if (!isNumeric) {
      setDisplay(value);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setDisplay(target.toLocaleString());
      return;
    }
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(target.toLocaleString());
      return;
    }

    let raf = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / COUNT_DURATION);
          // ease-out cubic — fast start, gentle landing
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay(Math.round(target * eased).toLocaleString());
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [isNumeric, target, value]);

  return <span ref={ref}>{display}</span>;
}

/**
 * The numbers band. Rendered on the palette's dark base with accent numerals
 * and hairline separators — a full-bleed block of saturated brand colour was
 * the loudest thing on the page and read as a template banner.
 */
const StatsSection = ({ content = DEFAULT_STATS }: { content?: StatsContent }) => {
  // Only figures the gym entered itself. With none, the band is not shown.
  const items = (content.items ?? []).filter((item) => item && String(item.value ?? "").trim() && item.label);

  if (items.length === 0) return null;

  return (
    <section className="home-stats-band" aria-label="Gym statistics">
      <div className="home-stats-glow" aria-hidden="true" />
      <div className="mx-auto px-4 md:px-8 lg:px-20">
        <div
          className={s.statsGrid}
          style={
            {
              "--cols": Math.min(items.length, 4),
              "--cols-sm": Math.min(items.length, 2),
            } as React.CSSProperties
          }
        >
          {/* Each figure is a glass card that flips up in turn, then counts. */}
          {items.map((item, idx) => (
            <Depth key={idx} index={idx}>
              <Tilt3D max={6} radius={22}>
                <div className={s.statCard}>
                  <p className="home-stat-value m-0">
                    <CountUp value={String(item.value)} />
                    {item.suffix && <span className="home-stat-suffix">{item.suffix}</span>}
                  </p>
                  <p className="home-stat-label mb-0">{item.label}</p>
                </div>
              </Tilt3D>
            </Depth>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
