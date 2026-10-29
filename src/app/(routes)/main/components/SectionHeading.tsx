"use client";

import React, { useEffect, useRef, useState } from "react";
import { Title3D } from "./motion3d";
import s from "./home3d.module.css";

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

/** Accent dot + label in a soft pill, used above every section title. */
export function Eyebrow({ label, dark = false }: { label?: string; dark?: boolean }) {
  if (!label) return null;
  return (
    <div className={`${s.eyebrow} ${dark ? s.eyebrowDark : ""}`}>
      <span className="home-eyebrow-dot" aria-hidden="true"></span>
      <span className={`home-eyebrow-label ${dark ? "home-eyebrow-label-dark" : ""}`}>{label}</span>
    </div>
  );
}

/** Big uppercase title whose words flip up in 3D as it scrolls in. */
export function SectionTitle({ text, dark = false, className = "" }: { text: string; dark?: boolean; className?: string }) {
  return (
    <Title3D
      text={text}
      className={`home-section-title ${s.title} ${dark ? "text-white" : "text-black"} ${className}`}
    />
  );
}

/**
 * The shared section header: eyebrow pill, uppercase 3D title, a short accent
 * rule and optional description. Keeps every homepage section on one rhythm.
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
  const alignCls =
    align === "center" ? `text-center items-center ${s.center}` : "text-left items-start for-mobile-center";
  return (
    <header className={`flex flex-col ${alignCls} ${className}`}>
      <Eyebrow label={badge} dark={dark} />
      <SectionTitle text={heading} dark={dark} className="max-w-4xl" />
      <span className={s.titleRule} aria-hidden="true" />
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
      { rootMargin: "0px 0px 15% 0px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`home-reveal ${visible ? "is-visible" : ""} ${className}`}
      style={{ transitionDuration: "0.5s", ...(delay ? { transitionDelay: `${Math.round(delay * 0.6)}ms` } : {}) }}
    >
      {children}
    </div>
  );
}
