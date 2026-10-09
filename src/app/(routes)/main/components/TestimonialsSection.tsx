"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  DEFAULT_TESTIMONIALS_HEADER,
  SectionHeaderContent,
  Testimonial,
  homeService,
  resolveMediaUrl,
} from "../services/homeService";
import { SectionHeading, Reveal } from "./SectionHeading";

function Stars({ rating }: { rating: number }) {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <div className="home-testimonial-stars" aria-label={`Rated ${full} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <i
          key={i}
          className={`fas fa-star ${i < full ? "" : "home-star-muted"}`}
          aria-hidden="true"
        ></i>
      ))}
    </div>
  );
}

/** Deterministic initials avatar for testimonials without a photo. */
function InitialsAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="home-testimonial-avatar home-testimonial-avatar-fallback" aria-hidden="true">
      {initials || "?"}
    </span>
  );
}

const TestimonialsSection = ({
  content = DEFAULT_TESTIMONIALS_HEADER,
}: {
  content?: SectionHeaderContent;
}) => {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await homeService.getTestimonials();
        if (!cancelled) setTestimonials(data);
      } catch {
        // No reviews to show; the section hides itself below.
        if (!cancelled) setTestimonials([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Only real, attributable reviews. With none added yet the section is left
  // out -- it used to fill itself with invented members' quotes, on every
  // gym's homepage.
  if (!loading && testimonials.length === 0) return null;

  return (
    <section className="section surface-dark home-dark-section home-testimonials relative overflow-hidden">
      {/* Soft accent glow behind the cards */}
      <div className="home-testimonials-glow" aria-hidden="true"></div>

      <div className="mx-auto relative">
        <Reveal>
          <SectionHeading
            dark
            badge={content.badge}
            heading={content.heading}
            description={content.description}
            className="mb-12 lg:mb-16"
          />
        </Reveal>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="home-testimonial-card animate-pulse min-h-[220px]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {testimonials.map((t, idx) => {
              const photo = resolveMediaUrl(t.imageUrl);
              return (
              <Reveal key={t._id} delay={idx * 90}>
                <figure className="home-testimonial-card h-full">
                  <div className="home-testimonial-quote-icon" aria-hidden="true">
                    <i className="fas fa-quote-left"></i>
                  </div>
                  <Stars rating={t.rating} />
                  <blockquote className="home-testimonial-quote">{t.quote}</blockquote>
                  <figcaption className="home-testimonial-footer">
                    {photo ? (
                      <Image
                        src={photo}
                        alt={t.name}
                        width={48}
                        height={48}
                        className="home-testimonial-avatar object-cover"
                        unoptimized
                      />
                    ) : (
                      <InitialsAvatar name={t.name} />
                    )}
                    <div>
                      <p className="home-testimonial-name">{t.name}</p>
                      {t.role && <p className="home-testimonial-role">{t.role}</p>}
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default TestimonialsSection;
