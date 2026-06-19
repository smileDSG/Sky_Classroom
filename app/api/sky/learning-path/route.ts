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
import {
  buildInitialPath,
  buildInitialPathFromContext,
  updatePathAfterJob,
} from '@/lib/teaching/learning-path-engine';
import { buildPathGenerationContext } from '@/lib/teaching/learning-path-context';
import type {
  PathGenerationOptions,
  PriorityStrategy,
  StrategyAlias,
} from '@/lib/teaching/learning-path-types';
import { createLearningPathDAO } from '@/lib/storage/dao/learning-paths';
import { readTeachingJob } from '@/lib/server/teaching-job-store';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:LearningPath');

const VALID_PRIORITY_STRATEGIES: PriorityStrategy[] = [
  'weakness',
  'review',
  'error-pattern',
  'goal-topic',
  'balanced',
];

function normalizePriorities(
  priorities?: string[],
  strategy?: string,
): PriorityStrategy[] {
  const valid = (priorities ?? []).filter((p): p is PriorityStrategy =>
    VALID_PRIORITY_STRATEGIES.includes(p as PriorityStrategy),
  );
  if (valid.length > 0) return valid;

  switch (strategy) {
    case 'weakness-first':
      return ['weakness'];
    case 'review-first':
      return ['review'];
    case 'error-first':
      return ['error-pattern'];
    case 'goal-topic':
      return ['goal-topic'];
    default:
      return ['balanced'];
  }
}

/** GET — Return active learning path for current user */
export async function GET(req: NextRequest) {
  try {
    const quota = await requireQuota('generationCount');
    if ('error' in quota) return quota.error;

    const storage = await getServerStorage();
    const dao = createLearningPathDAO(storage);

    const activePath = await dao.getActiveByUser(quota.userId);

    if (!activePath) {
      return apiSuccess({ data: { path: null } }, 200);
    }

    return apiSuccess({ data: { path: activePath } }, 200);
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
    const { goalTopic, priorities, strategy } = body as PathGenerationOptions;

    const normalizedPriorities = normalizePriorities(priorities, strategy);
    const context = await buildPathGenerationContext(quota.userId);
    const path = buildInitialPathFromContext(context, {
      goalTopic,
      priorities: normalizedPriorities,
      strategy: strategy as StrategyAlias,
    });

    const storage = await getServerStorage();
    const dao = createLearningPathDAO(storage);

    // Defensive: never persist/return an empty path as a "success" — that would
    // render a blank card and a misleading toast. The engine fallback should
    // guarantee nodes, but guard regardless.
    if (!path.nodes || path.nodes.length === 0) {
      log.error(`Built empty learning path for user ${quota.userId}`);
      return apiError('GENERATION_FAILED', 500, '未能生成学习路径，请稍后重试');
    }

    await dao.add(path);

    log.info(`Created learning path ${path.id} for user ${quota.userId} with ${path.nodes.length} nodes`);

    return apiSuccess({ data: { path } }, 201);
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

    return apiSuccess({ data: { path: updated } }, 200);
  } catch (err) {
    log.error('Failed to update learning path:', err);
    return apiError('INTERNAL_ERROR', 500, 'Failed to update learning path');
  }
}
