import type { KnowledgeState } from '@/lib/adaptive-learning/contracts';
import type { LearnerDecision } from '@/lib/adaptive-learning/decision/learner-decision';
import {
  canonicalizeKnowledgePoint,
  sameKnowledgePoint,
} from '@/lib/adaptive-learning/knowledge/knowledge-point-registry';

export interface TeachingKnowledgeImpact {
  knowledgePoint: string;
  masteryBefore: number | null;
  masteryAfter: number | null;
  confidenceBefore: number | null;
  confidenceAfter: number | null;
  evidenceCountBefore: number;
  evidenceCountAfter: number;
}

export interface TeachingProfileUpdate {
  recorded: boolean;
  evidenceType: 'verified-answer' | 'self-reported-feedback';
  changes: TeachingKnowledgeImpact[];
  learnerDecision: LearnerDecision;
}

function findState(states: KnowledgeState[], knowledgePoint: string): KnowledgeState | undefined {
  const normalized = knowledgePoint.trim().toLocaleLowerCase();
  return states.find(
    (state) =>
      state.nodeId.trim().toLocaleLowerCase() === normalized ||
      state.displayName?.trim().toLocaleLowerCase() === normalized ||
      sameKnowledgePoint(state.displayName ?? state.nodeId, knowledgePoint),
  );
}

export function buildTeachingKnowledgeImpacts(input: {
  knowledgePoints: string[];
  before: KnowledgeState[];
  after: KnowledgeState[];
}): TeachingKnowledgeImpact[] {
  const points = new Map(
    input.knowledgePoints.map((knowledgePoint) => {
      const canonical = canonicalizeKnowledgePoint(knowledgePoint);
      return [canonical.id, canonical.name] as const;
    }),
  );

  return [...points.values()].map((knowledgePoint) => {
    const before = findState(input.before, knowledgePoint);
    const after = findState(input.after, knowledgePoint);
    return {
      knowledgePoint,
      masteryBefore: before?.mastery ?? null,
      masteryAfter: after?.mastery ?? null,
      confidenceBefore: before?.confidence ?? null,
      confidenceAfter: after?.confidence ?? null,
      evidenceCountBefore: before?.evidenceCount ?? 0,
      evidenceCountAfter: after?.evidenceCount ?? 0,
    };
  });
}

export function getTeachingDecisionTarget(
  decision: LearnerDecision,
): { href: string; label: string } {
  const topic = decision.topic ? `?topic=${encodeURIComponent(decision.topic)}` : '';
  if (decision.action === 'teach') {
    return { href: `/sky/cloud-mind/teaching${topic}`, label: '继续补充讲解' };
  }
  if (decision.action === 'review') {
    return { href: `/sky/cloud-mind/memory${topic}`, label: '进入记忆复习' };
  }
  return {
    href: `/sky/cloud-mind/quiz${topic}`,
    label: decision.action === 'diagnostic' ? '做一道确认题' : '进入针对练习',
  };
}
