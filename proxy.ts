import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/server/auth/jwt';

/** Routes that don't require authentication */
const PUBLIC_PATHS = [
  '/',
  '/auth',
  '/m/auth',
  '/api/auth',
  '/api/access-code/status',
  '/api/server-providers',
  '/api/sky/enrichment',
  '/sky/software-cup',
  '/sky/pet-buddy', // TEMP-DIAG: playwright headless debug
  '/sky/cloud-mind/course-studio',
  '/sky/study-lab',
  '/api/sky/cloud-mind/personalization-context',
  '/api/sky/workshop',
  '/api/sky/learning-path',
  '/api/sky/content-safety',
  '/api/sky/course-knowledge',
  '/api/sky/learning-effect',
  '/api/sky/resource-generation',
  '/api/sky/student/profile/conversation',
];

/** Static asset prefixes to always skip */
const STATIC_PREFIXES = [
  '/_next',
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
  '/logos/',
  '/avatars/',
  '/live2d/',
  '/vendor/',
  '/logo-icon.svg',
  '/logo-horizontal.png',
  '/logo-app-icon.png',
  '/sky-observatory.jpg',
  '/temp/',
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

function getLoginPath(): string {
  return '/';
}

function isPublicReadRequest(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  return request.method === 'GET' && pathname === '/api/classroom';
}

function normalizeMobileRedirectPath(pathname: string): string {
  return pathname === '/m/sky/learning' ? '/m/sky/study-lab' : pathname;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public routes and static assets
  if (isPublicPath(pathname) || isPublicReadRequest(request)) {
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
  const redirectPathname = normalizeMobileRedirectPath(pathname);
  const loginUrl = new URL(getLoginPath(), request.url);
  const { search } = request.nextUrl;
  loginUrl.searchParams.set('redirect', search ? `${redirectPathname}${search}` : redirectPathname);
  loginUrl.searchParams.set('reason', 'login_required');
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|logos/|avatars/|live2d/|logo-icon\\.svg|logo-horizontal\\.png|logo-app-icon\\.png|sky-observatory\\.jpg).*)',
  ],
};
