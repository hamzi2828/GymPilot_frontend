"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { trainerService, Trainer } from "../../main/services/trainerService";

interface GymTrainersSectionProps {
  onTrainerClick?: (trainer: Trainer) => void;
}

const GymTrainersSection: React.FC<GymTrainersSectionProps> = ({ onTrainerClick }) => {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrainers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await trainerService.getActiveTrainers();
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

  const handleTrainerClick = (trainer: Trainer, e: React.MouseEvent) => {
    e.preventDefault();
    if (onTrainerClick) {
      onTrainerClick(trainer);
      // Scroll to TrainerDetail section
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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
              Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean
              commodo ligula eget dolor. Aenean massa. Cum sociis natoque
              penatibus et magnis dis parturient montes, nascetur ridiculus mus.
              Donec quam felis, ultricies nec, pellentesque eu, pretium quis,
              sem. Nulla consequat massa quis enim. Donec pede justo, fringilla
              vel, aliquet nec, vulputate eget, arcu.
            </p>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-center">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && trainers.length === 0 && (
          <div className="text-center py-20">
            <p className="gymfolio7-dark-gray-text text-lg">No trainers available at the moment.</p>
          </div>
        )}

        {/* Trainers Cards Grid */}
        {!loading && !error && trainers.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {trainers.map((trainer) => (
              <div
                key={trainer._id}
                className="block group cursor-pointer"
                onClick={(e) => handleTrainerClick(trainer, e)}
              >
                <article className="gymfolio7-trainer-card rounded-lg overflow-hidden transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
                  <div className="relative overflow-hidden h-64">
                    <Image
                      src={trainer.image || '/images/trainer-1.svg'}
                      alt={`${trainer.name} - ${trainer.role}`}
                      width={400}
                      height={256}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      priority={false}
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

                    <div className="flex justify-center gap-3">
                      {trainer.social?.twitter && (
                        <Link
                          href={trainerService.formatSocialUrl(trainer.social.twitter, 'twitter')}
                          className="gymfolio7-social-icon hover:scale-110 focus:scale-110 focus:outline-none"
                          aria-label={`Follow ${trainer.name} on Twitter`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <i className="fab fa-x-twitter text-lg"></i>
                        </Link>
                      )}
                      {trainer.social?.instagram && (
                        <Link
                          href={trainerService.formatSocialUrl(trainer.social.instagram, 'instagram')}
                          className="gymfolio7-social-icon hover:scale-110 focus:scale-110 focus:outline-none"
                          aria-label={`Follow ${trainer.name} on Instagram`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <i className="fab fa-instagram text-lg"></i>
                        </Link>
                      )}
                      {trainer.social?.facebook && (
                        <Link
                          href={trainerService.formatSocialUrl(trainer.social.facebook, 'facebook')}
                          className="gymfolio7-social-icon hover:scale-110 focus:scale-110 focus:outline-none"
                          aria-label={`Follow ${trainer.name} on Facebook`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <i className="fab fa-facebook text-lg"></i>
                        </Link>
                      )}
                      {trainer.social?.youtube && (
                        <Link
                          href={trainerService.formatSocialUrl(trainer.social.youtube, 'youtube')}
                          className="gymfolio7-social-icon hover:scale-110 focus:scale-110 focus:outline-none"
                          aria-label={`Follow ${trainer.name} on YouTube`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <i className="fab fa-youtube text-lg"></i>
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default GymTrainersSection;
