import type { NextConfig } from "next";

// The platform panel (every gym, their plans) lives in its own app,
// GymPilot_marketing, together with the marketing site. Old /super-admin
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

// ---------------------------------------------------------------------------
// Content-Security-Policy
//
// The session token lives in localStorage (the API is on its own domain, so
// an HttpOnly cookie would be a third-party one, which browsers block). Any
// script that runs on these pages can read it; this policy narrows what can
// run and where anything it reads could be sent.
//
//   script-src  'self' plus 'unsafe-inline'. Next.js writes inline scripts
//               into every page (the RSC payload, bootstrapping). The only
//               way to avoid 'unsafe-inline' is a per-request nonce from
//               middleware, which makes every page dynamic -- the public site
//               relies on static rendering and caching. So: no scripts from
//               any other host, and inline allowed. No third-party scripts
//               are loaded (checkout is a redirect to Stripe, Google sign-in
//               is a server redirect). 'unsafe-eval' only under `next dev`.
//   connect-src 'self', the API, and Vercel Blob (direct uploads PUT there).
//               This is the main exfiltration channel an injected script
//               would use (fetch/XHR/beacon/WebSocket).
//   img-src / media-src  any https host: admins paste image and video URLs
//               from anywhere (homepage builder, blog posts, social preview).
//   frame-src   the Google Maps embed and YouTube/Vimeo players gyms add.
//   style-src / font-src  Google Fonts and the Font Awesome sheet on cdnjs
//               that globals.css imports; inline styles are everywhere.
//   object-src 'none', base-uri 'self', form-action 'self'.
// Preview deployments also get Vercel's toolbar (vercel.live).
// ---------------------------------------------------------------------------
function originOf(value: string | undefined): string {
  try {
    return new URL(value || '').origin;
  } catch {
    return '';
  }
}

const IS_DEV = process.env.NODE_ENV !== 'production';
const IS_PREVIEW = process.env.VERCEL_ENV === 'preview';
// Several API clients fall back to localhost:4000 when the variable is unset.
const API_ORIGIN = originOf(process.env.NEXT_PUBLIC_BACKEND_URL) || (IS_DEV ? 'http://localhost:4000' : '');

function contentSecurityPolicy({ framed }: { framed: boolean }): string {
  const vercelLive = IS_PREVIEW ? ['https://vercel.live'] : [];
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(IS_DEV ? ["'unsafe-eval'"] : []), ...vercelLive],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com', ...vercelLive],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', ...(IS_PREVIEW ? ['https://vercel.live', 'https://assets.vercel.com'] : [])],
    'img-src': ["'self'", 'data:', 'blob:', 'https:', ...(API_ORIGIN.startsWith('http:') ? [API_ORIGIN] : [])],
    'media-src': ["'self'", 'blob:', 'https:', ...(API_ORIGIN.startsWith('http:') ? [API_ORIGIN] : [])],
    'connect-src': [
      "'self'",
      ...(API_ORIGIN ? [API_ORIGIN] : []),
      'https://blob.vercel-storage.com',
      'https://*.public.blob.vercel-storage.com',
      ...(IS_PREVIEW ? ['https://vercel.live', 'wss://ws-us3.pusher.com'] : []),
    ],
    'frame-src': ["'self'", 'https://www.google.com', 'https://maps.google.com', 'https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://player.vimeo.com', ...vercelLive],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    // Only /embed may be put in a frame, by any site (see headers() below).
    ...(framed ? {} : { 'frame-ancestors': ["'none'"] }),
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
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
          { key: 'Content-Security-Policy', value: contentSecurityPolicy({ framed: false }) },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      // The embeds: the same policy, without frame-ancestors.
      { source: '/embed', headers: [{ key: 'Content-Security-Policy', value: contentSecurityPolicy({ framed: true }) }] },
      { source: '/embed/:path*', headers: [{ key: 'Content-Security-Policy', value: contentSecurityPolicy({ framed: true }) }] },
    ];
  },
  async redirects() {
    return [
      { source: '/super-admin', destination: `${PLATFORM_ADMIN_URL}/super-admin`, permanent: false },
      { source: '/super-admin/:path*', destination: `${PLATFORM_ADMIN_URL}/super-admin/:path*`, permanent: false },
      // There is no timetable page any more: a visitor picks a class and books
      // from its own page. Old links (emails, bookmarks) land there instead.
      // /embed/timetable, the iframe widget, is a different path and stays.
      {
        source: '/timetable',
        has: [{ type: 'query', key: 'class', value: '(?<cls>[a-fA-F0-9]{24})' }],
        destination: '/classdetail?id=:cls',
        permanent: true,
      },
      { source: '/timetable', destination: '/classes', permanent: true },
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
