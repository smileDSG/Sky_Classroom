import { type NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  isValidResourceJobId,
  readResourceGenerationJobHybrid,
} from '@/lib/server/resource-generation-job-store';
import { createLogger } from '@/lib/logger';

const log = createLogger('ResourceJob API');

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  let resolvedJobId: string | undefined;
  try {
    const { jobId } = await context.params;
    resolvedJobId = jobId;

    if (!isValidResourceJobId(jobId)) {
      return apiError('INVALID_REQUEST', 400, 'Invalid resource generation job id');
    }

    const job = await readResourceGenerationJobHybrid(jobId);
    if (!job) {
      return apiError('INVALID_REQUEST', 404, 'Resource generation job not found');
    }

    // Lazily resume running/initializing jobs. In dev mode (Turbopack) the
    // in-memory runner map is wiped on HMR, so a job still marked running on
    // disk may have no active runner.
    if (job.status === 'running' || job.status === 'initializing') {
      const { resumeResourceGenerationJob } =
        await import('@/lib/server/resource-generation-runner');
      resumeResourceGenerationJob(jobId).catch(() => {});
    }

    const isDone = job.status === 'succeeded' || job.status === 'failed';

    return apiSuccess({
      jobId: job.id,
      status: job.status,
      step: job.step,
      progress: job.progress,
      message: job.message,
      result: job.result,
      error: job.error,
      done: isDone,
    });
  } catch (error) {
    log.error(`Resource job retrieval failed [jobId=${resolvedJobId ?? 'unknown'}]:`, error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to retrieve resource generation job',
      error instanceof Error ? error.message : String(error),
    );
  }
}
