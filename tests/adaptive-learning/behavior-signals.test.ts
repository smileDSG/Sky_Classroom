import { describe, expect, it } from 'vitest';

import {
  learningEventSchema,
  type KnowledgeState,
} from '@/lib/adaptive-learning/contracts';
import { applyEventToState } from '@/lib/adaptive-learning/profile/knowledge-state-engine';

function state(): KnowledgeState {
  return {
    userId: 'student-1',
    nodeId: 'a-star',
    alpha: 2,
    beta: 2,
    mastery: 0.5,
    confidence: 0.2,
    retention: 1,
    reviewStabilityDays: 7,
    repeatedErrorCount: 0,
    evidenceCount: 1,
    version: 1,
  };
}

describe('behavior signals', () => {
  it('accepts replay signals but never treats them as negative mastery evidence', () => {
    const replay = learningEventSchema.parse({
      eventId: 'replay-1',
      userId: 'student-1',
      type: 'segment-replayed',
      occurredAt: '2026-08-01T00:00:00.000Z',
      source: 'playback',
      nodeIds: ['a-star'],
      evidenceQuality: 'inferred',
      payload: { replayCount: 3 },
      schemaVersion: '1.0.0',
    });

    expect(applyEventToState(state(), replay)).toEqual(state());
  });
});
