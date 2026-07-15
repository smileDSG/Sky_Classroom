import type { KBStats, KBType } from '@/lib/knowledge-base/types';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import type { QuizAttempt } from '@/lib/student/quiz-attempts';
import type { StudentProfile } from '@/lib/student/profile-types';
import {
  buildKnowledgePointEvidence,
  buildNewUserEvidence,
  countRecentMistakesByKnowledge,
} from './evidence-builder';
import type {
  CloudMindDashboardData,
  DueReviewItem,
  LearningRecommendation,
  RecentLearningRecord,
  ToolStatus,
  WeakPointSummary,
} from './types';

export const CLOUD_MIND_TOOLS: ToolStatus[] = [
  {
    id: 'solve',
    label: '拍照搜题',
    href: '/sky/cloud-mind/solve',
    group: 'diagnosis',
    status: 'ready',
  },
  {
    id: 'quiz',
    label: '智能出题',
    href: '/sky/cloud-mind/quiz',
    group: 'diagnosis',
    status: 'ready',
  },
  {
    id: 'memory',
    label: '记忆卡片',
    href: '/sky/cloud-mind/memory',
    group: 'alchemy',
    status: 'ready',
  },
  {
    id: 'slides',
    label: 'PPT 课件',
    href: '/sky/cloud-mind/slides',
    group: 'classroom',
    status: 'ready',
  },
  {
    id: 'teaching',
    label: '智能授课',
    href: '/sky/cloud-mind/teaching',
    group: 'classroom',
    status: 'ready',
  },
];

export const EMPTY_KB_STATS: KBStats = {
  totalChunks: 0,
  totalDocuments: 0,
  byType: {
    solve: { chunks: 0, documents: 0 },
    slides: { chunks: 0, documents: 0 },
    cards: { chunks: 0, documents: 0 },
    classroom: { chunks: 0, documents: 0 },
  } satisfies Record<KBType, { chunks: number; documents: number }>,
};

function withQuery(
  href: string,
  params: Record<string, string | number | boolean | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `${href}?${qs}` : href;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function hasProfileLearningData(profile: StudentProfile | null): boolean {
  return (
    (profile?.totalQuestions ?? 0) > 0 ||
    Object.keys(profile?.masteryByKnowledge ?? {}).length > 0 ||
    (profile?.errorPatterns.length ?? 0) > 0
  );
}

function deriveWeakPointNames(input: {
  profile: StudentProfile | null;
  recentCounts: Map<string, number>;
}): string[] {
  if (input.profile?.weakPoints?.length) return input.profile.weakPoints;

  const recentNames = [...input.recentCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([point]) => point);
  if (recentNames.length > 0) return recentNames;

  return Object.entries(input.profile?.masteryByKnowledge ?? {})
    .sort((a, b) => a[1] - b[1])
    .map(([point]) => point);
}

function deriveWeakPoints(input: {
  profile: StudentProfile | null;
  mistakes: MistakeBookEntry[];
  dueMistakes: MistakeBookEntry[];
  kbStats: KBStats | null;
}): WeakPointSummary[] {
  const recentCounts = countRecentMistakesByKnowledge(input.mistakes);
  const dueCounts = countRecentMistakesByKnowledge(input.dueMistakes, 9999);
  const weakPointNames = deriveWeakPointNames({
    profile: input.profile,
    recentCounts,
  });

  return weakPointNames.slice(0, 5).map((knowledgePoint) => {
    const mastery = input.profile?.masteryByKnowledge?.[knowledgePoint] ?? 50;
    return {
      knowledgePoint,
      mastery,
      recentMistakeCount: recentCounts.get(knowledgePoint) ?? 0,
      actionHref: withQuery('/sky/cloud-mind/quiz', {
        topic: knowledgePoint,
        difficulty: mastery < 45 ? 'easy' : 'medium',
      }),
      evidence: buildKnowledgePointEvidence({
        knowledgePoint,
        mastery,
        recentMistakeCount: recentCounts.get(knowledgePoint) ?? 0,
        dueReviewCount: dueCounts.get(knowledgePoint) ?? 0,
        kbStats: input.kbStats,
      }),
    };
  });
}

function buildDueReviews(dueMistakes: MistakeBookEntry[]): DueReviewItem[] {
  return dueMistakes.slice(0, 6).map((mistake) => ({
    id: mistake.id,
    kind: 'mistake',
    title: mistake.problemText.slice(0, 42) || '错题复习',
    knowledgePoints: mistake.knowledgePoints,
    dueAt: mistake.nextReview ?? null,
    href: '/sky/learning',
  }));
}

function buildRecentRecords(input: {
  attempts: QuizAttempt[];
  mistakes: MistakeBookEntry[];
  profile: StudentProfile | null;
}): RecentLearningRecord[] {
  const quizRecords: RecentLearningRecord[] = input.attempts.slice(0, 4).map((attempt) => ({
    id: attempt.id,
    source: 'quiz',
    title: attempt.topic || '智能出题练习',
    detail: `${attempt.correct}/${attempt.total} 正确，正确率 ${attempt.accuracy}%`,
    createdAt: attempt.createdAt,
    href: '/sky/cloud-mind/quiz',
  }));

  const mistakeRecords: RecentLearningRecord[] = input.mistakes.slice(0, 3).map((mistake) => ({
    id: mistake.id,
    source: 'mistake',
    title: mistake.knowledgePoints[0] || '错题沉淀',
    detail: mistake.problemText.slice(0, 48) || '已写入错题本',
    createdAt: mistake.lastReview ?? Date.now(),
    href: '/sky/learning',
  }));

  const profileRecords: RecentLearningRecord[] =
    input.attempts.length === 0 &&
    input.mistakes.length === 0 &&
    hasProfileLearningData(input.profile)
      ? [
          {
            id: `profile-${input.profile?.userId ?? 'unknown'}`,
            source: 'profile',
            title: '学情画像更新',
            detail: `累计 ${input.profile?.totalQuestions ?? 0} 道题，正确 ${
              input.profile?.totalCorrect ?? 0
            } 道`,
            createdAt:
              input.profile?.lastUpdated instanceof Date
                ? input.profile.lastUpdated.getTime()
                : Date.now(),
            href: '/sky/learning',
          },
        ]
      : [];

  return [...quizRecords, ...mistakeRecords, ...profileRecords]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 6);
}

function buildRecommendations(input: {
  profile: StudentProfile | null;
  weakPoints: WeakPointSummary[];
  dueReviews: DueReviewItem[];
  recentAttempts: QuizAttempt[];
  kbStats: KBStats | null;
  hasLearningData: boolean;
}): LearningRecommendation[] {
  const recommendations: LearningRecommendation[] = [];
  const primaryWeakPoint = input.weakPoints[0];

  if (!input.hasLearningData) {
    recommendations.push({
      id: 'new-user-start',
      title: '先完成一次入门诊断',
      reason: '建立第一份学情画像后，智囊才能持续给出个性化建议。',
      priority: 100,
      actionType: 'practice_quiz',
      target: {
        href: '/sky/cloud-mind/quiz',
        label: '开始诊断',
      },
      evidence: buildNewUserEvidence(input.kbStats),
    });
  }

  if (input.dueReviews.length > 0) {
    recommendations.push({
      id: 'due-review',
      title: `先处理 ${input.dueReviews.length} 条到期复习`,
      reason: '到期内容优先复习，可以减少遗忘并更新掌握度。',
      priority: 95,
      actionType: 'review_mistakes',
      target: {
        href: '/sky/learning',
        label: '查看复习',
      },
      evidence: [
        {
          type: 'memory',
          title: '复习队列',
          summary: `${input.dueReviews.length} 条错题或记忆内容需要复习`,
          sourceId: 'due-reviews',
          confidence: 0.86,
        },
      ],
    });
  }

  if (primaryWeakPoint) {
    const evidence = buildKnowledgePointEvidence({
      knowledgePoint: primaryWeakPoint.knowledgePoint,
      mastery: primaryWeakPoint.mastery,
      recentMistakeCount: primaryWeakPoint.recentMistakeCount,
      dueReviewCount: input.dueReviews.filter((item) =>
        item.knowledgePoints.includes(primaryWeakPoint.knowledgePoint),
      ).length,
      kbStats: input.kbStats,
    });
    recommendations.push({
      id: `weak-${primaryWeakPoint.knowledgePoint}`,
      title: `攻克 ${primaryWeakPoint.knowledgePoint}`,
      reason:
        primaryWeakPoint.mastery < 60
          ? '该知识点掌握度偏低，适合先讲解再专项练习。'
          : '该知识点近期仍有波动，适合用小测巩固。',
      priority: 88,
      actionType: 'start_plan',
      target: {
        href: primaryWeakPoint.actionHref,
        label: '生成专项练习',
      },
      evidence,
    });
  }

  const recentAttempt = input.recentAttempts[0];
  if (recentAttempt && recentAttempt.accuracy < 70) {
    recommendations.push({
      id: `quiz-followup-${recentAttempt.id}`,
      title: '把本次测验错题转成卡片',
      reason: '测验正确率低于 70%，适合把错因转为短周期复习材料。',
      priority: 76,
      actionType: 'review_cards',
      target: {
        href: withQuery('/sky/cloud-mind/memory', {
          topic: recentAttempt.topic || primaryWeakPoint?.knowledgePoint || '',
          content: recentAttempt.questions
            .filter((question) => !question.isCorrect)
            .map((question) => `题目：${question.question}\n解析：${question.explanation ?? ''}`)
            .join('\n\n'),
        }),
        label: '生成记忆卡',
      },
      evidence: [
        {
          type: 'behavior',
          title: '测验表现',
          summary: `最近一次测验正确率 ${recentAttempt.accuracy}%`,
          sourceId: recentAttempt.id,
          confidence: 0.82,
        },
      ],
    });
  }

  return recommendations.sort((a, b) => b.priority - a.priority).slice(0, 4);
}

export function buildCloudMindDashboard(input: {
  userId: string;
  profile: StudentProfile | null;
  mistakes: MistakeBookEntry[];
  dueMistakes: MistakeBookEntry[];
  recentAttempts: QuizAttempt[];
  kbStats?: KBStats | null;
}): CloudMindDashboardData {
  const kbStats = input.kbStats ?? EMPTY_KB_STATS;
  const masteryValues = Object.values(input.profile?.masteryByKnowledge ?? {});
  const hasLearningData =
    hasProfileLearningData(input.profile) ||
    input.mistakes.length > 0 ||
    input.recentAttempts.length > 0;
  const weakPoints = deriveWeakPoints({
    profile: input.profile,
    mistakes: input.mistakes,
    dueMistakes: input.dueMistakes,
    kbStats,
  });
  const dueReviews = buildDueReviews(input.dueMistakes);
  const recentRecords = buildRecentRecords({
    attempts: input.recentAttempts,
    mistakes: input.mistakes,
    profile: input.profile,
  });
  const recommendations = buildRecommendations({
    profile: input.profile,
    weakPoints,
    dueReviews,
    recentAttempts: input.recentAttempts,
    kbStats,
    hasLearningData,
  });

  return {
    userId: input.userId,
    generatedAt: Date.now(),
    hasLearningData,
    recommendations,
    weakPoints,
    dueReviews,
    recentRecords,
    knowledgeStats: kbStats,
    toolStatus: CLOUD_MIND_TOOLS,
    summary: {
      totalQuestions: input.profile?.totalQuestions ?? 0,
      totalCorrect: input.profile?.totalCorrect ?? 0,
      masteryAverage: average(masteryValues),
      recentAccuracy:
        input.recentAttempts.length > 0
          ? average(input.recentAttempts.slice(0, 3).map((attempt) => attempt.accuracy))
          : (input.profile?.recentQuizPerformance?.overallAccuracy ?? null),
    },
  };
}
