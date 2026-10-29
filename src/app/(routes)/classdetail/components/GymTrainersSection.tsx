"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { trainerService, type Trainer } from "../../main/services/trainerService";
import TiltCard from "@/components/site/TiltCard";
import Reveal from "@/components/site/Reveal";
import { SectionHeading, surfaceClass } from "@/components/site/PageHero";

/**
 * The coaches shown on a class page.
 *
 * This used to be a hardcoded pair — "Alex Johnson" and "Sarah Mitchell", with
 * invented social links pointing at accounts that do not exist. Every other
 * trainer surface on the site already read from the API; this one did not, so
 * a gym could add or remove a coach everywhere except here.
 */
const GymTrainersSection = () => {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    trainerService
      .getActiveTrainers(4)
      .then((list) => {
        if (!cancelled) setTrainers(list);
      })
      // A class page is still worth showing without its coach list, so a
      // failure here hides the section rather than breaking the page.
      .catch(() => {
        if (!cancelled) setTrainers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing to say when there are no coaches on file, and an empty grid with a
  // heading reads as a broken page.
  if (!loading && trainers.length === 0) return null;

  return (
    <section className={`${surfaceClass} py-16 lg:py-24 px-4 sm:px-8 lg:px-20`} aria-labelledby="class-trainers-title">
      <div className="relative mx-auto max-w-[1400px]">
        <SectionHeading id="class-trainers-title" eyebrow="Our trainers" title="Meet the team" />

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {trainers.map((trainer, idx) => (
            <Reveal as="li" key={trainer._id} delay={(idx % 4) * 0.08}>
              <TiltCard className="group h-full overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)]">
                <Link
                  href="/trainers"
                  className="block rounded-3xl focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--accent)]"
                  aria-label={`${trainer.name}, ${trainer.role}: see the team`}
                >
                  <div className="relative h-72 overflow-hidden">
                    <Image
                      src={trainer.image || "/images/default-avatar.svg"}
                      alt=""
                      fill
                      sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw"
                      className="object-cover object-top transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-transparent to-transparent" aria-hidden="true" />
                  </div>
                  <div className="flex items-end justify-between gap-3 px-5 pb-5 pt-1">
                    <div>
                      <h3 className="font-['Montserrat'] text-lg font-extrabold text-white">{trainer.name}</h3>
                      <p className="mt-0.5 text-sm text-[var(--text-muted)]">{trainer.role}</p>
                    </div>
                    <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border border-[var(--border-subtle)] text-white/70 transition-colors group-hover:border-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-[var(--on-accent)]" aria-hidden="true">
                      <ArrowUpRight size={16} />
                    </span>
                  </div>
                </Link>
              </TiltCard>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default GymTrainersSection;
