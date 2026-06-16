/**
 * GET /api/sky/learning-path
 * POST /api/sky/learning-path
 * PATCH /api/sky/learning-path?id=xxx
 *
 * Manage learning paths for the current user.
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireQuota } from '@/lib/server/billing/require-quota';
import { getServerStorage } from '@/lib/server/server-storage';
import { buildStudentProfile, invalidateProfileCache } from '@/lib/student/profile-builder';
import { buildInitialPath, updatePathAfterJob } from '@/lib/teaching/learning-path-engine';
import { createLearningPathDAO } from '@/lib/storage/dao/learning-paths';
import { readTeachingJob } from '@/lib/server/teaching-job-store';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:LearningPath');

/** GET — Return active learning path for current user */
export async function GET(req: NextRequest) {
  try {
    const quota = await requireQuota('generationCount');
    if ('error' in quota) return quota.error;

    const storage = await getServerStorage();
    const dao = createLearningPathDAO(storage);

    const activePath = await dao.getActiveByUser(quota.userId);

    if (!activePath) {
      return apiSuccess({ path: null }, 200);
    }

    return apiSuccess({ path: activePath }, 200);
  } catch (err) {
    log.error('Failed to get learning path:', err);
    return apiError('INTERNAL_ERROR', 500, 'Failed to get learning path');
  }
}

/** POST — Create a new learning path */
export async function POST(req: NextRequest) {
  try {
    const quota = await requireQuota('generationCount');
    if ('error' in quota) return quota.error;

    const body = await req.json();
    const { goalTopic } = body as { goalTopic?: string };

    const profile = await buildStudentProfile(quota.userId);
    const path = buildInitialPath(profile, goalTopic);

    const storage = await getServerStorage();
    const dao = createLearningPathDAO(storage);
    await dao.add(path);

    log.info(`Created learning path ${path.id} for user ${quota.userId}`);

    return apiSuccess({ path }, 201);
  } catch (err) {
    log.error('Failed to create learning path:', err);
    return apiError('INTERNAL_ERROR', 500, 'Failed to create learning path');
  }
}

/** PATCH — Update a learning path (typically triggered after job completion) */
export async function PATCH(req: NextRequest) {
  try {
    const quota = await requireQuota('generationCount');
    if ('error' in quota) return quota.error;

    const url = new URL(req.url);
    const pathId = url.searchParams.get('id');
    if (!pathId) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing id parameter');
    }

    const body = await req.json();
    const { jobId } = body as { jobId?: string };

    if (!jobId) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing jobId parameter');
    }

    const storage = await getServerStorage();
    const dao = createLearningPathDAO(storage);

    const path = await dao.get(pathId);
    if (!path) {
      return apiError('NOT_FOUND', 404, '学习路径不存在');
    }
    if (path.userId !== quota.userId) {
      return apiError('UNAUTHORIZED', 403, '无权访问此学习路径');
    }

    const job = await readTeachingJob(jobId);
    if (!job) {
      return apiError('NOT_FOUND', 404, '教案不存在');
    }

    const profile = await buildStudentProfile(quota.userId);
    const updated = updatePathAfterJob(path, job, profile);

    await dao.update(pathId, updated);

    log.info(`Updated learning path ${pathId} after job ${jobId}`);

    return apiSuccess({ path: updated }, 200);
  } catch (err) {
    log.error('Failed to update learning path:', err);
    return apiError('INTERNAL_ERROR', 500, 'Failed to update learning path');
  }
}
