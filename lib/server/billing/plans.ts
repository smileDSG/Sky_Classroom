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
    name: '免费版',
    price: 0,
    llmCallsPerDay: 100,
    generationsPerDay: 5,
    storageLimit: 1_073_741_824, // 1 GB
    features: ['基础 AI 功能', '本地存储', '社区支持'],
  },
  basic: {
    type: 'basic',
    name: '基础版',
    price: 29,
    llmCallsPerDay: 500,
    generationsPerDay: 20,
    storageLimit: 10_737_418_240, // 10 GB
    features: ['包含免费版全部功能', '云端同步', '优先支持', '每日 500 次 AI 调用'],
  },
  pro: {
    type: 'pro',
    name: '专业版',
    price: 99,
    llmCallsPerDay: 0, // unlimited
    generationsPerDay: 100,
    storageLimit: 53_687_091_200, // 50 GB
    features: ['包含基础版全部功能', 'AI 调用不限量', '高级数据分析', '自定义模板'],
  },
  enterprise: {
    type: 'enterprise',
    name: '企业版',
    price: 299,
    llmCallsPerDay: 0,
    generationsPerDay: 0,
    storageLimit: 0,
    features: ['包含专业版全部功能', '全部不限量', '专属客服支持', '自定义集成'],
  },
};

export function getPlanLimits(planType: PlanType): {
  llmCallsPerDay: number;
  generationsPerDay: number;
  storageLimit: number;
} {
  const plan = PLANS[planType];
  return {
    llmCallsPerDay: plan.llmCallsPerDay,
    generationsPerDay: plan.generationsPerDay,
    storageLimit: plan.storageLimit,
  };
}
