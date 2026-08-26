import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/server/auth/helpers';
import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import { getServerStorage } from '@/lib/server/server-storage';
import { getDueMemoryReviews } from '@/lib/cloud-mind/spaced-repetition';
import type { MemoryReviewRecord } from '@/lib/cloud-mind/types';
import { createLogger } from '@/lib/logger';

const TABLE = 'cloud_mind_memory_reviews';
const log = createLogger('API:CloudMindMemoryDue');

export async function GET() {
  try {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;
    const userId = auth.user.id;
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
