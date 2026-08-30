"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { trainerService, Trainer } from "../services/trainerService";
import { DEFAULT_TRAINERS, TrainersContent } from "../services/homeService";
import { AccentText, Reveal } from "./SectionHeading";

type SocialKey = "twitter" | "instagram" | "facebook" | "youtube";

const SOCIALS: { key: SocialKey; icon: string; label: string }[] = [
  { key: "twitter", icon: "fab fa-x-twitter", label: "X" },
  { key: "instagram", icon: "fab fa-instagram", label: "Instagram" },
  { key: "facebook", icon: "fab fa-facebook", label: "Facebook" },
  { key: "youtube", icon: "fab fa-youtube", label: "YouTube" },
];

const GymTrainersSection = ({ content = DEFAULT_TRAINERS }: { content?: TrainersContent }) => {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = Number(content.limit) > 0 ? Number(content.limit) : DEFAULT_TRAINERS.limit;

  const fetchTrainers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await trainerService.getActiveTrainers(limit);
      setTrainers(data);
    } catch (err) {
      console.error("Error fetching trainers:", err);
      setError(err instanceof Error ? err.message : "Failed to load trainers");
      // Set empty array on error to prevent display issues
      setTrainers([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchTrainers();
  }, [fetchTrainers]);

  return (
    <section className="section surface-paper">
      <Reveal>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-12 lg:mb-16 gap-8">
          <header className="flex-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="home-eyebrow-dot" aria-hidden="true"></span>
              <span className="home-eyebrow-label">{content.badge}</span>
            </div>

            <h2 className="home-section-title text-2xl md:text-3xl lg:text-[42px] text-black mb-0">
              <AccentText text={content.heading} />
            </h2>
          </header>

          <div className="lg:max-w-xl lg:flex-shrink-0">
            <p className="home-section-description">{content.description}</p>
            <Link href="/trainers" className="btn btn--outline mt-6">
              <span>Meet every coach</span>
              <i className="fas fa-arrow-right text-xs" aria-hidden="true"></i>
            </Link>
          </div>
        </div>
      </Reveal>

      {/* Loading State */}
      {loading && (
        <div className="home-coach-grid" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="home-coach home-post--skeleton" />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-center">
          {error}
        </div>
      )}

      {/* Coach cards — image-forward, with the name set on the photograph and
          the social links revealed on hover so the card stays uncluttered.
          The column count follows the roster (capped at four) so three coaches
          fill the row instead of leaving an empty fourth slot. */}
      {!loading && !error && trainers.length > 0 && (
        <div
          className="home-coach-grid"
          style={{ "--cols": Math.min(trainers.length, 4) } as React.CSSProperties}
        >
          {trainers.map((trainer, idx) => (
            <Reveal key={trainer._id} delay={idx * 90} className="h-full">
              <article className="home-coach">
                <Image
                  src={trainer.image || "/images/trainer-1.svg"}
                  alt={`${trainer.name} — ${trainer.role}`}
                  width={400}
                  height={533}
                  className="w-full h-full object-cover"
                  priority={false}
                />
                <span className="home-coach__scrim" aria-hidden="true" />

                <div className="home-coach__body">
                  <p className="home-coach__role">{trainer.role}</p>
                  <h3 className="home-coach__name">{trainer.name}</h3>

                  <div className="home-coach__socials">
                    {SOCIALS.map(({ key, icon, label }) => {
                      const handle = trainer.social?.[key];
                      if (!handle) return null;
                      return (
                        <Link
                          key={key}
                          href={trainerService.formatSocialUrl(handle, key)}
                          className="home-coach__social"
                          aria-label={`${trainer.name} on ${label}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <i className={icon} aria-hidden="true"></i>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && trainers.length === 0 && (
        <div className="text-center py-20">
          <p className="home-section-description">No trainers available at the moment.</p>
        </div>
      )}
    </section>
  );
};

export default GymTrainersSection;
