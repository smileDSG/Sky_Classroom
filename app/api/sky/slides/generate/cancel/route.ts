/**
 * POST /api/sky/slides/generate/cancel
 *
 * Cancel a running PPT generation job.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { markSlidesJobCancelledHybrid, readSlidesJobHybrid } from '@/lib/slides/agent/slides-job-store-hybrid';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:SlidesCancel');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId } = body as { jobId?: string };

    if (!jobId) {
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing jobId');
    }

    const job = await readSlidesJobHybrid(jobId);
    if (!job) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 404, 'Job not found');
    }

    if (job.status !== 'running' && job.status !== 'queued') {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, `Cannot cancel job with status: ${job.status}`);
    }

    await markSlidesJobCancelledHybrid(jobId);
    log.info(`Slides job ${jobId} cancelled by user`);

    return apiSuccess({ jobId, status: 'cancelled' });
  } catch (err) {
    log.error('Cancel failed:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '取消失败');
  }
}
