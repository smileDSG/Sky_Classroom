/**
 * POST /api/sky/teaching/[jobId]/cancel
 *
 * Cancel a running teaching job.
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireQuota } from '@/lib/server/billing/require-quota';
import { readTeachingJob, markTeachingJobCancelled } from '@/lib/server/teaching-job-store';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const quota = await requireQuota('generationCount');
  if ('error' in quota) return quota.error;

  const { jobId } = await params;
  const job = await readTeachingJob(jobId);

  if (!job) {
    return apiError('NOT_FOUND', 404, '教案任务不存在');
  }

  if (job.userId !== quota.userId) {
    return apiError('UNAUTHORIZED', 403, '无权操作此任务');
  }

  if (job.status !== 'running' && job.status !== 'queued') {
    return apiError('INVALID_REQUEST', 400, '任务不在运行中');
  }

  await markTeachingJobCancelled(jobId);

  return apiSuccess({ message: '任务已取消' });
}
