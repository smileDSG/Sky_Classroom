import 'server-only';

import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth';

export async function resolveHandwritingUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token');
    if (!accessToken?.value) return null;
    const payload = await verifyAccessToken(accessToken.value);
    return payload?.sub ?? null;
  } catch {
    return null;
  }
}
