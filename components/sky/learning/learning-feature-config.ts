import { BarChart3, BookOpenCheck, CalendarClock, Network, ShieldCheck } from 'lucide-react';

export const LEARNING_FEATURES = [
  {
    key: 'mistakes',
    label: '错题本',
    desc: '查看错因、题目样本和闭环状态',
    href: '/sky/learning/mistakes',
    icon: BookOpenCheck,
  },
  {
    key: 'review',
    label: '复习计划',
    desc: '处理到期复习，沉淀长期记忆',
    href: '/sky/learning/review',
    icon: CalendarClock,
  },
  {
    key: 'graph',
    label: '知识图谱',
    desc: '定位薄弱知识点和先修关系',
    href: '/sky/learning/graph',
    icon: Network,
  },
  {
    key: 'stats',
    label: '学习统计',
    desc: '查看学习趋势、错因分布和掌握度',
    href: '/sky/learning/stats',
    icon: BarChart3,
  },
  {
    key: 'profile',
    label: '学情分析',
    desc: '生成多维能力画像和个性建议',
    href: '/sky/learning/profile',
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
