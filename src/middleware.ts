import { NextRequest, NextResponse } from 'next/server';

// This file has to live beside `app` (so here, in src/). At the repository
// root Next.js does not pick it up when the app is under src/, and the guard
// below never ran.

// The platform panel (every gym, their plans) moved to its own app,
// GymPilot_frontendAdmin, together with the marketing site. Old links and
// bookmarks to /super-admin here are sent there so nothing that used to
// work stops working.
const PLATFORM_ADMIN_URL = (process.env.NEXT_PUBLIC_PLATFORM_ADMIN_URL || 'http://localhost:3001').replace(/\/+$/, '');

// Protect routes that require authentication
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Identify protected routes
  const isUserDetail = pathname === '/user-detail' || pathname.startsWith('/user-detail/');
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const isPlatform = pathname === '/super-admin' || pathname.startsWith('/super-admin/');
  if (!isUserDetail && !isAdmin && !isPlatform) return NextResponse.next();

  if (isPlatform) {
    return NextResponse.redirect(`${PLATFORM_ADMIN_URL}${pathname}${req.nextUrl.search}`);
  }

  // The member portal and the admin panel both need a session. That is all
  // that is decided here.
  //
  // The edge only has a cookie. It cannot know that a receptionist holds
  // Attendance but not Settings, and the role it could read from a second
  // cookie is the role the person had when they signed in: a member made
  // staff since then would be turned away from the panel their new role is
  // for, with nothing on screen to say why. So who may open what is decided
  // where the answer is actually known -- by the admin layout, which asks the
  // server what this account may open (and sends a plain member home), and by
  // the API, which re-checks the permission on every request.
  if (req.cookies.get('auth_token')?.value) return NextResponse.next();

  // Send the visitor back to where they were headed once they sign in. The
  // sign-in page also puts the cookie back for someone who is still signed in
  // but has lost it (see restoreSessionCookie in helper.ts).
  const url = req.nextUrl.clone();
  url.pathname = '/authentication';
  url.search = '';
  url.searchParams.set('redirect', pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

// Only the signed-in areas. The public site, /embed, /kiosk, the API routes
// and static files are never matched, so this cannot get in their way.
export const config = {
  matcher: ['/user-detail', '/user-detail/:path*', '/admin', '/admin/:path*', '/super-admin', '/super-admin/:path*'],
};
