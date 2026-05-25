/**
 * GET /api/sky/solve/jobs/[jobId]
 * Poll for the status and result of a background solve job.
 */
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { getSolveJob } from '@/lib/server/solve-job-store';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:SolveJobStatus');

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;

    if (!jobId || jobId.length > 30) {
      return apiError('INVALID_REQUEST', 400, '无效的作业 ID');
    }

    const job = getSolveJob(jobId);
    if (!job) {
      return apiError('INVALID_REQUEST', 404, '作业未找到或已过期');
    }

    return apiSuccess({
      jobId: job.id,
      status: job.status,
      phase: job.phase,
      progress: job.progress,
      problemPreview: job.problemPreview,
      result: job.result,
      error: job.error,
      done: job.status === 'completed' || job.status === 'failed',
    });
  } catch (err) {
    log.error('Solve job poll failed:', err);
    return apiError(
      'INTERNAL_ERROR',
      500,
      '获取作业状态失败',
      err instanceof Error ? err.message : undefined,
    );
  }
}
