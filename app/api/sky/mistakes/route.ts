/**
 * GET/POST/PATCH/DELETE /api/sky/mistakes
 *
 * Mistake book CRUD endpoint backed by the unified storage DAO.
 * Falls back to in-memory storage when IndexedDB / localStorage are unavailable.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getServerStorage } from '@/lib/server/server-storage';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import type { ErrorType } from '@/lib/storage/dao/mistakes';
import { createLogger } from '@/lib/logger';
import { invalidateProfileCache } from '@/lib/student/profile-builder';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth';

const log = createLogger('API:SkyMistakes');

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

// ── GET — list / query mistakes ──────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const dao = await getDAO();
    const url = new URL(req.url);
    const errorType = url.searchParams.get('errorType') as ErrorType | null;
    const reviewed = url.searchParams.get('reviewed');
    const masteryBelow = url.searchParams.get('masteryBelow');
    const page = url.searchParams.get('page');
    const pageSize = url.searchParams.get('pageSize');

    const result = await dao.list({
      errorType: errorType ?? undefined,
      reviewed: reviewed !== null ? reviewed === 'true' : undefined,
      masteryBelow: masteryBelow ? Number(masteryBelow) : undefined,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });

    return apiSuccess({ items: result.items, total: result.total });
  } catch (err) {
    log.error('Mistakes GET error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '错题查询失败');
  }
}

// ── POST — create a new mistake entry ────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const dao = await getDAO();
    const body = await req.json();

    const id = `mistake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await dao.add({
      id,
      problemText: body.problemText ?? '',
      problemImage: body.problemImage,
      userAnswer: body.userAnswer ?? '',
      correctAnswer: body.correctAnswer ?? '',
      errorType: body.errorType ?? 'concept',
      errorExplanation: body.errorExplanation,
      knowledgePoints: body.knowledgePoints ?? [],
      sourceSessionId: body.sourceSessionId,
      source: body.source,
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
  try {
    const dao = await getDAO();
    const body = await req.json();
    const id = body.id as string;
    const correct = body.correct !== false; // default true

    if (!id) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '缺少 id 参数');
    }

    if (correct) {
      await dao.recordReview(id);
      log.info('Mistake reviewed (correct):', id);
    } else {
      // Wrong answer — reset review count
      await dao.resetReview(id);
      log.info('Mistake review reset (wrong):', id);
    }

    // Invalidate student profile cache so the next profile build reflects the review result
    try {
      const cookieStore = await cookies();
      const accessToken = cookieStore.get('access_token');
      if (accessToken) {
        const payload = await verifyAccessToken(accessToken.value);
        if (payload?.sub) {
          await invalidateProfileCache(payload.sub);
          log.info('Profile cache invalidated for user:', payload.sub);
        }
      }
    } catch (cacheErr) {
      log.warn('Failed to invalidate profile cache after review:', cacheErr);
    }

    return apiSuccess({ reviewed: correct, id });
  } catch (err) {
    log.error('Mistakes PATCH error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '标记复习失败');
  }
}

// ── DELETE — remove a mistake (or all if ?all=true) ──────────────────

export async function DELETE(req: NextRequest) {
  try {
    const dao = await getDAO();
    const url = new URL(req.url);

    // Bulk delete: ?all=true
    if (url.searchParams.get('all') === 'true') {
      const { items } = await dao.list({ page: 1, pageSize: 99999 });
      for (const item of items) {
        await dao.delete(item.id);
      }
      log.info(`Bulk deleted ${items.length} mistakes`);
      return apiSuccess({ deleted: items.length });
    }

    const id = url.pathname.split('/').pop();

    if (!id) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '缺少 id 参数');
    }

    await dao.delete(id);
    log.info('Mistake deleted:', id);
    return apiSuccess({ deleted: true, id });
  } catch (err) {
    log.error('Mistakes DELETE error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '删除错题失败');
  }
}
