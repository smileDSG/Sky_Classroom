export const MIN_SHADOW_ROLLOUT_RESPONSES = 20;

export interface ShadowRolloutInput {
  userId: string;
  sessionId?: string | null;
  eligibleResponses: number;
  enabled?: boolean;
  percentage?: number;
}

export interface ShadowRolloutDecision {
  enabled: boolean;
  cohort: 'user' | 'session';
  bucket: number;
  percentage: number;
  reason: 'disabled' | 'insufficient-data' | 'outside-cohort' | 'eligible';
}

function stableBucket(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Deterministic canary gate. Default remains disabled until explicitly configured. */
export function evaluateShadowRollout(input: ShadowRolloutInput): ShadowRolloutDecision {
  const percentage = clampPercentage(input.percentage ?? 0);
  const cohort = input.sessionId ? 'session' : 'user';
  const bucket = stableBucket(`${input.userId}:${input.sessionId ?? 'user'}`);

  if (!input.enabled || percentage === 0) {
    return { enabled: false, cohort, bucket, percentage, reason: 'disabled' };
  }
  if (input.eligibleResponses < MIN_SHADOW_ROLLOUT_RESPONSES) {
    return { enabled: false, cohort, bucket, percentage, reason: 'insufficient-data' };
  }
  if (bucket >= percentage) {
    return { enabled: false, cohort, bucket, percentage, reason: 'outside-cohort' };
  }
  return { enabled: true, cohort, bucket, percentage, reason: 'eligible' };
}
