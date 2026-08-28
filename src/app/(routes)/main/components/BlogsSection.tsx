"use client";
import React from "react";
import Link from "next/link";
import "@fortawesome/fontawesome-free/css/all.css";
import Image from "next/image";

const BlogsSection: React.FC = () => {
  return (
    <>
      <section
        id="blogs"
        className="section7-teampy-16 md:py-20 px-4 md:px-8 lg:px-20 relative overflow-hidden-member "
      >
        <div className="section7-context">
          <div className="section7-header">
            <div className="section7-badge">
              <div className="section7-icon"></div>
              <div className="section7-text">Fitness Tips</div>
            </div>
            <p className="section7-read-for-been-update">
              Stay Fit Stay Strong
            </p>
          </div>
        </div>

        <div className="section7-container">
          <div className="section7-content">
            {/* Card 1 */}
            <div className="section7-blog-post-card">
              <Link href="/blogs-detail" className="flex flex-col h-full">
                <div className="section7-content2">
                  <div className="section7-heading-and-subheading">
                    <div className="section7-heading-and-text">
                      <div className="section7-heading-and-icon">
                        <div className="section7-heading">
                          Top 10 Gym Wear Essentials
                        </div>
                        <div className="section7-icon-wrap">
                          <i className="fas fa-up-right-from-square section7-arrow-up-right"></i>
                        </div>
                      </div>
                      <div className="section7-supporting-text">
                        Discover the must-have workout clothing that combines
                        style, comfort, and performance for your fitness
                        journey.
                      </div>
                    </div>
                  </div>
                </div>
                <Image
                  className="section7-image"
                  src="/images/hero.svg"
                  alt="Gym wear essentials displayed"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              </Link>
            </div>

            {/* Card 2 */}
            <div className="section7-blog-post-card2">
              <Link href="/blogs-detail" className="flex flex-col h-full">
                <div className="section7-content2">
                  <div className="section7-heading-and-subheading">
                    <div className="section7-heading-and-text">
                      <div className="section7-heading-and-icon">
                        <div className="section7-heading">
                          Perfect Home Workout Setup
                        </div>
                        <div className="section7-icon-wrap">
                          <i className="fas fa-up-right-from-square section7-arrow-up-right"></i>
                        </div>
                      </div>
                      <div className="section7-supporting-text">
                        Transform your space into a functional fitness zone with
                        these expert tips and equipment recommendations.
                      </div>
                    </div>
                  </div>
                </div>
                <Image
                  className="section7-image2"
                  src="/images/gym-large.svg"
                  alt="Home gym setup with equipment"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              </Link>
            </div>

            {/* Card 3 */}
            <div className="section7-blog-post-card2">
              <Link href="/blogs-detail" className="flex flex-col h-full">
                <div className="section7-content2">
                  <div className="section7-heading-and-subheading">
                    <div className="section7-heading-and-text">
                      <div className="section7-heading-and-icon">
                        <div className="section7-heading">
                          Pre & Post Workout Nutrition
                        </div>
                        <div className="section7-icon-wrap">
                          <i className="fas fa-up-right-from-square section7-arrow-up-right"></i>
                        </div>
                      </div>
                      <div className="section7-supporting-text">
                        Maximize your workout results with proper nutrition
                        timing and meal planning strategies for optimal
                        performance.
                      </div>
                    </div>
                  </div>
                </div>
                <Image
                  className="section7-image2"
                  src="/images/hero.svg"
                  alt="Healthy nutrition foods for fitness"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default BlogsSection;