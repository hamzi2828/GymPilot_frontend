"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Renders admin-entered heading text, turning `*word*` markers into
 * accent-coloured spans — e.g. "be *fit* & *healthier*". This is the only
 * markup the CMS copy supports, so admins can highlight words without HTML.
 */
export function AccentText({ text }: { text: string }) {
  const parts = text.split(/\*([^*]+)\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="home-accent-text">
            {part}
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

/**
 * The shared section header: accent dot + eyebrow label, uppercase title and
 * optional description. Keeps every homepage section on the same rhythm.
 */
export function SectionHeading({
  badge,
  heading,
  description,
  align = "center",
  dark = false,
  className = "",
}: {
  badge?: string;
  heading: string;
  description?: string;
  align?: "center" | "left";
  dark?: boolean;
  className?: string;
}) {
  const alignCls = align === "center" ? "text-center items-center" : "text-left items-start for-mobile-center";
  return (
    <header className={`flex flex-col ${alignCls} ${className}`}>
      {badge && (
        <div className="inline-flex items-center gap-2 mb-4">
          <span className="home-eyebrow-dot" aria-hidden="true"></span>
          <span className={`home-eyebrow-label ${dark ? "home-eyebrow-label-dark" : ""}`}>{badge}</span>
        </div>
      )}
      <h2
        className={`home-section-title text-2xl md:text-3xl lg:text-4xl ${
          dark ? "text-white" : "text-black"
        }`}
      >
        <AccentText text={heading} />
      </h2>
      {description && (
        <p
          className={`home-section-description mt-5 max-w-3xl ${
            dark ? "home-section-description-dark" : ""
          }`}
        >
          {description}
        </p>
      )}
    </header>
  );
}

/**
 * Fades + lifts its children in the first time they scroll into view.
 * Purely decorative: content is fully visible without JS and when the user
 * prefers reduced motion (handled in CSS).
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`home-reveal ${visible ? "is-visible" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
