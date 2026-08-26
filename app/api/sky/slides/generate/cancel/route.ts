/**
 * POST /api/sky/slides/generate/cancel
 *
 * Cancel a running PPT generation job.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { cancelJob, getJob } from '@/lib/slides/agent/pipeline';
import { createLogger } from '@/lib/logger';
import { requireAuth } from '@/lib/server/auth/helpers';

const log = createLogger('API:SlidesCancel');

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const body = await req.json();
    const { jobId } = body as { jobId?: string };

    if (!jobId) {
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing jobId');
    }

    const job = getJob(jobId);
    if (!job) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 404, 'Job not found');
    }

    if (job.userId !== auth.user.id) {
      return apiError(API_ERROR_CODES.UNAUTHORIZED, 403, '无权操作此任务');
    }

    if (job.stage === 'done') {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Cannot cancel a completed job');
    }

    const cancelled = cancelJob(jobId, auth.user.id);
    if (!cancelled) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 404, 'Job not found');
    }
    log.info(`Slides job ${jobId} cancelled by user`);

    return apiSuccess({ jobId, status: 'cancelled' });
  } catch (err) {
    log.error('Cancel failed:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '取消失败');
  }
}
