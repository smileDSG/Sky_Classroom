/**
 * POST /api/sky/solve/jobs
 * Submit a solve job for background execution. Returns a jobId immediately.
 */
import { after } from 'next/server';
import { nanoid } from 'nanoid';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createSolveJob } from '@/lib/server/solve-job-store';
import { runSolveJob } from '@/lib/server/solve-job-runner';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:SolveJobs');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { problem, problemImage, problemSpec, userAnswer } = body;

    if (!problem) {
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, '缺少必填字段: problem');
    }

    const jobId = nanoid(10);
    const job = createSolveJob(jobId, problem);

    after(() => runSolveJob(jobId, problem, problemImage ?? null, userAnswer ?? null, problemSpec ?? null));

    log.info(`Solve job created: ${jobId} (${problem.slice(0, 40)}...)`);

    return apiSuccess({
      jobId: job.id,
      status: job.status,
      phase: job.phase,
      progress: job.progress,
      pollUrl: `/api/sky/solve/jobs/${jobId}`,
      pollIntervalMs: 2000,
    }, 202);
  } catch (err) {
    log.error('Solve job creation failed:', err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '创建解题作业失败',
      err instanceof Error ? err.message : undefined,
    );
  }
}
