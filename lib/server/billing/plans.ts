/**
 * Plan definitions and limit configurations.
 */

export type PlanType = 'free' | 'basic' | 'pro' | 'enterprise';

export interface PlanDefinition {
  type: PlanType;
  name: string;
  price: number; // CNY
  llmCallsPerDay: number; // 0 = unlimited
  generationsPerDay: number; // 0 = unlimited
  storageLimit: number; // bytes, 0 = unlimited
  features: string[];
}

export const PLANS: Record<PlanType, PlanDefinition> = {
  free: {
    type: 'free',
    name: 'Free',
    price: 0,
    llmCallsPerDay: 100,
    generationsPerDay: 5,
    storageLimit: 1_073_741_824, // 1 GB
    features: ['Basic AI features', 'Local storage', 'Community support'],
  },
  basic: {
    type: 'basic',
    name: 'Basic',
    price: 29,
    llmCallsPerDay: 500,
    generationsPerDay: 20,
    storageLimit: 10_737_418_240, // 10 GB
    features: ['All Free features', 'Cloud sync', 'Priority support', '500 AI calls/day'],
  },
  pro: {
    type: 'pro',
    name: 'Pro',
    price: 99,
    llmCallsPerDay: 0, // unlimited
    generationsPerDay: 100,
    storageLimit: 53_687_091_200, // 50 GB
    features: ['All Basic features', 'Unlimited AI calls', 'Advanced analytics', 'Custom templates'],
  },
  enterprise: {
    type: 'enterprise',
    name: 'Enterprise',
    price: 299,
    llmCallsPerDay: 0,
    generationsPerDay: 0,
    storageLimit: 0,
    features: ['All Pro features', 'Unlimited everything', 'Dedicated support', 'Custom integrations'],
  },
};

export function getPlanLimits(planType: PlanType): { llmCallsPerDay: number; generationsPerDay: number; storageLimit: number } {
  const plan = PLANS[planType];
  return {
    llmCallsPerDay: plan.llmCallsPerDay,
    generationsPerDay: plan.generationsPerDay,
    storageLimit: plan.storageLimit,
  };
}
