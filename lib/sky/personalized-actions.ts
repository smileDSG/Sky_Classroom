import { buildKnowledgeGraph } from '@/lib/knowledge-graph';
import type { MistakeRecord } from '@/lib/mistakes/types';

export type PersonalizedActionId = 'review' | 'quiz' | 'memory' | 'teaching' | 'solve';

export interface PersonalizedAction {
  id: PersonalizedActionId;
  label: string;
  description: string;
  href: string;
}

export interface PersonalizedActionPlan {
  hasSignals: boolean;
  primaryTopic: string;
  primaryReason: string;
  weakPoints: string[];
  dueReviewCount: number;
  reviewBacklogCount: number;
  actions: PersonalizedAction[];
}

const DEFAULT_TOPIC = '综合诊断';

function isReviewDue(mistake: MistakeRecord, now = Date.now()): boolean {
  if (mistake.reviewed) return false;
  if (typeof mistake.nextReview === 'number') return mistake.nextReview <= now;
  return true;
}

function getMostFrequentKnowledgePoint(mistakes: MistakeRecord[]): string | null {
  const counts = new Map<string, number>();
  for (const mistake of mistakes) {
    for (const point of mistake.knowledgePoints) {
      counts.set(point, (counts.get(point) ?? 0) + 1);
    }
  }

  return [...counts.entries()].sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
}

function buildMemoryHref(topic: string, weakPoints: string[]): string {
  const content =
    weakPoints.length > 0
      ? weakPoints.map((point) => `知识点：${point}`).join('\n')
      : `围绕「${topic}」整理核心概念、易错点和解题提醒。`;

  return `/sky/cloud-mind/memory?topic=${encodeURIComponent(topic)}&content=${encodeURIComponent(content)}`;
}

export function buildPersonalizedActionPlan(mistakes: MistakeRecord[]): PersonalizedActionPlan {
  const graph = mistakes.length > 0 ? buildKnowledgeGraph(mistakes) : null;
  const weakPoints = graph?.weakPoints.slice(0, 5) ?? [];
  const primaryTopic = weakPoints[0] ?? getMostFrequentKnowledgePoint(mistakes) ?? DEFAULT_TOPIC;
  const dueReviewCount = mistakes.filter((mistake) => isReviewDue(mistake)).length;
  const reviewBacklogCount = mistakes.filter((mistake) => !mistake.reviewed).length;
  const hasSignals = mistakes.length > 0 || weakPoints.length > 0 || dueReviewCount > 0;

  const primaryReason =
    dueReviewCount > 0
      ? `${dueReviewCount} 道错题需要复习`
      : weakPoints.length > 0
        ? `薄弱点集中在 ${weakPoints.slice(0, 2).join('、')}`
        : mistakes.length > 0
          ? '已有错题记录，可以继续巩固'
          : '先完成一次诊断，系统会开始建立画像';

  const quizHref = `/sky/cloud-mind/quiz?topic=${encodeURIComponent(primaryTopic)}`;
  const teachingHref = `/sky/cloud-mind/teaching?topic=${encodeURIComponent(primaryTopic)}`;

  return {
    hasSignals,
    primaryTopic,
    primaryReason,
    weakPoints,
    dueReviewCount,
    reviewBacklogCount,
    actions: [
      {
        id: 'review',
        label: '复习待办',
        description: dueReviewCount > 0 ? `处理 ${dueReviewCount} 道到期错题` : '查看复习节奏',
        href: '/sky/cloud-mind/memory',
      },
      {
        id: 'quiz',
        label: '针对出题',
        description: `围绕 ${primaryTopic} 生成练习`,
        href: quizHref,
      },
      {
        id: 'memory',
        label: '记忆卡片',
        description: '把薄弱点转成可复习卡片',
        href: buildMemoryHref(primaryTopic, weakPoints),
      },
      {
        id: 'teaching',
        label: '智能授课',
        description: `讲透 ${primaryTopic}`,
        href: teachingHref,
      },
      {
        id: 'solve',
        label: '拍照搜题',
        description: '补充新的诊断数据',
        href: '/sky/cloud-mind/solve',
      },
    ],
  };
}
