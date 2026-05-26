import { NextRequest, NextResponse } from 'next/server';

/** Convert string to Uint8Array */
function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/** Convert ArrayBuffer to hex string */
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Verify an HMAC-signed token using Web Crypto API (Edge-compatible) */
async function verifyToken(token: string, secret: string): Promise<boolean> {
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return false;

  const timestamp = token.substring(0, dotIndex);
  const signature = token.substring(dotIndex + 1);

  const keyData = encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const data = encode(timestamp);
  const expected = bufToHex(await crypto.subtle.sign('HMAC', key, data.buffer as ArrayBuffer));

  if (signature.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

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

function isBetaMode(): boolean {
  const betaMode = process.env.BETA_MODE;
  if (!betaMode) return false;
  return betaMode !== 'false' && betaMode !== '0';
}

export async function middleware(request: NextRequest) {
  const accessCode = process.env.ACCESS_CODE;
  const { pathname } = request.nextUrl;

  // Whitelist: auth endpoints, access-code, health check, beta public routes
  if (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/access-code/') ||
    pathname === '/api/health' ||
    pathname === '/auth/login' ||
    pathname === '/auth/register' ||
    pathname === '/auth/beta-gate' ||
    pathname === '/api/beta/invite' ||
    pathname === '/api/beta/request'
  ) {
    return NextResponse.next();
  }

  // If no ACCESS_CODE is set, allow all requests through (open mode)
  if (!accessCode) {
    return NextResponse.next();
  }

  // Check JWT access token first (for authenticated users)
  const accessToken = request.cookies.get('access_token');
  if (accessToken?.value) {
    const valid = await verifyJwtToken(accessToken.value);
    if (valid) {
      return NextResponse.next();
    }
  }

  // Fall back to access-code cookie check
  const cookie = request.cookies.get('openmaic_access');
  if (cookie?.value && (await verifyToken(cookie.value, accessCode))) {
    return NextResponse.next();
  }

  // Beta mode: check beta_access cookie
  if (isBetaMode()) {
    const betaCookie = request.cookies.get('beta_access');
    if (betaCookie?.value && (await verifyToken(betaCookie.value, accessCode))) {
      return NextResponse.next();
    }

    // API requests without valid auth → 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, errorCode: 'BETA_ACCESS_REQUIRED', error: 'Beta access required' },
        { status: 403 },
      );
    }

    // Page requests without valid auth → redirect to beta gate
    const gateUrl = new URL('/auth/beta-gate', request.url);
    if (pathname !== '/auth/beta-gate') {
      gateUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(gateUrl);
    }
  }

  // Non-beta mode: API requests without valid auth → 401
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, errorCode: 'INVALID_REQUEST', error: 'Authentication required' },
      { status: 401 },
    );
  }

  // Page requests → let through, frontend shows modal
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logos/).*)'],
};
