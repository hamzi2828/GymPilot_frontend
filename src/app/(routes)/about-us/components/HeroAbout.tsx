"use client";
import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSiteSettings } from "@/components/ThemeProvider";

const slide = {
  heading: "Transform Your Body",
  description:
    "Join our state-of-the-art fitness center and experience personalized training programs designed to help you achieve your fitness goals. Our expert trainers and modern equipment will guide you on your journey to a healthier, stronger you.",
  bgImage: "/images/hero.webp",
  ariaLabel: "Fitness training background",
};

const HeroAbout: React.FC = () => {
  const { siteName } = useSiteSettings();

  return (
    <section id="hero" className="hero hero--compact" aria-label="About us banner">
      <div className="hero__stage">
        <div className="hero__slide is-active">
          <div
            className="hero__media"
            style={{ backgroundImage: `url('${slide.bgImage}')` }}
            role="img"
            aria-label={slide.ariaLabel}
          />
        </div>
        <div className="hero__scrim" aria-hidden="true" />
        <div className="hero__vignette" aria-hidden="true" />
      </div>

      <div className="hero__inner">
        <div className="hero__content">
          <span className="hero__eyebrow">
            <span className="hero__eyebrow-dot" aria-hidden="true" />
            About {siteName}
          </span>
          <h1 className="hero__title">{slide.heading}</h1>
          <p className="hero__lede">{slide.description}</p>
          <div className="hero__actions">
            <Link href="/contact-us" className="btn btn--primary btn--lg">
              <span>Contact Us</span>
              <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
            </Link>
            <Link href="/packages" className="btn btn--glass btn--lg">
              <span>See Memberships</span>
              <ArrowRight size={17} strokeWidth={2.2} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroAbout;
