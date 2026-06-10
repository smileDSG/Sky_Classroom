/**
 * GET /api/sky/teaching/[jobId]
 *
 * Poll teaching job status. Returns current progress, plan, and completed sections.
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireQuota } from '@/lib/server/billing/require-quota';
import { readTeachingJob } from '@/lib/server/teaching-job-store';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  // Auth check
  const quota = await requireQuota('generationCount');
  if ('error' in quota) return quota.error;

  const { jobId } = await params;
  const job = await readTeachingJob(jobId);

  if (!job) {
    return apiError('NOT_FOUND', 404, '教案任务不存在');
  }

  // Ensure user can only access their own jobs
  if (job.userId !== quota.userId) {
    return apiError('UNAUTHORIZED', 403, '无权访问此任务');
  }

  return apiSuccess({
    id: job.id,
    topic: job.topic,
    status: job.status,
    step: job.step,
    progress: job.progress,
    message: job.message,
    plan: job.plan,
    sections: job.sections ?? [],
    sectionsCompleted: job.sectionsCompleted ?? 0,
    totalSections: job.totalSections ?? 0,
    error: job.error,
    done: job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled',
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
  });
}
