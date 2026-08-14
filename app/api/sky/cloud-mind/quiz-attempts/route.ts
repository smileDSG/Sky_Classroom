import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getServerStorage } from '@/lib/server/server-storage';
import { createQuizAttemptDAO } from '@/lib/student/quiz-attempts';
import {
  recordMappedAnswerEvidence,
  recordQuizAttemptEvidence,
} from '@/lib/adaptive-learning/profile/quiz-evidence-recorder';
import type { QuizAttemptInput, QuizAttemptQuestion } from '@/lib/student/quiz-attempts';
import type { Difficulty, Subject } from '@/lib/solve/agents/analyze-types';
import { recordAnswerSubmitted } from '@/lib/adaptive-learning/profile/event-recorder';
import { createLogger } from '@/lib/logger';
import { getJwtPayload } from '@/lib/server/auth/helpers';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { getLearnerDecision } from '@/lib/adaptive-learning/decision/learner-decision';

const log = createLogger('API:QuizAttempts');

const SUBJECTS = new Set<Subject>([
  'math',
  'physics',
  'chemistry',
  'biology',
  'chinese',
  'english',
  'history',
  'geography',
  'politics',
  'unknown',
]);
const DIFFICULTIES = new Set<Difficulty>(['easy', 'medium', 'hard']);

function normalizeSubject(value: unknown): Subject {
  return typeof value === 'string' && SUBJECTS.has(value as Subject)
    ? (value as Subject)
    : 'unknown';
}

function normalizeDifficulty(value: unknown): Difficulty {
  return typeof value === 'string' && DIFFICULTIES.has(value as Difficulty)
    ? (value as Difficulty)
    : 'medium';
}

function normalizeQuestions(rawQuestions: unknown): QuizAttemptQuestion[] {
  if (!Array.isArray(rawQuestions)) return [];
  return rawQuestions
    .map((raw): QuizAttemptQuestion | null => {
      const item = raw as Partial<QuizAttemptQuestion>;
      const answer = typeof item.answer === 'number' ? item.answer : Number(item.answer);
      const userAnswer =
        item.userAnswer === null || item.userAnswer === undefined
          ? null
          : typeof item.userAnswer === 'number'
            ? item.userAnswer
            : Number(item.userAnswer);
      const options = Array.isArray(item.options) ? item.options.map(String) : [];
      const knowledgePoints = Array.isArray(item.knowledgePoints)
        ? item.knowledgePoints.map(String).filter(Boolean)
        : [];

      if (!item.question || options.length === 0 || !Number.isInteger(answer)) return null;

      return {
        question: String(item.question),
        options,
        answer,
        userAnswer: Number.isInteger(userAnswer) ? userAnswer : null,
        isCorrect: Boolean(item.isCorrect),
        explanation: item.explanation ? String(item.explanation) : undefined,
        knowledgePoints,
      };
    })
    .filter((question): question is QuizAttemptQuestion => question !== null);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const auth = await getJwtPayload().catch(() => null);
    const userId = auth?.sub ?? (typeof body.userId === 'string' ? body.userId : 'default-user');
    const questions = normalizeQuestions(body.questions);
    if (questions.length === 0) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '缺少有效答题记录');
    }

    const input: QuizAttemptInput = {
      userId,
      subject: normalizeSubject(body.subject),
      difficulty: normalizeDifficulty(body.difficulty),
      topic: typeof body.topic === 'string' ? body.topic : '',
      source: body.source === 'bank' ? 'bank' : 'ai',
      questions,
    };

    const storage = await getServerStorage();
    const dao = createQuizAttemptDAO(storage);
    const attempt = await dao.add(input);
    const knowledgeStateDAO = createKnowledgeStateDAO(storage);
    const knowledgeStatesBefore = await knowledgeStateDAO.list(userId);
    // Record a learning event for every question so the profile can update
    // mastery per knowledge point in real time.
    let updatedNodeIds = new Set<string>();
    let evidence: {
      recordedEvents: number;
      updatedStates: number;
      skippedQuestions: number;
    };
    if (attempt.subject === 'math') {
      evidence = await recordQuizAttemptEvidence(storage, attempt, { source: 'quiz-attempts' });
    } else {
      const evidenceResults = await Promise.all(
        attempt.questions.map(async (question, index) => {
          const labels =
            question.knowledgePoints.length > 0
              ? question.knowledgePoints
              : [attempt.topic].filter(Boolean);
          try {
            const mapped = await recordMappedAnswerEvidence(storage, {
              eventId: `quiz:${attempt.id}:${index}`,
              userId: attempt.userId,
              source: 'cloud-mind-quiz',
              labels,
              correct: question.isCorrect,
              occurredAt: new Date(attempt.createdAt).toISOString(),
              evidenceQuality: 'verified',
              correlationId: attempt.id,
            });
            if (mapped.matchedNodes) {
              return {
                recorded: mapped.recordedEvent,
                updatedStates: mapped.updatedStates,
                updatedNodeIds: mapped.updatedNodeIds,
              };
            }
          } catch (err) {
            log.warn(`Failed to map quiz evidence for question ${index}:`, err);
          }

          const event = await recordAnswerSubmitted({
            storage,
            userId: attempt.userId,
            source: 'quiz-attempts',
            correct: question.isCorrect,
            knowledgePoints: labels,
            correlationId: attempt.id,
          });
          return { recorded: Boolean(event), updatedStates: event ? 1 : 0, updatedNodeIds: [] };
        }),
      );
      updatedNodeIds = new Set(evidenceResults.flatMap((result) => result.updatedNodeIds));
      const recordedEventCount = evidenceResults.filter((result) => result.recorded).length;
      evidence = {
        recordedEvents: recordedEventCount,
        updatedStates: evidenceResults.reduce((sum, result) => sum + result.updatedStates, 0),
        skippedQuestions: attempt.questions.length - recordedEventCount,
      };
    }
    const knowledgeStates = await knowledgeStateDAO.list(userId);
    const knowledgeStatesBeforeByNode = new Map(
      knowledgeStatesBefore.map((state) => [state.nodeId, state]),
    );
    const changedNodeIds = new Set(
      knowledgeStates
        .filter((state) => {
          const previous = knowledgeStatesBeforeByNode.get(state.nodeId);
          return !previous || state.version > previous.version;
        })
        .map((state) => state.nodeId),
    );
    const topicKey = attempt.topic.trim().toLocaleLowerCase();
    const relevantStates = knowledgeStates.filter(
      (state) =>
        updatedNodeIds.has(state.nodeId) ||
        changedNodeIds.has(state.nodeId) ||
        (topicKey.length > 0 && state.displayName?.trim().toLocaleLowerCase() === topicKey),
    );
    const profileImpact = relevantStates.map((state) => {
      const previous = knowledgeStatesBeforeByNode.get(state.nodeId);
      return {
        nodeId: state.nodeId,
        displayName: state.displayName ?? state.nodeId,
        masteryBefore: previous?.mastery ?? null,
        masteryAfter: state.mastery,
        confidenceBefore: previous?.confidence ?? null,
        confidenceAfter: state.confidence,
        evidenceAdded: Math.max(0, state.evidenceCount - (previous?.evidenceCount ?? 0)),
        repeatedErrorCount: state.repeatedErrorCount,
      };
    });
    const decision = getLearnerDecision({
      knowledgeStates: relevantStates,
      fallbackTopic: attempt.topic || null,
    });

    log.info(
      `Quiz attempt saved: ${attempt.id}, ${attempt.correct}/${attempt.total}, ` +
        `${evidence.updatedStates} knowledge states updated`,
    );
    return apiSuccess({ attempt, evidence, profileImpact, decision });
  } catch (err) {
    log.error('Save quiz attempt failed:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '答题成绩保存失败');
  }
}
