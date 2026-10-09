"use client";
import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { GymClass, gymClassService } from "../../main/services/gymClassService";
import { useSiteSettings } from "@/components/ThemeProvider";

interface GymClassDetailSectionProps {
  gymClass: GymClass;
}

const GymClassDetailSection: React.FC<GymClassDetailSectionProps> = ({ gymClass }) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  // The gym's own hours from Settings; the card is hidden until they are set.
  const { openingHours } = useSiteSettings();
  // The class's own video, when the gym uploaded one. Relative upload paths
  // live on the API host.
  const videoUrl = gymClassService.getAbsoluteImageUrl(gymClass.videoUrl);
  const posterUrl = gymClassService.getAbsoluteImageUrl(gymClass.videoPoster) || gymClass.thumbnail || undefined;

  const handleVideoToggle = () => {
    const video = document.getElementById('gymVideo') as HTMLVideoElement;
    if (video) {
      if (video.paused) {
        video.play();
        setIsVideoPlaying(true);
      } else {
        video.pause();
        setIsVideoPlaying(false);
      }
    }
  };

  const handleVideoEnded = () => {
    setIsVideoPlaying(false);
  };

  return (
    <div className="gymfolioclassdetail bg-gray-50">
      <style jsx>{`
        .montserrat-bold {
          font-family: "Montserrat", sans-serif;
          font-weight: 700;
        }
        .poppins-regular {
          font-family: "Poppins", sans-serif;
          font-weight: 400;
        }
        .poppins-medium {
          font-family: "Poppins", sans-serif;
          font-weight: 500;
        }
        .inter-regular {
          font-family: "Inter", sans-serif;
          font-weight: 400;
        }
        .video-bg {
          background: linear-gradient(to left, #f3ecff, #f3ecff);
        }
        .play-button {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(8px);
        }
        .info-card {
          background: #000000;
          backdrop-filter: blur(12px);
        }
        .check-icon {
          background: #3b3b3e;
        }
        .gym-green {
          color: #ff6b2c;
        }
        .gym-gray {
          color: #4d4d51;
        }
      `}</style>

      <section className="py-16 md:py-20 px-4 md:px-8 lg:px-20 relative ">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
          {/* Left Content Area */}
          <div className="lg:col-span-8 space-y-8 lg:space-y-16">
            {/* Video Section -- the class's own video only. With none, the
                class photo stands in; with neither, nothing is shown (this
                used to play a stock sample clip on every gym's site). */}
            {videoUrl ? (
            <div
              className="video-bg rounded-lg h-80 md:h-96 lg:h-[584px] flex items-center justify-center relative overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
              onClick={handleVideoToggle}
            >
              <video
                id="gymVideo"
                className="absolute inset-0 w-full h-full object-cover"
                poster={posterUrl}
                preload="metadata"
                muted
                playsInline
                onEnded={handleVideoEnded}
              >
                <source src={videoUrl} />
                Your browser does not support the video tag.
              </video>

              <button
                type="button"
                className="play-button w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center z-10 hover:bg-white transition-all duration-200 hover:scale-110 hover:shadow-lg"
                aria-label={isVideoPlaying ? "Pause video" : "Play video"}
              >
                {isVideoPlaying ? (
                  <i className="fas fa-pause text-black text-xl md:text-2xl"></i>
                ) : (
                  <i className="fas fa-play text-black text-xl md:text-2xl ml-1"></i>
                )}
              </button>
            </div>
            ) : gymClass.thumbnail ? (
              <div className="video-bg rounded-lg h-80 md:h-96 lg:h-[584px] relative overflow-hidden">
                <Image
                  src={gymClass.thumbnail}
                  alt={`${gymClass.name} class`}
                  fill
                  sizes="(min-width: 1024px) 66vw, 100vw"
                  className="object-cover"
                  unoptimized={/^https?:\/\//i.test(gymClass.thumbnail)}
                />
              </div>
            ) : null}

            {/* Class Info */}
            <article className="space-y-8 hover:bg-white hover:bg-opacity-30 p-6 rounded-lg transition-all duration-300">
              <header className="space-y-4">
                <h2 className="montserrat-bold text-2xl md:text-3xl lg:text-4xl leading-tight tracking-tight uppercase opacity-90 text-black hover:text-green-600 transition-colors duration-300">
                  {gymClass.name}
                </h2>
                <p className="poppins-regular text-sm leading-relaxed gym-gray">
                  {gymClass.description || gymClass.shortDescription || 'No description available for this class.'}
                </p>
              </header>

              {/* Features */}
              {gymClass.features && gymClass.features.length > 0 && (
                <div className="space-y-4">
                  <h3 className="montserrat-bold text-xl text-black">Features</h3>
                  <ul className="space-y-4" role="list">
                    {gymClass.features.map((feature, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-3 hover:bg-green-50 p-2 rounded transition-all duration-200 hover:shadow-sm"
                      >
                        <span className="check-icon w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 hover:scale-110 transition-transform duration-200">
                          <i className="fas fa-check gym-green text-xs"></i>
                        </span>
                        <span className="inter-regular text-base leading-6 gym-gray flex-1">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Requirements */}
              {gymClass.requirements && gymClass.requirements.length > 0 && (
                <div className="space-y-4">
                  <h3 className="montserrat-bold text-xl text-black">Requirements</h3>
                  <ul className="space-y-4" role="list">
                    {gymClass.requirements.map((requirement, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-3 hover:bg-green-50 p-2 rounded transition-all duration-200 hover:shadow-sm"
                      >
                        <span className="check-icon w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 hover:scale-110 transition-transform duration-200">
                          <i className="fas fa-check gym-green text-xs"></i>
                        </span>
                        <span className="inter-regular text-base leading-6 gym-gray flex-1">
                          {requirement}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Class Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {gymClass.duration && (
                  <div className="space-y-2">
                    <p className="poppins-medium text-xs text-[#85868b] uppercase">Duration</p>
                    <p className="montserrat-bold text-lg text-black">{gymClass.duration} min</p>
                  </div>
                )}
                {gymClass.difficulty && (
                  <div className="space-y-2">
                    <p className="poppins-medium text-xs text-[#85868b] uppercase">Difficulty</p>
                    <p className="montserrat-bold text-lg text-black">{gymClass.difficulty}</p>
                  </div>
                )}
                {gymClass.capacity && (
                  <div className="space-y-2">
                    <p className="poppins-medium text-xs text-[#85868b] uppercase">Capacity</p>
                    <p className="montserrat-bold text-lg text-black">{gymClass.capacity} people</p>
                  </div>
                )}
                {gymClass.price !== undefined && (
                  <div className="space-y-2">
                    <p className="poppins-medium text-xs text-[#85868b] uppercase">Price</p>
                    <p className="montserrat-bold text-lg text-black">
                      {gymClassService.formatPrice(gymClass.price, gymClass.currency)}
                    </p>
                  </div>
                )}
              </div>
            </article>
          </div>

          {/* Right Sidebar */}
          <aside
            className="lg:col-span-4 space-y-8 lg:space-y-16 lg:sticky lg:top-24 lg:self-start"
            role="complementary"
            aria-label="Gym information sidebar"
          >
            {/* Book Card -- the booking flow is the timetable, filtered to
                this class. Signing in happens there when needed. */}
            <section
              className="info-card rounded-3xl border border-white border-opacity-30 p-6 w-full"
              aria-labelledby="book-class-title"
            >
              <h3
                id="book-class-title"
                className="montserrat-bold text-2xl lg:text-3xl leading-tight tracking-tight gym-green mb-3"
              >
                Book this class
              </h3>
              <p className="poppins-regular text-sm leading-relaxed text-white/80 mb-5">
                Pick a session on the timetable and reserve your place.
              </p>
              <Link
                href={`/timetable?class=${gymClass._id}`}
                className="block w-full rounded-lg bg-white px-4 py-3 text-center text-sm font-bold text-black hover:bg-gray-100 transition-colors"
              >
                See sessions &amp; book
              </Link>
            </section>

            {/* Opening Hours Card -- the gym's hours from Settings. These were
                hardcoded, so every gym showed the same times. */}
            {openingHours.length > 0 && (
            <section
              className="info-card rounded-3xl border border-white border-opacity-30 p-6 w-full hover:border-opacity-50 hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:bg-opacity-95"
              aria-labelledby="opening-hours-title"
            >
              <header className="space-y-6">
                <h3
                  id="opening-hours-title"
                  className="montserrat-bold text-2xl lg:text-3xl leading-tight tracking-tight gym-green hover:text-green-400 transition-colors duration-300"
                >
                  Opening Hours
                </h3>
              </header>

              <dl className="space-y-1 mt-4">
                {openingHours.map((h) => (
                  <div
                    key={h.day}
                    className="flex items-center justify-between gap-4 p-3 rounded-lg hover:bg-white hover:bg-opacity-10 transition-all duration-200"
                  >
                    <dt className="poppins-medium text-sm leading-relaxed text-white">{h.day}</dt>
                    <dd className="poppins-medium text-sm leading-relaxed text-white">
                      {h.closed ? "Closed" : `${h.open} – ${h.close}`}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
            )}

            {/* No brochure card: there are no brochure files to link to, and
                three "#" links that did nothing were worse than none. */}

            {/* Additional Image -- from the class's own gallery, not a stock
                photo that every gym's site would share. */}
            {gymClass.gallery?.[0] && (
            <figure className="video-bg relative rounded-lg h-64 md:h-80 lg:h-[646px] flex items-center justify-center overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
              <Image
                src={gymClass.gallery[0]}
                alt={`${gymClass.name} class`}
                fill
                sizes="(min-width: 1024px) 33vw, 100vw"
                className="object-cover hover:scale-110 transition-transform duration-500"
                unoptimized={/^https?:\/\//i.test(gymClass.gallery[0])}
              />
            </figure>
            )}
          </aside>
        </div>

        {/* Class Schedule Table */}
        {gymClass.schedule && gymClass.schedule.length > 0 && (
          <section className="py-8 md:py-16">
            <div className="bg-black rounded-3xl border border-white border-opacity-20 p-6 md:p-12 lg:p-16 backdrop-blur-xl hover:border-opacity-40 transition-all duration-300">
              <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 items-start justify-center">
                {/* Day Column */}
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex flex-col gap-5 items-start justify-start w-full">
                    <header className="flex flex-col gap-5 items-start justify-start w-full">
                      <h3 className="montserrat-bold text-2xl lg:text-3xl leading-tight tracking-tight gym-green">
                        Day
                      </h3>
                    </header>

                    <div className="flex flex-col gap-6 items-start justify-start w-full">
                      {gymClass.schedule.map((schedule, index) => (
                        <div key={index} className="flex flex-col gap-4 items-start justify-start w-full">
                          <div className="poppins-medium text-sm leading-6 text-white w-full hover:text-green-100 transition-colors duration-200 cursor-pointer hover:bg-white hover:bg-opacity-5 p-2 rounded">
                            {schedule.day}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Time Column */}
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex flex-col gap-5 items-start justify-start w-full">
                    <header className="flex flex-col gap-5 items-start justify-start w-full">
                      <h3 className="montserrat-bold text-2xl lg:text-3xl leading-tight tracking-tight gym-green">
                        Time
                      </h3>
                    </header>

                    <div className="flex flex-col gap-6 items-start justify-start w-full">
                      {gymClass.schedule.map((schedule, index) => (
                        <div key={index} className="flex flex-col gap-4 items-start justify-start w-full">
                          <div className="poppins-medium text-sm leading-6 text-white w-full hover:text-green-100 transition-colors duration-200 cursor-pointer hover:bg-white hover:bg-opacity-5 p-2 rounded">
                            {schedule.startTime} to {schedule.endTime}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Instructor Column */}
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex flex-col gap-5 items-start justify-start w-full">
                    <header className="flex flex-col gap-5 items-start justify-start w-full">
                      <h3 className="montserrat-bold text-2xl lg:text-3xl leading-tight tracking-tight gym-green">
                        Instructor
                      </h3>
                    </header>

                    <div className="flex flex-col gap-6 items-start justify-start w-full">
                      {gymClass.schedule.map((schedule, index) => (
                        <div key={index} className="flex flex-col gap-4 items-start justify-start w-full">
                          <div className="poppins-medium text-sm leading-6 text-white w-full hover:text-green-100 transition-colors duration-200 cursor-pointer hover:bg-white hover:bg-opacity-5 p-2 rounded">
                            {schedule.instructorName || schedule.instructor || 'TBA'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </section>
    </div>
  );
};

export default GymClassDetailSection;