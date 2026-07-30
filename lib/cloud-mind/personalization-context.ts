import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import type { QuizAttempt } from '@/lib/student/quiz-attempts';
import type { StudentProfile } from '@/lib/student/profile-types';
import type { LearningPath } from '@/lib/teaching/learning-path-types';
import type { Subject } from '@/lib/solve/agents/analyze-types';
import { SUBJECT_CONFIG } from '@/lib/student/profile-config';
import { buildCloudMindDashboard } from './recommendation-engine';
import { derivePreferredDifficulty } from './difficulty-policy';
import type {
  CloudMindToolTarget,
  PersonalizationContext,
  PersonalizationDifficulty,
} from './types';

interface BuildPersonalizationContextInput {
  userId: string;
  profile: StudentProfile | null;
  mistakes: MistakeBookEntry[];
  dueMistakes: MistakeBookEntry[];
  recentAttempts: QuizAttempt[];
  learningPath?: LearningPath | null;
  selfReportedWeakSubjects?: Subject[];
}

function withQuery(
  href: string,
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `${href}?${qs}` : href;
}

function getPrimaryMastery(input: {
  weakPoints: PersonalizationContext['weakPoints'];
  masteryByKnowledge: Record<string, number>;
}): number | null {
  if (input.weakPoints[0]) return input.weakPoints[0].mastery;
  const sortedMastery = Object.values(input.masteryByKnowledge)
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  return sortedMastery[0] ?? null;
}

function serializeErrorPatterns(
  profile: StudentProfile | null,
): PersonalizationContext['errorPatterns'] {
  return (profile?.errorPatterns ?? []).slice(0, 8).map((pattern) => ({
    knowledgePoint: pattern.knowledgePoint,
    errorType: pattern.errorType,
    frequency: pattern.frequency,
    lastOccurrence:
      pattern.lastOccurrence instanceof Date
        ? pattern.lastOccurrence.toISOString()
        : new Date(pattern.lastOccurrence).toISOString(),
  }));
}

function summarizeLearningPath(
  learningPath?: LearningPath | null,
): PersonalizationContext['learningPath'] | undefined {
  if (!learningPath || learningPath.nodes.length === 0) return undefined;

  const inProgress = learningPath.nodes.find((node) => node.status === 'in_progress');
  const next = learningPath.nodes.find(
    (node) => node.status === 'in_progress' || node.status === 'pending',
  );

  return {
    current: inProgress?.topic,
    next: next?.topic,
    nodes: learningPath.nodes.map((node) => node.topic),
    reason: learningPath.title,
  };
}

function buildRecommendation(input: {
  hasLearningData: boolean;
  weakPoints: PersonalizationContext['weakPoints'];
  dueReviews: PersonalizationContext['dueReviews'];
  learningPath?: PersonalizationContext['learningPath'];
  preferredDifficulty: PersonalizationDifficulty;
  selfReportedWeakSubjects?: Subject[];
}): PersonalizationContext['recommendation'] {
  const primaryWeakPoint = input.weakPoints[0];
  const learningTopic = input.learningPath?.next ?? input.learningPath?.current;

  if (!input.hasLearningData) {
    const subject = input.selfReportedWeakSubjects?.[0];
    if (subject) {
      const subjectLabel = SUBJECT_CONFIG.find((config) => config.id === subject)?.label ?? subject;
      return {
        title: `先诊断一下${subjectLabel}`,
        reason: '你将它标记为较薄弱学科，先用一组小测建立真实学情基线。',
        targetTool: 'quiz',
        href: `/sky/cloud-mind/quiz?subject=${subject}&mode=diagnostic`,
      };
    }
    return {
      title: '先做一次入门诊断',
      reason: '先用一组小测建立学情画像，后续工具才能给出更贴合的默认值。',
      targetTool: 'quiz',
      href: withQuery('/sky/cloud-mind/quiz', { difficulty: input.preferredDifficulty }),
    };
  }

  if (input.dueReviews.length > 0) {
    const topic =
      input.dueReviews[0].knowledgePoints[0] ?? primaryWeakPoint?.knowledgePoint ?? learningTopic;
    return {
      title: `复习 ${input.dueReviews.length} 条到期内容`,
      reason: '先把到期内容转成短周期卡片，能减少遗忘并更新掌握度。',
      targetTool: 'memory',
      href: withQuery('/sky/cloud-mind/memory', { topic }),
    };
  }

  if (primaryWeakPoint) {
    return {
      title: `练一组 ${primaryWeakPoint.knowledgePoint}`,
      reason:
        primaryWeakPoint.mastery < 60
          ? '这个知识点掌握度偏低，适合先用低负担练习定位问题。'
          : '这个知识点近期还有波动，适合用小测巩固。',
      targetTool: 'quiz',
      href: withQuery('/sky/cloud-mind/quiz', {
        topic: primaryWeakPoint.knowledgePoint,
        difficulty: input.preferredDifficulty,
      }),
    };
  }

  if (learningTopic) {
    return {
      title: `听一节 ${learningTopic}`,
      reason: '沿着天梯工坊的学习路径继续推进。',
      targetTool: 'teaching',
      href: withQuery('/sky/cloud-mind/teaching', { topic: learningTopic }),
    };
  }

  return {
    title: '生成一组诊断题',
    reason: '当前没有明确薄弱点，先用智能出题补充学情信号。',
    targetTool: 'quiz',
    href: withQuery('/sky/cloud-mind/quiz', { difficulty: input.preferredDifficulty }),
  };
}

export function buildPersonalizationContext(
  input: BuildPersonalizationContextInput,
): PersonalizationContext {
  const dashboard = buildCloudMindDashboard({
    userId: input.userId,
    profile: input.profile,
    mistakes: input.mistakes,
    dueMistakes: input.dueMistakes,
    recentAttempts: input.recentAttempts,
  });
  const masteryByKnowledge = input.profile?.masteryByKnowledge ?? {};
  const primaryMastery = getPrimaryMastery({
    weakPoints: dashboard.weakPoints,
    masteryByKnowledge,
  });
  const preferredDifficulty = derivePreferredDifficulty({
    hasLearningData: dashboard.hasLearningData,
    recentAccuracy: dashboard.summary.recentAccuracy,
    primaryMastery,
  });
  const learningPath = summarizeLearningPath(input.learningPath);

  return {
    userId: input.userId,
    generatedAt: Date.now(),
    hasLearningData: dashboard.hasLearningData,
    weakPoints: dashboard.weakPoints,
    masteryByKnowledge,
    recentAccuracy: dashboard.summary.recentAccuracy,
    dueReviews: dashboard.dueReviews,
    errorPatterns: serializeErrorPatterns(input.profile),
    learningPath,
    preferredDifficulty,
    recommendation: buildRecommendation({
      hasLearningData: dashboard.hasLearningData,
      weakPoints: dashboard.weakPoints,
      dueReviews: dashboard.dueReviews,
      learningPath,
      preferredDifficulty,
      selfReportedWeakSubjects: input.selfReportedWeakSubjects,
    }),
  };
}

export function isCloudMindToolTarget(value: string): value is CloudMindToolTarget {
  return ['solve', 'slides', 'quiz', 'memory', 'teaching'].includes(value);
}
