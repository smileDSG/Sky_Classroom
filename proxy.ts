import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/server/auth/jwt';

/** Routes that don't require authentication */
const PUBLIC_PATHS = ['/', '/auth', '/api/auth', '/api/sky/solve/clear', '/api/sky/enrichment'];

/** Static asset prefixes to always skip */
const STATIC_PREFIXES = [
  '/_next',
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
  '/logos/',
  '/avatars/',
  '/logo-icon.svg',
  '/logo-horizontal.png',
];

function isPublicPath(pathname: string): boolean {
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p) || pathname === p)) {
    return true;
  }
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public routes and static assets
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check access token
  const accessToken = request.cookies.get('access_token')?.value;

  if (!accessToken) {
    if (isApiRoute(pathname)) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return redirectToLogin(request, pathname);
  }

  const payload = await verifyAccessToken(accessToken);
  if (!payload) {
    if (isApiRoute(pathname)) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    return redirectToLogin(request, pathname);
  }

  return NextResponse.next();
}

/**
 * Redirect to the login page, preserving the original path + query string
 * so the user returns to exactly where they were after authenticating.
 */
function redirectToLogin(request: NextRequest, pathname: string): NextResponse {
  const loginUrl = new URL('/auth/login', request.url);
  const { search } = request.nextUrl;
  loginUrl.searchParams.set('redirect', search ? `${pathname}${search}` : pathname);
  loginUrl.searchParams.set('reason', 'login_required');
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|logos/|avatars/|logo-icon\\.svg|logo-horizontal\\.png).*)',
  ],
};
