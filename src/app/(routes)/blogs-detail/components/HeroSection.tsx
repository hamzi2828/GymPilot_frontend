"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

interface HeroSectionProps {
  title: string;
  backgroundImage?: string;
  author?: {
    name: string;
    avatar?: string;
  };
  readingTime?: string;
  publishDate?: string;
  views?: number;
  category?: {
    name: string;
    slug?: string;
  };
}

const HeroSection: React.FC<HeroSectionProps> = ({
  title,
  backgroundImage = "/images/gym-blog-detail-hero.svg",
  author,
  readingTime = "12 min read",
  publishDate = "Dec 15, 2024",
  views = 1250,
  category
}) => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src={backgroundImage}
          alt={title}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black bg-opacity-60"></div>
      </div>

      <div className="relative z-10 text-center text-white px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <nav className="mb-8">
          <ol className="flex items-center justify-center space-x-2 text-sm">
            <li>
              <Link href="/" className="text-gray-300 hover:text-white transition-colors">
                Home
              </Link>
            </li>
            <li className="text-gray-400">/</li>
            <li>
              <Link href="/blogs" className="text-gray-300 hover:text-white transition-colors">
                Blogs
              </Link>
            </li>
            <li className="text-gray-400">/</li>
            <li className="text-white">Article</li>
          </ol>
        </nav>

        {category && (
          <div className="mb-6">
            <span className="gym-blog-custom-bg-green text-black px-4 py-2 rounded-full text-sm font-bold uppercase">
              {category.name}
            </span>
          </div>
        )}

        <h1 className="font-montserrat font-bold text-4xl sm:text-5xl lg:text-6xl mb-8 leading-tight">
          {title}
        </h1>

        <div className="flex flex-wrap items-center justify-center gap-6 text-gray-300">
          {author && (
            <div className="flex items-center gap-3">
              {author.avatar && (
                <Image
                  src={author.avatar}
                  alt={author.name}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              )}
              <span className="font-medium">By {author.name}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <i className="far fa-clock gym-blog-custom-text-green"></i>
            <span>{readingTime}</span>
          </div>

          <div className="flex items-center gap-2">
            <i className="far fa-calendar gym-blog-custom-text-green"></i>
            <span>{publishDate}</span>
          </div>

          <div className="flex items-center gap-2">
            <i className="far fa-eye gym-blog-custom-text-green"></i>
            <span>{views.toLocaleString()} views</span>
          </div>
        </div>

        <div className="mt-12">
          <button
            onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
            className="gym-blog-custom-bg-green text-black px-8 py-4 rounded-full font-bold hover:scale-105 transition-all duration-300 inline-flex items-center gap-2"
          >
            Start Reading <i className="fas fa-arrow-down"></i>
          </button>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <i className="fas fa-chevron-down text-white text-2xl opacity-70"></i>
      </div>
    </section>
  );
};

export default HeroSection;