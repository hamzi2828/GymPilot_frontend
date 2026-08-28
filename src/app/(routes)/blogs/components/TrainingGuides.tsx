"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

const TrainingGuides: React.FC = () => {
  return (
    <section
      id="guides"
      className="px-4 sm:px-6 lg:px-20 py-12 sm:py-16 lg:py-20 gym-blog-custom-bg-dark text-white"
    >
      <div className="mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-16">
          <div>
            <h2 className="font-montserrat font-bold text-3xl sm:text-4xl uppercase tracking-wide mb-4">
              Training Guides
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl">
              Expert-crafted workout programs for every fitness level
            </p>
          </div>
          <a
            href="#"
            className="mt-6 lg:mt-0 gym-blog-custom-gradient-green text-black font-bold px-6 py-3 rounded-full hover:scale-105 transition-all duration-300  gap-2"
          >
            View All Guides <i className="fas fa-arrow-right"></i>
          </a>
        </div>

        {/* Guides Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Large Guide Card */}
          <Link href="/blogs-detail" className="block">
            <article className="lg:row-span-2 relative overflow-hidden rounded-2xl gym-blog-hover-lift transition-all duration-500 group">
              <div className="relative h-80 lg:h-full min-h-[400px]">
                <Image
                  src="/images/hero.svg"
                  alt="Ultimate Push Day Guide"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="gym-blog-image-overlay absolute inset-0"></div>
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <span className="gym-blog-custom-bg-green text-black px-4 py-2 rounded-full text-sm font-bold uppercase mb-4 inline-block">
                    Workout Guide
                  </span>
                  <h3 className="font-montserrat font-bold text-2xl lg:text-4xl mb-4 text-white">
                    Ultimate Push Day Routine
                  </h3>
                  <p className="text-lg text-gray-200 mb-6">
                    Complete chest, shoulders, and triceps workout with
                    progressive overload techniques for maximum muscle growth.
                  </p>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-300">
                      <i className="far fa-clock mr-1"></i> 45 min workout
                    </span>
                    <span className="text-sm text-gray-300">
                      <i className="fas fa-dumbbell mr-1"></i> Intermediate
                    </span>
                  </div>
                </div>
              </div>
            </article>
          </Link>

          {/* Smaller Guide Cards */}
          <div>
            <Link href="/blogs-detail" className="block">
              <article className="gym-blog-card-gradient rounded-xl overflow-hidden gym-blog-hover-lift transition-all duration-500 group mb-3">
                <div className="flex h-48">
                  <div className="w-1/2 relative overflow-hidden">
                    <Image
                      src="/images/gym-blog-2.svg"
                      alt="Leg Day Guide"
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <div className="w-1/2 p-6 flex flex-col justify-between">
                    <div>
                      <span className="bg-purple-500 text-white px-2 py-1 rounded text-xs font-bold uppercase mb-2 inline-block">
                        Lower Body
                      </span>
                      <h3 className="font-semibold text-lg mb-2 group-hover:gym-blog-custom-text-green transition-colors">
                        Complete Leg Day
                      </h3>
                      <p className="text-gray-400 text-sm">
                        Build powerful legs with this comprehensive routine.
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">60 min</span>
                      <i className="fas fa-arrow-right gym-blog-custom-text-green"></i>
                    </div>
                  </div>
                </div>
              </article>
            </Link>

            <Link href="/blogs-detail" className="block">
              <article className="gym-blog-card-gradient rounded-xl overflow-hidden gym-blog-hover-lift transition-all duration-500 group">
                <div className="flex h-48">
                  <div className="w-1/2 relative overflow-hidden">
                    <Image
                      src="/images/gym-large.svg"
                      alt="HIIT Training"
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <div className="w-1/2 p-6 flex flex-col justify-between">
                    <div>
                      <span className="bg-orange-500 text-white px-2 py-1 rounded text-xs font-bold uppercase mb-2 inline-block">
                        Cardio
                      </span>
                      <h3 className="font-semibold text-lg mb-2 group-hover:gym-blog-custom-text-green transition-colors">
                        HIIT Fat Burner
                      </h3>
                      <p className="text-gray-400 text-sm">
                        High-intensity intervals for maximum fat loss.
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">20 min</span>
                      <i className="fas fa-arrow-right gym-blog-custom-text-green"></i>
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          </div>
        </div>

        {/* Quick Access Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="gym-blog-glass-effect rounded-lg p-6 text-center hover:scale-105 transition-all duration-300 cursor-pointer">
            <i className="fas fa-dumbbell text-3xl gym-blog-custom-text-green mb-3"></i>
            <h4 className="font-semibold mb-1">Strength</h4>
            <p className="text-sm text-gray-400">24 Workouts</p>
          </div>
          <div className="gym-blog-glass-effect rounded-lg p-6 text-center hover:scale-105 transition-all duration-300 cursor-pointer">
            <i className="fas fa-running text-3xl gym-blog-custom-text-green mb-3"></i>
            <h4 className="font-semibold mb-1">Cardio</h4>
            <p className="text-sm text-gray-400">18 Routines</p>
          </div>
          <div className="gym-blog-glass-effect rounded-lg p-6 text-center hover:scale-105 transition-all duration-300 cursor-pointer">
            <i className="fas fa-leaf text-3xl gym-blog-custom-text-green mb-3"></i>
            <h4 className="font-semibold mb-1">Yoga</h4>
            <p className="text-sm text-gray-400">12 Sessions</p>
          </div>
          <div className="gym-blog-glass-effect rounded-lg p-6 text-center hover:scale-105 transition-all duration-300 cursor-pointer">
            <i className="fas fa-home text-3xl gym-blog-custom-text-green mb-3"></i>
            <h4 className="font-semibold mb-1">Home</h4>
            <p className="text-sm text-gray-400">15 Workouts</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrainingGuides;