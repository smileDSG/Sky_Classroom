import { NextRequest } from 'next/server';
import { resolveHandwritingUserId } from '@/app/api/sky/handwriting/auth';
import { createHandwritingSubmissionDAO } from '@/lib/handwriting';
import type { HandwritingSubject } from '@/lib/handwriting';
import { createLogger } from '@/lib/logger';
import { apiError, API_ERROR_CODES, apiSuccess } from '@/lib/server/api-response';
import { getServerStorage } from '@/lib/server/server-storage';

const log = createLogger('API:HandwritingSubmissions');

let daoPromise: ReturnType<typeof initDAO> | null = null;

async function initDAO() {
  return createHandwritingSubmissionDAO(await getServerStorage());
}

async function getDAO() {
  if (!daoPromise) daoPromise = initDAO();
  return daoPromise;
}

function isHandwritingSubject(value: unknown): value is HandwritingSubject {
  return value === 'math' || value === 'physics';
}

export async function GET(_req: NextRequest) {
  const userId = await resolveHandwritingUserId();
  if (!userId) {
    return apiError(API_ERROR_CODES.UNAUTHORIZED, 401, 'Not authenticated');
  }

  try {
    const result = await (await getDAO()).listByUser(userId);
    return apiSuccess(result);
  } catch (error) {
    log.error('List handwriting submissions failed:', error);
    return apiError(API_ERROR_CODES.STORAGE_ERROR, 500, '手写提交查询失败');
  }
}

export async function POST(req: NextRequest) {
  const userId = await resolveHandwritingUserId();
  if (!userId) {
    return apiError(API_ERROR_CODES.UNAUTHORIZED, 401, 'Not authenticated');
  }

  const body = (await req.json().catch(() => null)) as {
    subject?: unknown;
    existingProblemId?: unknown;
    title?: unknown;
  } | null;
  if (!body || !isHandwritingSubject(body.subject)) {
    return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'subject 必须为 math 或 physics');
  }

  try {
    const submission = await (
      await getDAO()
    ).create({
      userId,
      subject: body.subject,
      existingProblemId:
        typeof body.existingProblemId === 'string' && body.existingProblemId.trim()
          ? body.existingProblemId.trim()
          : undefined,
      title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : undefined,
    });
    return apiSuccess({ submission }, 201);
  } catch (error) {
    log.error('Create handwriting submission failed:', error);
    return apiError(API_ERROR_CODES.STORAGE_ERROR, 500, '手写提交创建失败');
  }
}
