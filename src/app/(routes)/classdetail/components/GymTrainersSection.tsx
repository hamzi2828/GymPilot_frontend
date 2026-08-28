"use client";
import React from "react";
import Link from "next/link";

const GymTrainersSection = () => {
  const trainers = [
    {
      id: 1,
      name: "Alex Johnson",
      role: "Head Trainer & Fitness Coach",
      image: "/images/trainer-1.svg",
      social: {
        twitter: "https://twitter.com/alexjohnson",
        instagram: "https://instagram.com/alexjohnson",
        facebook: "https://facebook.com/alexjohnson",
        youtube: "https://youtube.com/@alexjohnson",
      },
    },
    {
      id: 2,
      name: "Sarah Mitchell",
      role: "Yoga Instructor & Wellness Coach",
      image: "/images/trainer2.svg",
      social: {
        twitter: "https://twitter.com/sarahmitchell",
        instagram: "https://instagram.com/sarahmitchell",
        facebook: "https://facebook.com/sarahmitchell",
        youtube: "https://youtube.com/@sarahmitchell",
      },
    }
  ];

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

        {/* Trainers Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {trainers.map((trainer) => (
            <Link key={trainer.id} href="/trainers" className="block group">
              <article className="gymfolio7-trainer-card rounded-lg overflow-hidden cursor-pointer transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
                <div className="relative overflow-hidden">
                  <img
                    src={trainer.image}
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

                  <div className="flex justify-center gap-3">
                    <Link
                      href={trainer.social.twitter}
                      className="gymfolio7-social-icon hover:scale-110 focus:scale-110 focus:outline-none"
                      aria-label={`Follow ${trainer.name} on Twitter`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <i className="fab fa-x-twitter text-lg"></i>
                    </Link>
                    <Link
                      href={trainer.social.instagram}
                      className="gymfolio7-social-icon hover:scale-110 focus:scale-110 focus:outline-none"
                      aria-label={`Follow ${trainer.name} on Instagram`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <i className="fab fa-instagram text-lg"></i>
                    </Link>
                    <Link
                      href={trainer.social.facebook}
                      className="gymfolio7-social-icon hover:scale-110 focus:scale-110 focus:outline-none"
                      aria-label={`Follow ${trainer.name} on Facebook`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <i className="fab fa-facebook text-lg"></i>
                    </Link>
                    <Link
                      href={trainer.social.youtube}
                      className="gymfolio7-social-icon hover:scale-110 focus:scale-110 focus:outline-none"
                      aria-label={`Follow ${trainer.name} on YouTube`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <i className="fab fa-youtube text-lg"></i>
                    </Link>
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
