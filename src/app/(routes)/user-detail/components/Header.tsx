"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";

export interface HeaderProps {
  userProfile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    profileImage: string;
  };
}

const API_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/+$/, "");

// Photos kept on the API's own disk come back as "/uploads/...", a path on the
// API host rather than on this website, so they are resolved against it --
// the same way blog and trainer images are.
function resolveAvatar(src: string): string {
  return src.startsWith("/uploads/") ? `${API_BASE}${src}` : src;
}

export const Header: React.FC<HeaderProps> = ({ userProfile }) => {
  const initial = (userProfile.firstName?.[0] || userProfile.email?.[0] || "?").toUpperCase();
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imageSrc = useMemo(() => resolveAvatar(userProfile.profileImage?.trim() || ""), [userProfile.profileImage]);
  const hasValidImage = useMemo(() => {
    if (!imageSrc) return false;
    const lowered = imageSrc.toLowerCase();
    if (lowered === "null" || lowered === "undefined") return false;
    // Accept only http(s), data URLs, or root-relative paths
    const isHttp = /^https?:\/\//i.test(imageSrc);
    const isData = /^data:image\//i.test(imageSrc);
    const isLocal = imageSrc.startsWith("/");
    if (!(isHttp || isData || isLocal)) return false;
    return !imgError;
  }, [imageSrc, imgError]);
  const showImage = hasValidImage && imgLoaded && !imgError;
  return (
    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8">
      <div className="flex items-start gap-5 w-full">
        <div className="relative shrink-0">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-4 border-primary relative">
            {/* Fallback shown until image loads successfully */}
            {!showImage && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-200 text-gray-700 text-3xl font-bold">
                {initial}
              </div>
            )}
            {hasValidImage && (
              <Image
                src={imageSrc}
                alt=""
                width={96}
                height={96}
                className={`w-full h-full object-cover ${showImage ? "block" : "hidden"}`}
                unoptimized
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
              />
            )}
          </div>
        </div>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black">
            {userProfile.firstName} {userProfile.lastName}
          </h1>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-gray-600">
            <span className="flex items-center">
              <i className="fas fa-envelope mr-2" />
              {userProfile.email}
            </span>
            {userProfile.phone && (
              <>
                <span className="hidden sm:block w-1 h-1 bg-gray-300 rounded-full" />
                <span className="flex items-center">
                  <i className="fas fa-phone mr-2" />
                  {userProfile.phone}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
