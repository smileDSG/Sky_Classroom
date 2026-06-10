/**
 * GET /api/sky/slides/generate/status?jobId=xxx
 *
 * Poll endpoint for PPT generation job status.
 * Reads from hybrid store (memory-first, disk fallback).
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { readSlidesJobHybrid, isValidSlidesJobId } from '@/lib/slides/agent/slides-job-store-hybrid';
import { buildRequestOrigin } from '@/lib/server/classroom-storage';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:SlidesStatus');

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId');
  if (!jobId) {
    return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing jobId');
  }

  if (!isValidSlidesJobId(jobId)) {
    return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Invalid job id');
  }

  try {
    const job = await readSlidesJobHybrid(jobId);
    if (!job) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 404, 'Job not found (expired or never existed)');
    }

    const origin = buildRequestOrigin(req);
    const pollUrl = `${origin}/api/sky/slides/generate/status?jobId=${jobId}`;
    const isDone = job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled';

    return apiSuccess({
      jobId: job.id,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      message: job.message,
      totalPages: job.totalPages,
      pollUrl,
      pollIntervalMs: 5000,
      done: isDone,
      result: job.result,
      qaReport: job.qaReport,
      error: job.error,
      inputSummary: job.inputSummary,
    });
  } catch (error) {
    log.error(`Slides job retrieval failed [jobId=${jobId}]:`, error);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      'Failed to retrieve slides job',
      error instanceof Error ? error.message : String(error),
    );
  }
}
