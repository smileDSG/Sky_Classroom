import { describe, expect, it } from 'vitest';

import { buildPlanningEvidence } from '@/lib/adaptive-learning/profile/planning-evidence';
import type { KnowledgeState, LearningEvent } from '@/lib/adaptive-learning/contracts';

describe('buildPlanningEvidence', () => {
  it('projects retention risk and seven-day engagement from authoritative evidence', () => {
    const states: KnowledgeState[] = [
      {
        userId: 'student-1',
        nodeId: 'functions-basic',
        displayName: '函数基础',
        alpha: 2,
        beta: 3,
        mastery: 0.4,
        confidence: 0.55,
        retention: 1,
        reviewStabilityDays: 5,
        repeatedErrorCount: 2,
        lastEvidenceAt: '2026-07-20T08:00:00.000Z',
        lastReviewedAt: '2026-07-20T08:00:00.000Z',
        evidenceCount: 3,
        version: 3,
      },
    ];
    const events: LearningEvent[] = [
      {
        eventId: 'study-1',
        userId: 'student-1',
        type: 'study-time-recorded',
        occurredAt: '2026-07-29T08:00:00.000Z',
        source: 'study-timer',
        nodeIds: [],
        evidenceQuality: 'verified',
        payload: { minutes: 30 },
        schemaVersion: '1.0.0',
      },
      {
        eventId: 'answer-1',
        userId: 'student-1',
        type: 'answer-submitted',
        occurredAt: '2026-07-30T08:00:00.000Z',
        source: 'quiz',
        nodeIds: ['functions-basic'],
        evidenceQuality: 'verified',
        payload: { correct: false },
        schemaVersion: '1.0.0',
      },
    ];

    const result = buildPlanningEvidence({
      states,
      events,
      now: new Date('2026-07-30T08:00:00.000Z'),
    });

    expect(result.knowledgeStatus).toBe('ready');
    expect(result.eventWatermark).toBe(2);
    expect(result.engagementSummary).toEqual({ studyMinutes7d: 30, activeDays7d: 2 });
    expect(result.targetKnowledge[0]).toMatchObject({
      nodeId: 'functions-basic',
      displayName: '函数基础',
      mastery: 0.4,
      evidenceCount: 3,
    });
    expect(result.targetKnowledge[0].retention).toBeCloseTo(Math.exp(-2), 5);
    expect(result.targetKnowledge[0].reasonCodes).toEqual(
      expect.arrayContaining(['low-mastery', 'retention-risk', 'repeated-errors']),
    );
  });
});
