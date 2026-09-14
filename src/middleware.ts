import { NextResponse, NextRequest } from 'next/server';

// List of public routes that do not require authentication
const PUBLIC_ROUTES = ['/login', '/register', '/api/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Simple auth check: look for a cookie named 'auth'
  const authCookie = request.cookies.get('auth');
  if (!authCookie) {
    // Redirect unauthenticated users to the login page
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated, allow request to continue
  return NextResponse.next();
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
