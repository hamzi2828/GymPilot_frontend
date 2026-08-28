"use client";
import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { gymClassService, GymClass } from "../../main/services/gymClassService";

interface GymfolioAllClassesProps {
  onClassClick?: (gymClass: GymClass) => void;
}

const PlusIcon = () => (
  <svg
    className="h-6 w-6 transition-transform duration-300 ease-out group-hover:rotate-90"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M6 12H18" stroke="#292D32" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 18V6" stroke="#292D32" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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

  const handleClassClick = (gymClass: GymClass, e: React.MouseEvent) => {
    e.preventDefault();
    if (onClassClick) {
      onClassClick(gymClass);
    }
  };

  return (
    <section
      id="classes"
      className="GymfolioAllClasses py-16 md:py-20 px-4 md:px-8 lg:px-20 relative overflow-hidden"
      aria-labelledby="GymfolioAllClasses-title"
    >
      {/* Title + Intro */}
      <header className="GymfolioAllClasses-articleTitle flex flex-col items-center gap-6 text-center mb-16">
        <div className="GymfolioAllClasses-header flex flex-col items-center gap-4">
          <div className="GymfolioAllClasses-badge inline-flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#91b200]" aria-hidden="true" />
            <span className="text-sm font-semibold text-[#85868b]">Classes</span>
          </div>
          <h2
            id="GymfolioAllClasses-title"
            className="text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-tight text-black/90"
          >
            What we do in our classes
          </h2>
        </div>
        <p className="GymfolioAllClasses-description text-base leading-6 text-[#4d4d51] max-w-[747px]">
          Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa.
          Cum sociis natoque penatibus et magnis dis parturient.
        </p>
      </header>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#91b200]"></div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-center max-w-2xl mx-auto">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && classesData.length === 0 && (
        <div className="text-center py-20">
          <p className="text-[#4d4d51] text-lg">No classes available at the moment.</p>
        </div>
      )}

      {/* Cards */}
      {!loading && !error && classesData.length > 0 && (
        <div
          className="GymfolioAllClasses-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          role="list"
          aria-label="Class cards"
        >
          {classesData.map((item, idx) => {
            return (
              <article
                key={item._id}
                role="listitem"
                className="GymfolioAllClasses-card group relative h-[426px] overflow-hidden rounded-lg bg-transparent transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/15 ring-1 ring-transparent hover:ring-[#bee304] hover:ring-offset-2 hover:ring-offset-white cursor-pointer"
                onClick={(e) => handleClassClick(item, e)}
              >
                <figure className="h-full w-full">
                  {/* Image */}
                  <div className="absolute inset-0">
                    <Image
                      src={item.thumbnail || '/images/class-placeholder.jpg'}
                      alt={`${item.name} class preview`}
                      fill
                      sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-105 group-hover:-rotate-[0.5deg]"
                      priority={idx < 4}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/0 to-black/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </div>

                  {/* Caption bar */}
                  <figcaption className="absolute bottom-0 left-0 right-0">
                    <div className="GymfolioAllClasses-caption flex items-center justify-between gap-4 bg-[#bee304] px-4 py-3">
                      <span className="GymfolioAllClasses-title text-base font-bold leading-6 text-black">
                        {item.name}
                      </span>
                      <button
                        className="GymfolioAllClasses-plus inline-flex items-center justify-center rounded-md bg-black/5 p-1 transition-colors duration-200 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                        aria-label={`Open ${item.name} details`}
                      >
                        <PlusIcon />
                      </button>
                    </div>
                  </figcaption>
                </figure>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default GymfolioAllClasses;