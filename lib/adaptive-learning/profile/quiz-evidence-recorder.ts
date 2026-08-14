import { getCurriculumPack } from '@/lib/adaptive-learning/curriculum/registry';
import type { LearningEvent } from '@/lib/adaptive-learning/contracts';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import type { StorageProvider } from '@/lib/storage/storage-types';
import type { QuizAttempt } from '@/lib/student/quiz-attempts';

import { recordFixedItemAbilityAnswer } from './ability-state-repository';
import { recordAnswerSubmitted } from './event-recorder';
import { updateKnowledgeStateFromAnswer } from './knowledge-state-updater';
import { LearnerProfileRepository } from './repository';

const CURRICULUM_PACK_ID = 'gaokao-math-2026.1';

export interface QuizEvidenceRecordResult {
  recordedEvents: number;
  updatedStates: number;
  skippedQuestions: number;
}

export interface MappedAnswerEvidenceInput {
  eventId: string;
  userId: string;
  source: string;
  labels: string[];
  correct: boolean;
  occurredAt: string;
  evidenceQuality: LearningEvent['evidenceQuality'];
  correlationId?: string;
  item?: {
    itemId: string;
    itemVersion: string;
    contentHash: string;
    generatorVersion: string;
    dimensionId: string;
    difficulty: number;
  };
}

export interface MappedAnswerEvidenceResult {
  matchedNodes: boolean;
  recordedEvent: boolean;
  duplicateEvent: boolean;
  updatedStates: number;
  updatedNodeIds: string[];
}

function normalizeLabel(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

function difficultyToLogit(difficulty: QuizAttempt['difficulty']): number {
  switch (difficulty) {
    case 'easy':
      return -0.7;
    case 'hard':
      return 0.7;
    default:
      return 0;
  }
}

function contentHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function fixedItemIdentity(attempt: QuizAttempt, question: QuizAttempt['questions'][number]) {
  const fingerprint = contentHash(
    JSON.stringify({
      question: question.question,
      options: question.options,
      answer: question.answer,
      knowledgePoints: question.knowledgePoints,
    }),
  );
  return {
    itemId: `quiz:${attempt.source}:${fingerprint}`,
    itemVersion: 'quiz-attempt.v1',
    contentHash: fingerprint,
    generatorVersion: attempt.source === 'ai' ? 'cloud-mind-ai.v1' : 'question-bank.v1',
  };
}

export async function recordMappedAnswerEvidence(
  storage: StorageProvider,
  input: MappedAnswerEvidenceInput,
): Promise<MappedAnswerEvidenceResult> {
  const pack = getCurriculumPack(CURRICULUM_PACK_ID);
  const nodeByLabel = new Map(
    pack.nodes.flatMap((node) =>
      [node.id, node.name, ...node.aliases].map((label) => [normalizeLabel(label), node] as const),
    ),
  );
  const nodes = [
    ...new Set(input.labels.map((label) => nodeByLabel.get(normalizeLabel(label)))),
  ].filter((node) => node !== undefined);
  if (nodes.length === 0) {
    return {
      matchedNodes: false,
      recordedEvent: false,
      duplicateEvent: false,
      updatedStates: 0,
      updatedNodeIds: [],
    };
  }

  const profileRepository = new LearnerProfileRepository(storage);
  const knowledgeStateDAO = createKnowledgeStateDAO(storage);
  const inserted = await profileRepository.appendLearningEvent({
    eventId: input.eventId,
    userId: input.userId,
    type: 'answer-submitted',
    occurredAt: input.occurredAt,
    source: input.source,
    nodeIds: nodes.map((node) => node.id),
    evidenceQuality: input.evidenceQuality,
    payload: {
      correct: input.correct,
      knowledgePoints: input.labels,
      ...(input.item
        ? {
            itemId: input.item.itemId,
            itemVersion: input.item.itemVersion,
            itemDifficulty: input.item.difficulty,
            dimensionId: input.item.dimensionId,
            contentHash: input.item.contentHash,
            generatorVersion: input.item.generatorVersion,
          }
        : {}),
    },
    schemaVersion: '1.0.0',
    correlationId: input.correlationId,
  });
  if (!inserted) {
    return {
      matchedNodes: true,
      recordedEvent: false,
      duplicateEvent: true,
      updatedStates: 0,
      updatedNodeIds: [],
    };
  }

  for (const node of nodes) {
    const previous = await knowledgeStateDAO.get(input.userId, node.id);
    const next = updateKnowledgeStateFromAnswer({
      userId: input.userId,
      nodeId: node.id,
      displayName: node.name,
      correct: input.correct,
      evidenceQuality: input.evidenceQuality,
      occurredAt: input.occurredAt,
      defaultStabilityDays: node.defaultStabilityDays,
      previous,
    });
    await knowledgeStateDAO.set(input.userId, next);
  }

  return {
    matchedNodes: true,
    recordedEvent: true,
    duplicateEvent: false,
    updatedStates: nodes.length,
    updatedNodeIds: nodes.map((node) => node.id),
  };
}

export async function recordQuizAttemptEvidence(
  storage: StorageProvider,
  attempt: QuizAttempt,
  options?: { source?: string },
): Promise<QuizEvidenceRecordResult> {
  if (attempt.subject !== 'math') {
    return { recordedEvents: 0, updatedStates: 0, skippedQuestions: attempt.questions.length };
  }

  const occurredAt = new Date(attempt.createdAt).toISOString();
  let recordedEvents = 0;
  let updatedStates = 0;
  let skippedQuestions = 0;

  for (const [questionIndex, question] of attempt.questions.entries()) {
    const labels = question.knowledgePoints.length > 0 ? question.knowledgePoints : [attempt.topic];
    const item = fixedItemIdentity(attempt, question);
    const result = await recordMappedAnswerEvidence(storage, {
      eventId: `quiz:${attempt.id}:${questionIndex}`,
      userId: attempt.userId,
      source: options?.source ?? 'cloud-mind-quiz',
      labels,
      correct: question.isCorrect,
      occurredAt,
      evidenceQuality: 'verified',
      correlationId: attempt.id,
      item: {
        ...item,
        dimensionId: attempt.subject,
        difficulty: difficultyToLogit(attempt.difficulty),
      },
    });
    if (!result.recordedEvent) {
      if (!result.matchedNodes) {
        const fallbackEvent = await recordAnswerSubmitted({
          storage,
          userId: attempt.userId,
          source: options?.source ?? 'cloud-mind-quiz',
          correct: question.isCorrect,
          knowledgePoints: labels,
          correlationId: attempt.id,
          item: {
            itemId: item.itemId,
            itemVersion: item.itemVersion,
            itemDifficulty: difficultyToLogit(attempt.difficulty),
            dimensionId: attempt.subject,
            contentHash: item.contentHash,
            generatorVersion: item.generatorVersion,
          },
        });
        if (fallbackEvent) {
          recordedEvents += 1;
          continue;
        }
      }
      skippedQuestions += 1;
      continue;
    }
    recordedEvents += 1;
    updatedStates += result.updatedStates;
    await recordFixedItemAbilityAnswer(storage, {
      userId: attempt.userId,
      dimensionId: attempt.subject,
      nodeIds: result.updatedNodeIds,
      difficulty: difficultyToLogit(attempt.difficulty),
      correct: question.isCorrect,
      occurredAt,
      ...item,
    });
  }

  return { recordedEvents, updatedStates, skippedQuestions };
}
