"use client";
import React, { useState, useRef } from "react";
import Image from "next/image";

const GymfolioGallery: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoToggle = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
  };

  const galleryImages = [
    {
      src: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
      alt: "Fitness workout session"
    },
    {
      src: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
      alt: "Gym equipment and weights"
    },
    {
      src: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
      alt: "Personal training session"
    },
    {
      src: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
      alt: "Yoga and stretching exercises"
    },
    {
      src: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
      alt: "Cardio workout equipment"
    },
    {
      src: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
      alt: "Healthy lifestyle and nutrition"
    }
  ];

  return (
    <section className="gymfolio6-gallery-bg py-16 lg:py-20 px-4 sm:px-8 lg:px-20">
      <div className="mx-auto">
        {/* Header Section */}
        <header className="text-center mb-12 lg:mb-16">
          <div className="flex items-center justify-center mb-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-transparent">
              <div className="gymfolio6-green-dot w-2 h-2 rounded-full"></div>
              <span className="gymfolio6-font-sora font-semibold text-sm gymfolio6-gray-text">
                Gallery
              </span>
            </div>
          </div>

          <h1 className="gymfolio6-font-montserrat font-bold text-2xl md:text-3xl lg:text-4xl leading-tight tracking-tight uppercase gymfolio6-title-opacity">
            <span className="text-black">Believe in yourself be </span>
            <span className="gymfolio6-green-text">fit</span>
            <span className="text-black"> & </span>
            <span className="gymfolio6-green-text">healthier</span>
          </h1>
        </header>

        {/* Gallery Grid */}
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-start">
          {/* Left Side - Sticky Video Card */}
          <article className="gymfolio6-sticky-video">
            <div className="gymfolio6-video-card rounded-lg p-16 sm:p-20 lg:p-24 flex items-center justify-center h-96 lg:h-[584px] relative overflow-hidden group cursor-pointer">
              {/* Video Element */}
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                onEnded={handleVideoEnded}
                loop
                muted
                playsInline
              >
                <source
                  src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                  type="video/mp4"
                />
                Your browser does not support the video tag.
              </video>

              {/* Play/Pause Button */}
              <button
                onClick={handleVideoToggle}
                className={`gymfolio6-play-button-backdrop rounded-full w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center transition-all duration-300 hover:scale-110 focus:scale-110 focus:outline-none focus:ring-4 focus:ring-white/30 relative z-10 ${
                  isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'
                }`}
                aria-label={isPlaying ? "Pause video" : "Play video"}
              >
                {isPlaying ? (
                  <svg
                    className="w-8 h-8 sm:w-10 sm:h-10 text-white"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg
                    className="w-8 h-8 sm:w-10 sm:h-10 text-white ml-1"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Video Overlay */}
              <div className={`absolute inset-0 transition-colors duration-300 ${
                isPlaying ? 'bg-black/10' : 'bg-black/20 group-hover:bg-black/10'
              }`}></div>
            </div>
          </article>

          {/* Right Side - Image Gallery */}
          <aside className="gymfolio6-gallery-scroll lg:h-[888px] lg:overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
              {galleryImages.map((image, index) => (
                <figure
                  key={index}
                  className="gymfolio6-gallery-image rounded-lg overflow-hidden h-64 lg:h-[280px] group"
                >
                  <Image
                    src={image.src}
                    alt={image.alt}
                    width={400}
                    height={280}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                </figure>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};

export default GymfolioGallery;