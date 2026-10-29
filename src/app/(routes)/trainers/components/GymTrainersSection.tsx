"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { trainerService, Trainer } from "../../main/services/trainerService";
import TiltCard from "@/components/site/TiltCard";
import Reveal from "@/components/site/Reveal";
import { SectionHeading, surfaceClass } from "@/components/site/PageHero";

const SOCIALS = [
  ["twitter", "fab fa-x-twitter", "X"],
  ["instagram", "fab fa-instagram", "Instagram"],
  ["facebook", "fab fa-facebook", "Facebook"],
  ["youtube", "fab fa-youtube", "YouTube"],
] as const;

interface GymTrainersSectionProps {
  onTrainerClick?: (trainer: Trainer) => void;
  selectedId?: string;
}

const GymTrainersSection: React.FC<GymTrainersSectionProps> = ({ onTrainerClick, selectedId }) => {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrainers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // The whole team, not the homepage's handful of featured coaches.
      const data = await trainerService.getAllActiveTrainers();
      setTrainers(data);
      // Set the first trainer as default selected
      if (data.length > 0 && onTrainerClick) {
        onTrainerClick(data[0]);
      }
    } catch (err) {
      console.error("Error fetching trainers:", err);
      setError(err instanceof Error ? err.message : "Failed to load trainers");
      setTrainers([]);
    } finally {
      setLoading(false);
    }
  }, [onTrainerClick]);

  useEffect(() => {
    fetchTrainers();
  }, [fetchTrainers]);

  const handleTrainerClick = (trainer: Trainer, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (onTrainerClick) {
      onTrainerClick(trainer);
      // Bring the profile above into view
      document.getElementById("trainer-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className={`${surfaceClass} py-20 lg:py-28 px-4 sm:px-8 lg:px-20`} aria-labelledby="trainers-grid-title">
      <div className="relative mx-auto max-w-[1400px]">
        <SectionHeading id="trainers-grid-title" eyebrow="Our trainers" title="Meet the team" />

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" aria-busy="true" aria-label="Loading trainers">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[420px] rounded-3xl bg-[var(--surface)] animate-pulse" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-red-200">{error}</div>
        )}

        {!loading && !error && trainers.length === 0 && (
          <p className="py-16 text-center text-lg text-[var(--text-muted)]">No trainers available at the moment.</p>
        )}

        {!loading && !error && trainers.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {trainers.map((trainer, idx) => {
              const active = trainer._id === selectedId;
              const links = SOCIALS.filter(([key]) => !!trainer.social?.[key]);
              return (
                <Reveal as="li" key={trainer._id} delay={(idx % 4) * 0.08}>
                  <TiltCard
                    className={`group h-full overflow-hidden rounded-3xl border bg-[var(--surface)] transition-colors duration-300 ${
                      active ? "border-[var(--accent)]" : "border-[var(--border-subtle)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => handleTrainerClick(trainer, e)}
                      aria-pressed={active}
                      aria-label={`Show ${trainer.name}'s profile`}
                      className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--accent)] rounded-3xl"
                    >
                      <div className="relative h-80 overflow-hidden">
                        <Image
                          src={trainer.image || "/images/default-avatar.svg"}
                          alt={`${trainer.name}, ${trainer.role}`}
                          fill
                          sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw"
                          className="object-cover object-top transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-transparent to-transparent" aria-hidden="true" />
                        {active && (
                          <span className="absolute left-4 top-4 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--on-accent)]">
                            Viewing
                          </span>
                        )}
                      </div>
                      <div className="px-5 pt-1 pb-4">
                        <h3 className="font-['Montserrat'] text-lg font-extrabold text-white">{trainer.name}</h3>
                        <p className="mt-0.5 text-sm text-[var(--text-muted)]">{trainer.role}</p>
                      </div>
                    </button>
                    {links.length > 0 && (
                      <div className="flex gap-2 px-5 pb-5">
                        {links.map(([key, icon, label]) => (
                          <Link
                            key={key}
                            href={trainerService.formatSocialUrl(trainer.social![key] as string, key)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] text-white/70 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                            aria-label={`Follow ${trainer.name} on ${label}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <i className={`${icon} text-sm`} aria-hidden="true" />
                          </Link>
                        ))}
                      </div>
                    )}
                  </TiltCard>
                </Reveal>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default GymTrainersSection;
