import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import { verifyAccessToken } from '@/lib/server/auth';
import { getServerStorage } from '@/lib/server/server-storage';
import { getDueMemoryReviews } from '@/lib/cloud-mind/spaced-repetition';
import type { MemoryReviewRecord } from '@/lib/cloud-mind/types';
import { createLogger } from '@/lib/logger';

const TABLE = 'cloud_mind_memory_reviews';
const log = createLogger('API:CloudMindMemoryDue');

async function resolveUserId(req: NextRequest): Promise<string> {
  const url = new URL(req.url);
  const queryUserId = url.searchParams.get('userId');
  if (queryUserId) return queryUserId;

  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token');
    if (!accessToken) return 'default-user';
    const payload = await verifyAccessToken(accessToken.value);
    return payload?.sub ?? 'default-user';
  } catch {
    return 'default-user';
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    const storage = await getServerStorage();
    const entries = await storage.getAll<MemoryReviewRecord>(
      TABLE,
      (entry) => entry.data.userId === userId,
    );

    return apiSuccess({ data: getDueMemoryReviews(entries.map((entry) => entry.data)) });
  } catch (err) {
    log.error('Memory due GET failed:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '到期记忆卡查询失败');
  }
}
