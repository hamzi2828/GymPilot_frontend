"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { trainerService, type Trainer } from "../../main/services/trainerService";

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
    <section className="py-16 lg:py-20 px-4 sm:px-8 lg:px-20">
      <div className="mx-auto">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-12 lg:mb-16 gap-6">
          <header className="flex-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full gymfolio7-green-dot"></div>
              <span className="gymfolio7-font-sora font-semibold text-sm gymfolio7-gray-text">
                Our Trainers
              </span>
            </div>

            <h2 className="gymfolio7-font-montserrat font-bold text-2xl md:text-3xl lg:text-4xl leading-tight tracking-tight uppercase opacity-92 text-black mb-0">
              The best fitness gym in town
            </h2>
          </header>

          <div className="lg:w-[747px] lg:flex-shrink-0">
            <p className="gymfolio7-dark-gray-text gymfolio7-font-inter gymfolio3-description-text text-base leading-6">
              Every coach on the floor is certified, insured and has come up through the same programmes they now teach. Book an intro session and you will be paired with the one whose speciality matches what you are training for.
            </p>
          </div>
        </div>

        {/* Trainers Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {trainers.map((trainer) => (
            <Link key={trainer._id} href="/trainers" className="block group">
              <article className="gymfolio7-trainer-card rounded-lg overflow-hidden cursor-pointer transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
                <div className="relative overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={trainer.image || "/images/trainer-1.svg"}
                    alt={`${trainer.name} - ${trainer.role}`}
                    className="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="gymfolio7-trainer-card-overlay absolute inset-0"></div>
                </div>

                <div className="p-4 text-center">
                  <div className="mb-4">
                    <h3 className="gymfolio7-green-text gymfolio7-font-montserrat font-bold text-base leading-6 mb-1">
                      {trainer.name}
                    </h3>
                    <p className="gymfolio7-dark-gray-text gymfolio7-font-inter text-sm leading-5">
                      {trainer.role}
                    </p>
                  </div>

                  {/* Only the accounts a trainer actually has. The old
                      hardcoded version linked to invented handles for
                      everybody, so every icon led to a 404. */}
                  <div className="flex justify-center gap-3">
                    {(
                      [
                        ["twitter", trainer.social?.twitter, "fab fa-twitter", "Twitter"],
                        ["instagram", trainer.social?.instagram, "fab fa-instagram", "Instagram"],
                        ["facebook", trainer.social?.facebook, "fab fa-facebook", "Facebook"],
                        ["youtube", trainer.social?.youtube, "fab fa-youtube", "YouTube"],
                      ] as const
                    )
                      .filter(([, href]) => !!href)
                      .map(([key, href, icon, label]) => (
                        <a
                          key={key}
                          href={href as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="gymfolio7-social-icon hover:scale-110 focus:scale-110 focus:outline-none"
                          aria-label={`Follow ${trainer.name} on ${label}`}
                        >
                          <i className={`${icon} text-lg`} aria-hidden="true"></i>
                        </a>
                      ))}
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default GymTrainersSection;
