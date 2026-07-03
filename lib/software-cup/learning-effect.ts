import type { ProfileSignal } from '@/lib/student/profile-signals';

export interface PracticeResult {
  questionId: string;
  knowledgePoint: string;
  correct: boolean;
  errorTag?: string;
}

export type ResourceUsageAction = 'view' | 'favorite' | 'skip' | 'complete';

export interface ResourceUsageResult {
  resourceId: string;
  resourceType: string;
  action: ResourceUsageAction;
  completionRate?: number;
  durationSeconds?: number;
}

export interface LearningEffectSignalInput {
  userId: string;
  results: PracticeResult[];
  now?: number;
}

export interface LearningEffectReportInput {
  results: PracticeResult[];
  resourceUsage?: ResourceUsageResult[];
}

export interface MasteryDeltaItem {
  knowledgePoint: string;
  before: number;
  after: number;
  delta: number;
  reason: string;
}

export interface ResourceEffectivenessItem {
  resourceId: string;
  resourceType: string;
  action: ResourceUsageAction;
  effectScore: number;
  status: 'effective' | 'neutral' | 'mismatch';
  reason: string;
}

export interface LearningEffectReport {
  accuracy: number;
  total: number;
  correct: number;
  masteryDelta: MasteryDeltaItem[];
  resourceEffectiveness: ResourceEffectivenessItem[];
  profileChangePreview: {
    strongPoints: string[];
    weakPoints: string[];
    errorTags: string[];
  };
  nextResourceStrategy: string[];
  summary: string;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function genSignalId(dimension: string, now: number): string {
  return `learning_effect_${dimension}_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function evaluatePracticeResults(results: PracticeResult[]) {
  const total = Math.max(results.length, 1);
  const correct = results.filter((item) => item.correct).length;
  const accuracy = Math.round((correct / total) * 100);
  const strongPoints = unique(
    results.filter((item) => item.correct).map((item) => item.knowledgePoint),
  );
  const weakPoints = unique(
    results.filter((item) => !item.correct).map((item) => item.knowledgePoint),
  );
  const errorTags = unique(
    results.filter((item) => !item.correct).map((item) => item.errorTag || 'unclassified error'),
  );

  return {
    total,
    correct,
    accuracy,
    strongPoints,
    weakPoints,
    errorTags,
  };
}

function buildMasteryDelta(results: PracticeResult[]): MasteryDeltaItem[] {
  const mastery = new Map<
    string,
    { before: number; after: number; correct: number; wrong: number }
  >();

  for (const result of results) {
    const current = mastery.get(result.knowledgePoint) ?? {
      before: 50,
      after: 50,
      correct: 0,
      wrong: 0,
    };
    current.after = result.correct
      ? Math.min(100, current.after + 12)
      : Math.max(0, current.after - 18);
    current.correct += result.correct ? 1 : 0;
    current.wrong += result.correct ? 0 : 1;
    mastery.set(result.knowledgePoint, current);
  }

  return [...mastery.entries()].map(([knowledgePoint, item]) => ({
    knowledgePoint,
    before: item.before,
    after: item.after,
    delta: item.after - item.before,
    reason:
      item.wrong > 0
        ? `${item.wrong} incorrect answer(s) revealed an unstable concept boundary.`
        : `${item.correct} correct answer(s) show this point is ready for applied practice.`,
  }));
}

function scoreResourceUsage(usage: ResourceUsageResult): number {
  const completionScore = Math.round(Math.max(0, Math.min(1, usage.completionRate ?? 0)) * 70);
  const durationScore = Math.min(20, Math.round((usage.durationSeconds ?? 0) / 30));
  const actionBonus = usage.action === 'favorite' ? 20 : usage.action === 'complete' ? 12 : 0;
  const skipPenalty = usage.action === 'skip' ? 35 : 0;
  return Math.max(0, Math.min(100, completionScore + durationScore + actionBonus - skipPenalty));
}

function classifyResourceUsage(usage: ResourceUsageResult): ResourceEffectivenessItem {
  const effectScore = scoreResourceUsage(usage);
  const status: ResourceEffectivenessItem['status'] =
    usage.action === 'skip' || (usage.completionRate ?? 1) < 0.35
      ? 'mismatch'
      : effectScore >= 70
        ? 'effective'
        : 'neutral';

  return {
    resourceId: usage.resourceId,
    resourceType: usage.resourceType,
    action: usage.action,
    effectScore,
    status,
    reason:
      status === 'effective'
        ? 'The learner stayed with this resource or explicitly favored it.'
        : status === 'mismatch'
          ? 'The learner skipped or left early, so this format should be reduced next round.'
          : 'The resource produced a weak signal and should not dominate future recommendations.',
  };
}

export function buildLearningEffectReport(input: LearningEffectReportInput): LearningEffectReport {
  const summary = evaluatePracticeResults(input.results);
  const masteryDelta = buildMasteryDelta(input.results);
  const resourceEffectiveness = (input.resourceUsage ?? []).map(classifyResourceUsage);
  const nextResourceStrategy =
    summary.weakPoints.length > 0
      ? summary.weakPoints.map((point) => `push targeted review for ${point}`)
      : ['increase applied tasks for mastered points'];

  const mismatchedTypes = unique(
    resourceEffectiveness
      .filter((item) => item.status === 'mismatch')
      .map((item) => item.resourceType),
  );
  if (mismatchedTypes.length > 0) {
    nextResourceStrategy.push(`reduce ${mismatchedTypes.join(', ')} until engagement improves`);
  }

  return {
    accuracy: summary.accuracy,
    total: summary.total,
    correct: summary.correct,
    masteryDelta,
    resourceEffectiveness,
    profileChangePreview: {
      strongPoints: summary.strongPoints,
      weakPoints: summary.weakPoints,
      errorTags: summary.errorTags,
    },
    nextResourceStrategy,
    summary:
      summary.accuracy < 60
        ? 'Practice results indicate the next round should lower difficulty and focus on weak points.'
        : 'Practice results support moving into applied resources while preserving mistake review.',
  };
}

export function learningEffectToProfileSignals(input: LearningEffectSignalInput): ProfileSignal[] {
  const now = input.now ?? Date.now();
  const summary = evaluatePracticeResults(input.results);
  const signals: ProfileSignal[] = [];

  if (summary.strongPoints.length > 0 || summary.weakPoints.length > 0) {
    signals.push({
      id: genSignalId('knowledgeBase', now),
      userId: input.userId,
      dimension: 'knowledgeBase',
      value: {
        strongPoints: summary.strongPoints,
        weakPoints: summary.weakPoints,
      },
      source: 'quiz',
      confidence: summary.total > 1 ? 0.82 : 0.68,
      evidence: input.results.map(
        (result) =>
          `${result.questionId}: ${result.knowledgePoint} ${result.correct ? 'correct' : 'wrong'}`,
      ),
      createdAt: now,
    });
  }

  if (summary.errorTags.length > 0) {
    signals.push({
      id: genSignalId('errorPatternPreference', now),
      userId: input.userId,
      dimension: 'errorPatternPreference',
      value: summary.errorTags,
      source: 'quiz',
      confidence: 0.8,
      evidence: input.results
        .filter((result) => !result.correct)
        .map((result) => `${result.knowledgePoint}: ${result.errorTag || 'unclassified error'}`),
      createdAt: now,
    });
  }

  const state =
    summary.weakPoints.length > 0
      ? `Practice shows weak points in ${summary.weakPoints.join(', ')}. Recommend easier explanations and targeted review.`
      : `Practice accuracy is ${summary.accuracy}%. Ready for applied tasks and higher challenge.`;

  signals.push({
    id: genSignalId('currentLearningState', now),
    userId: input.userId,
    dimension: 'currentLearningState',
    value: state,
    source: 'quiz',
    confidence: 0.76,
    evidence: [`accuracy=${summary.accuracy}`, `total=${summary.total}`],
    createdAt: now,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000,
  });

  return signals;
}
