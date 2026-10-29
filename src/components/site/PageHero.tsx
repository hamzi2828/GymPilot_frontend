"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import styles from "./motion.module.css";
import { FlipWords } from "./Reveal";

const EASE = [0.22, 0.61, 0.36, 1] as const;

export type Crumb = { label: string; href?: string };

/**
 * The banner for inner pages: the gym's photo (when there is one) under a
 * layered shade, a faint grid and the theme accent's glow, with the title
 * flipping up word by word.
 */
export default function PageHero({
  title,
  eyebrow,
  lead,
  image,
  crumbs,
  actions,
  tall = false,
  children,
}: {
  title: string;
  eyebrow?: string;
  lead?: React.ReactNode;
  image?: string;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
  tall?: boolean;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  // 0 at the top of the page, 1 once the hero has scrolled out of view.
  const scrollYProgress = useMotionValue(0);
  useEffect(() => {
    if (reduce) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const h = el.offsetHeight || 1;
      scrollYProgress.set(Math.min(1, Math.max(0, -el.getBoundingClientRect().top / h)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduce, scrollYProgress]);
  const photoY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const innerY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const innerFade = useTransform(scrollYProgress, [0, 0.8], [1, 0.2]);

  const fade = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease: EASE },
        };

  const words = title.trim().split(/\s+/).length;

  return (
    <section ref={ref} className={`${styles.hero} ${tall ? styles.heroTall : ""}`} aria-label={`${title} banner`}>
      {image && (
        <motion.div
          className={styles.heroPhoto}
          style={{ backgroundImage: `url('${image}')`, y: reduce ? 0 : photoY }}
          aria-hidden="true"
        />
      )}
      <div className={styles.heroShade} aria-hidden="true" />
      <div className={styles.heroGrid} aria-hidden="true" />
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.heroGlow2} aria-hidden="true" />

      <motion.div className={styles.heroInner} style={reduce ? undefined : { y: innerY, opacity: innerFade }}>
        {crumbs && crumbs.length > 0 && (
          <motion.nav aria-label="Breadcrumb" {...fade(0)}>
            <ol className={styles.crumbs}>
              {crumbs.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden="true">/</span>}
                  {c.href ? (
                    <Link href={c.href}>{c.label}</Link>
                  ) : (
                    <span aria-current="page" className="text-white">
                      {c.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </motion.nav>
        )}

        {eyebrow && (
          <motion.span className={styles.eyebrow} {...fade(0.05)}>
            <span className={styles.dot} aria-hidden="true" />
            {eyebrow}
          </motion.span>
        )}

        <h1 className={styles.title}>
          <FlipWords
            text={title}
            wordClassName={styles.word}
            accentLast={words > 1}
            accentClassName={styles.accentWord}
            delay={0.12}
          />
        </h1>

        {lead && (
          <motion.div className={styles.lead} {...fade(0.35 + words * 0.06)}>
            {lead}
          </motion.div>
        )}

        {actions && (
          <motion.div className={styles.actions} {...fade(0.45 + words * 0.06)}>
            {actions}
          </motion.div>
        )}

        {children}
      </motion.div>
    </section>
  );
}

/** Eyebrow, title and lead for a section on the dark page surface. */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  center = false,
  id,
}: {
  eyebrow?: string;
  title: string;
  lead?: React.ReactNode;
  center?: boolean;
  id?: string;
}) {
  return (
    <header className={`${styles.sectionHead} ${center ? styles.sectionHeadCenter : ""}`}>
      {eyebrow && (
        <span className={styles.sectionEyebrow}>
          <span className={styles.dot} aria-hidden="true" />
          {eyebrow}
        </span>
      )}
      <h2 id={id} className={styles.sectionTitle}>
        <FlipWords text={title} inView accentLast accentClassName={styles.accentWord} />
      </h2>
      {lead && <p className={styles.sectionLead}>{lead}</p>}
    </header>
  );
}

/** Class for a dark, theme-coloured page section. */
export const surfaceClass = styles.surface;
