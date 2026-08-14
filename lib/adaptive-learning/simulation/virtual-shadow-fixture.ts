import type { LearningEvent } from '@/lib/adaptive-learning/contracts';
import type { InterventionDecision } from '@/lib/adaptive-learning/data/intervention-decisions';
import type { LearnerOutcome } from '@/lib/adaptive-learning/data/learner-outcomes';
import {
  simulateVirtualStudent,
  VIRTUAL_STUDENT_PROFILES,
  type SimulationRunResult,
} from './virtual-student';

export interface VirtualShadowFixture {
  source: 'simulation';
  runs: SimulationRunResult[];
  events: LearningEvent[];
  decisions: InterventionDecision[];
  outcomes: LearnerOutcome[];
}

function isoAt(index: number): string {
  return new Date(Date.UTC(2026, 0, 1, 0, index, 0)).toISOString();
}

function buildAnswerEvent(input: {
  index: number;
  userId: string;
  run: SimulationRunResult;
  decisionId: string;
  occurredAt: string;
}): LearningEvent {
  const itemId = `simulation-item-${input.index + 1}`;
  const correct = input.run.metrics.correctRate >= 0.5;
  return {
    eventId: `simulation-event-${input.index + 1}`,
    userId: input.userId,
    type: 'answer-submitted',
    occurredAt: input.occurredAt,
    source: 'virtual-student-shadow',
    nodeIds: [],
    evidenceQuality: 'verified',
    schemaVersion: '1.0.0',
    correlationId: input.decisionId,
    payload: {
      correct,
      itemId,
      itemVersion: 'simulation.v1',
      itemDifficulty: input.run.profileId === 'high-achiever' ? 0.7 : -0.2,
      dimensionId: `simulation:${input.run.profileId}`,
      contentHash: `simulation:${input.run.runId}:${itemId}`,
      generatorVersion: 'virtual-student.v1',
    },
  };
}

function buildShadowDecision(input: {
  index: number;
  userId: string;
  run: SimulationRunResult;
  decisionId: string;
  createdAt: string;
  useNewModel: boolean;
}): InterventionDecision {
  const plan = input.useNewModel
    ? { id: 'counterfactual:scaffold-first', action: 'teach' as const, topic: input.run.topic }
    : {
        id: `counterfactual:baseline:quiz`,
        action: 'quiz' as const,
        topic: input.run.topic,
      };
  return {
    decisionId: input.decisionId,
    userId: input.userId,
    sessionId: `simulation-session-${input.index + 1}`,
    stateSnapshot: { source: 'simulation', profileId: input.run.profileId },
    candidatePlans: [plan],
    selectedPlan: plan,
    fallbackUsed: !input.useNewModel,
    modelId: input.useNewModel ? 'simulation:counterfactual-v1' : null,
    correlationId: input.decisionId,
    createdAt: input.createdAt,
  };
}

function buildOutcome(input: {
  index: number;
  userId: string;
  run: SimulationRunResult;
  decisionId: string;
  startedAt: string;
  endedAt: string;
}): LearnerOutcome {
  const questionCount = Math.max(
    1,
    input.run.turns.filter((turn) => turn.actor === 'virtual-student' && turn.correct !== undefined)
      .length,
  );
  const correctCount = Math.round(input.run.metrics.correctRate * questionCount);
  return {
    outcomeId: `simulation-outcome-${input.index + 1}`,
    decisionId: input.decisionId,
    userId: input.userId,
    windowStart: input.startedAt,
    windowEnd: input.endedAt,
    correctCount,
    questionCount,
    correctRate: questionCount > 0 ? correctCount / questionCount : 0,
    hintsRequested: input.run.metrics.hintsRequested,
    durationSeconds: input.run.metrics.turns * 30,
    completed: input.run.completed,
    exited: input.run.exited,
    errorTypes: input.run.metrics.correctRate < 0.5 ? ['simulation-incorrect-answer'] : [],
    nextDecisionId: null,
    createdAt: input.endedAt,
  };
}

/** Build report-ready data in memory. Never persists simulation data. */
export function buildVirtualShadowFixture(
  input: {
    runCount?: number;
    seed?: number;
    topic?: string;
  } = {},
): VirtualShadowFixture {
  const runCount = Math.max(20, Math.min(100, input.runCount ?? 24));
  const topic = input.topic?.trim() || 'functions';
  const runs: SimulationRunResult[] = [];
  const events: LearningEvent[] = [];
  const decisions: InterventionDecision[] = [];
  const outcomes: LearnerOutcome[] = [];

  for (let index = 0; index < runCount; index += 1) {
    const profile = VIRTUAL_STUDENT_PROFILES[index % VIRTUAL_STUDENT_PROFILES.length]!;
    const run = simulateVirtualStudent({
      profile,
      topic,
      maxTurns: 8,
      seed: (input.seed ?? 1) + index,
    });
    const userId = `simulation-user:${profile.profileId}`;
    const decisionId = `simulation-decision-${index + 1}`;
    const startedAt = isoAt(index * 2);
    const endedAt = isoAt(index * 2 + 1);
    const useNewModel = index % 2 === 1;

    runs.push(run);
    decisions.push(
      buildShadowDecision({ index, userId, run, decisionId, createdAt: startedAt, useNewModel }),
    );
    events.push(buildAnswerEvent({ index, userId, run, decisionId, occurredAt: endedAt }));
    outcomes.push(buildOutcome({ index, userId, run, decisionId, startedAt, endedAt }));
  }

  return { source: 'simulation', runs, events, decisions, outcomes };
}
