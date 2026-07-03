import type { ProfileSignal } from '@/lib/student/profile-signals';

export type ResourceInteractionAction = 'view' | 'favorite' | 'skip' | 'complete';

export interface ResourceInteractionInput {
  userId: string;
  resourceId: string;
  resourceType: string;
  action: ResourceInteractionAction;
  completionRate?: number;
  durationSeconds?: number;
  now?: number;
}

const SHORT_TERM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  markdown_lecture: 'lecture documents',
  ppt_outline: 'slides',
  mind_map: 'diagrams',
  quiz_bank: 'practice questions',
  code_case: 'code cases',
  video_script: 'videos',
};

function genSignalId(kind: string, now: number): string {
  return `resource_interaction_${kind}_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function resourceLabel(resourceType: string): string {
  return RESOURCE_TYPE_LABELS[resourceType] ?? resourceType;
}

function isPositivePreference(input: ResourceInteractionInput): boolean {
  if (input.action === 'favorite') return true;
  if (input.action !== 'complete') return false;
  return (input.completionRate ?? 1) >= 0.8;
}

export function resourceInteractionToProfileSignals(
  input: ResourceInteractionInput,
): ProfileSignal[] {
  const now = input.now ?? Date.now();
  const label = resourceLabel(input.resourceType);
  const signals: ProfileSignal[] = [];

  if (isPositivePreference(input)) {
    signals.push({
      id: genSignalId('resourcePreference', now),
      userId: input.userId,
      dimension: 'resourcePreference',
      value: [label],
      source: 'behavior',
      confidence: input.action === 'favorite' ? 0.84 : 0.76,
      evidence: [
        `${input.action} ${input.resourceId}`,
        `completionRate=${input.completionRate ?? 'unknown'}`,
      ],
      createdAt: now,
    });
  }

  const lowFit = input.action === 'skip' || (input.completionRate ?? 1) < 0.35;
  signals.push({
    id: genSignalId('currentLearningState', now),
    userId: input.userId,
    dimension: 'currentLearningState',
    value: lowFit
      ? `Resource ${input.resourceId} (${label}) was skipped or left early. Reduce this format for the next push.`
      : `Resource ${input.resourceId} (${label}) produced a positive engagement signal.`,
    source: 'behavior',
    confidence: lowFit ? 0.66 : 0.72,
    evidence: [
      `action=${input.action}`,
      `completionRate=${input.completionRate ?? 'unknown'}`,
      `durationSeconds=${input.durationSeconds ?? 'unknown'}`,
    ],
    createdAt: now,
    expiresAt: now + SHORT_TERM_TTL_MS,
  });

  return signals;
}
