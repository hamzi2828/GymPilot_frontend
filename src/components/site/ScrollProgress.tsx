"use client";

// Round badge in the bottom-right corner: a ring that fills as the page is
// scrolled, with the percentage inside. Clicking it goes back to the top.
// Sits above the WhatsApp button when a gym has one (see the CSS).

import { useEffect, useState } from "react";
import s from "./ScrollProgress.module.css";

const R = 22;
const CIRC = 2 * Math.PI * R;

export default function ScrollProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setPct(max > 0 ? Math.min(100, Math.max(0, Math.round((window.scrollY / max) * 100))) : 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const toTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      className={`${s.ring} ${pct > 2 ? s.show : ""}`}
      aria-label={`Back to top (${pct}% of the page scrolled)`}
      tabIndex={pct > 2 ? 0 : -1}
    >
      <svg viewBox="0 0 52 52" className={s.svg} aria-hidden="true">
        <circle cx="26" cy="26" r={R} className={s.track} />
        <circle
          cx="26"
          cy="26"
          r={R}
          className={s.bar}
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - pct / 100)}
        />
      </svg>
      <span className={s.inner} aria-hidden="true">
        <svg viewBox="0 0 24 24" className={s.arrow}>
          <path d="M12 19V5M6 11l6-6 6 6" />
        </svg>
        <span className={s.num}>{pct}%</span>
      </span>
    </button>
  );
}
