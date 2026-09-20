import { BarChart3, BookOpenCheck, Network, ShieldCheck } from 'lucide-react';

export const LEARNING_FEATURES = [
  {
    key: 'mistakes',
    label: '错题本',
    desc: '查看错因、题目样本和闭环状态',
    href: '/sky/learning/mistakes',
    icon: BookOpenCheck,
  },
  {
    key: 'graph',
    label: '知识地图',
    desc: '定位薄弱知识点和先修关系',
    href: '/sky/learning/graph',
    icon: Network,
  },
  {
    key: 'stats',
    label: '学习统计',
    desc: '查看学习趋势、错因分布和掌握情况',
    href: '/sky/learning/stats',
    icon: BarChart3,
  },
  {
    key: 'profile',
    label: '学习分析',
    desc: '生成学习情况和个性建议',
    href: '/sky/learning/profile?from=learning',
    icon: ShieldCheck,
  },
] as const;

export type LearningFeatureKey = (typeof LEARNING_FEATURES)[number]['key'];

export function isLearningFeatureKey(value: string | null): value is LearningFeatureKey {
  return LEARNING_FEATURES.some((feature) => feature.key === value);
}

export function getLearningFeatureHref(key: LearningFeatureKey): string {
  return LEARNING_FEATURES.find((feature) => feature.key === key)?.href ?? '/sky/learning';
}
