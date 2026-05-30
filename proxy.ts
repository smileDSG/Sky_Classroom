import { NextRequest, NextResponse } from 'next/server';

/** Verify a JWT access token using Web Crypto (Edge-compatible) */
async function verifyJwtToken(token: string): Promise<boolean> {
  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'change-me-in-production');
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Whitelist: auth pages, auth API endpoints, health check, static assets
  if (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/beta/') ||
    pathname.startsWith('/api/access-code/') ||
    pathname === '/api/health' ||
    pathname === '/auth/login' ||
    pathname === '/auth/register' ||
    pathname === '/auth/forgot-password' ||
    pathname === '/auth/reset-password' ||
    pathname === '/auth/verify-email' ||
    pathname === '/auth/beta-gate' ||
    pathname.startsWith('/temp/pptx/')
  ) {
    return NextResponse.next();
  }

  // Check JWT access token
  const accessToken = request.cookies.get('access_token');
  if (accessToken?.value) {
    const valid = await verifyJwtToken(accessToken.value);
    if (valid) {
      return NextResponse.next();
    }
  }

  // API requests without valid auth → 401
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, errorCode: 'AUTH_REQUIRED', error: 'Authentication required' },
      { status: 401 },
    );
  }

  // Page requests without valid auth → redirect to login
  const loginUrl = new URL('/auth/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logos/|avatars/).*)'],
};
