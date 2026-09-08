import { z } from 'zod';

import type { KnowledgeState } from '@/lib/adaptive-learning/contracts';
import {
  interventionPlanSchema,
  type InterventionPlan,
} from '@/lib/adaptive-learning/data/intervention-decisions';
import type { LearnerDecision } from './learner-decision';
import type { ProviderId } from '@/lib/types/provider';

const counterfactualOutputSchema = z
  .object({
    plans: z.array(interventionPlanSchema).min(2).max(3),
  })
  .strict();

export interface CounterfactualDecision {
  stateSummary: string;
  plans: InterventionPlan[];
  selectedPlanId: string;
  fallbackUsed: boolean;
  modelId: string | null;
}

export interface CounterfactualInput {
  baseline: LearnerDecision;
  knowledgeStates: KnowledgeState[];
  reflection?: {
    hypotheses: Array<{ statement: string; confidence: number }>;
  } | null;
  explicitTopic?: string | null;
  modelRef?: string;
}

function scorePlan(plan: InterventionPlan, baseline: LearnerDecision): number {
  let score = 0;
  if (plan.action === baseline.action) score += 3;
  if (plan.topic === baseline.topic) score += 2;
  if (plan.difficulty === baseline.difficulty) score += 1;
  if (plan.risks?.length === 0) score += 1;
  if (plan.expectedEffects?.length) score += 1;
  return score;
}

function buildRulePlans(input: CounterfactualInput): InterventionPlan[] {
  const baseline = input.baseline;
  const topic = input.explicitTopic?.trim() || baseline.topic;
  const reason = baseline.reasonCodes;
  const plans: InterventionPlan[] = [
    {
      id: `counterfactual:baseline:${baseline.action}`,
      action: baseline.action,
      topic,
      difficulty: baseline.difficulty,
      format: baseline.format,
      expectedEffects: ['保持当前节奏，获得与基线可比较的结果'],
      risks: ['如果当前难度不合适，可能继续积累挫败感'],
      rationale: reason,
    },
    {
      id: 'counterfactual:scaffold-first',
      action: baseline.action === 'quiz' ? 'teach' : 'review',
      topic,
      difficulty: 'easy',
      format: 'worked-example',
      expectedEffects: ['先降低认知负担', '提高继续学习的可能性'],
      risks: ['推进速度可能变慢'],
      rationale: ['先搭脚手架，再观察结果'],
    },
    {
      id: 'counterfactual:targeted-practice',
      action: baseline.action === 'teach' ? 'quiz' : 'quiz',
      topic,
      difficulty: baseline.difficulty === 'easy' ? 'medium' : baseline.difficulty,
      format: 'interactive',
      expectedEffects: ['快速验证干预后是否能独立完成'],
      risks: ['若基础仍不稳，可能增加错误和退出风险'],
      rationale: ['用短测验验证假设，而不是直接假定有效'],
    },
  ];
  return plans.map((plan) => ({ ...plan, score: scorePlan(plan, baseline) }));
}

function filterPlans(plans: InterventionPlan[], input: CounterfactualInput): InterventionPlan[] {
  const topic = input.explicitTopic?.trim();
  const valid = plans.filter((plan) => {
    if (!plan.topic || !plan.action || !plan.difficulty || !plan.format) return false;
    return !topic || plan.topic.trim().toLocaleLowerCase() === topic.toLocaleLowerCase();
  });
  return valid.length >= 2 ? valid.slice(0, 3) : buildRulePlans(input);
}

async function tryLLMPlans(
  input: CounterfactualInput,
  fallback: InterventionPlan[],
): Promise<{ plans: InterventionPlan[]; modelId: string | null; fallbackUsed: boolean }> {
  if (!input.modelRef) return { plans: fallback, modelId: null, fallbackUsed: true };
  try {
    const { providerId, modelId } = parseModelRef(input.modelRef);
    const apiKey = process.env[`${providerId.toUpperCase()}_API_KEY`];
    if (!apiKey) return { plans: fallback, modelId: null, fallbackUsed: true };
    const [{ callLLM }, { getModel }] = await Promise.all([
      import('@/lib/ai/llm'),
      import('@/lib/ai/providers'),
    ]);
    const { model } = getModel({ providerId: providerId as ProviderId, modelId, apiKey });
    const result = await callLLM(
      {
        model,
        system:
          '你是学习干预推演器。输出2到3个JSON方案。expectedEffects和risks是预期，不是真实结果。主题必须保持用户指定主题。',
        prompt: JSON.stringify({
          baseline: input.baseline,
          state: input.knowledgeStates.map((state) => ({
            nodeId: state.nodeId,
            mastery: state.mastery,
            confidence: state.confidence,
            retention: state.retention,
            repeatedErrorCount: state.repeatedErrorCount,
          })),
          reflection: input.reflection ?? null,
          requiredShape:
            '{"plans":[{"id","action","topic","difficulty","format","expectedEffects","risks","rationale"}]}',
        }),
        temperature: 0.2,
        maxOutputTokens: 1800,
      },
      'counterfactual-decision',
      { retries: 1, timeoutMs: 20_000, validate: (text) => text.includes('plans') },
    );
    const parsed = counterfactualOutputSchema.safeParse(JSON.parse(result.text));
    if (!parsed.success) return { plans: fallback, modelId: null, fallbackUsed: true };
    const plans = filterPlans(parsed.data.plans, input).map((plan) => ({
      ...plan,
      score: scorePlan(plan, input.baseline),
    }));
    return { plans, modelId, fallbackUsed: false };
  } catch {
    return { plans: fallback, modelId: null, fallbackUsed: true };
  }
}

function parseModelRef(ref: string): { providerId: string; modelId: string } {
  const [providerId, ...rest] = ref.split(':');
  if (!providerId || rest.length === 0) throw new Error('Invalid model reference');
  return { providerId, modelId: rest.join(':') };
}

export async function generateCounterfactualDecision(
  input: CounterfactualInput,
): Promise<CounterfactualDecision> {
  const fallbackPlans = buildRulePlans(input);
  const generated = await tryLLMPlans(input, fallbackPlans);
  const plans = filterPlans(generated.plans, input);
  const selected =
    [...plans].sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0] ?? fallbackPlans[0];
  if (!selected) throw new Error('Counterfactual decision produced no plan');
  return {
    stateSummary: `基线动作 ${input.baseline.action}，目标 ${input.explicitTopic?.trim() || input.baseline.topic || '当前知识点'}`,
    plans,
    selectedPlanId: selected.id,
    fallbackUsed: generated.fallbackUsed,
    modelId: generated.modelId,
  };
}
