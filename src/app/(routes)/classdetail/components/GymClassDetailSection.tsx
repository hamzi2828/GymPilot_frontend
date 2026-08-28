"use client";
import React, { useState } from "react";
import { GymClass } from "../../main/services/gymClassService";

interface GymClassDetailSectionProps {
  gymClass: GymClass;
}

const GymClassDetailSection: React.FC<GymClassDetailSectionProps> = ({ gymClass }) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

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
          color: #bee304;
        }
        .gym-gray {
          color: #4d4d51;
        }
      `}</style>

      <section className="py-16 md:py-20 px-4 md:px-8 lg:px-20 relative ">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
          {/* Left Content Area */}
          <main className="lg:col-span-8 space-y-8 lg:space-y-16">
            {/* Video Section */}
            <div
              className="video-bg rounded-lg h-80 md:h-96 lg:h-[584px] flex items-center justify-center relative overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
              onClick={handleVideoToggle}
            >
              <video
                id="gymVideo"
                className="absolute inset-0 w-full h-full object-cover"
                poster={gymClass.thumbnail || "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"}
                preload="metadata"
                muted
                onEnded={handleVideoEnded}
              >
                <source
                  src="https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4"
                  type="video/mp4"
                />
                Your browser does not support the video tag.
              </video>

              <button
                className="play-button w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center z-10 hover:bg-white transition-all duration-200 hover:scale-110 hover:shadow-lg"
                aria-label="Play video"
              >
                {isVideoPlaying ? (
                  <i className="fas fa-pause text-black text-xl md:text-2xl"></i>
                ) : (
                  <i className="fas fa-play text-black text-xl md:text-2xl ml-1"></i>
                )}
              </button>
            </div>

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
                      {gymClass.price === 0 ? 'Free' : `PKR ${gymClass.price}`}
                    </p>
                  </div>
                )}
              </div>
            </article>
          </main>

          {/* Right Sidebar */}
          <aside
            className="lg:col-span-4 space-y-8 lg:space-y-16 lg:sticky lg:top-24 lg:self-start"
            role="complementary"
            aria-label="Gym information sidebar"
          >
            {/* Opening Hours Card */}
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

              <dl className="space-y-4">
                <div className="flex items-center justify-between hover:bg-white hover:bg-opacity-10 p-3 rounded-lg transition-all duration-200 cursor-pointer">
                  <dt className="poppins-medium text-sm leading-relaxed text-white">
                    Monday - Friday
                  </dt>
                  <i
                    className="fas fa-arrow-right text-white text-sm hover:translate-x-1 transition-transform duration-200"
                    aria-hidden="true"
                  ></i>
                  <dd className="poppins-medium text-sm leading-relaxed text-white">
                    7:00 am to 10:00 pm
                  </dd>
                </div>

                <hr className="border-white border-opacity-20" />

                <div className="flex items-center justify-between hover:bg-white hover:bg-opacity-10 p-3 rounded-lg transition-all duration-200 cursor-pointer">
                  <dt className="poppins-medium text-sm leading-relaxed text-white">
                    Saturday - Sunday
                  </dt>
                  <i
                    className="fas fa-arrow-right text-white text-sm hover:translate-x-1 transition-transform duration-200"
                    aria-hidden="true"
                  ></i>
                  <dd className="poppins-medium text-sm leading-relaxed text-white">
                    8:00 am to 9:00 pm
                  </dd>
                </div>
              </dl>
            </section>

            {/* Download Brochure Card */}
            <section
              className="info-card rounded-3xl border border-white border-opacity-30 p-6 w-full hover:border-opacity-50 hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:bg-opacity-95"
              aria-labelledby="brochure-title"
            >
              <header className="space-y-6">
                <h3
                  id="brochure-title"
                  className="montserrat-bold text-2xl lg:text-3xl leading-tight tracking-tight gym-green hover:text-green-400 transition-colors duration-300"
                >
                  Download Brochure
                </h3>
              </header>

              <nav aria-label="Brochure downloads">
                <ul className="space-y-4" role="list">
                  {[
                    { label: "Brochure PDF version", href: "#" },
                    { label: "Membership Guide PDF", href: "#" },
                    { label: "Class Schedule PDF", href: "#" }
                  ].map((item, index) => (
                    <React.Fragment key={index}>
                      <li>
                        <a
                          href={item.href}
                          className="flex items-center gap-4 cursor-pointer hover:bg-white hover:bg-opacity-10 p-3 rounded-lg transition-all duration-200 transform hover:translate-x-2 hover:shadow-md"
                          aria-label={`Download ${item.label.toLowerCase()}`}
                        >
                          <i
                            className="fas fa-folder text-white text-base flex-shrink-0 hover:text-green-400 transition-colors duration-200"
                            aria-hidden="true"
                          ></i>
                          <span className="poppins-medium text-sm leading-relaxed text-white flex-1 hover:text-green-100 transition-colors duration-200">
                            {item.label}
                          </span>
                        </a>
                      </li>
                      {index < 2 && <li><hr className="border-white border-opacity-20" /></li>}
                    </React.Fragment>
                  ))}
                </ul>
              </nav>
            </section>

            {/* Additional Image */}
            <figure className="video-bg rounded-lg h-64 md:h-80 lg:h-[646px] flex items-center justify-center overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
              <img
                src="https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                alt="Modern gym equipment and training area with professional weights and exercise machines"
                className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
              />
            </figure>
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