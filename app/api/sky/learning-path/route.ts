/**
 * POST /api/sky/learning-path
 *
 * Generates a personalised learning path for the authenticated user based on
 * their learner preferences and domain profile. The planning projection is
 * built server-side; client-provided projections are ignored.
 */

import { NextRequest } from 'next/server';
import { createLogger } from '@/lib/logger';
import { requireAuth } from '@/lib/server/auth/helpers';
import { getRequiredServerStorage } from '@/lib/server/server-storage';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { buildPlanningProjection } from '@/lib/adaptive-learning/profile/projection-builder';
import { generateLearningPlan } from '@/lib/adaptive-learning/planning/learning-plan-service';
import { retrieveChunksForPlanning } from '@/lib/adaptive-learning/planning/retrieve-chunks';
import { generatePlanWithLLM } from '@/lib/adaptive-learning/planning/generate-plan';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import { adaptiveLearningApiError } from '@/lib/adaptive-learning/api-error';

const log = createLogger('API:SkyLearningPath');

export const maxDuration = 120;

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
