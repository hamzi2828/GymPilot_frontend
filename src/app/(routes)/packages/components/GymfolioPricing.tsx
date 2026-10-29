"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { packageService, Package } from "../services/packageService";
import { parseAmount } from "@/helper/money";
import TiltCard from "@/components/site/TiltCard";
import Reveal from "@/components/site/Reveal";
import { SectionHeading, surfaceClass } from "@/components/site/PageHero";

// A package with nothing to charge (price 0, or a price like "Free" that is
// not a number) cannot go through card or bank checkout -- the API refuses
// both -- so it is joined at the desk instead.
function joinedAtTheDesk(plan: Package) {
  const price = parseAmount(plan.price);
  return price === null || price <= 0;
}

const GymfolioPricing: React.FC = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await packageService.getActivePackages();
      setPackages(data);
    } catch (err) {
      console.error('Error fetching packages:', err);
      setError('We could not load the packages just now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  return (
    <section
      className={`${surfaceClass} px-4 sm:px-6 lg:px-12 py-20 lg:py-28`}
      aria-labelledby="GymfolioPricing-title"
    >
      <div className="relative mx-auto max-w-7xl">
        <SectionHeading id="GymfolioPricing-title" eyebrow="Pricing" title="Membership packages" center />

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true" aria-label="Loading packages">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[520px] rounded-[28px] bg-[var(--surface)] animate-pulse" />
            ))}
          </div>
        )}

        {/* Error State: say so, and offer another go rather than a dead end. */}
        {error && !loading && (
          <div className="mx-auto max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center" role="alert">
            <p className="text-red-200">{error}</p>
            <button
              type="button"
              onClick={fetchPackages}
              className="btn btn--primary mt-4"
            >
              <span>Try again</span>
            </button>
          </div>
        )}

        {/* Empty State: the gym has no package on sale. Under a heading alone
            the page read as broken. */}
        {!loading && !error && packages.length === 0 && (
          <div className="mx-auto max-w-md py-10 text-center">
            <p className="text-[var(--text-muted)]">No packages are listed here yet.</p>
            <Link
              href="/contact-us"
              className="btn btn--glass mt-4"
            >
              <span>Ask us about joining</span>
            </Link>
          </div>
        )}

        {!loading && !error && packages.length > 0 && (
          <ul className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8" aria-label="Pricing plans">
            {packages.map((plan, idx) => {
              // The gym marks its featured plan with a badge or the dark style.
              const featured = !!plan.badge || plan.theme === "dark";
              const titleId = `GymfolioPricing-${plan._id}-title`;
              const desk = joinedAtTheDesk(plan);

              return (
                <Reveal as="li" key={plan._id} delay={idx * 0.1} className={featured ? "lg:-mt-4 lg:mb-4" : ""}>
                  <TiltCard
                    max={6}
                    as="article"
                    aria-labelledby={titleId}
                    className={[
                      "relative flex h-full flex-col overflow-hidden rounded-[28px] border p-7 sm:p-8",
                      featured
                        ? "border-[color:color-mix(in_srgb,var(--accent)_60%,transparent)] bg-[var(--surface)] shadow-[0_30px_80px_-30px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
                        : "border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface)_70%,transparent)]",
                    ].join(" ")}
                  >
                    {featured && (
                      <div
                        className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[140%] -translate-x-1/2 rounded-full"
                        style={{ background: "radial-gradient(ellipse at center, color-mix(in srgb, var(--accent) 28%, transparent), transparent 65%)" }}
                        aria-hidden="true"
                      />
                    )}

                    <header className="relative">
                      <div className="flex items-start justify-between gap-3">
                        <h3 id={titleId} className="font-['Montserrat'] text-xl font-extrabold text-white">
                          {plan.name}
                        </h3>
                        {plan.badge && (
                          <span className="inline-flex flex-none items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--on-accent)]">
                            <Sparkles size={12} aria-hidden="true" />
                            {plan.badge}
                          </span>
                        )}
                      </div>
                      {plan.supportingText && (
                        <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">{plan.supportingText}</p>
                      )}
                      <p className="mt-7 flex flex-wrap items-baseline gap-x-2" aria-label={`${plan.price} ${plan.currency} ${plan.period || ""}`.trim()}>
                        <span className="font-['Montserrat'] text-6xl font-extrabold tracking-tight text-white">{plan.price}</span>
                        <span className="text-sm font-bold text-white">{plan.currency}</span>
                        {plan.period && <span className="text-sm text-[var(--text-muted)]">/ {plan.period}</span>}
                      </p>
                    </header>

                    <div className="relative my-7 h-px bg-[var(--border-subtle)]" aria-hidden="true" />

                    <ul className="relative space-y-3.5">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-3 text-[15px] text-white/80">
                          <span
                            className={`mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full ${
                              featured ? "bg-[var(--accent)] text-[var(--on-accent)]" : "bg-white/10 text-[var(--accent)]"
                            }`}
                            aria-hidden="true"
                          >
                            <Check size={12} strokeWidth={3} />
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div className="relative mt-auto pt-9">
                      <Link
                        href={desk ? "/contact-us" : `/checkout?packageId=${plan._id}`}
                        className={`btn btn--lg btn--block ${featured ? "btn--primary" : "btn--glass"}`}
                        aria-label={desk ? `Ask at the front desk about the ${plan.name} plan` : `Get started with ${plan.name} plan`}
                      >
                        <span>{desk ? "Ask at the front desk" : "Get Started"}</span>
                        <ArrowRight size={18} aria-hidden="true" />
                      </Link>
                    </div>
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

export default GymfolioPricing;
