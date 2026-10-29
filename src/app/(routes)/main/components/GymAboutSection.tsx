"use client";
import React, { useId, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Dumbbell } from "lucide-react";
import { AboutContent, DEFAULT_ABOUT, resolveMediaUrl } from "../services/homeService";
import { Eyebrow, SectionTitle } from "./SectionHeading";
import { Depth, useDepthVars, useScrollReveal } from "./motion3d";
import s from "./home3d.module.css";
import { useSiteSettings } from "@/components/ThemeProvider";

type Bar = { label: string; value: number };

const R = 26;
const CIRC = 2 * Math.PI * R;

/** Glowing progress ring that fills the first time it scrolls into view. */
function Ring({ value, dark = false }: { value: number; dark?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useScrollReveal(ref);
  // Empty while waiting below the fold; full value otherwise.
  const shown = state === "waiting" ? 0 : value;
  return (
    <div ref={ref} className={`${s.ring} ${dark ? s.ringDark : ""}`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle className={s.ringTrack} cx="32" cy="32" r={R} strokeWidth="6" />
        <circle
          className={s.ringFill}
          cx="32"
          cy="32"
          r={R}
          strokeWidth="6"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - shown / 100)}
        />
      </svg>
      <span className={s.ringValue}>{value}%</span>
    </div>
  );
}

/** Spinning circular text, e.g. "DEMO GYM • ABOUT US •". */
function Stamp({ text }: { text: string }) {
  const id = `stamp${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div className={s.aboutStamp} aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <defs>
          <path id={id} d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
        </defs>
        <text>
          <textPath href={`#${id}`} textLength="236">
            {text}
          </textPath>
        </text>
      </svg>
      <span className={s.stampCore}>
        <Dumbbell size={18} strokeWidth={2.4} />
      </span>
    </div>
  );
}

/**
 * About block: a layered 3D photo (accent plate, dot grid, tilted frame,
 * glass skill badges and a name stamp, all moving at different depths with
 * the pointer and scroll) beside the gym's story, bullets and CTA, then the
 * second block as a dark pull-out card. Everything shown is the gym's own
 * content; parts with nothing entered are left out.
 */
const GymAboutSection = ({ content = DEFAULT_ABOUT }: { content?: AboutContent }) => {
  const { siteName } = useSiteSettings();
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  useDepthVars(stageRef, sectionRef);

  const imageSrc = resolveMediaUrl(content.image);
  const bullets = (content.bullets ?? []).filter((b) => typeof b === "string" && b.trim());
  const bars: Bar[] = (content.progress ?? [])
    .filter((bar) => bar && bar.label)
    .map((bar) => ({ label: bar.label, value: Math.min(100, Math.max(0, Math.round(Number(bar.value) || 0))) }));
  const hasSecondText = Boolean(content.secondHeading || content.secondDescription);

  if (!content.description && bullets.length === 0 && !imageSrc && !hasSecondText && bars.length === 0) return null;

  const heading = content.heading || (siteName ? `About ${siteName}` : "About us");
  // With a photo, the first two skills float on it as badges; the rest (or
  // all of them without a photo) sit in the dark card.
  const badgeBars = imageSrc ? bars.slice(0, 2) : [];
  const cardBars = imageSrc ? bars.slice(2) : bars;
  const stampWords = [siteName, content.badge].filter(Boolean).join(" • ");
  const stampText = stampWords ? `${stampWords} • `.repeat(stampWords.length > 18 ? 1 : 2) : "";
  const showCard = hasSecondText || cardBars.length > 0;

  return (
    <section ref={sectionRef} className={`section surface-paper ${s.about}`}>
      <div className={`${s.aboutGrid} ${imageSrc ? s.withImage : s.noImage}`}>
        {imageSrc && (
          <Depth>
            <div ref={stageRef} className={s.aboutStage}>
              <span className={s.aboutBlock} aria-hidden="true" />
              <span className={s.aboutDots} aria-hidden="true" />
              <figure className={`${s.aboutFrame} m-0`}>
                <Image
                  src={imageSrc}
                  alt={siteName ? `Training at ${siteName}` : "Training at the gym"}
                  fill
                  sizes="(max-width: 1024px) 92vw, 50vw"
                  className="object-cover"
                  unoptimized={/^https?:\/\//i.test(imageSrc)}
                />
                <span className={s.aboutSheen} aria-hidden="true" />
              </figure>

              {badgeBars.map((bar, i) => (
                <div key={bar.label} className={`${s.aboutBadge} ${i === 0 ? s.aboutBadgeA : s.aboutBadgeB}`}>
                  <Ring value={bar.value} />
                  <span className={s.badgeText}>
                    <span className={s.badgeTitle}>{bar.label}</span>
                  </span>
                </div>
              ))}

              {stampText && <Stamp text={stampText} />}
            </div>
          </Depth>
        )}

        <div className="for-mobile-center">
          <Depth index={1}>
            <Eyebrow label={content.badge} />
            <SectionTitle text={heading} />
          </Depth>

          {content.description && (
            <Depth index={2}>
              <p className={s.aboutLede}>{content.description}</p>
            </Depth>
          )}

          {bullets.length > 0 && (
            <Depth index={3} className="w-full">
              <ul className={s.aboutList}>
                {bullets.map((bullet, idx) => (
                  <li key={idx}>
                    <span className={s.aboutIcon} aria-hidden="true">
                      <Check size={17} strokeWidth={2.8} />
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </Depth>
          )}

          {content.ctaText && (
            <Depth index={4} className={s.aboutCta}>
              <Link href={content.ctaLink || "/packages"} className="btn btn--primary btn--lg">
                <span>{content.ctaText}</span>
                <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            </Depth>
          )}
        </div>
      </div>

      {showCard && (
        <Depth>
          <div className={s.aboutStrip}>
            <div>
              {content.secondHeading && (
                <SectionTitle text={content.secondHeading} dark className={s.stripTitle} />
              )}
            </div>
            <div>
              {content.secondDescription && <p className={s.stripText}>{content.secondDescription}</p>}
              {cardBars.length > 0 && (
                <div className={s.stripRings}>
                  {cardBars.map((bar) => (
                    <div key={bar.label} className={s.stripRing}>
                      <Ring value={bar.value} dark />
                      <span className={s.badgeTitle}>{bar.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Depth>
      )}
    </section>
  );
};

export default GymAboutSection;
