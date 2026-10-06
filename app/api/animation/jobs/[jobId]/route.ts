import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import { readAnimationJob } from '@/lib/animation/animation-job-store';

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await readAnimationJob(jobId);
  if (!job) return apiError(API_ERROR_CODES.NOT_FOUND, 404, '任务不存在');
  return apiSuccess({ job });
}
