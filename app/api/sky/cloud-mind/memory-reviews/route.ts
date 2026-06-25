import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import { verifyAccessToken } from '@/lib/server/auth';
import { getServerStorage } from '@/lib/server/server-storage';
import {
  buildMemoryReviewId,
  getDueMemoryReviews,
  scheduleMemoryReview,
} from '@/lib/cloud-mind/spaced-repetition';
import type { MemoryReviewRating, MemoryReviewRecord } from '@/lib/cloud-mind/types';
import type { StorageEntry } from '@/lib/storage/storage-types';
import { createLogger } from '@/lib/logger';

const TABLE = 'cloud_mind_memory_reviews';
const RATINGS = new Set<MemoryReviewRating>(['remembered', 'fuzzy', 'forgotten']);
const log = createLogger('API:CloudMindMemoryReviews');

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

function normalizeRating(value: unknown): MemoryReviewRating | null {
  return typeof value === 'string' && RATINGS.has(value as MemoryReviewRating)
    ? (value as MemoryReviewRating)
    : null;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    const url = new URL(req.url);
    const dueOnly = url.searchParams.get('due') === 'true';
    const storage = await getServerStorage();
    const entries = await storage.getAll<MemoryReviewRecord>(
      TABLE,
      (entry) => entry.data.userId === userId,
    );
    const reviews = entries.map((entry) => entry.data);
    const data = dueOnly ? getDueMemoryReviews(reviews) : reviews;

    return apiSuccess({ data });
  } catch (err) {
    log.error('Memory reviews GET failed:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '记忆卡复习记录查询失败');
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    const body = await req.json();
    const rating = normalizeRating(body.rating);

    if (!rating) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '缺少有效复习反馈');
    }
    if (!body.cardId || !body.deckId) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '缺少卡片或卡组 ID');
    }

    const storage = await getServerStorage();
    const cardId = String(body.cardId);
    const reviewId = buildMemoryReviewId(userId, cardId);
    const existing = await storage.get<MemoryReviewRecord>(TABLE, reviewId);
    const record = scheduleMemoryReview({
      userId,
      cardId,
      deckId: String(body.deckId),
      rating,
      previous: existing?.data ?? null,
      sourceType: body.sourceType,
      sourceId: body.sourceId ? String(body.sourceId) : undefined,
      front: body.front ? String(body.front) : undefined,
      back: body.back ? String(body.back) : undefined,
      tags: Array.isArray(body.tags) ? body.tags.map(String).filter(Boolean) : undefined,
    });
    const now = Date.now();
    const entry: StorageEntry<MemoryReviewRecord> = {
      id: record.id,
      data: record,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await storage.set(TABLE, entry);
    return apiSuccess({ data: record }, existing ? 200 : 201);
  } catch (err) {
    log.error('Memory reviews POST failed:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '记忆卡复习反馈保存失败');
  }
}
