"use client";
import React from "react";
import "@fortawesome/fontawesome-free/css/all.css";
import Image from "next/image";
import Link from "next/link";
import { AboutContent, DEFAULT_ABOUT, resolveMediaUrl } from "../services/homeService";
import { AccentText, Reveal } from "./SectionHeading";

const GymAboutSection = ({ content = DEFAULT_ABOUT }: { content?: AboutContent }) => {
  const imageSrc = resolveMediaUrl(content.image) || DEFAULT_ABOUT.image;

  return (
    <section className="py-8 md:py-20 px-4 md:px-8 lg:px-20">
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
          <Reveal className="flex-1 z-6 relative">
            <article className="space-y-8 lg:pr-12 xl:pr-24 for-mobile-center">
              <header className="space-y-4 for-mobile-center">
                <div className="flex items-center gap-2">
                  <span className="home-eyebrow-dot" aria-hidden="true"></span>
                  <span className="home-eyebrow-label">{content.badge}</span>
                </div>
                <h2 className="home-section-title text-2xl md:text-3xl lg:text-4xl text-black">
                  <AccentText text={content.heading} />
                </h2>
              </header>

              <p className="home-section-description">{content.description}</p>

              <ul className="space-y-3">
                {content.bullets.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="home-check-circle" aria-hidden="true">
                      <i className="fas fa-check text-xs"></i>
                    </span>
                    <span className="gymfolio3-list-text text-gray-600 text-base">{bullet}</span>
                  </li>
                ))}
              </ul>

              {content.ctaText && (
                <Link href={content.ctaLink || "/packages"} className="hero-cta-button inline-flex">
                  <span className="hero-cta-text">{content.ctaText}</span>
                  <i className="fas fa-arrow-right" aria-hidden="true"></i>
                </Link>
              )}
            </article>
          </Reveal>

          {/* Center Image */}
          <Reveal delay={120} className="lg:relative lg:-mx-20 xl:-mx-32 gymfolio3-z-index lg:order-none">
            <figure className="relative home-about-figure">
              <Image
                src={imageSrc}
                alt="Training at the gym"
                width={600}
                height={500}
                className="w-full max-w-md lg:max-w-lg xl:max-w-2xl h-76 md:h-80 lg:h-96 xl:h-[500px] object-cover rounded-2xl"
                priority
                unoptimized={/^https?:\/\//i.test(imageSrc)}
              />
            </figure>
          </Reveal>

          {/* Second Content Block */}
          <Reveal delay={200} className="flex-1 z-9 relative">
            <article className="space-y-8 lg:pl-12 xl:pl-24">
              <header className="space-y-4 for-mobile-center">
                <h2 className="home-section-title text-2xl md:text-3xl text-black">
                  <AccentText text={content.secondHeading} />
                </h2>
                <p className="home-section-description">{content.secondDescription}</p>
              </header>

              <div className="space-y-6">
                {content.progress.map((bar, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h3 className="gymfolio3-progress-label text-gray-900 font-medium">{bar.label}</h3>
                      <span className="gymfolio3-progress-label text-gray-900 font-medium">
                        {Math.min(100, Math.max(0, Number(bar.value) || 0))}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="home-progress-fill h-full rounded-full"
                        style={{ width: `${Math.min(100, Math.max(0, Number(bar.value) || 0))}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default GymAboutSection;
