import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/server/auth/helpers';
import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import { getServerStorage } from '@/lib/server/server-storage';
import {
  buildMemoryReviewId,
  getDueMemoryReviews,
  scheduleMemoryReview,
} from '@/lib/cloud-mind/spaced-repetition';
import type { MemoryReviewRating, MemoryReviewRecord } from '@/lib/cloud-mind/types';
import type { StorageEntry } from '@/lib/storage/storage-types';
import { createLogger } from '@/lib/logger';
import { recordReviewCompleted } from '@/lib/adaptive-learning/profile/event-recorder';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { getLearnerDecision } from '@/lib/adaptive-learning/decision/learner-decision';

const TABLE = 'cloud_mind_memory_reviews';
const RATINGS = new Set<MemoryReviewRating>(['remembered', 'fuzzy', 'forgotten']);
const log = createLogger('API:CloudMindMemoryReviews');

function normalizeRating(value: unknown): MemoryReviewRating | null {
  return typeof value === 'string' && RATINGS.has(value as MemoryReviewRating)
    ? (value as MemoryReviewRating)
    : null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;
    const userId = auth.user.id;
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
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;
    const userId = auth.user.id;
    const body = await req.json();
    const rating = normalizeRating(body.rating);

    if (!rating) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '缺少有效复习反馈');
    }
    if (!body.cardId || !body.deckId) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '缺少卡片或卡组 ID');
    }

    const storage = await getServerStorage();
    const knowledgeStateDAO = createKnowledgeStateDAO(storage);
    const knowledgeStatesBefore = await knowledgeStateDAO.list(userId);
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

    const rawKnowledgePoints: unknown[] = Array.isArray(body.knowledgePoints)
      ? body.knowledgePoints
      : (record.tags ?? []);
    const knowledgePoints: string[] = Array.from(
      new Set(rawKnowledgePoints.map((item: unknown) => String(item).trim()).filter(Boolean)),
    );
    const adaptiveRating =
      rating === 'remembered' ? 'recalled' : rating === 'forgotten' ? 'forgotten' : 'hard';
    const learningEvent = await recordReviewCompleted({
      storage,
      userId,
      source: 'cloud-mind-memory',
      rating: adaptiveRating,
      knowledgePoints,
      correlationId: record.id,
    });
    const knowledgeStatesAfter = await knowledgeStateDAO.list(userId);
    const beforeByNodeId = new Map(knowledgeStatesBefore.map((state) => [state.nodeId, state]));
    const changedStates = knowledgeStatesAfter.filter((state) => {
      const previous = beforeByNodeId.get(state.nodeId);
      return !previous || state.version > previous.version;
    });
    const profileImpact = changedStates.map((state) => {
      const previous = beforeByNodeId.get(state.nodeId);
      return {
        nodeId: state.nodeId,
        displayName: state.displayName ?? state.nodeId,
        masteryBefore: previous?.mastery ?? null,
        masteryAfter: state.mastery,
        confidenceBefore: previous?.confidence ?? null,
        confidenceAfter: state.confidence,
        retentionAfter: state.retention,
        stabilityDaysAfter: state.reviewStabilityDays,
        evidenceAdded: Math.max(0, state.evidenceCount - (previous?.evidenceCount ?? 0)),
      };
    });
    const decision = getLearnerDecision({
      knowledgeStates: changedStates,
      fallbackTopic: knowledgePoints[0] ?? null,
    });

    return apiSuccess(
      {
        data: record,
        evidence: { recorded: Boolean(learningEvent), updatedStates: profileImpact.length },
        profileImpact,
        decision,
      },
      existing ? 200 : 201,
    );
  } catch (err) {
    log.error('Memory reviews POST failed:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '记忆卡复习反馈保存失败');
  }
}
