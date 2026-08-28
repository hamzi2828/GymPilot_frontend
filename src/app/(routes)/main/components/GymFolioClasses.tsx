"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { gymClassService, GymClass } from "../services/gymClassService";

interface CarouselTrackElement extends HTMLDivElement {
  touchStartX?: number | null;
  touchCurrentX?: number | null;
}

const GymFolioClasses = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardsToShow, setCardsToShow] = useState(3);
  const [classesData, setClassesData] = useState<GymClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const carouselTrackRef = useRef<CarouselTrackElement | null>(null);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  const totalCards = classesData.length;

  // Fetch classes on component mount
  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
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
  };

  // Get cards to show based on screen size
  const getCardsToShow = () => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth >= 1280) return 3;
      if (window.innerWidth >= 1024) return 2;
      if (window.innerWidth >= 640) return 1;
      return 1;
    }
    return 3;
  };

  // Update cards to show on resize
  const updateCardsToShow = useCallback(() => {
    const newCardsToShow = getCardsToShow();
    setCardsToShow(newCardsToShow);
    const newMaxIndex = totalCards - newCardsToShow;
    if (currentIndex > newMaxIndex) {
      setCurrentIndex(newMaxIndex);
    }
  }, [totalCards, currentIndex]);

  // Initialize autoplay
  const startAutoPlay = useCallback(() => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
    }
    autoPlayRef.current = setInterval(() => {
      setCurrentIndex(prevIndex => {
        const maxIdx = totalCards - cardsToShow;
        return prevIndex >= maxIdx ? 0 : prevIndex + 1;
      });
    }, 4000);
  }, [totalCards, cardsToShow]);

  // Navigation handlers
  const nextSlide = () => {
    const maxIdx = totalCards - cardsToShow;
    setCurrentIndex(prevIndex => prevIndex >= maxIdx ? 0 : prevIndex + 1);
  };

  const prevSlide = () => {
    const maxIdx = totalCards - cardsToShow;
    setCurrentIndex(prevIndex => prevIndex <= 0 ? maxIdx : prevIndex - 1);
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!carouselTrackRef.current) return;
    const touch = e.touches[0];
    carouselTrackRef.current.touchStartX = touch.clientX;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!carouselTrackRef.current || !carouselTrackRef.current.touchStartX) return;
    const touch = e.touches[0];
    carouselTrackRef.current.touchCurrentX = touch.clientX;
  };

  const handleTouchEnd = () => {
    if (!carouselTrackRef.current ||
        !carouselTrackRef.current.touchStartX ||
        !carouselTrackRef.current.touchCurrentX) return;

    const diff = carouselTrackRef.current.touchStartX - carouselTrackRef.current.touchCurrentX;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }

    carouselTrackRef.current.touchStartX = null;
    carouselTrackRef.current.touchCurrentX = null;
  };

  // Effects
  useEffect(() => {
    setCardsToShow(getCardsToShow());
    const handleResize = () => updateCardsToShow();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateCardsToShow]);

  useEffect(() => {
    if (classesData.length > 0) {
      startAutoPlay();
    }
    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [cardsToShow, classesData.length, startAutoPlay]);

  // Calculate transform
  const cardWidth = 302;
  const gap = 24;
  const translateX = -currentIndex * (cardWidth + gap);

  return (
    <section className="bg-black py-8 md:py-20 px-4 md:px-8 lg:px-20 relative overflow-hidden">
      <div className="mx-auto">
        {/* Header Section */}
        <header className="text-center mb-16">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="gymfolio4-badge-dot"></div>
            <span className="text-gray-300 font-inter font-semibold text-sm">
              Classes
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="font-montserrat font-bold text-2xl md:text-3xl lg:text-4xl leading-tight text-white uppercase tracking-tight mb-6 opacity-90">
            What we do in our classes
          </h1>

          {/* Description */}
          <p className="text-gray-300   font-inter text-base lg:text-lg leading-relaxed max-w-3xl mx-auto">
            Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean
            commodo ligula eget dolor. Aenean massa. Cum sociis natoque
            penatibus et magnis dis parturient.
          </p>
        </header>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-900/20 border border-red-500/50 text-red-300 px-4 py-3 rounded text-center">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && classesData.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-300 text-lg">No classes available at the moment.</p>
          </div>
        )}

        {/* Carousel Container */}
        {!loading && !error && classesData.length > 0 && (
        <div className="relative">
          {/* Navigation Buttons */}
          <button
            onClick={prevSlide}
            className="gymfolio4-navigation-btn absolute left-4 top-1/2  z-10"
            disabled={currentIndex === 0}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M15 19.9201L8.47997 13.4001C7.70997 12.6301 7.70997 11.3701 8.47997 10.6001L15 4.08008"
                stroke="white"
                strokeWidth="1.5"
                strokeMiterlimit="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            onClick={nextSlide}
            className="gymfolio4-navigation-btn absolute right-4 top-1/2  z-10"
            disabled={currentIndex >= totalCards - cardsToShow}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8.9101 20.67C8.7201 20.67 8.5301 20.6 8.3801 20.45C8.0901 20.16 8.0901 19.68 8.3801 19.39L14.9001 12.87C15.3801 12.39 15.3801 11.61 14.9001 11.13L8.3801 4.61002C8.0901 4.32002 8.0901 3.84002 8.3801 3.55002C8.6701 3.26002 9.1501 3.26002 9.4401 3.55002L15.9601 10.07C16.4701 10.58 16.7601 11.27 16.7601 12C16.7601 12.73 16.4801 13.42 15.9601 13.93L9.4401 20.45C9.2901 20.59 9.1001 20.67 8.9101 20.67Z"
                fill="white"
              />
            </svg>
          </button>

          {/* Carousel Track Container */}
        
<div className="gymfolio4-carousel-container mx-4 sm:mx-6 md:mx-10 lg:mx-16">
  <div 
    ref={carouselTrackRef}
    className="gymfolio4-carousel-track gymfolio4-staggered-layout"
    style={{ transform: `translateX(${translateX}px)` }}
    onTouchStart={handleTouchStart}
    onTouchMove={handleTouchMove}
    onTouchEnd={handleTouchEnd}
  >
    {classesData.map((classItem) => (
      <Link
        key={classItem._id}
        href={`/classdetail?id=${classItem._id}`}
        className="gymfolio4-carousel-card group"
      >
        <div
          className="gymfolio4-card-image"
          style={{
            backgroundImage: `url('${classItem.thumbnail || '/images/class-placeholder.jpg'}')`,
          }}
        ></div>
        <div className="gymfolio4-card-overlay">
          <h3 className="gymfolio4-card-title">
            {classItem.name}
          </h3>
          <div className="gymfolio4-plus-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6 12H18"
                stroke="#292D32"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 18V6"
                stroke="#292D32"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </Link>
    ))}
  </div>
</div>

        </div>
        )}
      </div>
    </section>
  );
};

export default GymFolioClasses;