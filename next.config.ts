import type { NextConfig } from "next";

// The platform panel (every gym, their plans) lives in its own app,
// GymPilot_frontendAdmin, together with the marketing site. Old /super-admin
// links on a gym's website are sent there.
const PLATFORM_ADMIN_URL = (process.env.NEXT_PUBLIC_PLATFORM_ADMIN_URL || 'http://localhost:3001').replace(/\/+$/, '');

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  output: 'standalone',
  async redirects() {
    return [
      { source: '/super-admin', destination: `${PLATFORM_ADMIN_URL}/super-admin`, permanent: false },
      { source: '/super-admin/:path*', destination: `${PLATFORM_ADMIN_URL}/super-admin/:path*`, permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
      },
      {
        // Vercel Blob storage — where uploaded logos and bank barcodes land.
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
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
