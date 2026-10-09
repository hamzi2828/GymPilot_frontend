import type { NextConfig } from "next";

// The platform panel (every gym, their plans) lives in its own app,
// GymPilot_frontendAdmin, together with the marketing site. Old /super-admin
// links on a gym's website are sent there.
const PLATFORM_ADMIN_URL = (process.env.NEXT_PUBLIC_PLATFORM_ADMIN_URL || 'http://localhost:3001').replace(/\/+$/, '');

type RemotePattern = NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>[number];

// Uploads kept on the API's own disk are served from /uploads on the API host,
// so that host has to be allowed for images too. Worked out from the backend
// URL at build time rather than hardcoded, since every deployment has its own.
function backendImagePattern(): RemotePattern[] {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_BACKEND_URL || '');
    const protocol = url.protocol.replace(':', '');
    if (protocol !== 'http' && protocol !== 'https') return [];
    return [{ protocol, hostname: url.hostname, ...(url.port ? { port: url.port } : {}) }];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  output: 'standalone',
  env: {
    // Always defined, so client code comparing it to 'true' becomes a constant
    // at build time and the demo-login credentials are left out of production
    // bundles (see DemoAccounts.tsx). Off unless explicitly turned on.
    NEXT_PUBLIC_SHOW_DEMO_LOGINS: process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS === 'true' ? 'true' : 'false',
  },
  // A gym's admin panel, member portal and front-desk kiosk all live here, so
  // no other site may put any of it in a frame: a click on what looks like
  // their own page would otherwise land on a button in here. `frame-ancestors`
  // is what modern browsers honour; X-Frame-Options covers the older ones.
  //
  // The one exception is /embed/*, the timetable a gym puts in an <iframe> on
  // its own website: being framed is all it is for. It has no value of
  // X-Frame-Options that means "anyone", so the two framing headers are left
  // off those paths rather than overridden, and every other path keeps them.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // Everything except /embed and /embed/... ("/embedded" is not exempt).
        source: '/((?!embed(?:/|$)).*)',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
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
        // Vercel Blob storage — where uploaded logos and bank barcodes land.
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
      },
      ...backendImagePattern(),
      {
        protocol: 'http',
        hostname: 'localhost',
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
