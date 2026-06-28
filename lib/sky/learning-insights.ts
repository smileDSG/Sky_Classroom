import { buildKnowledgeGraph, getMasterySummary } from '@/lib/knowledge-graph';
import type { MistakeRecord } from '@/lib/mistakes/types';
import type { MistakeCause } from '@/lib/solve/types';

export interface MemoryProgressSnapshot {
  totalFlipped: number;
  topicCount: number;
  lastStudied: number | null;
}

export interface LearningInsightTopic {
  name: string;
  score: number;
  mastery: number;
  mistakeCount: number;
  dueCount: number;
  unreviewedCount: number;
  dominantCause: MistakeCause | null;
  reason: string;
}

export interface LearningInsightAction {
  label: string;
  description: string;
  href: string;
  tone: 'review' | 'quiz' | 'memory' | 'teaching';
}

export interface LearningDataHealth {
  score: number;
  label: string;
  signals: Array<{
    label: string;
    ready: boolean;
    detail: string;
  }>;
}

export interface LearningInsights {
  hasSignals: boolean;
  focusTopic: string;
  headline: string;
  focusReason: string;
  strategyLabel: string;
  metrics: {
    totalMistakes: number;
    dueReviewCount: number;
    overdueReviewCount: number;
    reviewBacklogCount: number;
    weakPointCount: number;
    averageMastery: number;
    masteredPointCount: number;
    knowledgePointCount: number;
    memoryTopicCount: number;
    memoryFlipCount: number;
  };
  topTopics: LearningInsightTopic[];
  causeSummary: Array<{
    cause: MistakeCause;
    label: string;
    count: number;
  }>;
  dataHealth: LearningDataHealth;
  actions: LearningInsightAction[];
}

const DEFAULT_TOPIC = '综合诊断';
const DAY_MS = 24 * 60 * 60 * 1000;

export interface LearningInsightProfile {
  masteryByKnowledge?: Record<string, number>;
  weakPoints?: string[];
  strongPoints?: string[];
  errorPatterns?: Array<{
    knowledgePoint: string;
    errorType: MistakeCause | string;
    frequency: number;
  }>;
  totalQuestions?: number;
  totalCorrect?: number;
}

export interface LearningInsightStats {
  masteryPercent?: number;
  todayStudyMinutes?: number;
  streakDays?: number;
  problemsAttempted?: number;
  problemsCorrect?: number;
  scenesCompleted?: number;
}

export interface LearningInsightReviewSnapshot {
  dueCount?: number;
  overdue?: number;
  completed?: number;
  total?: number;
}

export interface LearningInsightContext {
  profile?: LearningInsightProfile | null;
  learningStats?: LearningInsightStats | null;
  review?: LearningInsightReviewSnapshot | null;
}

const CAUSE_LABELS: Record<MistakeCause, string> = {
  'concept-unclear': '概念不清',
  'calculation-error': '计算失误',
  misreading: '审题偏差',
  'method-wrong': '方法选择',
  careless: '粗心漏项',
  'format-error': '格式表达',
};

function toTime(value: Date | string | number | undefined): number {
  if (value === undefined) return 0;
  if (value instanceof Date) return value.getTime();
  return new Date(value).getTime();
}

function isDue(mistake: MistakeRecord, now: number): boolean {
  if (mistake.reviewed) return false;
  if (typeof mistake.nextReview === 'number') return mistake.nextReview <= now;
  return true;
}

function isOverdue(mistake: MistakeRecord, now: number): boolean {
  if (!isDue(mistake, now)) return false;
  return (
    typeof mistake.nextReview === 'number' &&
    mistake.nextReview > 0 &&
    mistake.nextReview < now - DAY_MS
  );
}

function getDominantCause(causes: Map<MistakeCause, number>): MistakeCause | null {
  return [...causes.entries()].sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildMemoryHref(topic: string, topics: string[]): string {
  const content = topics.length
    ? topics.map((item) => `知识点：${item}`).join('\n')
    : `围绕「${topic}」整理核心概念、易错点、辨析提醒和复习问题。`;
  return `/sky/cloud-mind/memory?topic=${encodeURIComponent(topic)}&content=${encodeURIComponent(content)}`;
}

function buildDataHealth(
  mistakes: MistakeRecord[],
  memoryProgress: MemoryProgressSnapshot,
  weakPointCount: number,
  dueReviewCount: number,
): LearningDataHealth {
  const signals = [
    {
      label: '错题样本',
      ready: mistakes.length >= 5,
      detail:
        mistakes.length >= 5
          ? `${mistakes.length} 道错题可建模`
          : `已有 ${mistakes.length} 道，建议补到 5 道以上`,
    },
    {
      label: '复习节奏',
      ready: dueReviewCount > 0 || mistakes.some((item) => item.reviewCount > 0),
      detail: dueReviewCount > 0 ? `${dueReviewCount} 道到期` : '暂无到期记录',
    },
    {
      label: '知识图谱',
      ready: weakPointCount > 0 || mistakes.some((item) => item.knowledgePoints.length > 0),
      detail: weakPointCount > 0 ? `${weakPointCount} 个薄弱点` : '等待更多知识点标签',
    },
    {
      label: '记忆卡片',
      ready: memoryProgress.topicCount > 0,
      detail:
        memoryProgress.topicCount > 0 ? `${memoryProgress.topicCount} 个主题` : '尚未形成卡片闭环',
    },
  ];
  const readyCount = signals.filter((signal) => signal.ready).length;
  const score = Math.round((readyCount / signals.length) * 100);

  return {
    score,
    label: score >= 75 ? '画像稳定' : score >= 50 ? '画像成型中' : '画像采集中',
    signals,
  };
}

export function buildLearningInsights(
  mistakes: MistakeRecord[],
  memoryProgress: MemoryProgressSnapshot = {
    totalFlipped: 0,
    topicCount: 0,
    lastStudied: null,
  },
  now = Date.now(),
  context: LearningInsightContext = {},
): LearningInsights {
  const graph = mistakes.length > 0 ? buildKnowledgeGraph(mistakes) : null;
  const summary = graph ? getMasterySummary(graph) : null;
  const topicMap = new Map<
    string,
    {
      mistakeCount: number;
      dueCount: number;
      unreviewedCount: number;
      recentCount: number;
      causes: Map<MistakeCause, number>;
    }
  >();
  const causeCounts = new Map<MistakeCause, number>();
  let dueReviewCount = context.review?.dueCount ?? 0;
  let overdueReviewCount = context.review?.overdue ?? 0;
  let reviewBacklogCount = 0;

  for (const mistake of mistakes) {
    const due = isDue(mistake, now);
    const overdue = isOverdue(mistake, now);
    const recent = now - toTime(mistake.solvedAt) <= 7 * DAY_MS;
    if (!context.review) {
      if (due) dueReviewCount += 1;
      if (overdue) overdueReviewCount += 1;
    }
    if (!mistake.reviewed) reviewBacklogCount += 1;
    causeCounts.set(mistake.cause, (causeCounts.get(mistake.cause) ?? 0) + 1);

    for (const point of mistake.knowledgePoints) {
      const entry = topicMap.get(point) ?? {
        mistakeCount: 0,
        dueCount: 0,
        unreviewedCount: 0,
        recentCount: 0,
        causes: new Map<MistakeCause, number>(),
      };
      entry.mistakeCount += 1;
      if (due) entry.dueCount += 1;
      if (!mistake.reviewed) entry.unreviewedCount += 1;
      if (recent) entry.recentCount += 1;
      entry.causes.set(mistake.cause, (entry.causes.get(mistake.cause) ?? 0) + 1);
      topicMap.set(point, entry);
    }
  }

  const nodeMap = new Map((graph?.nodes ?? []).map((node) => [node.name, node]));
  const topTopicsFromMistakes = [...topicMap.entries()]
    .map(([name, data]) => {
      const mastery = nodeMap.get(name)?.mastery ?? Math.max(0, 100 - data.mistakeCount * 12);
      const dominantCause = getDominantCause(data.causes);
      const score = Math.round(
        (100 - mastery) * 0.46 +
          data.mistakeCount * 10 +
          data.dueCount * 18 +
          data.unreviewedCount * 8 +
          data.recentCount * 5,
      );
      const reason =
        data.dueCount > 0
          ? `${data.dueCount} 道相关错题已到复习点`
          : dominantCause
            ? `高频错因是${CAUSE_LABELS[dominantCause]}`
            : `累计 ${data.mistakeCount} 道错题`;
      return {
        name,
        score,
        mastery,
        mistakeCount: data.mistakeCount,
        dueCount: data.dueCount,
        unreviewedCount: data.unreviewedCount,
        dominantCause,
        reason,
      };
    })
    .sort((a, b) => b.score - a.score);

  const existingTopics = new Set(topTopicsFromMistakes.map((topic) => topic.name));
  const profileTopics = Object.entries(context.profile?.masteryByKnowledge ?? {})
    .filter(([name]) => !existingTopics.has(name))
    .map(([name, mastery]) => {
      const weakRank = context.profile?.weakPoints?.indexOf(name) ?? -1;
      const pattern = context.profile?.errorPatterns?.find((item) => item.knowledgePoint === name);
      const score = Math.round(
        (100 - mastery) * 0.55 +
          (weakRank >= 0 ? 30 - weakRank * 3 : 0) +
          (pattern?.frequency ?? 0) * 8,
      );
      return {
        name,
        score,
        mastery,
        mistakeCount: pattern?.frequency ?? 0,
        dueCount: 0,
        unreviewedCount: 0,
        dominantCause: (pattern?.errorType as MistakeCause | undefined) ?? null,
        reason:
          pattern && pattern.frequency > 0
            ? `画像显示该点出现 ${pattern.frequency} 次错误模式`
            : mastery < 60
              ? `画像掌握度 ${mastery}%`
              : '画像建议持续巩固',
      };
    });

  const topTopics = [...topTopicsFromMistakes, ...profileTopics]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const focusTopic = topTopics[0]?.name ?? graph?.weakPoints[0] ?? DEFAULT_TOPIC;
  const profileQuestionCount = context.profile?.totalQuestions ?? 0;
  const statsQuestionCount = context.learningStats?.problemsAttempted ?? 0;
  const hasSignals =
    mistakes.length > 0 ||
    memoryProgress.topicCount > 0 ||
    topTopics.length > 0 ||
    profileQuestionCount > 0 ||
    statsQuestionCount > 0;
  const strategyLabel =
    dueReviewCount > 0
      ? '复习到期优先'
      : topTopics[0]?.mastery !== undefined && topTopics[0].mastery < 50
        ? '薄弱点攻坚'
        : reviewBacklogCount > 0
          ? '错题闭环补齐'
          : '画像采集';
  const headline = hasSignals ? `今天优先处理「${focusTopic}」` : '先采集一次诊断数据';
  const focusReason =
    dueReviewCount > 0
      ? `${dueReviewCount} 道错题已到复习窗口，其中 ${overdueReviewCount} 道逾期`
      : (topTopics[0]?.reason ?? '完成拍照搜题、针对练习或课堂测验后，系统会自动生成个性化路径');
  const relatedTopics = topTopics.map((topic) => topic.name);

  return {
    hasSignals,
    focusTopic,
    headline,
    focusReason,
    strategyLabel,
    metrics: {
      totalMistakes: mistakes.length,
      dueReviewCount,
      overdueReviewCount,
      reviewBacklogCount,
      weakPointCount: graph?.weakPoints.length ?? 0,
      averageMastery:
        summary?.overallMastery ??
        context.learningStats?.masteryPercent ??
        average(Object.values(context.profile?.masteryByKnowledge ?? {})),
      masteredPointCount: summary?.masteredCount ?? 0,
      knowledgePointCount: summary?.totalCount ?? 0,
      memoryTopicCount: memoryProgress.topicCount,
      memoryFlipCount: memoryProgress.totalFlipped,
    },
    topTopics,
    causeSummary: [...causeCounts.entries()]
      .map(([cause, count]) => ({
        cause,
        label: CAUSE_LABELS[cause],
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4),
    dataHealth: buildDataHealth(
      mistakes,
      memoryProgress,
      graph?.weakPoints.length ?? 0,
      dueReviewCount,
    ),
    actions: [
      {
        label: '进入复习',
        description: dueReviewCount > 0 ? `处理 ${dueReviewCount} 道到期错题` : '检查复习计划',
        href: '/sky/learning?tab=review',
        tone: 'review',
      },
      {
        label: '针对出题',
        description: `围绕 ${focusTopic} 生成练习`,
        href: `/sky/cloud-mind/quiz?topic=${encodeURIComponent(focusTopic)}`,
        tone: 'quiz',
      },
      {
        label: '记忆卡片',
        description: '把薄弱点转为可复习材料',
        href: buildMemoryHref(focusTopic, relatedTopics),
        tone: 'memory',
      },
      {
        label: '智能授课',
        description: `讲透 ${focusTopic}`,
        href: `/sky/cloud-mind/teaching?topic=${encodeURIComponent(focusTopic)}`,
        tone: 'teaching',
      },
    ],
  };
}
