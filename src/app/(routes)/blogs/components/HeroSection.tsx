"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { heroSectionService, HeroSectionData } from "../services/heroSectionService";

const HeroSection: React.FC = () => {
  const [heroData, setHeroData] = useState<HeroSectionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHeroData = async () => {
      try {
        setIsLoading(true);
        const data = await heroSectionService.getActiveHeroSection();
        setHeroData(data);
      } catch (error) {
        console.error('Error fetching hero data:', error);
        setHeroData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHeroData();
  }, []);

  if (isLoading) {
    return (
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden text-white">
        <div className="absolute inset-0 bg-gray-900"></div>
        <div className="relative z-10 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
        </div>
      </section>
    );
  }

  if (!heroData) {
    return (
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden text-white">
        <div className="absolute inset-0 bg-gray-900"></div>
        <div className="relative z-10 text-center max-w-2xl mx-auto px-4">
          <h1 className="font-montserrat font-black text-4xl sm:text-5xl lg:text-7xl uppercase tracking-wider mb-6">
            NO HERO SET
          </h1>
          <p className="text-xl sm:text-2xl lg:text-3xl font-light mb-8 text-gray-200">
            Please configure a hero section in the admin panel
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden text-white">
      <div className="absolute inset-0">
        <Image
          src={heroData.backgroundImage}
          alt="Fitness Hero"
          fill
          className="object-cover"
          priority
        />
        <div className="gym-blog-hero-overlay absolute inset-0"></div>
      </div>

      <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
        <h1 className="font-montserrat font-black text-4xl sm:text-5xl lg:text-7xl uppercase tracking-wider mb-6 gym-blog-text-shadow">
          {heroData.title}
        </h1>
        <p className="text-xl sm:text-2xl lg:text-3xl font-light mb-8 text-gray-200 max-w-2xl mx-auto">
          {heroData.subtitle}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href={heroData.primaryButtonLink}
            className="gym-blog-custom-gradient-green text-black font-bold px-8 py-4 rounded-full text-lg hover:scale-105 transition-all duration-300"
          >
            {heroData.primaryButtonText}
          </a>
          <a
            href={heroData.secondaryButtonLink}
            className="gym-blog-glass-effect text-white font-semibold px-8 py-4 rounded-full text-lg hover:scale-105 transition-all duration-300"
          >
            {heroData.secondaryButtonText}
          </a>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 animate-bounce">
        <i className="fas fa-chevron-down text-2xl gym-blog-custom-text-green"></i>
      </div>
    </section>
  );
};

export default HeroSection;