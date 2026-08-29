"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  DEFAULT_TESTIMONIALS_HEADER,
  FALLBACK_TESTIMONIALS,
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
        if (!cancelled) setTestimonials(data.length ? data : FALLBACK_TESTIMONIALS);
      } catch {
        // Section still demonstrates itself when the API is unreachable.
        if (!cancelled) setTestimonials(FALLBACK_TESTIMONIALS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="home-dark-section home-testimonials py-16 lg:py-24 px-4 md:px-8 lg:px-20 relative overflow-hidden">
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
            {testimonials.map((t, idx) => (
              <Reveal key={t._id} delay={idx * 90}>
                <figure className="home-testimonial-card h-full">
                  <div className="home-testimonial-quote-icon" aria-hidden="true">
                    <i className="fas fa-quote-left"></i>
                  </div>
                  <Stars rating={t.rating} />
                  <blockquote className="home-testimonial-quote">{t.quote}</blockquote>
                  <figcaption className="home-testimonial-footer">
                    {t.imageUrl ? (
                      <Image
                        src={resolveMediaUrl(t.imageUrl)}
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
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default TestimonialsSection;
