import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Paths that require authentication
  const protectedPaths = ['/dashboard', '/upload', '/collections', '/create-stream', '/profile', '/settings', '/room'];
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  // Paths that are only for public (auth)
  const isAuthPath = pathname === '/auth';

  // Check for auth cookie (we will update AuthProvider to set this)
  const authCookie = request.cookies.get('cowatch_auth');

  if (isProtectedPath && !authCookie) {
    // Redirect to login if trying to access protected path without auth
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  if (isAuthPath && authCookie) {
    // Redirect to dashboard if trying to access auth page while logged in
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
