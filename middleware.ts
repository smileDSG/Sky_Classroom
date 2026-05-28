import { NextRequest, NextResponse } from 'next/server';

function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyBetaToken(token: string, accessCode: string): Promise<boolean> {
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return false;

  const timestamp = token.substring(0, dotIndex);
  const signature = token.substring(dotIndex + 1);

  const keyData = encode(accessCode);
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 永远放行的路径
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/beta/invite') ||
    pathname === '/beta/gate' ||
    pathname === '/api/health' ||
    pathname.startsWith('/logos/') ||
    pathname.startsWith('/avatars/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 没有设置 BETA_MODE 时，不启用门禁
  if (process.env.BETA_MODE !== 'true') {
    return NextResponse.next();
  }

  // 检查 beta_access cookie
  const betaCookie = request.cookies.get('beta_access');
  if (betaCookie?.value) {
    const accessCode = process.env.ACCESS_CODE || process.env.JWT_SECRET || 'beta-default-secret';
    const valid = await verifyBetaToken(betaCookie.value, accessCode);
    if (valid) {
      return NextResponse.next();
    }
  }

  // API 请求返回 401
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, error: '需要邀请码访问' },
      { status: 401 },
    );
  }

  // 页面请求重定向到门禁页
  return NextResponse.redirect(new URL('/beta/gate', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logos/|avatars/).*)'],
};
