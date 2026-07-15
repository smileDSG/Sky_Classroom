/**
 * GET /api/sky/teaching/history
 * DELETE /api/sky/teaching/history?id=xxx
 *
 * List teaching history for the current user, or delete a specific entry.
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireQuota } from '@/lib/server/billing/require-quota';
import {
  listTeachingJobsByUser,
  readTeachingJob,
  deleteTeachingJob,
} from '@/lib/server/teaching-job-store';

export async function GET(req: NextRequest) {
  const quota = await requireQuota('generationCount');
  if ('error' in quota) return quota.error;

  const url = new URL(req.url);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50;
  const favorited = url.searchParams.get('favorited') === 'true';

  const allJobs = await listTeachingJobsByUser(quota.userId);

  // Only return completed (succeeded) jobs for history, but also include running ones
  const history = allJobs
    .filter((j) => {
      if (favorited) return j.isFavorited === true && j.status === 'succeeded';
      return j.status === 'succeeded' || j.status === 'running';
    })
    .slice(0, limit)
    .map((j) => ({
      id: j.id,
      topic: j.topic,
      status: j.status,
      progress: j.progress,
      plan: j.status === 'succeeded' ? j.plan : undefined,
      sections: j.status === 'succeeded' ? j.sections : undefined,
      sectionsCompleted: j.sectionsCompleted ?? 0,
      totalSections: j.totalSections ?? 0,
      createdAt: j.createdAt,
      completedAt: j.completedAt,
      isFavorited: j.isFavorited ?? false,
    }));

  return apiSuccess({ history });
}

export async function DELETE(req: NextRequest) {
  const quota = await requireQuota('generationCount');
  if ('error' in quota) return quota.error;

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing id parameter');
  }

  const job = await readTeachingJob(id);
  if (!job) {
    return apiError('NOT_FOUND', 404, '教案不存在');
  }

  if (job.userId !== quota.userId) {
    return apiError('UNAUTHORIZED', 403, '无权删除此教案');
  }

  await deleteTeachingJob(id);

  return apiSuccess({ message: '已删除' });
}
