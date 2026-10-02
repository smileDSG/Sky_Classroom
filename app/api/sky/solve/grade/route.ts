/**
 * POST /api/sky/solve/grade
 * Grading endpoint: compares user answer with correct answer.
 */
import { gradeAnswer } from '@/lib/solve/grader';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import { requireAuth } from '@/lib/server/auth/helpers';
import { getRequiredServerStorage } from '@/lib/server/server-storage';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import type { ErrorType } from '@/lib/storage/dao/mistakes';
import type { MistakeCause } from '@/lib/solve/types';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { buildTeachingProjection } from '@/lib/adaptive-learning/profile/projection-builder';
import { recordAnswerSubmitted } from '@/lib/adaptive-learning/profile/event-recorder';
import { buildTeachingEvidence } from '@/lib/adaptive-learning/profile/teaching-evidence';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { recordMappedAnswerEvidence } from '@/lib/adaptive-learning/profile/quiz-evidence-recorder';
import { invalidateProfileCache } from '@/lib/student/profile-builder';
import { injectTeachingProjection } from '@/lib/assistant/context-injector';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import { adaptiveLearningApiError } from '@/lib/adaptive-learning/api-error';
import { getLearnerDecision } from '@/lib/adaptive-learning/decision/learner-decision';
import { safeErrorMessage } from '@/lib/server/sanitize-error';

const log = createLogger('API:SkySolveGrade');

/** Map grader's MistakeCause to DAO's ErrorType */
function mapCauseToErrorType(cause: MistakeCause): ErrorType {
  const map: Record<MistakeCause, ErrorType> = {
    'concept-unclear': 'concept',
    'calculation-error': 'calculation',
    misreading: 'reading',
    'method-wrong': 'reasoning',
    careless: 'careless',
    'format-error': 'careless',
  };
  return map[cause] ?? 'concept';
}

let _daoPromise: ReturnType<typeof createMistakeBookDAO> | null = null;
async function getMistakeDAO() {
  if (!_daoPromise) {
    try {
      const storage = await getRequiredServerStorage();
      _daoPromise = createMistakeBookDAO(storage);
    } catch (error) {
      _daoPromise = null;
      throw error;
    }
  }
  return _daoPromise;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const body = await req.json();
    const { problem, correctAnswer, userAnswer, stepByStep, knowledgePoints } = body;

    if (!problem || !correctAnswer || !userAnswer) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        '缺少必填字段: problem, correctAnswer, userAnswer',
      );
    }

    // Load authoritative learner profile for personalised grading
    const storage = await getRequiredServerStorage();
    const profileRepository = new LearnerProfileRepository(storage);
    const knowledgeStateDAO = createKnowledgeStateDAO(storage);
    const preferences = await profileRepository.getLatestPreferences(auth.user.id);
    if (!preferences) {
      const error = new AdaptiveLearningError({
        code: 'PROFILE_NOT_FOUND',
        message: 'Learner profile is required before grading',
        retryable: false,
        stage: 'solve-grade-profile-load',
      });
      return adaptiveLearningApiError(error, crypto.randomUUID());
    }

    const [knowledgeStates, learningEvents] = await Promise.all([
      knowledgeStateDAO.list(auth.user.id),
      profileRepository.listLearningEvents(auth.user.id),
    ]);
    const teachingEvidence = buildTeachingEvidence({
      states: knowledgeStates,
      eventWatermark: learningEvents.length,
    });

    const teachingProjection = buildTeachingProjection({
      userId: auth.user.id,
      snapshotId: `snapshot:${preferences.userId}:v${preferences.version}:w${teachingEvidence.eventWatermark}`,
      profileVersion: preferences.version,
      eventWatermark: teachingEvidence.eventWatermark,
      preferences,
      knowledgeStatus: teachingEvidence.knowledgeStatus,
      strengths: teachingEvidence.strengths,
      growthAreas: teachingEvidence.growthAreas,
    });
    const teachingProjectionText = injectTeachingProjection('', teachingProjection).trim();

    const steps: string[] | undefined = Array.isArray(stepByStep)
      ? stepByStep.map((s: { content?: string; text?: string }) => s?.content ?? s?.text ?? '')
      : undefined;

    const result = await gradeAnswer(
      problem,
      correctAnswer,
      userAnswer,
      steps,
      teachingProjectionText,
    );

    const evidenceLabels = Array.isArray(knowledgePoints)
      ? knowledgePoints.map(String).filter(Boolean)
      : [];
    const evidenceResult = await recordMappedAnswerEvidence(storage, {
      eventId: `solve-grade:${crypto.randomUUID()}`,
      userId: auth.user.id,
      source: 'solve-grade',
      labels: evidenceLabels,
      correct: result.isCorrect,
      occurredAt: new Date().toISOString(),
      evidenceQuality: 'verified',
    });
    let updatedKnowledgeStates = knowledgeStates;
    if (evidenceResult.updatedStates > 0) {
      await invalidateProfileCache(auth.user.id);
      updatedKnowledgeStates = await knowledgeStateDAO.list(auth.user.id);
    } else if (!evidenceResult.matchedNodes) {
      await recordAnswerSubmitted({
        storage,
        userId: auth.user.id,
        source: 'solve-grade',
        correct: result.isCorrect,
        knowledgePoints: evidenceLabels,
      });
    }

    const beforeByNodeId = new Map(knowledgeStates.map((state) => [state.nodeId, state]));
    const afterByNodeId = new Map(updatedKnowledgeStates.map((state) => [state.nodeId, state]));
    const profileImpact = evidenceResult.updatedNodeIds.flatMap((nodeId) => {
      const afterState = afterByNodeId.get(nodeId);
      if (!afterState) return [];
      const beforeState = beforeByNodeId.get(nodeId);
      return [
        {
          nodeId,
          displayName: afterState.displayName ?? nodeId,
          masteryBefore: beforeState?.mastery ?? null,
          masteryAfter: afterState.mastery,
          confidenceBefore: beforeState?.confidence ?? null,
          confidenceAfter: afterState.confidence,
          evidenceAdded: Math.max(0, afterState.evidenceCount - (beforeState?.evidenceCount ?? 0)),
          repeatedErrorCount: afterState.repeatedErrorCount,
        },
      ];
    });
    const nextDecision = getLearnerDecision({
      knowledgeStates: updatedKnowledgeStates,
      fallbackTopic: evidenceLabels[0] ?? null,
    });

    // 错误答案写入错题本（使用统一存储 DAO）
    if (!result.isCorrect) {
      try {
        const dao = await getMistakeDAO();
        await dao.add(auth.user.id, {
          id: `mistake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          problemText: problem,
          userAnswer,
          correctAnswer,
          errorType: mapCauseToErrorType(result.cause),
          errorExplanation: result.errorAnalysis,
          knowledgePoints: knowledgePoints ?? [],
          sourceSessionId: undefined,
        });
        log.info('批改结果已存入错题本');
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        log.error('错题本存储失败:', errMsg, e instanceof Error ? e.stack : '');
        return apiError(
          API_ERROR_CODES.INTERNAL_ERROR,
          500,
          `错题本存储失败: ${safeErrorMessage(e)}`,
        );
      }
    }

    return apiSuccess({
      ...result,
      evidence: {
        matchedNodes: evidenceResult.matchedNodes,
        updatedStates: evidenceResult.updatedStates,
        recordedEvent: evidenceResult.recordedEvent,
      },
      profileImpact,
      nextDecision,
    });
  } catch (err) {
    log.error('Grade API error:', err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '批改失败',
      err instanceof Error ? safeErrorMessage(err) : undefined,
    );
  }
}
