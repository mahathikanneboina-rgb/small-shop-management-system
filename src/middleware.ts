import { NextResponse, NextRequest } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';

// List of public routes that do not require authentication
const PUBLIC_ROUTES = ['/login', '/register', '/api/auth'];

const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const firebaseJwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

async function hasValidFirebaseSession(token: string | undefined) {
  if (!token || !firebaseProjectId) return false;
  try {
    await jwtVerify(token, firebaseJwks, {
      algorithms: ['RS256'],
      issuer: `https://securetoken.google.com/${firebaseProjectId}`,
      audience: firebaseProjectId,
    });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Verify the Firebase ID token rather than trusting an arbitrary cookie value.
  const isAuthenticated = await hasValidFirebaseSession(request.cookies.get('auth')?.value);
  if (!isAuthenticated) {
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
