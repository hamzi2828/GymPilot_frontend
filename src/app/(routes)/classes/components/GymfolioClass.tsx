"use client";
import React, { useRef, useState } from "react";
import Image from "next/image";
import { GymClass } from "../../main/services/gymClassService";

interface GymfolioClassProps {
  gymClass: GymClass | null;
}

const CheckIcon = () => (
  <svg
    className="w-6 h-6 flex-none"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M0 12C0 5.37258 5.37258 0 12 0C18.6274 0 24 5.37258 24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12Z" fill="#3B3B3E" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M17.0965 7.39004L9.9365 14.3L8.0365 12.27C7.6865 11.94 7.1365 11.92 6.7365 12.2C6.3465 12.49 6.2365 13 6.4765 13.41L8.7265 17.07C8.9465 17.41 9.3265 17.62 9.7565 17.62C10.1665 17.62 10.5565 17.41 10.7765 17.07C11.1365 16.6 18.0065 8.41004 18.0065 8.41004C18.9065 7.49004 17.8165 6.68004 17.0965 7.38004V7.39004Z"
      fill="#bee304"
    />
  </svg>
);

const PlayIcon = () => (
  <svg
    className="w-12 h-12"
    width="48"
    height="48"
    viewBox="0 0 48 48"
    fill="none"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="24" cy="24" r="24" fill="rgba(190, 227, 4, 0.9)" />
    <path
      d="M20 16.5C19.1667 16.0333 18 16.6127 18 17.5618V30.4382C18 31.3873 19.1667 31.9667 20 31.5L30.5 25.0618C31.3333 24.5951 31.3333 23.4049 30.5 22.9382L20 16.5Z"
      fill="white"
    />
  </svg>
);

const PauseIcon = () => (
  <svg
    className="w-12 h-12"
    width="48"
    height="48"
    viewBox="0 0 48 48"
    fill="none"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="24" cy="24" r="24" fill="rgba(190, 227, 4, 0.9)" />
    <rect x="17" y="16" width="4" height="16" rx="2" fill="white" />
    <rect x="27" y="16" width="4" height="16" rx="2" fill="white" />
  </svg>
);

const VideoClassButton = () => (
  <svg
    className="w-[34px] h-[34px]"
    width="34"
    height="34"
    viewBox="0 0 34 34"
    fill="none"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M14.4258 10.9896L23.0101 10.9896L23.0101 19.5739"
      stroke="black"
      strokeWidth="1.5"
      strokeMiterlimit="10"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10.9893 23.0104L22.8899 11.1098"
      stroke="black"
      strokeWidth="1.5"
      strokeMiterlimit="10"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const GymfolioClass: React.FC<GymfolioClassProps> = ({ gymClass }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  // If no class is selected, show a placeholder message
  if (!gymClass) {
    return (
      <section className="GymfolioClasses py-16 md:py-20 px-4 md:px-8 lg:px-20 relative overflow-hidden">
        <div className="text-center py-20">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="inline-block h-2 w-2 rounded-full bg-[#6c8704]"></span>
            <span className="text-sm font-semibold text-[#85868b]">Our Classes</span>
          </div>
          <h2 className="text-2xl font-bold text-black/90 mb-4">Select a Class</h2>
          <p className="text-[#4d4d51]">Click on any class below to view its details</p>
        </div>
      </section>
    );
  }

  // Use features from gymClass or fallback to default points
  const points = gymClass.features && gymClass.features.length > 0
    ? gymClass.features
    : ["Access to all basic features", "Professional workout guidance", "Flexible class schedules"];

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVideoClick = () => {
    setShowVideo(true);
    // Small delay to ensure video element is rendered
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }, 100);
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
  };

  return (
    <section
      className="GymfolioClasses  py-16 md:py-20 px-4 md:px-8 lg:px-20 relative overflow-hidden"
      aria-labelledby="GymfolioClasses-title"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
        {/* Left: Content */}
        <div className="GymfolioClasses-context flex flex-col gap-6">
          <header className="GymfolioClasses-header flex flex-col gap-4">
            <div className="GymfolioClasses-badge inline-flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-[#6c8704]" aria-hidden="true" />
              <span className="text-sm font-semibold text-[#85868b]">Our Classes</span>
            </div>
            <h2
              id="GymfolioClasses-title"
              className="text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-tight text-black/90"
            >
              {gymClass.name}
            </h2>
          </header>

          <p className="GymfolioClasses-description text-sm sm:text-base leading-6 text-[#4d4d51]">
            {gymClass.shortDescription || gymClass.description || "Discover this amazing class and transform your fitness journey."}
          </p>

          <ul className="GymfolioClasses-points space-y-4">
            {points.map((item, idx) => (
              <li key={idx} className="GymfolioClasses-point flex items-start gap-3">
                <span aria-hidden="true">
                  <CheckIcon />
                </span>
                <span className="text-base text-[#4d4d51]">{item}</span>
              </li>
            ))}
          </ul>

          {gymClass.videoUrl && (
            <div>
              <button
                onClick={handleVideoClick}
                className="GymfolioClasses-cta inline-flex items-center gap-2 rounded-lg bg-[#bee304] px-6 py-3 font-semibold text-black shadow-[4px_4px_12px_rgba(0,132,255,0.25)] transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                aria-label="Watch video class"
              >
                Watch Video Class
                <VideoClassButton />
              </button>
            </div>
          )}
        </div>

        {/* Right: Media */}
        <div className="GymfolioClasses-media relative h-[380px] sm:h-[460px] lg:h-[584px] w-full overflow-hidden rounded-lg bg-[#f3ecff]">
          {!showVideo ? (
            // Thumbnail view
            <>
              <Image
                src={gymClass.videoPoster || gymClass.thumbnail || "/images/hero.svg"}
                alt={`${gymClass.name} preview`}
                fill
                className="object-cover"
                priority={false}
              />
              {gymClass.videoUrl && (
                <button
                  onClick={handleVideoClick}
                  className="absolute inset-0 grid place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black transition-transform hover:scale-105"
                  aria-label="Play video"
                >
                  <PlayIcon />
                </button>
              )}
            </>
          ) : (
            // Video view
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                onEnded={handleVideoEnd}
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                controls={false}
              >
                {gymClass.videoUrl ? (
                  <source src={gymClass.videoUrl} type="video/mp4" />
                ) : (
                  <>
                    <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4" />
                    <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.webm" type="video/webm" />
                  </>
                )}
                Your browser does not support the video tag.
              </video>
              
              {/* Play/Pause overlay */}
              <button
                onClick={togglePlayPause}
                className="absolute inset-0 grid place-items-center bg-black/0 hover:bg-black/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label={isPlaying ? "Pause video" : "Play video"}
              >
                <span className="opacity-0 hover:opacity-100 transition-opacity">
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </span>
              </button>
              
              {/* Back to thumbnail button */}
              <button
                onClick={() => {
                  setShowVideo(false);
                  setIsPlaying(false);
                  if (videoRef.current) {
                    videoRef.current.pause();
                    videoRef.current.currentTime = 0;
                  }
                }}
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Close video"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default GymfolioClass;