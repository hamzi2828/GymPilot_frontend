"use client";
import React, { useRef, useState } from "react";
import Image from "next/image";
import { CalendarCheck, Check, Clock, Gauge, Pause, Play, Tag, Users } from "lucide-react";
import { GymClass, gymClassService } from "../../main/services/gymClassService";
import { useSiteSettings } from "@/components/ThemeProvider";
import ClassSessionsSection from "./ClassSessionsSection";
import TiltCard from "@/components/site/TiltCard";
import Reveal from "@/components/site/Reveal";
import { surfaceClass } from "@/components/site/PageHero";

interface GymClassDetailSectionProps {
  gymClass: GymClass;
}

const card = "rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)]";

function CheckList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className={`${card} p-6`}>
      <h3 className="font-['Montserrat'] text-lg font-extrabold text-white">{title}</h3>
      <ul className="mt-4 space-y-3" role="list">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-3 text-[15px] leading-6 text-white/80">
            <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)]" aria-hidden="true">
              <Check size={12} strokeWidth={3} />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

const GymClassDetailSection: React.FC<GymClassDetailSectionProps> = ({ gymClass }) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  // The gym's own hours from Settings; the card is hidden until they are set.
  const { openingHours } = useSiteSettings();
  // The class's own video, when the gym uploaded one. Relative upload paths
  // live on the API host.
  const videoUrl = gymClassService.getAbsoluteImageUrl(gymClass.videoUrl);
  const posterUrl = gymClassService.getAbsoluteImageUrl(gymClass.videoPoster) || gymClass.thumbnail || undefined;

  const handleVideoToggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsVideoPlaying(true);
    } else {
      video.pause();
      setIsVideoPlaying(false);
    }
  };

  const stats = [
    gymClass.duration ? { icon: Clock, label: "Duration", value: `${gymClass.duration} min` } : null,
    gymClass.difficulty ? { icon: Gauge, label: "Difficulty", value: gymClass.difficulty } : null,
    gymClass.capacity ? { icon: Users, label: "Capacity", value: `${gymClass.capacity} people` } : null,
    gymClass.price !== undefined
      ? { icon: Tag, label: "Price", value: gymClassService.formatPrice(gymClass.price, gymClass.currency) }
      : null,
  ].filter((s): s is { icon: typeof Clock; label: string; value: string } => !!s);

  return (
    <section className={`${surfaceClass} py-16 md:py-24 px-4 md:px-8 lg:px-20`}>
      <div className="relative mx-auto grid max-w-[1400px] grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        {/* Main column */}
        <div className="min-w-0 space-y-8 lg:col-span-8">
          {/* The class's own video only. With none, the class photo stands
              in; with neither, nothing is shown. */}
          {videoUrl ? (
            <Reveal>
              <TiltCard max={4} className={`${card} relative h-72 overflow-hidden md:h-96 lg:h-[540px]`}>
                <video
                  ref={videoRef}
                  className="absolute inset-0 h-full w-full object-cover"
                  poster={posterUrl}
                  preload="metadata"
                  muted
                  playsInline
                  onEnded={() => setIsVideoPlaying(false)}
                >
                  <source src={videoUrl} />
                  Your browser does not support the video tag.
                </video>
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" aria-hidden="true" />
                <button
                  type="button"
                  onClick={handleVideoToggle}
                  className="absolute left-1/2 top-1/2 z-10 inline-flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] shadow-[0_0_0_10px_color-mix(in_srgb,var(--accent)_25%,transparent)] transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  aria-label={isVideoPlaying ? "Pause video" : "Play video"}
                >
                  {isVideoPlaying ? <Pause size={28} aria-hidden="true" /> : <Play size={28} className="ml-1" aria-hidden="true" />}
                </button>
              </TiltCard>
            </Reveal>
          ) : gymClass.thumbnail ? (
            <Reveal>
              <TiltCard max={4} className={`${card} relative h-72 overflow-hidden md:h-96 lg:h-[540px]`}>
                <Image
                  src={gymClass.thumbnail}
                  alt={`${gymClass.name} class`}
                  fill
                  sizes="(min-width: 1024px) 66vw, 100vw"
                  className="object-cover"
                  unoptimized={/^https?:\/\//i.test(gymClass.thumbnail)}
                />
              </TiltCard>
            </Reveal>
          ) : null}

          {/* About the class */}
          <Reveal>
            <article className="space-y-6">
              <header>
                <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                  About this class
                </p>
                <h2 className="mt-3 font-['Montserrat'] text-3xl font-extrabold uppercase leading-tight tracking-tight text-white md:text-4xl">
                  {gymClass.name}
                </h2>
                <p className="mt-4 max-w-[70ch] text-base leading-relaxed text-white/75">
                  {gymClass.description || gymClass.shortDescription || "No description available for this class."}
                </p>
              </header>

              {stats.length > 0 && (
                <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {stats.map(({ icon: Icon, label, value }) => (
                    <div key={label} className={`${card} p-4`}>
                      <Icon size={18} className="text-[var(--accent)]" aria-hidden="true" />
                      <dt className="mt-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</dt>
                      <dd className="mt-1 font-['Montserrat'] text-lg font-extrabold capitalize text-white">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {((gymClass.features?.length ?? 0) > 0 || (gymClass.requirements?.length ?? 0) > 0) && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {gymClass.features && gymClass.features.length > 0 && <CheckList title="Features" items={gymClass.features} />}
                  {gymClass.requirements && gymClass.requirements.length > 0 && (
                    <CheckList title="Requirements" items={gymClass.requirements} />
                  )}
                </div>
              )}
            </article>
          </Reveal>

          {/* Upcoming sessions, booked here. The session cards are shared
              with the light embed, so they sit on a light panel. */}
          <div className="rounded-3xl bg-white p-5 text-neutral-900 sm:p-8">
            <ClassSessionsSection classId={gymClass._id} />
          </div>
        </div>

        {/* Sidebar */}
        <aside
          className="space-y-6 lg:col-span-4 lg:sticky lg:top-24 lg:self-start"
          aria-label="Class information"
        >
          {/* A shortcut to the sessions; on a phone they are already next. */}
          <section
            className="relative hidden overflow-hidden rounded-3xl border border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[var(--surface)] p-7 lg:block"
            aria-labelledby="book-class-title"
          >
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full"
              style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 35%, transparent), transparent 65%)" }}
              aria-hidden="true"
            />
            <CalendarCheck size={26} className="relative text-[var(--accent)]" aria-hidden="true" />
            <h3 id="book-class-title" className="relative mt-4 font-['Montserrat'] text-2xl font-extrabold text-white">
              Book this class
            </h3>
            <p className="relative mt-2 text-sm leading-relaxed text-white/70">
              Pick one of the upcoming sessions and reserve your place.
            </p>
            <a
              href="#sessions"
              className="btn btn--primary btn--block mt-6"
            >
              <span>See sessions &amp; book</span>
            </a>
          </section>

          {/* The gym's own hours from Settings. */}
          {openingHours.length > 0 && (
            <section className={`${card} p-7`} aria-labelledby="opening-hours-title">
              <h3 id="opening-hours-title" className="font-['Montserrat'] text-xl font-extrabold text-white">
                Opening hours
              </h3>
              <dl className="mt-4 divide-y divide-[var(--border-subtle)]">
                {openingHours.map((h) => (
                  <div key={h.day} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                    <dt className="text-white/80">{h.day}</dt>
                    <dd className={h.closed ? "text-[var(--text-muted)]" : "font-semibold text-white"}>
                      {h.closed ? "Closed" : `${h.open} – ${h.close}`}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* From the class's own gallery. */}
          {gymClass.gallery?.[0] && (
            <TiltCard max={6} className={`${card} relative h-64 overflow-hidden md:h-80`}>
              <Image
                src={gymClass.gallery[0]}
                alt={`${gymClass.name} class`}
                fill
                sizes="(min-width: 1024px) 33vw, 100vw"
                className="object-cover"
                unoptimized={/^https?:\/\//i.test(gymClass.gallery[0])}
              />
            </TiltCard>
          )}
        </aside>
      </div>
    </section>
  );
};

export default GymClassDetailSection;
