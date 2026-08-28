"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

const NutritionHub: React.FC = () => {
  return (
    <section className="px-4 sm:px-12 lg:px-28 py-12 sm:py-16 lg:py-20 gym-blog-custom-bg-darker text-white">
      <div className="mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-montserrat font-bold text-3xl sm:text-4xl uppercase tracking-wide mb-4">
            Nutrition Hub
          </h2>
          <div className="w-24 h-1 gym-blog-custom-bg-green mx-auto mb-6"></div>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Fuel your body right with expert nutrition advice and meal plans
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Featured Nutrition Article */}
          <Link href="/blogs-detail" className="block lg:col-span-2">
            <article className="relative overflow-hidden rounded-2xl gym-blog-hover-lift transition-all duration-500 group">
              <div className="relative h-80">
                <Image
                  src="/images/gym-bdetail1.svg"
                  alt="Meal Prep Mastery"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="gym-blog-image-overlay absolute inset-0"></div>
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <span className="bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-bold uppercase mb-4 inline-block">
                    Nutrition Guide
                  </span>
                  <h3 className="font-montserrat font-bold text-2xl lg:text-3xl mb-4 text-white">
                    Meal Prep Mastery: 7 Days in 2 Hours
                  </h3>
                  <p className="text-lg text-gray-200 mb-4">
                    Learn how to prepare a week&apos;s worth of healthy,
                    muscle-building meals in just 2 hours every Sunday.
                  </p>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-300">
                      <i className="far fa-clock mr-1"></i> 6 min read
                    </span>
                    <span className="text-sm text-gray-300">
                      <i className="fas fa-utensils mr-1"></i> 21 recipes
                    </span>
                  </div>
                </div>
              </div>
            </article>
          </Link>

          {/* Nutrition Tips Sidebar */}
          <div className="space-y-6">
            <Link href="/blogs-detail" className="block">
              <article className="gym-blog-card-gradient rounded-xl p-6 gym-blog-hover-lift transition-all duration-500 group">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src="/images/dry-fruits.png"
                      alt="Protein Guide"
                      width={64}
                      height={64}
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <span className="text-xs gym-blog-custom-text-green font-semibold uppercase">
                      Protein
                    </span>
                    <h4 className="font-semibold mb-2 group-hover:gym-blog-custom-text-green transition-colors">
                      Complete Protein Guide
                    </h4>
                    <p className="text-sm text-gray-400">
                      Everything about protein intake for muscle growth.
                    </p>
                  </div>
                </div>
              </article>
            </Link>

            <Link href="/blogs-detail" className="block">
              <article className="gym-blog-card-gradient rounded-xl p-6 gym-blog-hover-lift transition-all duration-500 group">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src="/images/pure-honey.png"
                      alt="Supplements"
                      width={64}
                      height={64}
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <span className="text-xs gym-blog-custom-text-green font-semibold uppercase">
                      Supplements
                    </span>
                    <h4 className="font-semibold mb-2 group-hover:gym-blog-custom-text-green transition-colors">
                      Essential Supplements
                    </h4>
                    <p className="text-sm text-gray-400">
                      Science-backed supplements that actually work.
                    </p>
                  </div>
                </div>
              </article>
            </Link>

            <Link href="/blogs-detail" className="block">
              <article className="gym-blog-card-gradient rounded-xl p-6 gym-blog-hover-lift transition-all duration-500 group">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src="/images/dry-fruits.png"
                      alt="Hydration"
                      width={64}
                      height={64}
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <span className="text-xs gym-blog-custom-text-green font-semibold uppercase">
                      Hydration
                    </span>
                    <h4 className="font-semibold mb-2 group-hover:gym-blog-custom-text-green transition-colors">
                      Optimal Hydration
                    </h4>
                    <p className="text-sm text-gray-400">
                      How much water you really need for performance.
                    </p>
                  </div>
                </div>
              </article>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NutritionHub;