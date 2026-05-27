/**
 * GET /api/sky/slides/generate/status?jobId=xxx
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getJob } from '@/lib/slides/agent/pipeline';

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId');
  if (!jobId) {
    return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing jobId');
  }

  const job = getJob(jobId);
  if (!job) {
    return apiError(API_ERROR_CODES.NOT_FOUND, 404, 'Job not found (expired or never existed)');
  }

  return apiSuccess({ job } as unknown as Record<string, unknown>);
}
