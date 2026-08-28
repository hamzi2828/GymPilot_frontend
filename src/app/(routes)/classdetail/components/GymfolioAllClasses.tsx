"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";

type ClassItem = {
  id: string;
  title: string;
  image: string; // public/ path
  slug: "power-yoga" | "battle-box" | "boxing" | "cardio";
};

// All cards will link to the static classdetail page
const CLASS_DETAIL_LINK = "/classdetail";

const classesData: ClassItem[] = [
  { id: "power-yoga-1", title: "Power Yoga", slug: "power-yoga", image: "/images/class1.svg" },
  { id: "battle-box-1", title: "Battle Box", slug: "battle-box", image: "/images/class2.svg" },
  { id: "boxing-1", title: "Boxing", slug: "boxing", image: "/images/class3.svg" },
  { id: "cardio-1", title: "Cardio", slug: "cardio", image: "/images/class4.svg" },
 
];

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

const GymfolioClass: React.FC = () => {
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

      {/* Cards */}
      <div
        className="GymfolioAllClasses-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        role="list"
        aria-label="Class cards"
      >
        {classesData.map((item, idx) => {
          // All cards link to the same static classdetail page
          const href = CLASS_DETAIL_LINK;
          return (
            <article
              key={item.id}
              role="listitem"
              className="GymfolioAllClasses-card group relative h-[426px] overflow-hidden rounded-lg bg-transparent transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/15 ring-1 ring-transparent hover:ring-[#bee304] hover:ring-offset-2 hover:ring-offset-white"
            >
              <figure className="h-full w-full">
                {/* Image */}
                <div className="absolute inset-0">
                  <Image
                    src={item.image}
                    alt={`${item.title} class preview`}
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
                      {item.title}
                    </span>
                    <Link
                      href={href}
                      className="GymfolioAllClasses-plus inline-flex items-center justify-center rounded-md bg-black/5 p-1 transition-colors duration-200 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                      aria-label={`Open ${item.title} details`}
                    >
                      <PlusIcon />
                    </Link>
                  </div>
                </figcaption>

                {/* Full-card link target */}
                <Link href={href} aria-label={`${item.title} details`} className="absolute inset-0" />
              </figure>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default GymfolioClass;