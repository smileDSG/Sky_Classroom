import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildAbilityShadowReport } from '@/lib/adaptive-learning/profile/shadow-report-service';
import type { InterventionDecision } from '@/lib/adaptive-learning/data/intervention-decisions';
import type { LearnerOutcome } from '@/lib/adaptive-learning/data/learner-outcomes';

describe('ability shadow report service', () => {
  it('compares intervention outcomes by baseline versus new strategy', () => {
    const decisions: InterventionDecision[] = [
      {
        decisionId: 'baseline-1',
        userId: 'student-1',
        sessionId: 's1',
        stateSnapshot: {},
        candidatePlans: [],
        selectedPlan: { id: 'counterfactual:baseline:quiz', action: 'quiz' },
        fallbackUsed: true,
        modelId: null,
        correlationId: 'b1',
        createdAt: '2026-08-01T00:00:00.000Z',
      },
      {
        decisionId: 'new-1',
        userId: 'student-1',
        sessionId: 's2',
        stateSnapshot: {},
        candidatePlans: [],
        selectedPlan: { id: 'counterfactual:scaffold-first', action: 'teach' },
        fallbackUsed: false,
        modelId: 'mock:model',
        correlationId: 'n1',
        createdAt: '2026-08-01T00:01:00.000Z',
      },
    ];
    const makeOutcome = (decisionId: string, completed: boolean): LearnerOutcome => ({
      outcomeId: `outcome-${decisionId}`,
      decisionId,
      userId: 'student-1',
      windowStart: '2026-08-01T00:00:00.000Z',
      windowEnd: '2026-08-01T00:01:00.000Z',
      correctCount: completed ? 3 : 1,
      questionCount: 4,
      correctRate: completed ? 0.75 : 0.25,
      hintsRequested: completed ? 1 : 0,
      durationSeconds: 60,
      completed,
      exited: !completed,
      errorTypes: [],
      nextDecisionId: null,
      createdAt: '2026-08-01T00:01:00.000Z',
    });
    const report = buildAbilityShadowReport([], decisions, [
      makeOutcome('baseline-1', false),
      makeOutcome('new-1', true),
    ]);

    expect(report.outcomes).toMatchObject({
      status: 'insufficient-data',
      eligibleOutcomes: 2,
      baseline: { sessions: 1, completionRate: 0, exitRate: 1 },
      newModel: { sessions: 1, completionRate: 1, correctRate: 0.75 },
    });
  });

  it('uses only eligible verified answer events and reports when evidence is insufficient', () => {
    const report = buildAbilityShadowReport([
      {
        eventId: 'event-1',
        userId: 'student-1',
        type: 'answer-submitted',
        occurredAt: '2026-08-01T00:00:00.000Z',
        source: 'quiz',
        nodeIds: [],
        evidenceQuality: 'verified',
        schemaVersion: '1.0.0',
        payload: {
          correct: true,
          itemId: 'q-1',
          itemVersion: 'v1',
          itemDifficulty: -0.7,
          dimensionId: 'math',
          contentHash: 'h1',
          generatorVersion: 'bank',
        },
      },
      {
        eventId: 'event-2',
        userId: 'student-1',
        type: 'answer-submitted',
        occurredAt: '2026-08-01T00:01:00.000Z',
        source: 'quiz',
        nodeIds: [],
        evidenceQuality: 'inferred',
        schemaVersion: '1.0.0',
        payload: {
          correct: false,
          itemId: 'q-2',
          itemVersion: 'v1',
          itemDifficulty: 0.7,
          dimensionId: 'math',
          contentHash: 'h2',
          generatorVersion: 'bank',
        },
      },
      {
        eventId: 'event-3',
        userId: 'student-1',
        type: 'shadow-decision-recorded',
        occurredAt: '2026-08-01T00:02:00.000Z',
        source: 'cloud-mind-personalization',
        nodeIds: [],
        evidenceQuality: 'inferred',
        schemaVersion: '1.0.0',
        payload: {
          baselineTargetTool: 'quiz',
          newTargetTool: 'teaching',
          baselineHref: '/quiz',
          newHref: '/teaching',
          changed: true,
          topic: '函数基础',
          action: 'teach',
          profileVersion: 2,
          reasonCodes: ['low-mastery'],
        },
      },
    ]);

    expect(report.eligibleResponses).toBe(1);
    expect(report.skippedResponses).toBe(1);
    expect(report.status).toBe('insufficient-data');
    expect(report.decisions).toMatchObject({ recorded: 1, changed: 1, unchanged: 0 });
  });

  it('reaches the report threshold with the checked-in replay dataset', () => {
    const fixturePath = path.join(
      process.cwd(),
      'data/adaptive-learning/evaluation/ability-replay.v1.json',
    );
    const dataset = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
      responses: Array<{
        userId: string;
        dimensionId: string;
        itemId: string;
        difficulty: number;
        correct: boolean;
        occurredAt: string;
      }>;
    };
    const events = dataset.responses.map((response, index) => ({
      eventId: `dataset-${index}`,
      userId: response.userId,
      type: 'answer-submitted' as const,
      occurredAt: response.occurredAt,
      source: 'replay-dataset',
      nodeIds: [],
      evidenceQuality: 'verified' as const,
      schemaVersion: '1.0.0' as const,
      payload: {
        correct: response.correct,
        itemId: response.itemId,
        itemVersion: 'dataset.v1',
        itemDifficulty: response.difficulty,
        dimensionId: response.dimensionId,
        contentHash: `dataset:${response.itemId}`,
        generatorVersion: 'replay-dataset.v1',
      },
    }));

    const report = buildAbilityShadowReport(events);

    expect(report.status).toBe('ready');
    expect(report.eligibleResponses).toBe(dataset.responses.length);
    expect(report.report?.evaluatedResponses).toBe(dataset.responses.length);
  });
});
