"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

const EASE = [0.22, 0.61, 0.36, 1] as const;

/**
 * Rises into place with a slight 3D tilt when scrolled into view. With
 * reduced motion it renders in place, no animation.
 */
export default function Reveal({
  children,
  className,
  delay = 0,
  y = 40,
  tilt = 14,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  /** Starting rotateX, in degrees. */
  tilt?: number;
  as?: "div" | "section" | "li" | "article" | "header";
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  if (reduce) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y, rotateX: tilt, transformPerspective: 1000 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.8, delay, ease: EASE }}
      style={{ transformOrigin: "50% 100%" }}
    >
      {children}
    </Comp>
  );
}

/**
 * Splits a heading into words that flip up into place one after another,
 * like type rising off the page. The full text stays in the DOM for
 * screen readers.
 */
export function FlipWords({
  text,
  className,
  wordClassName,
  accentLast = false,
  accentClassName,
  delay = 0,
  inView = false,
}: {
  text: string;
  className?: string;
  wordClassName?: string;
  /** Colour the last word with the theme accent. */
  accentLast?: boolean;
  accentClassName?: string;
  delay?: number;
  /** Wait until scrolled into view rather than playing on load. */
  inView?: boolean;
}) {
  const reduce = useReducedMotion();
  const words = text.trim().split(/\s+/);
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      {words.map((w, i) => {
        const cls = `${wordClassName ?? ""} ${accentLast && words.length > 1 && i === words.length - 1 ? accentClassName ?? "" : ""}`;
        const content = i < words.length - 1 ? `${w} ` : w;
        if (reduce) {
          return (
            <span key={i} className={cls} style={{ whiteSpace: "pre-wrap" }} aria-hidden="true">
              {content}
            </span>
          );
        }
        const target = { opacity: 1, rotateX: 0, y: 0 };
        return (
          <motion.span
            key={i}
            aria-hidden="true"
            className={cls}
            style={{ display: "inline-block", whiteSpace: "pre-wrap", transformOrigin: "50% 100%" }}
            initial={{ opacity: 0, rotateX: -85, y: "0.35em", transformPerspective: 700 }}
            {...(inView
              ? { whileInView: target, viewport: { once: true, amount: 0.6 } }
              : { animate: target })}
            transition={{ duration: 0.9, delay: delay + i * 0.08, ease: EASE }}
          >
            {content}
          </motion.span>
        );
      })}
    </span>
  );
}
