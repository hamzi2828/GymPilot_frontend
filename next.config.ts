import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'other-levels.com',
      },
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
      },
    ],
    // Disable image optimization in development for faster builds
    unoptimized: process.env.NODE_ENV !== 'production',
  },
  compiler: {
    // This helps ensure styles are consistent
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;
