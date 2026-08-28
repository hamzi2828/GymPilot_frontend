"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { packageService, Package } from "../services/packageService";

const CheckIcon = () => (
  <svg
    className="w-6 h-6 flex-none"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M0 12C0 5.37258 5.37258 0 12 0C18.6274 0 24 5.37258 24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12Z" fill="#F5F5F6" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M17.096 7.39004L9.93602 14.3L8.03602 12.27C7.68602 11.94 7.13602 11.92 6.73602 12.2C6.34602 12.49 6.23602 13 6.47602 13.41L8.72602 17.07C8.94602 17.41 9.32601 17.62 9.75601 17.62C10.166 17.62 10.556 17.41 10.776 17.07C11.136 16.6 18.006 8.41004 18.006 8.41004C18.906 7.49004 17.816 6.68004 17.096 7.38004V7.39004Z"
      fill="black"
    />
  </svg>
);

const ArrowRightIcon = () => (
  <svg
    className="w-6 h-6"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M14.4297 5.93005L20.4997 12.0001L14.4297 18.0701"
      stroke="black"
      strokeWidth="1.5"
      strokeMiterlimit="10"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3.5 12L20.33 12"
      stroke="black"
      strokeWidth="1.5"
      strokeMiterlimit="10"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const GymfolioPricing: React.FC = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await packageService.getActivePackages();
        setPackages(data);
      } catch (err) {
        console.error('Error fetching packages:', err);
        setError('Failed to load packages. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, []);

  return (
    <section
      className="GymfolioPricing relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-12 py-16 lg:py-20"
      aria-labelledby="GymfolioPricing-title"
    >
      <header className="flex flex-col items-center gap-4 text-center mb-12 lg:mb-16">
        <div className="GymfolioPricing-badge inline-flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[#91b200]" aria-hidden="true" />
          <span className="text-sm font-semibold text-[#85868b]">Pricing</span>
        </div>
        <h2
          id="GymfolioPricing-title"
          className="text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-tight text-black/90"
        >
          Simple, transparent pricing
        </h2>
      </header>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#bee304]"></div>
            <p className="text-gray-600">Loading packages...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex items-center justify-center py-20">
          <div className="rounded-lg bg-red-50 p-6 max-w-md">
            <p className="text-red-800 text-center">{error}</p>
          </div>
        </div>
      )}

      {/* Packages Grid */}
      {!loading && !error && (
        <div
          className="GymfolioPricing-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
          role="list"
          aria-label="Pricing plans"
        >
          {packages.map((plan) => {
            const isDark = plan.theme === "dark";
            const titleId = `GymfolioPricing-${plan._id}-title`;

            return (
              <article
                key={plan._id}
                aria-labelledby={titleId}
              className={[
                "GymfolioPricing-card relative flex flex-col overflow-hidden rounded-2xl border",
                isDark ? "GymfolioPricing-card--dark border-gray-200 bg-[#181b20] shadow-lg" : "border-[#cfd0d2] bg-white",
              ].join(" ")}
              role="listitem"
            >
              {/* Card header */}
              <header
                className={[
                  "border-b px-8 pt-8 pb-6",
                  isDark ? "border-white/10" : "border-[#eaecf0]",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-[240px]">
                    <h3
                      id={titleId}
                      className={[
                        "GymfolioPricing-cardTitle text-2xl font-semibold",
                        isDark ? "text-[#bee304]" : "text-[#6c8704]",
                      ].join(" ")}
                    >
                      {plan.name}
                    </h3>
                  </div>

                  <div className="flex items-end gap-1">
                    <span
                      className={[
                        "GymfolioPricing-price block text-6xl font-semibold tracking-tight",
                        isDark ? "text-white" : "text-[#141415]",
                      ].join(" ")}
                      aria-label={`${plan.price} ${plan.currency}`}
                    >
                      {plan.price}
                    </span>
                    <div className="pb-2">
                      <span
                        className={[
                          "GymfolioPricing-currency block text-sm font-bold",
                          isDark ? "text-white" : "text-[#141415]",
                        ].join(" ")}
                      >
                        {plan.currency}
                      </span>
                    </div>
                    <div className="pb-2">
                      <span
                        className={[
                          "GymfolioPricing-period block text-sm",
                          isDark ? "text-gray-300" : "text-[#6a6b70]",
                        ].join(" ")}
                      >
                        {plan.period}
                      </span>
                    </div>
                  </div>
                </div>
              </header>

              {/* Card content */}
              <div className="px-8 pt-6 pb-10">
                <div className="mb-4">
                  <p
                    className={[
                      "GymfolioPricing-featuresHeading text-sm font-semibold",
                      isDark ? "text-gray-50" : "text-[#141415]",
                    ].join(" ")}
                  >
                    FEATURES
                  </p>
                  {plan.supportingText && (
                    <p className={["mt-1 text-sm", isDark ? "text-gray-300" : "text-gray-500"].join(" ")}>
                      {plan.supportingText}
                    </p>
                  )}
                </div>

                <ul className="GymfolioPricing-features space-y-4">
                  {plan.features.map((f, idx) => (
                    <li key={idx} className="GymfolioPricing-feature flex items-start gap-3">
                      <span aria-hidden="true">
                        <CheckIcon />
                      </span>
                      <span
                        className={[
                          "text-base",
                          isDark ? "text-gray-300" : "text-[#4d4d51]",
                        ].join(" ")}
                      >
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Card footer */}
              <footer
                className={[
                  "mt-auto px-4 pb-8",
                  isDark ? "bg-[#181b20]" : "bg-white",
                ].join(" ")}
              >
                <Link
                  href={`/checkout?packageId=${plan._id}`}
                  className="GymfolioPricing-cta inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#bee304] px-6 py-3 font-semibold text-black shadow-[4px_4px_12px_rgba(0,132,255,0.25)] transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                  aria-label={`Get started with ${plan.name} plan`}
                >
                  Get Started
                  <ArrowRightIcon />
                </Link>
              </footer>

              {/* Popular badge for dark (Pro) */}
              {plan.badge && (
                <div className="absolute right-4 top-4">
                  <span className="inline-flex items-center rounded-full border border-[#f5ff94] bg-[#feffe5] px-3 py-0.5 text-sm font-medium text-black">
                    {plan.badge}
                  </span>
                </div>
              )}
            </article>
          );
          })}
        </div>
      )}
    </section>
  );
};

export default GymfolioPricing;