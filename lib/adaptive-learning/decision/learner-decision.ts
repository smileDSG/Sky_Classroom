import type { KnowledgeState } from '@/lib/adaptive-learning/contracts';
import type { DiagnosticCandidate } from '@/lib/adaptive-learning/profile/diagnostic-candidates';
import {
  canonicalizeKnowledgePoint,
  resolveKnowledgePoint,
} from '@/lib/adaptive-learning/knowledge/knowledge-point-registry';

export type LearnerDecisionAction = 'diagnostic' | 'teach' | 'review' | 'quiz';
export type LearnerDecisionDifficulty = 'easy' | 'medium' | 'hard';

export interface LearnerDecision {
  action: LearnerDecisionAction;
  topic: string | null;
  nodeId: string | null;
  difficulty: LearnerDecisionDifficulty;
  format: 'worked-example' | 'diagram' | 'interactive';
  durationMinutes: number;
  questionCount: number;
  explanationMode: 'immediate' | 'on-request';
  reasonCodes: string[];
  summary: string;
  profileVersion: number;
  eventWatermark: string | null;
}

export interface LearnerDecisionInput {
  knowledgeStates: KnowledgeState[];
  explicitTopic?: string | null;
  fallbackTopic?: string | null;
  now?: Date;
  /** Optional V1 ability estimate. Omitted keeps legacy decision behavior. */
  abilityTheta?: number;
  /** Behavior-derived candidates. They can only request diagnosis. */
  diagnosticCandidates?: DiagnosticCandidate[];
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function currentRetention(state: KnowledgeState, now: Date): number {
  const lastEvidenceAt = [state.lastReviewedAt, state.lastEvidenceAt]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  if (!lastEvidenceAt) return 1;
  const elapsedDays = Math.max(
    0,
    (now.getTime() - new Date(lastEvidenceAt).getTime()) / (24 * 60 * 60 * 1000),
  );
  return clamp(Math.exp(-elapsedDays / Math.max(1, state.reviewStabilityDays)));
}

function matchesTopic(state: KnowledgeState, topic: string): boolean {
  const normalized = topic.trim().toLocaleLowerCase();
  const directMatch = [state.nodeId, state.displayName]
    .filter(Boolean)
    .some((value) => value!.trim().toLocaleLowerCase() === normalized);
  if (directMatch) return true;

  const target = canonicalizeKnowledgePoint(topic);
  return stateIdentity(state).id === target.id;
}

function stateIdentity(state: KnowledgeState): { id: string; name: string } {
  if (state.displayName) {
    const point = canonicalizeKnowledgePoint(state.displayName);
    return { id: point.id, name: point.name };
  }
  const known = resolveKnowledgePoint(state.nodeId);
  return known ? { id: known.id, name: known.name } : { id: state.nodeId, name: state.nodeId };
}

function deduplicateStates(states: KnowledgeState[]): KnowledgeState[] {
  const byConcept = new Map<string, KnowledgeState>();
  for (const state of states) {
    const id = stateIdentity(state).id;
    const current = byConcept.get(id);
    const currentTime = new Date(current?.lastEvidenceAt ?? current?.lastReviewedAt ?? 0).getTime();
    const stateTime = new Date(state.lastEvidenceAt ?? state.lastReviewedAt ?? 0).getTime();
    if (
      !current ||
      state.evidenceCount > current.evidenceCount ||
      (state.evidenceCount === current.evidenceCount && stateTime > currentTime)
    ) {
      byConcept.set(id, state);
    }
  }
  return [...byConcept.values()];
}

function selectState(
  states: KnowledgeState[],
  explicitTopic?: string | null,
): KnowledgeState | null {
  const canonicalStates = deduplicateStates(states);
  if (explicitTopic) {
    const exact = canonicalStates.find((state) => matchesTopic(state, explicitTopic));
    return exact ?? null;
  }

  return (
    canonicalStates.sort((a, b) => {
      const aScore = a.evidenceCount === 0 ? -1 : Math.min(a.mastery, a.retention);
      const bScore = b.evidenceCount === 0 ? -1 : Math.min(b.mastery, b.retention);
      return aScore - bScore || b.repeatedErrorCount - a.repeatedErrorCount;
    })[0] ?? null
  );
}

export function getLearnerDecision(input: LearnerDecisionInput): LearnerDecision {
  const now = input.now ?? new Date();
  const selected = selectState(input.knowledgeStates, input.explicitTopic);
  const identity = selected ? stateIdentity(selected) : null;
  const rawTopic = input.explicitTopic ?? identity?.name ?? input.fallbackTopic ?? null;
  const topic = rawTopic ? (resolveKnowledgePoint(rawTopic)?.name ?? rawTopic) : null;
  const conceptId = identity?.id ?? (rawTopic ? resolveKnowledgePoint(rawTopic)?.id : null) ?? null;
  const profileVersion = input.knowledgeStates.reduce(
    (max, state) => Math.max(max, state.version),
    0,
  );
  const eventWatermark =
    input.knowledgeStates
      .map((state) => state.lastEvidenceAt ?? state.lastReviewedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

  if (!selected || selected.evidenceCount === 0) {
    return {
      action: 'diagnostic',
      topic,
      nodeId: conceptId,
      difficulty: 'easy',
      format: 'worked-example',
      durationMinutes: 5,
      questionCount: 3,
      explanationMode: 'immediate',
      reasonCodes: ['no-evidence'],
      summary: '没有足够答题证据，先做一次基础诊断。',
      profileVersion,
      eventWatermark,
    };
  }

  const diagnosticCandidate = input.diagnosticCandidates?.[0];
  if (!input.explicitTopic && diagnosticCandidate && diagnosticCandidate.suspicionScore >= 0.5) {
    return {
      action: 'diagnostic',
      topic: diagnosticCandidate.nodeId,
      nodeId: diagnosticCandidate.nodeId,
      difficulty: 'easy',
      format: 'worked-example',
      durationMinutes: 5,
      questionCount: 1,
      explanationMode: 'immediate',
      reasonCodes: ['behavior-diagnostic', ...diagnosticCandidate.reasonCodes],
      summary: '检测到需要确认的学习信号，先做一道针对性诊断题。',
      profileVersion,
      eventWatermark,
    };
  }

  const retention = currentRetention(selected, now);
  let action: LearnerDecisionAction;
  let reasonCodes: string[];
  let summary: string;

  if (selected.confidence < 0.4) {
    action = 'diagnostic';
    reasonCodes = ['low-confidence'];
    summary = '证据量还少，先继续诊断，避免过早判断。';
  } else if (selected.mastery < 0.55) {
    action = 'teach';
    reasonCodes = ['low-mastery'];
    if (selected.repeatedErrorCount >= 2) reasonCodes.push('repeated-errors');
    summary = '掌握度偏低，先补概念，再进入练习。';
  } else if (retention < 0.7) {
    action = 'review';
    reasonCodes = ['low-retention'];
    summary = '之前学会过，但当前记忆度下降，安排复习。';
  } else {
    action = 'quiz';
    reasonCodes = ['stable-mastery'];
    summary = '掌握度和记忆度稳定，进入针对性练习。';
  }

  const legacyDifficulty: LearnerDecisionDifficulty =
    action === 'diagnostic' || action === 'teach'
      ? 'easy'
      : action === 'review'
        ? 'medium'
        : selected.mastery >= 0.8
          ? 'hard'
          : 'medium';
  const difficulty: LearnerDecisionDifficulty =
    action === 'quiz' && input.abilityTheta !== undefined
      ? input.abilityTheta <= -0.5
        ? 'easy'
        : input.abilityTheta >= 0.5
          ? 'hard'
          : legacyDifficulty
      : legacyDifficulty;

  return {
    action,
    topic,
    nodeId: conceptId,
    difficulty,
    format: action === 'teach' ? 'diagram' : action === 'quiz' ? 'interactive' : 'worked-example',
    durationMinutes: action === 'diagnostic' ? 5 : action === 'teach' ? 10 : 12,
    questionCount:
      action === 'diagnostic' || action === 'teach'
        ? 3
        : action === 'review'
          ? 5
          : selected.mastery >= 0.8
            ? 10
            : 5,
    explanationMode: action === 'diagnostic' || action === 'teach' ? 'immediate' : 'on-request',
    reasonCodes,
    summary,
    profileVersion,
    eventWatermark,
  };
}
