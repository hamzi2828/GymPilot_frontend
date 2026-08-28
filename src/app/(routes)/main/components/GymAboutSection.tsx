"use client";
import React from "react";
import "@fortawesome/fontawesome-free/css/all.css";
import Image from "next/image";

const GymAboutSection = () => {
  return (
    <section className="py-8 md:py-20 px-4 md:px-8 lg:px-20">
      <div className="mx-auto">
        <div className="custom-flex-container">
          {/* First Content Block - About Us */}
          <article className="flex-1 space-y-8 lg:pr-8 xl:pr-16 z-6 relative for-mobile-center">
            <header className="space-y-4 for-mobile-center">
              <div className="flex items-center gap-2">
                <div className="gymfolio3-green-dot w-2 h-2 rounded-full"></div>
                <span className="text-gray-400 font-semibold text-sm tracking-wide">
                  About Us
                </span>
              </div>
              <h2 className="gymfolio3-main-title text-2xl md:text-3xl lg:text-4xl font-bold text-black uppercase leading-tight opacity-90">
                The best fitness gym in town
              </h2>
            </header>

            <p className="gymfolio3-description-text text-gray-600 text-sm md:text-base leading-relaxed">
              Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean
              commodo ligula eget dolor. Aenean massa. Cum sociis natoque
              penatibus et magnis dis parturient montes, nascetur ridiculus mus.
              Donec quam felis, ultricies nec, pellentesque eu, pretium quis,
              sem. Nulla consequat massa quis enim. Donec pede justo, fringilla
              vel, aliquet nec, vulputate eget, arcu.
            </p>

            <ul className="space-y-2">
              <li className="flex items-start gap-3">
                <div className="gymfolio3-check-circle w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="fas fa-check text-xs gymfolio3-check-icon"></i>
                </div>
                <span className="gymfolio3-list-text text-gray-600 text-base">
                  Access to all basic features
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="gymfolio3-check-circle w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="fas fa-check text-xs gymfolio3-check-icon"></i>
                </div>
                <span className="gymfolio3-list-text text-gray-600 text-base">
                  Access to all basic features
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="gymfolio3-check-circle w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="fas fa-check text-xs gymfolio3-check-icon"></i>
                </div>
                <span className="gymfolio3-list-text text-gray-600 text-base">
                  Access to all basic features
                </span>
              </li>
            </ul>

            <button className="hero-cta-button">
              <span className="hero-cta-text">Let&apos;s Start</span>
              <i className="fas fa-arrow-right"></i>
            </button>
          </article>

          {/* Center Image */}
          <figure className="relative lg:relative lg:-mx-20 xl:-mx-32 gymfolio3-z-index lg:order-none">
            <Image
              src="/images/gym-couple.png"
              alt="Couple working out at gym"
              width={600}
              height={500}
              className="w-full max-w-md lg:max-w-lg xl:max-w-2xl h-76 md:h-80 lg:h-96 xl:h-[500px] object-cover rounded-lg"
              priority
            />
          </figure>

          {/* Second Content Block - Body's of Strength */}
          <article className="flex-1 space-y-8 lg:pl-8 xl:pl-16 z-9 relative">
            <header className="space-y-4  for-mobile-center">
              <h2 className="gymfolio3-main-title text-2xl md:text-3xl  font-bold text-black uppercase leading-tight opacity-90">
                Body&apos;s of & Strength
              </h2>
              <p className="gymfolio3-description-text text-gray-600 text-sm md:text-base leading-relaxed">
                Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean
                commodo ligula eget dolor. Aenean massa. Cum sociis natoque
                penatibus et magnis dis parturient montes, nascetur ridiculus
                mus. Donec quam felis, ultricies nec, pellentesque eu, pretium
                quis, sem. Nulla consequat massa quis enim. Donec pede justo,
                fringilla vel, aliquet nec, vulputate eget, arcu.
              </p>
            </header>

            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="gymfolio3-progress-label text-gray-900 font-medium">General Boxing</h3>
                  <span className="gymfolio3-progress-label text-gray-900 font-medium">85%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div className="gymfolio3-progress-bar-85 gymfolio3-green-accent h-full rounded-full transition-all duration-500 ease-out"></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="gymfolio3-progress-label text-gray-900 font-medium">Muscles Tonus</h3>
                  <span className="gymfolio3-progress-label text-gray-900 font-medium">90%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div className="gymfolio3-progress-bar-90 gymfolio3-green-accent h-full rounded-full transition-all duration-500 ease-out"></div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
};

export default GymAboutSection;