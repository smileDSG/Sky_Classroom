import { describe, expect, it } from 'vitest';

import { getLearnerDecision } from '@/lib/adaptive-learning/decision/learner-decision';
import type { KnowledgeState } from '@/lib/adaptive-learning/contracts';

function state(overrides: Partial<KnowledgeState> = {}): KnowledgeState {
  return {
    userId: 'student-1',
    nodeId: 'functions-basic',
    displayName: '函数基础',
    alpha: 2,
    beta: 2,
    mastery: 0.5,
    confidence: 0,
    retention: 1,
    reviewStabilityDays: 7,
    repeatedErrorCount: 0,
    evidenceCount: 0,
    version: 1,
    ...overrides,
  };
}

describe('getLearnerDecision', () => {
  it('diagnoses when there is no evidence', () => {
    const decision = getLearnerDecision({ knowledgeStates: [state()] });
    expect(decision.action).toBe('diagnostic');
    expect(decision.reasonCodes).toContain('no-evidence');
    expect(decision.questionCount).toBe(3);
    expect(decision.explanationMode).toBe('immediate');
  });

  it('teaches low mastery and preserves topic', () => {
    const decision = getLearnerDecision({
      knowledgeStates: [
        state({ mastery: 0.3, confidence: 0.7, evidenceCount: 4, repeatedErrorCount: 2 }),
      ],
    });
    expect(decision.action).toBe('teach');
    expect(decision.topic).toBe('函数基础');
    expect(decision.reasonCodes).toEqual(['low-mastery', 'repeated-errors']);
  });

  it('reviews a mastered topic when current retention is low', () => {
    const decision = getLearnerDecision({
      now: new Date('2026-07-31T00:00:00.000Z'),
      knowledgeStates: [
        state({
          mastery: 0.85,
          confidence: 0.9,
          evidenceCount: 8,
          lastReviewedAt: '2026-07-20T00:00:00.000Z',
          reviewStabilityDays: 7,
        }),
      ],
    });
    expect(decision.action).toBe('review');
    expect(decision.reasonCodes).toContain('low-retention');
  });

  it('uses the newest evidence timestamp when calculating retention', () => {
    const decision = getLearnerDecision({
      now: new Date('2026-07-31T00:00:00.000Z'),
      knowledgeStates: [
        state({
          mastery: 0.8,
          confidence: 0.9,
          evidenceCount: 8,
          lastReviewedAt: '2026-07-01T00:00:00.000Z',
          lastEvidenceAt: '2026-07-30T00:00:00.000Z',
          reviewStabilityDays: 7,
        }),
      ],
    });
    expect(decision.action).toBe('quiz');
  });

  it('honors an explicit topic when it matches a known state', () => {
    const decision = getLearnerDecision({
      explicitTopic: '函数基础',
      knowledgeStates: [state({ displayName: '函数基础' })],
    });
    expect(decision.topic).toBe('函数基础');
    expect(decision.nodeId).toBe('functions-basic');
  });

  it('does not replace an unknown explicit topic with another weak point', () => {
    const decision = getLearnerDecision({
      explicitTopic: '概率论',
      knowledgeStates: [state({ displayName: '函数基础', mastery: 0.2, evidenceCount: 5 })],
    });
    expect(decision.action).toBe('diagnostic');
    expect(decision.topic).toBe('概率论');
    expect(decision.nodeId).toBeNull();
  });

  it('raises question count and makes explanations optional for stable mastery', () => {
    const decision = getLearnerDecision({
      knowledgeStates: [
        state({
          mastery: 0.88,
          confidence: 0.9,
          evidenceCount: 10,
          lastEvidenceAt: new Date().toISOString(),
        }),
      ],
    });
    expect(decision.action).toBe('quiz');
    expect(decision.questionCount).toBe(10);
    expect(decision.explanationMode).toBe('on-request');
  });
});
