import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { promises as fs } from 'fs';
import path from 'path';
import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import { verifyAccessToken } from '@/lib/server/auth';
import { getServerStorage } from '@/lib/server/server-storage';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { createLearningPathDAO } from '@/lib/storage/dao/learning-paths';
import { createUserDAO } from '@/lib/storage/dao/users';
import { createQuizAttemptDAO } from '@/lib/student/quiz-attempts';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { getAbilityState } from '@/lib/adaptive-learning/profile/ability-state-repository';
import { GAOKAO_MATH_PACK_V1 } from '@/lib/adaptive-learning/curriculum/gaokao-math-v1';
import { buildDiagnosticCandidates } from '@/lib/adaptive-learning/profile/diagnostic-candidates';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { buildStudentProfile, invalidateProfileCache } from '@/lib/student/profile-builder';
import { ensureDemoLearningData } from '@/lib/demo/admin-mistake-seed';
import { createProfileSignalDAO } from '@/lib/student/profile-signals';
import { buildPersonalizationContext } from '@/lib/cloud-mind/personalization-context';
import { createLogger } from '@/lib/logger';
import {
  STUDENT_PROFILE_CACHE_VERSION,
  type ProfileCacheEntry,
  type StudentProfile,
} from '@/lib/student/profile-types';
import { getLearnerSupportSubjectIds } from '@/lib/onboarding/consumption';
import { getDueMemoryReviews } from '@/lib/cloud-mind/spaced-repetition';
import type { MemoryReviewRecord } from '@/lib/cloud-mind/types';
import { recordShadowDecision } from '@/lib/adaptive-learning/profile/event-recorder';
import { evaluateShadowRollout } from '@/lib/adaptive-learning/profile/shadow-rollout';
import { buildAbilityShadowReport } from '@/lib/adaptive-learning/profile/shadow-report-service';

const log = createLogger('API:CloudMindPersonalizationContext');
const DEMO_PROFILE_USER_ID = 'default-user';
const DEMO_FALLBACK_USER_IDS = new Set(['admin-default']);
const MEMORY_REVIEWS_TABLE = 'cloud_mind_memory_reviews';

async function resolveUserId(req: NextRequest): Promise<string> {
  const url = new URL(req.url);
  const queryUserId = url.searchParams.get('userId');
  if (queryUserId) return queryUserId;

  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token');
    if (!accessToken) return 'default-user';
    const payload = await verifyAccessToken(accessToken.value);
    return payload?.sub ?? 'default-user';
  } catch {
    return 'default-user';
  }
}

async function safeBuildProfile(userId: string): Promise<StudentProfile | null> {
  try {
    return await buildStudentProfile(userId);
  } catch (err) {
    log.warn('Profile unavailable for cloud mind personalization:', err);
    return null;
  }
}

function hasProfileLearningData(profile: StudentProfile | null): boolean {
  return (
    (profile?.totalQuestions ?? 0) > 0 ||
    Object.keys(profile?.masteryByKnowledge ?? {}).length > 0 ||
    (profile?.errorPatterns.length ?? 0) > 0
  );
}

function hydrateProfileDates(profile: StudentProfile): StudentProfile {
  return {
    ...profile,
    lastUpdated: new Date(profile.lastUpdated),
    errorPatterns: profile.errorPatterns.map((pattern) => ({
      ...pattern,
      lastOccurrence: new Date(pattern.lastOccurrence),
    })),
  };
}

async function readCachedDemoProfile(): Promise<StudentProfile | null> {
  try {
    const cachePath = path.join(
      process.cwd(),
      'data',
      'student-profiles',
      `${DEMO_PROFILE_USER_ID}.json`,
    );
    const raw = await fs.readFile(cachePath, 'utf-8');
    const entry = JSON.parse(raw) as ProfileCacheEntry;
    if (entry.cacheVersion !== STUDENT_PROFILE_CACHE_VERSION) return null;
    return hydrateProfileDates(entry.profile);
  } catch (err) {
    log.warn('Demo profile unavailable for cloud mind personalization:', err);
    return null;
  }
}

async function resolveProfile(userId: string): Promise<StudentProfile | null> {
  const profile = await safeBuildProfile(userId);
  if (hasProfileLearningData(profile) || !DEMO_FALLBACK_USER_IDS.has(userId)) {
    return profile;
  }

  const demoProfile = await readCachedDemoProfile();
  if (!demoProfile || !hasProfileLearningData(demoProfile)) return profile;

  return {
    ...demoProfile,
    userId,
  };
}

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    const storage = await getServerStorage();
    const demoSeed = await ensureDemoLearningData(userId, storage);
    if (demoSeed.changed) {
      await invalidateProfileCache(userId);
    }
    const mistakeDAO = createMistakeBookDAO(storage);
    const quizAttemptDAO = createQuizAttemptDAO(storage);
    const knowledgeStateDAO = createKnowledgeStateDAO(storage);
    const learningPathDAO = createLearningPathDAO(storage);
    const profileSignalDAO = createProfileSignalDAO(storage);
    const userDAO = await createUserDAO(storage);

    const [
      profile,
      mistakesResult,
      dueMistakes,
      recentAttempts,
      learningPath,
      profileSignals,
      user,
      knowledgeStates,
      abilityState,
      learningEvents,
      memoryReviewEntries,
    ] = await Promise.all([
      resolveProfile(userId),
      mistakeDAO.list(userId, { page: 1, pageSize: 50 }),
      mistakeDAO.getDueForReview(userId),
      quizAttemptDAO.list({ userId, recentDays: 14 }),
      learningPathDAO.getActiveByUser(userId),
      profileSignalDAO.listByUser(userId),
      userDAO.getById(userId),
      knowledgeStateDAO.list(userId),
      getAbilityState(storage, userId, 'math'),
      new LearnerProfileRepository(storage).listLearningEvents(userId),
      storage.getAll<MemoryReviewRecord>(
        MEMORY_REVIEWS_TABLE,
        (entry) => entry.data.userId === userId,
      ),
    ]);

    const diagnosticCandidates = buildDiagnosticCandidates({
      signals: learningEvents.flatMap((event) =>
        [
          'segment-replayed',
          'segment-paused',
          'dwell-recorded',
          'question-asked',
          'self-reported',
        ].includes(event.type)
          ? [
              {
                eventId: event.eventId,
                type: event.type as never,
                nodeIds: event.nodeIds,
                payload: event.payload,
              },
            ]
          : [],
      ),
      edges: GAOKAO_MATH_PACK_V1.nodes.flatMap((node) =>
        node.prerequisiteIds.map((from) => ({ from, to: node.id, relation: 'prerequisite' })),
      ),
    });

    const context = buildPersonalizationContext({
      userId,
      profile,
      mistakes: mistakesResult.items,
      dueMistakes,
      recentAttempts,
      learningPath,
      profileSignals,
      selfReportedWeakSubjects: user ? getLearnerSupportSubjectIds(user) : undefined,
      knowledgeStates,
      abilityTheta: abilityState?.theta,
      diagnosticCandidates,
      dueMemoryReviews: getDueMemoryReviews(memoryReviewEntries.map((entry) => entry.data)),
      useLearnerDecision: evaluateShadowRollout({
        userId,
        eligibleResponses: buildAbilityShadowReport(learningEvents).eligibleResponses,
        enabled: process.env.SHADOW_ROLLOUT_ENABLED === 'true',
        percentage: Number(process.env.SHADOW_ROLLOUT_PERCENTAGE ?? 0),
      }).enabled,
    });

    if (context.learnerDecision && context.shadowComparison) {
      await recordShadowDecision({
        storage,
        userId,
        source: 'cloud-mind-personalization',
        existingEvents: learningEvents,
        skipCacheInvalidation: true,
        comparison: {
          ...context.shadowComparison,
          topic: context.learnerDecision.topic,
          action: context.learnerDecision.action,
          profileVersion: context.learnerDecision.profileVersion,
          reasonCodes: context.learnerDecision.reasonCodes,
        },
      });
    }

    return apiSuccess({ data: context });
  } catch (err) {
    log.error('Cloud mind personalization context failed:', err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      'Cloud mind personalization context failed',
    );
  }
}
