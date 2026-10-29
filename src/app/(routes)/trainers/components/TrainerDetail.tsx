"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Award, Dumbbell, Medal } from "lucide-react";
import { Trainer, trainerService } from "../../main/services/trainerService";
import TiltCard from "@/components/site/TiltCard";
import { surfaceClass } from "@/components/site/PageHero";

interface TrainerDetailProps {
  trainer: Trainer | null;
}

const SOCIALS = [
  ["twitter", "fab fa-x-twitter", "X"],
  ["instagram", "fab fa-instagram", "Instagram"],
  ["facebook", "fab fa-facebook", "Facebook"],
  ["youtube", "fab fa-youtube", "YouTube"],
] as const;

const TrainerDetail: React.FC<TrainerDetailProps> = ({ trainer }) => {
  const reduce = useReducedMotion();

  return (
    <section
      id="trainer-detail"
      className={`${surfaceClass} scroll-mt-20 px-4 sm:px-8 lg:px-20 pt-16 pb-4 lg:pt-24`}
      aria-live="polite"
    >
      <div className="relative mx-auto max-w-[1400px]">
        {!trainer ? (
          <div className="py-16 text-center">
            <h2 className="font-['Montserrat'] text-2xl font-extrabold text-white">Select a trainer</h2>
            <p className="mt-2 text-[var(--text-muted)]">Choose anyone below to see their profile.</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={trainer._id}
              className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16"
              initial={reduce ? false : { opacity: 0, rotateY: -8, x: -20, transformPerspective: 1200 }}
              animate={{ opacity: 1, rotateY: 0, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, rotateY: 8, x: 20 }}
              transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
            >
              {/* Portrait */}
              <div className="lg:col-span-5">
                <TiltCard max={6} className="relative mx-auto aspect-[4/5] w-full max-w-[520px] overflow-hidden rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[0_40px_80px_-40px_rgba(0,0,0,0.9)]">
                  <Image
                    src={trainer.image || "/images/default-avatar.svg"}
                    alt={`${trainer.name}, ${trainer.role}`}
                    fill
                    sizes="(min-width:1024px) 40vw, 100vw"
                    className="object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" aria-hidden="true" />
                  <div
                    className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full"
                    style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 45%, transparent), transparent 65%)" }}
                    aria-hidden="true"
                  />
                </TiltCard>
              </div>

              {/* Profile */}
              <div className="lg:col-span-7">
                <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                  {trainer.role}
                </p>
                <h2 className="mt-3 font-['Montserrat'] text-4xl font-extrabold leading-[1.02] tracking-tight text-white sm:text-5xl lg:text-6xl">
                  {trainer.name}
                </h2>

                {trainer.bio && (
                  <p className="mt-6 max-w-[62ch] text-base leading-relaxed text-white/75 sm:text-lg">{trainer.bio}</p>
                )}

                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {trainer.experience ? (
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
                      <Medal size={20} className="text-[var(--accent)]" aria-hidden="true" />
                      <p className="mt-3 font-['Montserrat'] text-3xl font-extrabold text-white">{trainer.experience}</p>
                      <p className="text-sm text-[var(--text-muted)]">years of professional training</p>
                    </div>
                  ) : null}

                  {trainer.specialties && trainer.specialties.length > 0 && (
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
                      <Dumbbell size={20} className="text-[var(--accent)]" aria-hidden="true" />
                      <h3 className="mt-3 text-sm font-bold uppercase tracking-wider text-white">Specialties</h3>
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {trainer.specialties.map((item, index) => (
                          <li key={index} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/80">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {trainer.certifications && trainer.certifications.length > 0 && (
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:col-span-2">
                      <Award size={20} className="text-[var(--accent)]" aria-hidden="true" />
                      <h3 className="mt-3 text-sm font-bold uppercase tracking-wider text-white">Certifications</h3>
                      <ul className="mt-3 space-y-1.5 text-sm text-white/75">
                        {trainer.certifications.map((item, index) => (
                          <li key={index} className="flex gap-2">
                            <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[var(--accent)]" aria-hidden="true" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  {SOCIALS.filter(([key]) => !!trainer.social?.[key]).map(([key, icon, label]) => (
                    <Link
                      key={key}
                      href={trainerService.formatSocialUrl(trainer.social![key] as string, key)}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-subtle)] text-white/75 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                      aria-label={`Follow ${trainer.name} on ${label}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <i className={icon} aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </section>
  );
};

export default TrainerDetail;
