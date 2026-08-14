import { describe, expect, it } from 'vitest';

import {
  evaluateShadowRollout,
  MIN_SHADOW_ROLLOUT_RESPONSES,
} from '@/lib/adaptive-learning/profile/shadow-rollout';

describe('shadow rollout gate', () => {
  it('is disabled by default and before evidence threshold', () => {
    expect(
      evaluateShadowRollout({ userId: 'u1', eligibleResponses: MIN_SHADOW_ROLLOUT_RESPONSES }),
    ).toMatchObject({ enabled: false, reason: 'disabled' });
    expect(
      evaluateShadowRollout({
        userId: 'u1',
        eligibleResponses: MIN_SHADOW_ROLLOUT_RESPONSES - 1,
        enabled: true,
        percentage: 100,
      }),
    ).toMatchObject({ enabled: false, reason: 'insufficient-data' });
  });

  it('uses stable user or session cohort assignment', () => {
    const input = { userId: 'u1', eligibleResponses: 20, enabled: true, percentage: 100 };
    expect(evaluateShadowRollout(input)).toEqual(evaluateShadowRollout(input));
    expect(evaluateShadowRollout({ ...input, sessionId: 's1' }).cohort).toBe('session');
    expect(evaluateShadowRollout({ ...input, percentage: 0 })).toMatchObject({
      enabled: false,
      reason: 'disabled',
    });
  });

  it('never enables users outside configured percentage', () => {
    const decision = evaluateShadowRollout({
      userId: 'u1',
      eligibleResponses: 20,
      enabled: true,
      percentage: 1,
    });
    expect(decision.enabled).toBe(decision.bucket < 1);
    expect(['eligible', 'outside-cohort']).toContain(decision.reason);
  });
});
