import { NextRequest, NextResponse } from 'next/server';

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

  const token = req.cookies.get('auth_token')?.value;
  const role = req.cookies.get('auth_role')?.value;

  // Send the visitor back to where they were headed once they sign in.
  const signInUrl = () => {
    const url = req.nextUrl.clone();
    url.pathname = '/authentication';
    url.search = '';
    url.searchParams.set('redirect', pathname + req.nextUrl.search);
    return url;
  };

  // User-detail requires authentication only
  if (isUserDetail) {
    if (token) return NextResponse.next();
    return NextResponse.redirect(signInUrl());
  }

  // Admin needs authentication, and a role that is not an ordinary gym member.
  //
  // This is deliberately coarse. The edge only has a cookie: it cannot know
  // that a receptionist holds Attendance but not Settings, and hardcoding
  // 'admin' here is exactly what would keep every staff role out of the panel
  // their role was created to let them into. So this turns away the obvious
  // case (a member who found the URL) and the real decision is made twice
  // where the answer is actually known -- by the admin layout, which asks the
  // server what this account may open, and by the API, which re-checks the
  // permission on every request.
  if (isAdmin) {
    if (!token) {
      return NextResponse.redirect(signInUrl());
    }
    if (!role || role === 'user') {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/user-detail', '/user-detail/:path*', '/admin', '/admin/:path*', '/super-admin', '/super-admin/:path*'],
};
