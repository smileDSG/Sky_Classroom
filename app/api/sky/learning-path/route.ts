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
import { buildPlanningEvidence } from '@/lib/adaptive-learning/profile/planning-evidence';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { generateLearningPlan } from '@/lib/adaptive-learning/planning/learning-plan-service';
import {
  buildScheduledLearningPlan,
} from '@/lib/adaptive-learning/planning/scheduled-learning-plan';
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
import { createLearningPlanDAO } from '@/lib/storage/dao/learning-plans';
import { resolveLearnerDecisionForUser } from '@/lib/server/teaching-personalization';
import { readTeachingJob } from '@/lib/server/teaching-job-store';

const log = createLogger('API:LearningPath');

const VALID_PRIORITY_STRATEGIES: PriorityStrategy[] = [
  'weakness',
  'review',
  'error-pattern',
  'goal-topic',
  'balanced',
];

const DEFAULT_NARRATIVE_PLAN_TIMEOUT_MS = 8_000;

function getNarrativePlanTimeoutMs(): number {
  const configured = Number(process.env.LEARNING_PATH_NARRATIVE_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_NARRATIVE_PLAN_TIMEOUT_MS;
}

async function awaitNarrativePlan<T>(
  promise: Promise<T | null>,
  timeoutMs: number,
): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      log.warn(`Narrative learning plan timed out after ${timeoutMs}ms; using schedule only`);
      resolve(null);
    }, timeoutMs);

    void promise.then((value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    });
  });
}

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
    const { goalTopic, domainProfileId = 'default', priorities, strategy } = body as {
      goalTopic?: string;
      domainProfileId?: string;
      priorities?: string[];
      strategy?: StrategyAlias;
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

    const domainProfile = await profileRepository.getLatestDomainProfile(
      auth.user.id,
      domainProfileId,
    );
    if (!domainProfile) {
      const error = new AdaptiveLearningError({
        code: 'PROFILE_INCOMPLETE',
        message: `Domain profile ${domainProfileId} is required before generating a learning path`,
        retryable: false,
        stage: 'learning-path-domain-profile-load',
      });
      return adaptiveLearningApiError(error, correlationId);
    }

    const [knowledgeStates, learningEvents] = await Promise.all([
      createKnowledgeStateDAO(storage).list(auth.user.id),
      profileRepository.listLearningEvents(auth.user.id),
    ]);
    const planningEvidence = buildPlanningEvidence({
      states: knowledgeStates,
      events: learningEvents,
      targetNodeIds: domainProfile.targetNodeIds,
    });

    const projection = buildPlanningProjection({
      userId: auth.user.id,
      snapshotId:
        `snapshot:${preferences.userId}:v${preferences.version}` +
        `:w${planningEvidence.eventWatermark}`,
      profileVersion: preferences.version,
      eventWatermark: planningEvidence.eventWatermark,
      preferences,
      domainProfile,
      planningMode:
        domainProfile.examDate && domainProfile.targetScore !== undefined ? 'exam' : 'mastery',
      knowledgeStatus: planningEvidence.knowledgeStatus,
      targetKnowledge: planningEvidence.targetKnowledge,
      engagementSummary: planningEvidence.engagementSummary,
    });

    const narrativePlanTimeoutMs = getNarrativePlanTimeoutMs();
    const narrativePlanPromise = (async () =>
      generateLearningPlan(
        {
          projection,
          goalTopic,
          learnerDecision: await resolveLearnerDecisionForUser(auth.user.id, goalTopic),
        },
        {
          retrieveChunks: retrieveChunksForPlanning,
          generatePlan: (systemPrompt, userPrompt) =>
            generatePlanWithLLM(systemPrompt, userPrompt, {
              retries: 0,
              timeoutMs: narrativePlanTimeoutMs,
            }),
        },
      ))().catch((error) => {
      log.warn(
        'Narrative learning plan unavailable; continuing with deterministic schedule:',
        error,
      );
      return null;
    });

    const normalizedPriorities = normalizePriorities(priorities, strategy);
    const pathContext = await buildPathGenerationContext(auth.user.id);
    const path = buildInitialPathFromContext(pathContext, {
      goalTopic,
      priorities: normalizedPriorities,
      strategy,
    });

    if (!path.nodes.length) {
      return apiError(
        API_ERROR_CODES.GENERATION_FAILED,
        500,
        '未能生成学习路径，请稍后重试',
        undefined,
        { 'x-correlation-id': correlationId },
      );
    }

    const plan = buildScheduledLearningPlan({
      path,
      projection,
      evidenceEventIds: learningEvents.map((event) => event.eventId),
    });
    const planDAO = createLearningPlanDAO(storage);
    const previousPlan = await planDAO.getActiveByUser(auth.user.id);
    await createLearningPathDAO(storage).add(path);
    await planDAO.add(plan);
    if (previousPlan) {
      await planDAO.update(previousPlan.id, { status: 'superseded' });
    }
    const narrativePlan = await awaitNarrativePlan(
      narrativePlanPromise,
      narrativePlanTimeoutMs,
    );

    return apiSuccess(
      { data: { path, plan, narrativePlan } },
      201,
      { 'x-correlation-id': correlationId },
    );
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
