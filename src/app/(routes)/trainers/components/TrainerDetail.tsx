"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Trainer, trainerService } from "../../main/services/trainerService";

interface TrainerDetailProps {
  trainer: Trainer | null;
}

const TrainerDetail: React.FC<TrainerDetailProps> = ({ trainer }) => {
  const badgeText = "Meet Our Trainers";
  const heading = "The Best Fitness Gym in Town";

  // If no trainer is selected, show a placeholder message
  if (!trainer) {
    return (
      <div className="trainer-detail-about-us p-6 sm:p-10 lg:p-20 flex flex-col items-center justify-center">
        <div className="text-center py-20">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-lime-600"></div>
            <span className="text-gray-400 text-sm font-semibold">Meet Our Trainers</span>
          </div>
          <h2 className="text-2xl font-bold text-black/90 mb-4">Select a Trainer</h2>
          <p className="text-gray-600">Click on any trainer below to view their details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="trainer-detail-about-us p-6 sm:p-10 lg:p-20 flex flex-col lg:flex-row gap-8 lg:gap-16 items-center justify-start">
      <div className="trainer-detail-frame-left flex flex-col gap-8 lg:gap-16 items-start justify-center flex-1 w-full">
        {/* Header Section */}
        <div className="trainer-detail-header flex flex-col gap-4 items-center justify-center w-full">
          {/* Badge */}
          <div className="trainer-detail-badge rounded-full border border-transparent px-2 py-1 flex flex-row gap-2 items-center justify-center">
            <div className="trainer-detail-icon w-2 h-2 bg-lime-600 rounded-full flex-shrink-0"></div>
            <div className="trainer-detail-badge-text text-gray-400 text-center font-semibold text-sm leading-5">
              {badgeText}
            </div>
          </div>

          {/* Main Heading */}
          <h1 className="trainer-detail-heading text-black text-center font-bold text-xl sm:text-2xl lg:text-3xl leading-snug tracking-tight uppercase opacity-92 w-full flex items-center justify-center">
            {heading}
          </h1>
        </div>

        {/* Main Content Row */}
        <div className="trainer-detail-frame-content flex flex-col lg:flex-row gap-8 lg:gap-16 items-center justify-start w-full">
          {/* Team Card */}
          <div className="trainer-detail-team-card bg-gray-50 rounded-lg border border-gray-200 flex flex-col w-full sm:w-[400px] lg:w-[600px] h-[400px] sm:h-[500px] lg:h-[600px] overflow-hidden flex-shrink-0">
            <div className="trainer-detail-card-bg flex-1 relative">
              <Image
                src={trainer.image || '/images/trainer-1.svg'}
                alt={trainer.name}
                fill
                className="object-cover"
              />
            </div>

            <div className="trainer-detail-context p-4 flex flex-col gap-4 items-center justify-center">
              <div className="trainer-detail-names flex flex-col items-center justify-center">
                <div className="trainer-detail-user-name text-lime-700 text-center font-bold text-base leading-6">
                  {trainer.name}
                </div>
                <div className="trainer-detail-role text-gray-700 text-center font-normal text-sm leading-6">
                  {trainer.role}
                </div>
              </div>

              {/* Social Media */}
              <div className="trainer-detail-social-media flex justify-center gap-3">
                {trainer.social?.twitter && (
                  <Link
                    href={trainerService.formatSocialUrl(trainer.social.twitter, 'twitter')}
                    className="gymfolio7-social-icon hover:scale-110 focus:scale-110 focus:outline-none"
                    aria-label={`Follow ${trainer.name} on Twitter`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i className="fab fa-x-twitter text-lg"></i>
                  </Link>
                )}
                {trainer.social?.instagram && (
                  <Link
                    href={trainerService.formatSocialUrl(trainer.social.instagram, 'instagram')}
                    className="gymfolio7-social-icon hover:scale-110 focus:scale-110 focus:outline-none"
                    aria-label={`Follow ${trainer.name} on Instagram`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i className="fab fa-instagram text-lg"></i>
                  </Link>
                )}
                {trainer.social?.facebook && (
                  <Link
                    href={trainerService.formatSocialUrl(trainer.social.facebook, 'facebook')}
                    className="gymfolio7-social-icon hover:scale-110 focus:scale-110 focus:outline-none"
                    aria-label={`Follow ${trainer.name} on Facebook`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i className="fab fa-facebook text-lg"></i>
                  </Link>
                )}
                {trainer.social?.youtube && (
                  <Link
                    href={trainerService.formatSocialUrl(trainer.social.youtube, 'youtube')}
                    className="gymfolio7-social-icon hover:scale-110 focus:scale-110 focus:outline-none"
                    aria-label={`Follow ${trainer.name} on YouTube`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i className="fab fa-youtube text-lg"></i>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Right Content */}
          <div className="trainer-detail-context2 flex flex-col gap-6 lg:gap-8 items-start justify-start flex-1 w-full">
            {/* Biography */}
            {trainer.bio && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Biography</h2>
                <p className="text-gray-600">{trainer.bio}</p>
              </div>
            )}

            {/* Specialties */}
            {trainer.specialties && trainer.specialties.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Specialties</h2>
                <ul className="list-disc pl-5 text-gray-600">
                  {trainer.specialties.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Certifications */}
            {trainer.certifications && trainer.certifications.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Certifications</h2>
                <ul className="list-disc pl-5 text-gray-600">
                  {trainer.certifications.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Experience */}
            {trainer.experience && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Experience</h2>
                <p className="text-gray-600">{trainer.experience} years of professional training</p>
              </div>
            )}

            {/* Contact Info */}
            <div>
              <h2 className="text-lg font-semibold mb-2">Contact Info</h2>
              {trainer.email && <p className="text-gray-600">📧 {trainer.email}</p>}
              {trainer.phone && <p className="text-gray-600">📞 {trainer.phone}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainerDetail;
