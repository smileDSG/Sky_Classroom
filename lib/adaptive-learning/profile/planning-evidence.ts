import type {
  KnowledgeState,
  LearningEvent,
  PlanningProfileProjection,
} from '@/lib/adaptive-learning/contracts';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_TARGET_KNOWLEDGE = 12;

export interface BuildPlanningEvidenceInput {
  states: KnowledgeState[];
  events: LearningEvent[];
  now?: Date;
  targetNodeIds?: string[];
}

export interface PlanningEvidence {
  knowledgeStatus: 'ready' | 'no-evidence';
  targetKnowledge: PlanningProfileProjection['data']['targetKnowledge'];
  engagementSummary: PlanningProfileProjection['data']['engagementSummary'];
  eventWatermark: number;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function currentRetention(state: KnowledgeState, now: Date): number {
  if (!state.lastEvidenceAt) return state.retention;

  const elapsedDays = Math.max(
    0,
    (now.getTime() - new Date(state.lastEvidenceAt).getTime()) / MILLISECONDS_PER_DAY,
  );
  return Math.min(1, Math.exp(-elapsedDays / state.reviewStabilityDays));
}

function reasonCodes(state: KnowledgeState, retention: number): string[] {
  const reasons: string[] = [];
  if (state.mastery < 0.6) reasons.push('low-mastery');
  if (retention < 0.7) reasons.push('retention-risk');
  if (state.repeatedErrorCount >= 2) reasons.push('repeated-errors');
  if (state.confidence < 0.4) reasons.push('low-confidence');
  return reasons.length > 0 ? reasons : ['stable-evidence'];
}

export function buildPlanningEvidence(input: BuildPlanningEvidenceInput): PlanningEvidence {
  const now = input.now ?? new Date();
  const targetNodeIds = new Set(input.targetNodeIds ?? []);
  const targetKnowledge = input.states
    .map((state) => {
      const retention = currentRetention(state, now);
      const risk =
        (1 - state.mastery) * 0.55 +
        (1 - retention) * 0.3 +
        (1 - state.confidence) * 0.1 +
        Math.min(state.repeatedErrorCount, 5) * 0.05 +
        (targetNodeIds.has(state.nodeId) ? 1 : 0);

      return {
        signal: {
          nodeId: state.nodeId,
          ...(state.displayName ? { displayName: state.displayName } : {}),
          mastery: state.mastery,
          confidence: state.confidence,
          retention: round(retention),
          reviewStabilityDays: state.reviewStabilityDays,
          evidenceCount: state.evidenceCount,
          lastEvidenceAt: state.lastEvidenceAt,
          reasonCodes: reasonCodes(state, retention),
        },
        risk,
      };
    })
    .sort((left, right) => right.risk - left.risk)
    .slice(0, MAX_TARGET_KNOWLEDGE)
    .map(({ signal }) => signal);

  const cutoff = now.getTime() - 7 * MILLISECONDS_PER_DAY;
  const recentEvents = input.events.filter((event) => {
    const occurredAt = new Date(event.occurredAt).getTime();
    return occurredAt >= cutoff && occurredAt <= now.getTime() && event.type !== 'profile-updated';
  });
  const studyMinutes7d = recentEvents.reduce((total, event) => {
    const minutes = event.type === 'study-time-recorded' ? event.payload.minutes : undefined;
    return total + (Number.isInteger(minutes) && Number(minutes) > 0 ? Number(minutes) : 0);
  }, 0);
  const activeDays7d = new Set(recentEvents.map((event) => event.occurredAt.slice(0, 10))).size;

  return {
    knowledgeStatus: targetKnowledge.length > 0 ? 'ready' : 'no-evidence',
    targetKnowledge,
    engagementSummary: { studyMinutes7d, activeDays7d },
    eventWatermark: input.events.length,
  };
}
