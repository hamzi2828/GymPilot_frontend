"use client";

import React, { useState, useEffect } from 'react';

const WhyChooseUs: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 3;

  const images = [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80',
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80',
    'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80'
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  // Auto-play carousel
  useEffect(() => {
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className=" py-8 md:py-20 px-4 lg:px-20">
      <div className=" mx-auto">
        {/* Header Section */}
        <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 lg:gap-16 mb-16 for-mobile-center ">
          <div className="flex-1">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="gymfolio3-badge-dot"></div>
              <span className="text-gray-500 gymfolio3-badge-font font-semibold text-sm">
                Why Choose Us
              </span>
            </div>

            {/* Main Heading */}
            <h2 className="gymfolio3-main-heading text-2xl md:text-3xl lg:text-4xl font-bold leading-tight text-black uppercase tracking-tight mb-0">
              The best fitness gym in <br /> town
            </h2>
          </div>

          {/* Description */}
          <div className="flex-1 lg:max-w-2xl">
            <p className="gymfolio3-description-text text-base lg:text-lg leading-relaxed">
              Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean
              commodo ligula eget dolor. Aenean massa. Cum sociis natoque
              penatibus et magnis dis parturient montes, nascetur ridiculus mus.
              Donec quam felis, ultricies nec, pellentesque eu, pretium quis,
              sem. Nulla consequat massa quis enim. Donec pede justo, fringilla
              vel, aliquet nec, vulputate eget, arcu.
            </p>
          </div>
        </header>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 lg:gap-8">
          {/* Left Side - Sticky Image Carousel */}
          <div className="xl:col-span-2">
            <div className="gymfolio3-sticky-card">
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {/* Carousel Container */}
                <div className="gymfolio3-carousel-wrapper h-80 lg:h-96 relative overflow-hidden">
                  <div 
                    className="gymfolio3-carousel-track flex h-full w-full"
                    style={{
                      transform: `translateX(-${currentSlide * 100}%)`
                    }}
                  >
                    {images.map((image, index) => (
                      <div
                        key={index}
                        className="flex-shrink-0 w-full h-full bg-cover bg-center"
                        style={{ backgroundImage: `url('${image}')` }}
                      ></div>
                    ))}
                  </div>
                </div>

                {/* Image Slider Controls */}
                <div className="p-6">
                  <div className="flex items-center justify-center gap-4">
                    {/* Left Arrow */}
                    <button
                      onClick={prevSlide}
                      className="p-1 hover:bg-gray-100 rounded transition-colors duration-200"
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
                          stroke="#AEAFB2"
                          strokeWidth="1.5"
                          strokeMiterlimit="10"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>

                    {/* Dots */}
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((index) => (
                        <button
                          key={index}
                          onClick={() => goToSlide(index)}
                          className="bg-transparent border-none cursor-pointer p-0"
                        >
                          <div
                            className={
                              index === currentSlide
                                ? "gymfolio3-slider-active"
                                : "gymfolio3-slider-inactive"
                            }
                          ></div>
                        </button>
                      ))}
                    </div>

                    {/* Right Arrow */}
                    <button
                      onClick={nextSlide}
                      className="p-1 hover:bg-gray-100 rounded transition-colors duration-200"
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
                          fill="#AEAFB2"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Cards Grid */}
          <div className="xl:col-span-3 space-y-6">
            {/* Top Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Athletes Card */}
             {/* Athletes Card */}
<article className="group bg-yellow-50 rounded-lg overflow-hidden shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-yellow-100">
  <div
    className="h-48 bg-cover bg-center transform-gpu motion-safe:transition-transform motion-safe:duration-500 ease-out group-hover:scale-105"
    style={{
      backgroundImage: `url('https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80')`
    }}
  ></div>
  <div className="p-6">
    <h3 className="gymfolio3-card-title font-semibold text-xl lg:text-2xl text-black mb-3">
      Athletes
    </h3>
    <p className="gymfolio3-card-text text-sm lg:text-base leading-relaxed">
      Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor...
    </p>
  </div>
</article>

{/* Statistics Card */}
<article className="group bg-black rounded-lg p-8 lg:p-12 flex flex-col justify-center text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:ring-1 hover:ring-yellow-300/40">
  <div className="text-yellow-100 transition-colors">
    <span className="gymfolio3-stats-font font-bold text-3xl lg:text-4xl xl:text-5xl leading-tight">
      More than 50%
    </span>
    <p className="gymfolio3-stats-font text-lg lg:text-xl xl:text-2xl mt-2 leading-relaxed">
      of youth report being dissatisfied with their bodies.
    </p>
  </div>
</article>

            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             
{/* High Performers Card */}
<article className="group bg-yellow-50 rounded-lg overflow-hidden shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-yellow-100">
  <div className="p-6">
    <h3 className="gymfolio3-card-title font-semibold text-xl lg:text-2xl text-black mb-3">
      High Performers
    </h3>
    <p className="gymfolio3-card-text text-sm lg:text-base leading-relaxed mb-6">
      Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor...
    </p>
  </div>
  <div
    className="h-48 bg-cover bg-center transform-gpu motion-safe:transition-transform motion-safe:duration-500 ease-out group-hover:scale-105"
    style={{
      backgroundImage: `url('https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80')`
    }}
  ></div>
</article>

{/* Award Winning Card */}
<article className="group bg-yellow-50 rounded-lg overflow-hidden shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-yellow-100">
  <div
    className="h-48 bg-cover bg-center transform-gpu motion-safe:transition-transform motion-safe:duration-500 ease-out group-hover:scale-105"
    style={{
      backgroundImage: `url('https://images.unsplash.com/photo-1549060279-7e168fcee0c2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80')`
    }}
  ></div>
  <div className="p-6">
    <h3 className="gymfolio3-card-title font-semibold text-xl lg:text-2xl text-black mb-3">
      Award Winning
    </h3>
    <p className="gymfolio3-card-text text-sm lg:text-base leading-relaxed">
      Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor...
    </p>
  </div>
</article>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;