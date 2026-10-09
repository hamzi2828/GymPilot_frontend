"use client";

import React from "react";
import { useSiteSettings } from "@/components/ThemeProvider";

// The panel beside the sign-in form. It carries the gym's own name and one
// line that is true of any account; it used to print member counts and
// services that no gym had supplied.
export const RightSide: React.FC = () => {
  const { siteName } = useSiteSettings();

  return (
    <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
    {/* Animated background gradient */}
    <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-800 animate-pulse"></div>

    {/* Geometric pattern overlay */}
    <div className="absolute inset-0 opacity-10">
      <div
        className="h-full w-full"
        style={{
          backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="%23ff6b2c" stroke-width="1"/></pattern></defs><rect width="200" height="200" fill="url(%23grid)"/></svg>')`,
        }}
      ></div>
    </div>

    {/* Floating geometric shapes */}
    <div className="absolute inset-0">
      <div className="absolute top-20 left-20 w-32 h-32 auth-blob-strong rounded-full opacity-20 animate-bounce" style={{ animationDelay: "0s", animationDuration: "3s" }}></div>
      <div className="absolute top-40 right-32 w-24 h-24 auth-blob-strong rounded-lg opacity-15 animate-pulse" style={{ animationDelay: "1s", animationDuration: "4s" }}></div>
      <div className="absolute bottom-32 left-32 w-40 h-40 auth-blob-soft rounded-full opacity-10 animate-ping" style={{ animationDelay: "2s", animationDuration: "5s" }}></div>
      <div className="absolute bottom-20 right-20 w-28 h-28 auth-blob-soft transform rotate-45 opacity-20 animate-spin" style={{ animationDuration: "20s" }}></div>
    </div>

    {/* Main content */}
    <div className="relative z-20 h-full flex flex-col justify-center items-center text-white p-12">
      <div className="text-center max-w-lg">
        <div className="mb-8">
          <div className="auth-accent-gradient w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>

        <h2 className="text-5xl font-black mb-8 text-white font-sans leading-tight">
          Welcome
          {siteName && <span className="block auth-accent-bright">to {siteName}</span>}
        </h2>

        <p className="text-xl text-gray-300 font-medium leading-relaxed">
          Sign in to your account, or create one to get started.
        </p>
      </div>
    </div>

    {/* Bottom accent */}
    <div className="absolute bottom-0 left-0 right-0 h-2 auth-bottom-bar"></div>
  </div>
  );
};

export default RightSide;
