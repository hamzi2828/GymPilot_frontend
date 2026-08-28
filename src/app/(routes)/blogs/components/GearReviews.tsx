"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

const GearReviews: React.FC = () => {
  return (
    <section className="px-4 sm:px-12 lg:px-32 py-12 sm:py-16 lg:py-20 gym-blog-custom-bg-dark text-white">
      <div className="mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-16">
          <div>
            <h2 className="font-montserrat font-bold text-3xl sm:text-4xl uppercase tracking-wide mb-4">
              Gear Reviews
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl">
              Honest reviews of the latest fitness equipment and apparel
            </p>
          </div>
          <a
            href="#"
            className="mt-6 lg:mt-0 gym-blog-glass-effect text-white font-semibold px-6 py-3 rounded-full hover:scale-105 transition-all duration-300 inline-flex items-center gap-2"
          >
            All Reviews <i className="fas fa-arrow-right"></i>
          </a>
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Link href="/blogs-detail" className="block">
            <article className="gym-blog-custom-bg-darker rounded-xl overflow-hidden gym-blog-hover-lift transition-all duration-500 group">
              <div className="relative h-48 overflow-hidden">
                <Image
                  src="/images/gym-2.svg"
                  alt="Running Shoes Review"
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute top-4 right-4">
                  <div className="bg-gym-blog-custom-bg-green text-black px-2 py-1 rounded font-bold text-sm">
                    8.8/10
                  </div>
                </div>
                <div className="absolute top-4 left-4">
                  <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase">
                    Supplements
                  </span>
                </div>
              </div>
              <div className="p-6">
                <h3 className="font-semibold text-lg mb-3 group-hover:gym-blog-custom-text-green transition-colors">
                  Optimum Nutrition Gold Standard
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  The gold standard of protein powders tested for taste,
                  mixability, and protein quality.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">$55 • 3 min read</span>
                  <i className="fas fa-star gym-blog-custom-text-green"></i>
                </div>
              </div>
            </article>
          </Link>

          <Link href="/blogs-detail" className="block">
            <article className="gym-blog-custom-bg-darker rounded-xl overflow-hidden gym-blog-hover-lift transition-all duration-500 group">
              <div className="relative h-48 overflow-hidden">
                <Image
                  src="/images/gym-3.svg"
                  alt="Fitness Smartwatch"
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute top-4 right-4">
                  <div className="bg-gym-blog-custom-bg-green text-black px-2 py-1 rounded font-bold text-sm">
                    9.5/10
                  </div>
                </div>
                <div className="absolute top-4 left-4">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase">
                    Tech
                  </span>
                </div>
              </div>
              <div className="p-6">
                <h3 className="font-semibold text-lg mb-3 group-hover:gym-blog-custom-text-green transition-colors">
                  Garmin Forerunner 955
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  Ultimate fitness tracking device with advanced metrics and
                  multi-sport capabilities.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">$499 • 8 min read</span>
                  <i className="fas fa-star gym-blog-custom-text-green"></i>
                </div>
              </div>
            </article>
          </Link>

          <Link href="/blogs-detail" className="block">
            <article className="gym-blog-custom-bg-darker rounded-xl overflow-hidden gym-blog-hover-lift transition-all duration-500 group">
              <div className="relative h-48 overflow-hidden">
                <Image
                  src="/images/gym-4.svg"
                  alt="Fitness Smartwatch"
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute top-4 right-4">
                  <div className="bg-gym-blog-custom-bg-green text-black px-2 py-1 rounded font-bold text-sm">
                    9.5/10
                  </div>
                </div>
                <div className="absolute top-4 left-4">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase">
                    Tech
                  </span>
                </div>
              </div>
              <div className="p-6">
                <h3 className="font-semibold text-lg mb-3 group-hover:gym-blog-custom-text-green transition-colors">
                  Garmin Forerunner 955
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  Ultimate fitness tracking device with advanced metrics and
                  multi-sport capabilities.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">$499 • 8 min read</span>
                  <i className="fas fa-star gym-blog-custom-text-green"></i>
                </div>
              </div>
            </article>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default GearReviews;