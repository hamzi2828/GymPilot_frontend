"use client";
import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { ArrowUpRight, Clock, Gauge } from "lucide-react";
import { gymClassService, GymClass } from "../../main/services/gymClassService";
import TiltCard, { tiltPop } from "@/components/site/TiltCard";
import Reveal from "@/components/site/Reveal";
import { SectionHeading, surfaceClass } from "@/components/site/PageHero";

interface GymfolioAllClassesProps {
  onClassClick?: (gymClass: GymClass) => void;
}

const GymfolioAllClasses: React.FC<GymfolioAllClassesProps> = ({ onClassClick }) => {
  const [classesData, setClassesData] = useState<GymClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClasses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await gymClassService.getActiveClasses();
      setClassesData(data);
    } catch (err) {
      console.error("Error fetching gym classes:", err);
      setError(err instanceof Error ? err.message : "Failed to load classes");
      setClassesData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleClassClick = (gymClass: GymClass, e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (onClassClick) {
      onClassClick(gymClass);
    }
  };

  return (
    <section
      id="classes"
      className={`${surfaceClass} py-20 md:py-28 px-4 md:px-8 lg:px-20`}
      aria-labelledby="GymfolioAllClasses-title"
    >
      <div className="relative mx-auto max-w-[1400px]">
        <SectionHeading id="GymfolioAllClasses-title" eyebrow="Classes" title="Our classes" center />

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" aria-busy="true" aria-label="Loading classes">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[420px] rounded-3xl bg-[var(--surface)] animate-pulse" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="mx-auto max-w-2xl rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && classesData.length === 0 && (
          <p className="py-16 text-center text-lg text-[var(--text-muted)]">No classes available at the moment.</p>
        )}

        {!loading && !error && classesData.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" aria-label="Classes">
            {classesData.map((item, idx) => (
              <Reveal as="li" key={item._id} delay={(idx % 4) * 0.08}>
                <TiltCard className="group h-full rounded-3xl">
                  <a
                    href={`/classdetail?id=${item._id}`}
                    onClick={(e) => handleClassClick(item, e)}
                    className="relative flex h-[440px] flex-col justify-end overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
                    aria-label={`${item.name} class details`}
                  >
                    <Image
                      src={item.thumbnail || "/images/class-placeholder.svg"}
                      alt=""
                      fill
                      sizes="(min-width:1280px) 25vw, (min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                      priority={idx < 4}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/0" aria-hidden="true" />
                    <div
                      className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      style={{ background: "linear-gradient(to top, color-mix(in srgb, var(--accent) 30%, transparent), transparent 55%)" }}
                      aria-hidden="true"
                    />
                    <div className="relative p-6">
                      {(item.duration || item.difficulty) && (
                        <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold text-white/85">
                          {item.duration ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 backdrop-blur-md">
                              <Clock size={13} aria-hidden="true" /> {item.duration} min
                            </span>
                          ) : null}
                          {item.difficulty && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 capitalize backdrop-blur-md">
                              <Gauge size={13} aria-hidden="true" /> {item.difficulty}
                            </span>
                          )}
                        </div>
                      )}
                      <h3 className="font-['Montserrat'] text-2xl font-extrabold leading-tight tracking-tight text-white">
                        {item.name}
                      </h3>
                      {item.shortDescription && (
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/70">{item.shortDescription}</p>
                      )}
                    </div>
                  </a>
                  <span className={`${tiltPop} pointer-events-none absolute right-5 top-5 z-10`} aria-hidden="true">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] shadow-[0_10px_30px_-8px_var(--accent)] transition-transform duration-500 group-hover:rotate-45">
                      <ArrowUpRight size={20} strokeWidth={2.4} />
                    </span>
                  </span>
                </TiltCard>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default GymfolioAllClasses;