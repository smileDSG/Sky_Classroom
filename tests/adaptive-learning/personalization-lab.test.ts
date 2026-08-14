import { describe, expect, it } from 'vitest';

import {
  applyPersonalizationLabEvent,
  createPersonalizationLabState,
  decidePersonalizationLab,
} from '@/lib/adaptive-learning/decision/personalization-lab';

describe('personalization lab decision', () => {
  it('starts with a diagnostic decision when no learning evidence exists', () => {
    const state = createPersonalizationLabState('demo-session');
    const decision = decidePersonalizationLab(state);

    expect(decision).toMatchObject({
      action: 'diagnostic',
      difficulty: 'easy',
    });
    expect(decision.reasonCodes).toContain('no-evidence');
  });

  it('switches from diagnosis to teaching after repeated incorrect answers', () => {
    let state = createPersonalizationLabState('repeated-errors');
    for (let index = 0; index < 3; index += 1) {
      state = applyPersonalizationLabEvent(state, { type: 'answer-incorrect' });
    }

    expect(state.decision.action).toBe('teach');
    expect(state.decision.reasonCodes).toContain('repeated-errors');
    expect(state.knowledgeStates[0]?.mastery).toBeLessThan(0.55);
    expect(state.knowledgeStates[0]?.confidence).toBeGreaterThan(0.4);
  });

  it('recommends review when mastery is strong but retention drops', () => {
    let state = createPersonalizationLabState('retention-risk');
    for (let index = 0; index < 5; index += 1) {
      state = applyPersonalizationLabEvent(state, { type: 'answer-correct' });
    }
    state = applyPersonalizationLabEvent(state, { type: 'review-failure' });

    expect(state.knowledgeStates[0]?.mastery).toBeGreaterThan(0.55);
    expect(state.knowledgeStates[0]?.retention).toBeLessThan(0.7);
    expect(state.decision).toMatchObject({ action: 'review', difficulty: 'medium' });
    expect(state.decision.reasonCodes).toContain('low-retention');
  });
});
