/**
 * GET/POST/PATCH/DELETE /api/sky/mistakes
 *
 * Mistake book CRUD endpoint backed by the unified storage DAO.
 * Falls back to in-memory storage when IndexedDB / localStorage are unavailable.
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getServerStorage } from '@/lib/server/server-storage';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import type { ErrorType } from '@/lib/storage/dao/mistakes';
import { createLogger } from '@/lib/logger';
import { recordReviewCompleted } from '@/lib/adaptive-learning/profile/event-recorder';
import { getLearnerDecision } from '@/lib/adaptive-learning/decision/learner-decision';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { requireAuth } from '@/lib/server/auth/helpers';
import { ensureDemoLearningData } from '@/lib/demo/admin-mistake-seed';
import { invalidateProfileCache } from '@/lib/student/profile-builder';
import type { KnowledgeState } from '@/lib/adaptive-learning/contracts';
import {
  canonicalizeKnowledgePoint,
  sameKnowledgePoint,
} from '@/lib/adaptive-learning/knowledge/knowledge-point-registry';

const log = createLogger('API:SkyMistakes');

const MistakeCreateSchema = z.object({
  problemText: z.string().max(20000).optional().default(''),
  problemImage: z.string().max(2000).optional(),
  userAnswer: z.string().max(2000).optional().default(''),
  correctAnswer: z.string().max(2000).optional().default(''),
  errorType: z
    .enum(['calculation', 'concept', 'reasoning', 'reading', 'careless'])
    .optional()
    .default('concept'),
  errorExplanation: z.string().max(20000).optional(),
  knowledgePoints: z.array(z.string().max(200)).max(20).optional().default([]),
  sourceSessionId: z.string().max(200).optional(),
  source: z
    .enum(['review', 'classroom-quiz', 'solve', 'manual', 'classroom-diagnostic'])
    .optional(),
});

/** Shared DAO singleton (lazy-init) */
let _daoPromise: ReturnType<typeof initDAO> | null = null;

async function initDAO() {
  const storage = await getServerStorage();
  return createMistakeBookDAO(storage);
}

async function getDAO() {
  if (!_daoPromise) _daoPromise = initDAO();
  return _daoPromise;
}

function findKnowledgeState(states: KnowledgeState[], knowledgePoint: string) {
  const normalized = knowledgePoint.trim().toLocaleLowerCase();
  return states.find(
    (state) =>
      state.nodeId.trim().toLocaleLowerCase() === normalized ||
      state.displayName?.trim().toLocaleLowerCase() === normalized ||
      sameKnowledgePoint(state.displayName ?? state.nodeId, knowledgePoint),
  );
}

// ── GET — list / query mistakes ──────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const dao = await getDAO();
    const storage = await getServerStorage();
    const demoSeed = await ensureDemoLearningData(auth.user.id, storage);
    if (demoSeed.changed) {
      await invalidateProfileCache(auth.user.id);
    }
    const url = new URL(req.url);
    const errorType = url.searchParams.get('errorType') as ErrorType | null;
    const reviewed = url.searchParams.get('reviewed');
    const masteryBelow = url.searchParams.get('masteryBelow');
    const page = url.searchParams.get('page');
    const pageSize = url.searchParams.get('pageSize');

    const result = await dao.list(auth.user.id, {
      errorType: errorType ?? undefined,
      reviewed: reviewed !== null ? reviewed === 'true' : undefined,
      // 注意: 不能写成 `Number.isFinite(Number(masteryBelow))` —— 参数缺省时
      // masteryBelow 是 null，而 Number(null) === 0 是有限数，会误判为"用户传了 0"，
      // 于是 dao 按 masteryLevel < 0 过滤，把所有错题都滤掉（表现为列表永远为空）。
      // 必须先排除 null / 空串，再做数字转换。
      masteryBelow:
        masteryBelow !== null && masteryBelow.trim() !== '' && Number.isFinite(Number(masteryBelow))
          ? Number(masteryBelow)
          : undefined,
      page: page !== null && Number.isFinite(Number(page)) ? Math.max(1, Math.trunc(Number(page))) : 1,
      pageSize:
        pageSize !== null && pageSize.trim() !== ''
          ? Math.min(100, Math.max(1, Math.trunc(Number(pageSize))))
          : 20,
    });

    return apiSuccess({ items: result.items, total: result.total });
  } catch (err) {
    log.error('Mistakes GET error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '错题查询失败');
  }
}

// ── POST — create a new mistake entry ────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const dao = await getDAO();
    const body = await req.json();

    const parsed = MistakeCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '无效的错题数据');
    }
    const {
      problemText,
      problemImage,
      userAnswer,
      correctAnswer,
      errorType,
      errorExplanation,
      knowledgePoints,
      sourceSessionId,
      source,
    } = parsed.data;

    const id = `mistake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await dao.add(auth.user.id, {
      id,
      problemText,
      problemImage,
      userAnswer,
      correctAnswer,
      errorType,
      errorExplanation,
      knowledgePoints,
      sourceSessionId,
      source,
    });

    log.info('Mistake created:', id);
    return apiSuccess({ id, created: true }, 201);
  } catch (err) {
    log.error('Mistakes POST error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '错题记录失败');
  }
}

// ── PATCH — record a review (Ebbinghaus scheduling) ──────────────────

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const dao = await getDAO();
    const storage = await getServerStorage();
    const knowledgeStateDAO = createKnowledgeStateDAO(storage);
    const body = await req.json();
    const id = body.id as string;
    const correct = body.correct !== false; // default true

    if (!id) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '缺少 id 参数');
    }

    const entry = await dao.get(auth.user.id, id);
    if (!entry) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 404, '错题不存在');
    }
    const statesBefore = await knowledgeStateDAO.list(auth.user.id);

    const updated = correct
      ? await dao.recordReview(auth.user.id, id)
      : await dao.resetReview(auth.user.id, id);

    if (!updated) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 404, '错题不存在');
    }

    if (correct) {
      log.info('Mistake reviewed (correct):', id);
    } else {
      log.info('Mistake review reset (wrong):', id);
    }

    // Record a review event and invalidate the profile cache so the next
    // profile build reflects the review result in real time.
    let reviewEventRecorded = false;
    try {
      const event = await recordReviewCompleted({
        storage,
        userId: auth.user.id,
        source: 'mistake-review',
        rating: correct ? 'recalled' : 'forgotten',
        knowledgePoints: entry.knowledgePoints,
        correlationId: entry.id,
      });
      reviewEventRecorded = Boolean(event);
    } catch (eventErr) {
      log.warn('Failed to record review event:', eventErr);
    }

    const [statesAfter, reviewedEntry] = await Promise.all([
      knowledgeStateDAO.list(auth.user.id),
      dao.get(auth.user.id, id),
    ]);
    const canonicalPoints = new Map(
      entry.knowledgePoints.map((knowledgePoint) => {
        const canonical = canonicalizeKnowledgePoint(knowledgePoint);
        return [canonical.id, canonical.name] as const;
      }),
    );
    const changes = [...canonicalPoints.values()].map((knowledgePoint) => {
      const before = findKnowledgeState(statesBefore, knowledgePoint);
      const after = findKnowledgeState(statesAfter, knowledgePoint);
      return {
        knowledgePoint,
        masteryBefore: before?.mastery ?? null,
        masteryAfter: after?.mastery ?? null,
        confidenceBefore: before?.confidence ?? null,
        confidenceAfter: after?.confidence ?? null,
        evidenceCountBefore: before?.evidenceCount ?? 0,
        evidenceCountAfter: after?.evidenceCount ?? 0,
      };
    });
    const learnerDecision = getLearnerDecision({
      knowledgeStates: statesAfter,
      explicitTopic: entry.knowledgePoints[0],
    });

    return apiSuccess({
      reviewed: correct,
      id,
      review: reviewedEntry
        ? {
            reviewCount: reviewedEntry.reviewCount,
            masteryLevel: reviewedEntry.masteryLevel,
            nextReview: reviewedEntry.nextReview,
          }
        : null,
      profileUpdate: {
        recorded: reviewEventRecorded,
        changes,
        learnerDecision,
      },
    });
  } catch (err) {
    log.error('Mistakes PATCH error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '标记复习失败');
  }
}

// ── DELETE — remove a mistake (or all if ?all=true) ──────────────────

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const dao = await getDAO();
    const url = new URL(req.url);

    // Bulk delete: ?all=true
    if (url.searchParams.get('all') === 'true') {
      const { items } = await dao.list(auth.user.id, { page: 1, pageSize: 99999 });
      for (const item of items) {
        await dao.delete(auth.user.id, item.id);
      }
      log.info(`Bulk deleted ${items.length} mistakes`);
      return apiSuccess({ deleted: items.length });
    }

    const id = url.pathname.split('/').pop();

    if (!id) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '缺少 id 参数');
    }

    const deleted = await dao.delete(auth.user.id, id);
    if (!deleted) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 404, '错题不存在');
    }

    log.info('Mistake deleted:', id);
    return apiSuccess({ deleted: true, id });
  } catch (err) {
    log.error('Mistakes DELETE error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '删除错题失败');
  }
}
