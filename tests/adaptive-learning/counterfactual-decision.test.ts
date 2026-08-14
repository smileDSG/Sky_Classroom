import { describe, expect, it } from 'vitest';

import type { KnowledgeState } from '@/lib/adaptive-learning/contracts';
import { generateCounterfactualDecision } from '@/lib/adaptive-learning/decision/counterfactual-decision';
import type { LearnerDecision } from '@/lib/adaptive-learning/decision/learner-decision';

const baseline: LearnerDecision = {
  action: 'quiz',
  topic: '函数',
  nodeId: 'functions-basic',
  difficulty: 'medium',
  format: 'interactive',
  durationMinutes: 12,
  questionCount: 5,
  explanationMode: 'on-request',
  reasonCodes: ['stable-mastery'],
  summary: '进入针对性练习',
  profileVersion: 1,
  eventWatermark: null,
};

const state: KnowledgeState = {
  userId: 'user-1',
  nodeId: 'functions-basic',
  displayName: '函数',
  alpha: 8,
  beta: 2,
  mastery: 0.8,
  confidence: 0.8,
  retention: 0.8,
  reviewStabilityDays: 7,
  repeatedErrorCount: 0,
  evidenceCount: 10,
  version: 1,
};

describe('counterfactual decision', () => {
  it('generates three rule candidates and selects a scored plan', async () => {
    const decision = await generateCounterfactualDecision({
      baseline,
      knowledgeStates: [state],
      explicitTopic: '函数',
    });

    expect(decision.fallbackUsed).toBe(true);
    expect(decision.plans).toHaveLength(3);
    expect(decision.plans.every((plan) => plan.topic === '函数')).toBe(true);
    expect(decision.plans.every((plan) => plan.expectedEffects && plan.risks)).toBe(true);
    expect(decision.selectedPlanId).toBe(decision.plans[0]?.id);
  });

  it('does not allow candidate generation to rewrite an explicit topic', async () => {
    const decision = await generateCounterfactualDecision({
      baseline,
      knowledgeStates: [state],
      explicitTopic: '概率',
    });

    expect(decision.plans.every((plan) => plan.topic === '概率')).toBe(true);
  });
});
