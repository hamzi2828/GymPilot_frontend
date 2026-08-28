"use client";
import React from "react";
import Link from "next/link";

const slide = {
  heading: "Transform Your Body",
  description:
    "Join our state-of-the-art fitness center and experience personalized training programs designed to help you achieve your fitness goals. Our expert trainers and modern equipment will guide you on your journey to a healthier, stronger you.",
  bgImage: "/images/hero.svg",
  ariaLabel: "Fitness training background",
};

const HeroAbout: React.FC = () => {
  return (
    <section
      id="hero"
      className="hero-section relative overflow-hidden"
      role="banner"
      aria-label="Fitness showcase"
    >
      <div className="hero-carousel relative" id="hero-carousel">
        <article
          className="hero-slide active"
          role="main"
          aria-label="Hero section"
          id="slide-1"
        >
          <div
            className="hero-background-image"
            style={{ backgroundImage: `url('${slide.bgImage}')` }}
            role="img"
            aria-label={slide.ariaLabel}
          >
            <div className="hero-overlay" aria-hidden="true"></div>
            <div className="hero-content">
              <div className="hero-text-content">
                <header className="hero-header-lines">
                  <h1 className="hero-heading">{slide.heading}</h1>
                  <p className="hero-description">{slide.description}</p>
                </header>
                <nav className="hero-buttons" aria-label="Get started">
                  <Link
                    href="/contact-us"
                    className="hero-cta-button"
                    role="button"
                    aria-label="Contact us to get started"
                  >
                    <span className="hero-cta-text">Contact Us</span>
                    <i className="fas fa-arrow-right" aria-hidden="true"></i>
                  </Link>
                </nav>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
};

export default HeroAbout;