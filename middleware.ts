import { NextRequest, NextResponse } from 'next/server';

// Protect routes that require authentication
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Identify protected routes
  const isUserDetail = pathname === '/user-detail' || pathname.startsWith('/user-detail/');
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  if (!isUserDetail && !isAdmin) return NextResponse.next();

  const token = req.cookies.get('auth_token')?.value;
  const role = req.cookies.get('auth_role')?.value;

  // User-detail requires authentication only
  if (isUserDetail) {
    if (token) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = '/authentication';
    return NextResponse.redirect(url);
  }

  // Admin requires authentication + admin role
  if (isAdmin) {
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = '/authentication';
      return NextResponse.redirect(url);
    }
    if (role !== 'admin') {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/user-detail', '/user-detail/:path*', '/admin', '/admin/:path*'],
};
