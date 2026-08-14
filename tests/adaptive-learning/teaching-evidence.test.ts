import { describe, expect, it } from 'vitest';

import { buildTeachingEvidence } from '@/lib/adaptive-learning/profile/teaching-evidence';
import type { KnowledgeState } from '@/lib/adaptive-learning/contracts';

function makeState(overrides: Partial<KnowledgeState>): KnowledgeState {
  return {
    userId: 'student-1',
    nodeId: 'functions-basic',
    alpha: 1,
    beta: 1,
    mastery: 0.5,
    confidence: 0.6,
    retention: 1,
    reviewStabilityDays: 7,
    repeatedErrorCount: 0,
    evidenceCount: 2,
    version: 1,
    ...overrides,
  };
}

describe('buildTeachingEvidence', () => {
  it('separates durable strengths from growth areas using mastery and retention', () => {
    const result = buildTeachingEvidence({
      states: [
        makeState({ nodeId: 'functions-basic', mastery: 0.9, confidence: 0.8 }),
        makeState({
          nodeId: 'derivative-concept',
          mastery: 0.45,
          confidence: 0.7,
          repeatedErrorCount: 2,
        }),
      ],
      eventWatermark: 8,
      now: new Date('2026-07-30T08:00:00.000Z'),
    });

    expect(result.knowledgeStatus).toBe('ready');
    expect(result.eventWatermark).toBe(8);
    expect(result.strengths[0]).toMatchObject({ nodeId: 'functions-basic', mastery: 0.9 });
    expect(result.growthAreas[0]).toMatchObject({ nodeId: 'derivative-concept', mastery: 0.45 });
    expect(result.growthAreas[0].reasonCodes).toContain('repeated-errors');
  });
});
