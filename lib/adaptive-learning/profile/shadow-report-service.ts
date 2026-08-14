import { z } from 'zod';

import type { LearningEvent } from '@/lib/adaptive-learning/contracts';

import { evaluateAbilityShadow, type AbilityShadowReport } from './shadow-evaluator';
import type { LearnerOutcome } from '@/lib/adaptive-learning/data/learner-outcomes';
import type { InterventionDecision } from '@/lib/adaptive-learning/data/intervention-decisions';

export const MIN_SHADOW_RESPONSES = 20;
export const MIN_SHADOW_OUTCOMES = 20;

const eligiblePayloadSchema = z
  .object({
    correct: z.boolean(),
    itemId: z.string().min(1),
    itemVersion: z.string().min(1),
    itemDifficulty: z.number().finite(),
    dimensionId: z.string().min(1),
    contentHash: z.string().min(1),
    generatorVersion: z.string().min(1),
  })
  .passthrough();

export interface AbilityShadowReportView {
  status: 'insufficient-data' | 'ready';
  eligibleResponses: number;
  skippedResponses: number;
  minimumResponses: number;
  behavior: {
    replayEvents: number;
    replayCount: number;
    mappedReplayEvents: number;
    pauseEvents: number;
    dwellEvents: number;
    questionEvents: number;
    selfReportedEvents: number;
    latestReplayAt?: string;
  };
  decisions: {
    recorded: number;
    changed: number;
    unchanged: number;
    latestAt?: string;
  };
  outcomes: InterventionOutcomeReportView;
  report: AbilityShadowReport | null;
}

export interface InterventionOutcomeMetrics {
  sessions: number;
  completionRate: number;
  correctRate: number;
  hintRequestRate: number;
  exitRate: number;
}

export interface InterventionOutcomeReportView {
  status: 'insufficient-data' | 'ready';
  eligibleOutcomes: number;
  minimumOutcomes: number;
  overall: InterventionOutcomeMetrics;
  baseline: InterventionOutcomeMetrics;
  newModel: InterventionOutcomeMetrics;
}

function roundMetric(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function outcomeMetrics(outcomes: LearnerOutcome[]): InterventionOutcomeMetrics {
  if (outcomes.length === 0) {
    return { sessions: 0, completionRate: 0, correctRate: 0, hintRequestRate: 0, exitRate: 0 };
  }
  return {
    sessions: outcomes.length,
    completionRate: roundMetric(
      outcomes.filter((outcome) => outcome.completed).length / outcomes.length,
    ),
    correctRate: roundMetric(
      outcomes.reduce((total, outcome) => total + outcome.correctRate, 0) / outcomes.length,
    ),
    hintRequestRate: roundMetric(
      outcomes.filter((outcome) => outcome.hintsRequested > 0).length / outcomes.length,
    ),
    exitRate: roundMetric(outcomes.filter((outcome) => outcome.exited).length / outcomes.length),
  };
}

function interventionStrategy(decision: InterventionDecision | undefined): 'baseline' | 'new' {
  const planId = decision?.selectedPlan?.id ?? '';
  return planId.startsWith('counterfactual:') && !planId.startsWith('counterfactual:baseline:')
    ? 'new'
    : 'baseline';
}

function buildOutcomeReport(
  decisionRecords: InterventionDecision[],
  outcomes: LearnerOutcome[],
): InterventionOutcomeReportView {
  const decisionsById = new Map(decisionRecords.map((decision) => [decision.decisionId, decision]));
  const eligible = outcomes.filter((outcome) => {
    const decision = decisionsById.get(outcome.decisionId);
    return decision?.userId === outcome.userId;
  });
  const baseline = eligible.filter(
    (outcome) => interventionStrategy(decisionsById.get(outcome.decisionId)) === 'baseline',
  );
  const newModel = eligible.filter(
    (outcome) => interventionStrategy(decisionsById.get(outcome.decisionId)) === 'new',
  );
  return {
    status: eligible.length >= MIN_SHADOW_OUTCOMES ? 'ready' : 'insufficient-data',
    eligibleOutcomes: eligible.length,
    minimumOutcomes: MIN_SHADOW_OUTCOMES,
    overall: outcomeMetrics(eligible),
    baseline: outcomeMetrics(baseline),
    newModel: outcomeMetrics(newModel),
  };
}

export function buildAbilityShadowReport(
  events: LearningEvent[],
  decisionRecords: InterventionDecision[] = [],
  outcomes: LearnerOutcome[] = [],
): AbilityShadowReportView {
  const replayEvents = events.filter((event) => event.type === 'segment-replayed');
  const behavior = {
    replayEvents: replayEvents.length,
    replayCount: replayEvents.reduce(
      (total, event) => total + Number(event.payload.replayCount ?? 0),
      0,
    ),
    mappedReplayEvents: replayEvents.filter((event) => event.nodeIds.length > 0).length,
    pauseEvents: events.filter((event) => event.type === 'segment-paused').length,
    dwellEvents: events.filter((event) => event.type === 'dwell-recorded').length,
    questionEvents: events.filter((event) => event.type === 'question-asked').length,
    selfReportedEvents: events.filter((event) => event.type === 'self-reported').length,
    latestReplayAt: replayEvents.at(-1)?.occurredAt,
  };
  const decisionEvents = events.filter((event) => event.type === 'shadow-decision-recorded');
  const changedDecisions = decisionEvents.filter((event) => event.payload.changed === true);
  const decisions = {
    recorded: decisionEvents.length,
    changed: changedDecisions.length,
    unchanged: decisionEvents.length - changedDecisions.length,
    latestAt: decisionEvents.at(-1)?.occurredAt,
  };
  const responses = events.flatMap((event) => {
    if (event.type !== 'answer-submitted' || event.evidenceQuality !== 'verified') return [];
    const payload = eligiblePayloadSchema.safeParse(event.payload);
    if (!payload.success) return [];
    return [
      {
        userId: event.userId,
        dimensionId: payload.data.dimensionId,
        itemId: payload.data.itemId,
        difficulty: payload.data.itemDifficulty,
        correct: payload.data.correct,
        occurredAt: event.occurredAt,
      },
    ];
  });
  const eligibleResponses = responses.length;
  const skippedResponses =
    events.filter((event) => event.type === 'answer-submitted').length - eligibleResponses;

  if (eligibleResponses < MIN_SHADOW_RESPONSES) {
    return {
      status: 'insufficient-data',
      eligibleResponses,
      skippedResponses,
      minimumResponses: MIN_SHADOW_RESPONSES,
      behavior,
      decisions,
      outcomes: buildOutcomeReport(decisionRecords, outcomes),
      report: null,
    };
  }

  return {
    status: 'ready',
    eligibleResponses,
    skippedResponses,
    minimumResponses: MIN_SHADOW_RESPONSES,
    behavior,
    decisions,
    outcomes: buildOutcomeReport(decisionRecords, outcomes),
    report: evaluateAbilityShadow(responses),
  };
}
