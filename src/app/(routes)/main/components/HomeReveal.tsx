"use client";

// Wraps one homepage section so it rises into view as it scrolls in, and its
// cards (any grid inside it) follow one after another (globals.css:
// .home-rise; the headings keep their own Reveal). Hidden only once
// JavaScript is running and only below the fold; a section already on
// screen, a browser without IntersectionObserver, or a visitor who asked for
// reduced motion just sees it.

import { useLayoutEffect, useRef } from "react";

export default function HomeReveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rect = el.getBoundingClientRect();
    if (reduced || typeof IntersectionObserver === "undefined" || rect.top < window.innerHeight * 0.9) {
      el.classList.add("is-in");
      return;
    }
    el.classList.add("is-waiting");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.remove("is-waiting");
          el.classList.add("is-in");
          observer.disconnect();
        }
      },
      // Start a little before the section reaches the screen.
      { rootMargin: "0px 0px 20% 0px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="home-rise" style={{ transitionDuration: "0.5s" }}>
      {children}
    </div>
  );
}
