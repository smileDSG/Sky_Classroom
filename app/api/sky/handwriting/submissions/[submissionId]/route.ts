import { NextRequest } from 'next/server';
import { resolveHandwritingUserId } from '@/app/api/sky/handwriting/auth';
import { createHandwritingSubmissionDAO, HANDWRITING_SUBMISSION_STATUSES } from '@/lib/handwriting';
import type { SubmissionStatus } from '@/lib/handwriting';
import { createLogger } from '@/lib/logger';
import { apiError, API_ERROR_CODES, apiSuccess } from '@/lib/server/api-response';
import { getServerStorage } from '@/lib/server/server-storage';

const log = createLogger('API:HandwritingSubmission');

let daoPromise: ReturnType<typeof initDAO> | null = null;

async function initDAO() {
  return createHandwritingSubmissionDAO(await getServerStorage());
}

async function getDAO() {
  if (!daoPromise) daoPromise = initDAO();
  return daoPromise;
}

function isSubmissionStatus(value: unknown): value is SubmissionStatus {
  return (
    typeof value === 'string' &&
    (HANDWRITING_SUBMISSION_STATUSES as readonly string[]).includes(value)
  );
}

interface RouteContext {
  params: Promise<{ submissionId: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const userId = await resolveHandwritingUserId();
  if (!userId) {
    return apiError(API_ERROR_CODES.UNAUTHORIZED, 401, 'Not authenticated');
  }

  try {
    const { submissionId } = await params;
    const submission = await (await getDAO()).getForUser(submissionId, userId);
    if (!submission) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 404, '手写提交不存在');
    }
    return apiSuccess({ submission });
  } catch (error) {
    log.error('Get handwriting submission failed:', error);
    return apiError(API_ERROR_CODES.STORAGE_ERROR, 500, '手写提交查询失败');
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const userId = await resolveHandwritingUserId();
  if (!userId) {
    return apiError(API_ERROR_CODES.UNAUTHORIZED, 401, 'Not authenticated');
  }

  const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
  if (!body || !isSubmissionStatus(body.status)) {
    return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '无效的提交状态');
  }
  if (body.status !== 'closed') {
    return apiError(API_ERROR_CODES.FORBIDDEN, 403, '工作流状态只能由对应服务推进');
  }

  try {
    const { submissionId } = await params;
    const submission = await (await getDAO()).updateStatus(submissionId, userId, body.status);
    if (!submission) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 404, '手写提交不存在');
    }
    return apiSuccess({ submission });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('Illegal handwriting submission transition:')
    ) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 409, error.message);
    }
    log.error('Update handwriting submission failed:', error);
    return apiError(API_ERROR_CODES.STORAGE_ERROR, 500, '手写提交更新失败');
  }
}
