/**
 * GET /api/sky/learning-path
 * POST /api/sky/learning-path
 * PATCH /api/sky/learning-path?id=xxx
 *
 * Manage learning paths for the current user. POST now builds the plan from an
 * authoritative learner profile planning projection instead of the legacy
 * learning-path engine.
 */

import { NextRequest } from 'next/server';
import { createLogger } from '@/lib/logger';
import { requireAuth } from '@/lib/server/auth/helpers';
import { requireQuota } from '@/lib/server/billing/require-quota';
import { getServerStorage, getRequiredServerStorage } from '@/lib/server/server-storage';
import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { buildPlanningProjection } from '@/lib/adaptive-learning/profile/projection-builder';
import { generateLearningPlan } from '@/lib/adaptive-learning/planning/learning-plan-service';
import { retrieveChunksForPlanning } from '@/lib/adaptive-learning/planning/retrieve-chunks';
import { generatePlanWithLLM } from '@/lib/adaptive-learning/planning/generate-plan';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import { adaptiveLearningApiError } from '@/lib/adaptive-learning/api-error';
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
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, 'Failed to get learning path');
  }
}

export const maxDuration = 120;

/** POST — Create a new learning path from a planning projection */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const correlationId = crypto.randomUUID();

  try {
    const body = await req.json();
    const { goalTopic, domainProfileId = 'default' } = body as {
      goalTopic?: string;
      domainProfileId?: string;
    };

    if (!domainProfileId || typeof domainProfileId !== 'string') {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'domainProfileId 必须是字符串');
    }

    const storage = await getRequiredServerStorage();
    const profileRepository = new LearnerProfileRepository(storage);

    const preferences = await profileRepository.getLatestPreferences(auth.user.id);
    if (!preferences) {
      const error = new AdaptiveLearningError({
        code: 'PROFILE_NOT_FOUND',
        message: 'Learner profile is required before generating a learning path',
        retryable: false,
        stage: 'learning-path-profile-load',
      });
      return adaptiveLearningApiError(error, correlationId);
    }

    const domainProfile = await profileRepository.getLatestDomainProfile(auth.user.id, domainProfileId);
    if (!domainProfile) {
      const error = new AdaptiveLearningError({
        code: 'PROFILE_INCOMPLETE',
        message: `Domain profile ${domainProfileId} is required before generating a learning path`,
        retryable: false,
        stage: 'learning-path-domain-profile-load',
      });
      return adaptiveLearningApiError(error, correlationId);
    }

    const projection = buildPlanningProjection({
      userId: auth.user.id,
      snapshotId: `snapshot:${preferences.userId}:v${preferences.version}:w0`,
      profileVersion: preferences.version,
      eventWatermark: 0,
      preferences,
      domainProfile,
      planningMode: domainProfile.examDate && domainProfile.targetScore ? 'exam' : 'mastery',
      knowledgeStatus: 'no-evidence',
      targetKnowledge: [],
      engagementSummary: { studyMinutes7d: 0, activeDays7d: 0 },
    });

    const plan = await generateLearningPlan(
      { projection, goalTopic },
      {
        retrieveChunks: retrieveChunksForPlanning,
        generatePlan: generatePlanWithLLM,
      },
    );

    return apiSuccess({ data: plan }, 200, { 'x-correlation-id': correlationId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Learning path generation failed:', message);

    if (error instanceof AdaptiveLearningError) {
      return adaptiveLearningApiError(error, correlationId);
    }

    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '学习路径生成失败',
      message,
      { 'x-correlation-id': correlationId },
    );
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
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Missing id parameter');
    }

    const body = await req.json();
    const { jobId } = body as { jobId?: string };

    if (!jobId) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Missing jobId parameter');
    }

    const storage = await getServerStorage();
    const dao = createLearningPathDAO(storage);

    const path = await dao.get(pathId);
    if (!path) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 404, '学习路径不存在');
    }
    if (path.userId !== quota.userId) {
      return apiError(API_ERROR_CODES.UNAUTHORIZED, 403, '无权访问此学习路径');
    }

    const job = await readTeachingJob(jobId);
    if (!job) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 404, '教案不存在');
    }

    const profile = await buildStudentProfile(quota.userId);
    const updated = updatePathAfterJob(path, job, profile);

    await dao.update(pathId, updated);

    log.info(`Updated learning path ${pathId} after job ${jobId}`);

    return apiSuccess({ data: { path: updated } }, 200);
  } catch (err) {
    log.error('Failed to update learning path:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, 'Failed to update learning path');
  }
}
