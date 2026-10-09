"use client";
import React from "react";
import "@fortawesome/fontawesome-free/css/all.css";
import Image from "next/image";
import Link from "next/link";
import { AboutContent, DEFAULT_ABOUT, resolveMediaUrl } from "../services/homeService";
import { AccentText, Reveal } from "./SectionHeading";
import { useSiteSettings } from "@/components/ThemeProvider";

const GymAboutSection = ({ content = DEFAULT_ABOUT }: { content?: AboutContent }) => {
  const { siteName } = useSiteSettings();
  // Everything here is the gym's own words and photo. A part with nothing
  // entered is left out, and with nothing at all the section is not shown.
  const imageSrc = resolveMediaUrl(content.image);
  const bullets = (content.bullets ?? []).filter((b) => typeof b === "string" && b.trim());
  const progress = (content.progress ?? []).filter((bar) => bar && bar.label);
  const hasSecond = Boolean(content.secondHeading || content.secondDescription || progress.length);

  if (!content.description && bullets.length === 0 && !imageSrc && !hasSecond) return null;

  const heading = content.heading || (siteName ? `About ${siteName}` : "About us");

  return (
    <section className="section surface-paper">
      <div className="mx-auto">
        <div className="custom-flex-container">
          {/* First Content Block - About Us */}
          {/*
            The centre image is deliberately pulled OVER both columns with a
            negative margin, so each column has to reserve room for it or the
            image lands on the words. The invariant is:

                column padding  >=  |image negative margin| - container gap

            The gap is 48px, so -mx-20 (80px) needs >= 32px and -mx-32 (128px)
            needs >= 80px. The padding below is one step past each, which is
            the clearance you can see between the text and the photo.
          */}
          <Reveal className="flex-1 z-6 relative home-reveal--left">
            <article className="space-y-8 lg:pr-12 xl:pr-24 for-mobile-center">
              <header className="space-y-4 for-mobile-center">
                <div className="flex items-center gap-2">
                  <span className="home-eyebrow-dot" aria-hidden="true"></span>
                  <span className="home-eyebrow-label">{content.badge}</span>
                </div>
                <h2 className="home-section-title text-2xl md:text-3xl lg:text-[42px] text-black">
                  <AccentText text={heading} />
                </h2>
              </header>

              {content.description && <p className="home-section-description">{content.description}</p>}

              {bullets.length > 0 && (
                <ul className="space-y-3">
                  {bullets.map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="home-check-circle" aria-hidden="true">
                        <i className="fas fa-check text-xs"></i>
                      </span>
                      <span className="gymfolio3-list-text text-gray-600 text-base">{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}

              {content.ctaText && (
                <Link href={content.ctaLink || "/packages"} className="btn btn--primary btn--lg">
                  <span>{content.ctaText}</span>
                  <i className="fas fa-arrow-right text-xs" aria-hidden="true"></i>
                </Link>
              )}
            </article>
          </Reveal>

          {/* Center Image: the gym's own photo, or no figure at all. It is only
              pulled over a column on a side that has one. */}
          {imageSrc && (
            <Reveal
              delay={120}
              className={`lg:relative lg:-ml-20 xl:-ml-32 ${
                hasSecond ? "lg:-mr-20 xl:-mr-32" : ""
              } gymfolio3-z-index lg:order-none home-reveal--scale`}
            >
              <figure className="relative home-about-figure">
                <Image
                  src={imageSrc}
                  alt={siteName}
                  width={600}
                  height={500}
                  className="w-full max-w-md lg:max-w-lg xl:max-w-2xl h-76 md:h-80 lg:h-96 xl:h-[500px] object-cover"
                  priority
                  unoptimized={/^https?:\/\//i.test(imageSrc)}
                />
              </figure>
            </Reveal>
          )}

          {/* Second Content Block */}
          {hasSecond && (
            <Reveal delay={200} className="flex-1 z-9 relative home-reveal--right">
              <article className="space-y-8 lg:pl-12 xl:pl-24">
                {(content.secondHeading || content.secondDescription) && (
                  <header className="space-y-4 for-mobile-center">
                    {content.secondHeading && (
                      <h2 className="home-section-title text-2xl md:text-3xl text-black">
                        <AccentText text={content.secondHeading} />
                      </h2>
                    )}
                    {content.secondDescription && (
                      <p className="home-section-description">{content.secondDescription}</p>
                    )}
                  </header>
                )}

                {progress.length > 0 && (
                  <div className="space-y-6">
                    {progress.map((bar, idx) => (
                      <div key={idx} className="space-y-2.5">
                        <div className="flex justify-between items-center">
                          <h3 className="gymfolio3-progress-label text-gray-900 font-medium">{bar.label}</h3>
                          <span className="gymfolio3-progress-label text-gray-900 font-semibold">
                            {Math.min(100, Math.max(0, Number(bar.value) || 0))}%
                          </span>
                        </div>
                        <div className="home-progress-track">
                          {/* Width comes from --w so the bar can grow from zero the
                              first time the block scrolls into view (see CSS). */}
                          <div
                            className="home-progress-fill h-full rounded-full"
                            style={
                              {
                                "--w": `${Math.min(100, Math.max(0, Number(bar.value) || 0))}%`,
                              } as React.CSSProperties
                            }
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
};

export default GymAboutSection;
