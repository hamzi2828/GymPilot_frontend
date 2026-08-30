"use client";

import React, { useEffect, useRef, useState } from "react";
import { DEFAULT_STATS, StatsContent } from "../services/homeService";

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
  const items = content.items?.length ? content.items : DEFAULT_STATS.items;

  return (
    <section className="home-stats-band" aria-label="Gym statistics">
      <div className="home-stats-glow" aria-hidden="true" />
      <div className="mx-auto px-4 md:px-8 lg:px-20">
        <dl className="home-stats-grid">
          {items.map((item, idx) => (
            <div key={idx} className="home-stat-item">
              <dd className="home-stat-value">
                <CountUp value={item.value} />
                {item.suffix && <span className="home-stat-suffix">{item.suffix}</span>}
              </dd>
              <dt className="home-stat-label">{item.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};

export default StatsSection;
