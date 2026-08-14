export type PersonalizationLabEventType =
  | 'answer-correct'
  | 'answer-incorrect'
  | 'review-success'
  | 'review-failure';

export interface PersonalizationLabEvent {
  type: PersonalizationLabEventType;
  occurredAt?: string;
}

export interface PersonalizationLabKnowledgeState {
  nodeId: string;
  displayName: string;
  alpha: number;
  beta: number;
  mastery: number;
  confidence: number;
  retention: number;
  stabilityDays: number;
  evidenceCount: number;
  repeatedErrorCount: number;
  lastEvidenceAt: string | null;
}

export type PersonalizationLabAction = 'diagnostic' | 'teach' | 'review' | 'quiz';
export type PersonalizationLabDifficulty = 'easy' | 'medium' | 'hard';

export interface PersonalizationLabDecision {
  action: PersonalizationLabAction;
  difficulty: PersonalizationLabDifficulty;
  format: 'worked-example' | 'diagram' | 'interactive';
  durationMinutes: number;
  topic: string;
  reasonCodes: string[];
  summary: string;
}

export interface PersonalizationLabState {
  sessionId: string;
  generatedAt: string;
  eventCount: number;
  knowledgeStates: PersonalizationLabKnowledgeState[];
  decision: PersonalizationLabDecision;
}

const NODE = {
  nodeId: 'derivative-definition',
  displayName: '导数定义',
};

const INITIAL_ALPHA = 1;
const INITIAL_BETA = 1;
const INITIAL_STABILITY_DAYS = 7;

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function buildKnowledgeState(now: string): PersonalizationLabKnowledgeState {
  return {
    nodeId: NODE.nodeId,
    displayName: NODE.displayName,
    alpha: INITIAL_ALPHA,
    beta: INITIAL_BETA,
    mastery: 0.5,
    confidence: 0,
    retention: 1,
    stabilityDays: INITIAL_STABILITY_DAYS,
    evidenceCount: 0,
    repeatedErrorCount: 0,
    lastEvidenceAt: null,
  };
}

function updateDerivedState(
  state: PersonalizationLabKnowledgeState,
  updates: Partial<PersonalizationLabKnowledgeState>,
): PersonalizationLabKnowledgeState {
  const next = { ...state, ...updates };
  const evidenceCount = next.evidenceCount;
  return {
    ...next,
    mastery: round(next.alpha / (next.alpha + next.beta)),
    confidence: round(1 - Math.exp(-evidenceCount / 4)),
    retention: round(clamp(next.retention)),
    stabilityDays: round(Math.max(1, next.stabilityDays)),
  };
}

export function createPersonalizationLabState(
  sessionId: string,
  now = new Date(),
): PersonalizationLabState {
  const generatedAt = now.toISOString();
  const knowledgeState = buildKnowledgeState(generatedAt);
  const state = {
    sessionId,
    generatedAt,
    eventCount: 0,
    knowledgeStates: [knowledgeState],
    decision: null as PersonalizationLabDecision | null,
  };
  return {
    ...state,
    decision: decidePersonalizationLab(state as PersonalizationLabState),
  };
}

export function decidePersonalizationLab(
  state: Pick<PersonalizationLabState, 'knowledgeStates'>,
): PersonalizationLabDecision {
  const knowledgeState = state.knowledgeStates[0];
  if (!knowledgeState) {
    return {
      action: 'diagnostic',
      difficulty: 'easy',
      format: 'worked-example',
      durationMinutes: 5,
      topic: NODE.displayName,
      reasonCodes: ['no-knowledge-point'],
      summary: '先做一次基础诊断，建立学习证据。',
    };
  }

  let action: PersonalizationLabAction;
  let reasonCodes: string[];
  let summary: string;

  if (knowledgeState.evidenceCount === 0) {
    action = 'diagnostic';
    reasonCodes = ['no-evidence'];
    summary = '还没有答题证据，先做一次基础诊断。';
  } else if (knowledgeState.confidence < 0.4) {
    action = 'diagnostic';
    reasonCodes = ['low-confidence'];
    summary = '已有少量证据，但判断还不稳定，继续诊断。';
  } else if (knowledgeState.mastery < 0.55) {
    action = 'teach';
    reasonCodes = ['low-mastery'];
    if (knowledgeState.repeatedErrorCount >= 2) reasonCodes.push('repeated-errors');
    summary = '掌握度偏低，先补充概念讲解。';
  } else if (knowledgeState.retention < 0.7) {
    action = 'review';
    reasonCodes = ['low-retention'];
    summary = '之前已经学会，但当前记忆度下降，安排复习。';
  } else {
    action = 'quiz';
    reasonCodes = ['stable-mastery'];
    summary = '当前掌握和记忆状态稳定，进入针对性练习。';
  }

  const difficulty: PersonalizationLabDifficulty =
    action === 'diagnostic' || action === 'teach'
      ? 'easy'
      : action === 'review'
        ? 'medium'
        : knowledgeState.mastery >= 0.8
          ? 'hard'
          : 'medium';

  return {
    action,
    difficulty,
    format: action === 'teach' ? 'diagram' : action === 'quiz' ? 'interactive' : 'worked-example',
    durationMinutes: action === 'diagnostic' ? 5 : action === 'teach' ? 10 : 12,
    topic: knowledgeState.displayName,
    reasonCodes,
    summary,
  };
}

export function applyPersonalizationLabEvent(
  state: PersonalizationLabState,
  event: PersonalizationLabEvent,
): PersonalizationLabState {
  const occurredAt = event.occurredAt ?? new Date().toISOString();
  const current = state.knowledgeStates[0] ?? buildKnowledgeState(occurredAt);
  const isCorrect = event.type === 'answer-correct';
  const isReviewSuccess = event.type === 'review-success';
  const evidenceWeight = isReviewSuccess || isCorrect ? 1 : 0.8;
  const next = updateDerivedState(current, {
    alpha: current.alpha + (isCorrect || isReviewSuccess ? evidenceWeight : 0),
    beta: current.beta + (!isCorrect && !isReviewSuccess ? evidenceWeight : 0),
    evidenceCount: current.evidenceCount + 1,
    repeatedErrorCount:
      event.type === 'answer-incorrect' || event.type === 'review-failure'
        ? current.repeatedErrorCount + 1
        : 0,
    retention: isReviewSuccess || isCorrect ? 1 : event.type === 'review-failure' ? 0.35 : 1,
    stabilityDays:
      isReviewSuccess || isCorrect ? current.stabilityDays * 1.25 : current.stabilityDays * 0.75,
    lastEvidenceAt: occurredAt,
  });
  const nextState = {
    ...state,
    generatedAt: occurredAt,
    eventCount: state.eventCount + 1,
    knowledgeStates: [next],
  };
  return {
    ...nextState,
    decision: decidePersonalizationLab(nextState),
  };
}
