import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import type { QuizAttempt } from '@/lib/student/quiz-attempts';
import type { StudentProfile } from '@/lib/student/profile-types';
import {
  buildConversationProfileFromSignals,
  type ConversationProfileSummary,
  type ProfileSignal,
} from '@/lib/student/profile-signals';
import type { LearningPath } from '@/lib/teaching/learning-path-types';
import type { Subject } from '@/lib/solve/agents/analyze-types';
import { SUBJECT_CONFIG } from '@/lib/student/profile-config';
import { buildCloudMindDashboard } from './recommendation-engine';
import { derivePreferredDifficulty } from './difficulty-policy';
import type {
  CloudMindToolTarget,
  PersonalizationContext,
  PersonalizationDifficulty,
  TutoringExplanationStyle,
  TutoringPacing,
  TutoringPolicy,
  TutoringResourceFormat,
} from './types';

interface BuildPersonalizationContextInput {
  userId: string;
  profile: StudentProfile | null;
  mistakes: MistakeBookEntry[];
  dueMistakes: MistakeBookEntry[];
  recentAttempts: QuizAttempt[];
  learningPath?: LearningPath | null;
  profileSignals?: ProfileSignal[];
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
  conversationProfile?: ConversationProfileSummary;
  weakPoints: PersonalizationContext['weakPoints'];
  dueReviews: PersonalizationContext['dueReviews'];
  learningPath?: PersonalizationContext['learningPath'];
  preferredDifficulty: PersonalizationDifficulty;
  selfReportedWeakSubjects?: Subject[];
}): PersonalizationContext['recommendation'] {
  const primaryWeakPoint = input.weakPoints[0];
  const conversationWeakPoint = input.conversationProfile?.knowledgeBase?.weakPoints[0];
  const conversationGoal = input.conversationProfile?.learningGoal?.value;
  const conversationTopic = conversationWeakPoint ?? conversationGoal;
  const learningTopic = input.learningPath?.next ?? input.learningPath?.current;

  if (!input.hasLearningData) {
    if (conversationTopic) {
      return {
        title: `先诊断 ${conversationTopic}`,
        reason: '已从自然语言画像中识别到学习目标或薄弱点，先用一组小测校准画像。',
        targetTool: 'quiz',
        href: withQuery('/sky/cloud-mind/quiz', {
          topic: conversationTopic,
          difficulty: input.preferredDifficulty,
        }),
      };
    }

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

function normalizeResourceFormat(value: string): TutoringResourceFormat | null {
  if (/code|代码|编程|案例/i.test(value)) return 'code_case';
  if (/diagram|图解|流程图|思维导图|可视化/i.test(value)) return 'diagram';
  if (/practice|练习|刷题|题目|小测/i.test(value)) return 'practice';
  if (/video|视频|动画/i.test(value)) return 'video';
  if (/summary|文字|总结|讲义/i.test(value)) return 'summary';
  return null;
}

function normalizeResourceFormats(values: string[] = []): TutoringResourceFormat[] {
  const normalized = values
    .map(normalizeResourceFormat)
    .filter((value): value is TutoringResourceFormat => value !== null);

  if (normalized.length === 0) return ['worked_example', 'practice'];
  return Array.from(new Set(normalized));
}

function deriveExplanationStyle(input: {
  interactionPreference?: string;
  resourceFormats: TutoringResourceFormat[];
}): TutoringExplanationStyle {
  const preference = input.interactionPreference ?? '';
  if (/步骤|step|一步|先给答案/i.test(preference)) return 'step_first';
  if (/原理|principle|why|为什么|推导/i.test(preference)) return 'principle_first';
  if (/练习|practice|刷题|小测/i.test(preference)) return 'practice_first';
  if (input.resourceFormats.includes('code_case') || input.resourceFormats.includes('diagram')) {
    return 'example_first';
  }
  return 'step_first';
}

function derivePacing(input: {
  learningPace?: string;
  recentAccuracy: number | null;
  primaryMastery: number | null;
}): TutoringPacing {
  const learningPace = input.learningPace ?? '';
  if (/两周|一周|考试|比赛|截止|deadline|ddl|冲刺/i.test(learningPace)) return 'sprint';
  if (
    (input.recentAccuracy !== null && input.recentAccuracy < 60) ||
    (input.primaryMastery !== null && input.primaryMastery < 60)
  ) {
    return 'remedial';
  }
  return 'steady';
}

function buildTutoringPolicy(input: {
  conversationProfile: ConversationProfileSummary;
  weakPoints: PersonalizationContext['weakPoints'];
  learningPath?: PersonalizationContext['learningPath'];
  preferredDifficulty: PersonalizationDifficulty;
  recentAccuracy: number | null;
  primaryMastery: number | null;
}): TutoringPolicy {
  const conversationWeakPoint = input.conversationProfile.knowledgeBase?.weakPoints[0];
  const primaryWeakPoint = input.weakPoints[0]?.knowledgePoint;
  const learningTopic = input.learningPath?.next ?? input.learningPath?.current;
  const goal = input.conversationProfile.learningGoal?.value;
  const targetTopic = primaryWeakPoint ?? conversationWeakPoint ?? learningTopic ?? goal;
  const rawResourcePreferences = input.conversationProfile.resourcePreference?.value ?? [];
  const resourceFormats = normalizeResourceFormats(rawResourcePreferences);
  const explanationStyle = deriveExplanationStyle({
    interactionPreference: input.conversationProfile.interactionPreference?.value,
    resourceFormats,
  });
  const pacing = derivePacing({
    learningPace: input.conversationProfile.learningPace?.value,
    recentAccuracy: input.recentAccuracy,
    primaryMastery: input.primaryMastery,
  });

  const directives: string[] = [];
  if (targetTopic) {
    directives.push(`围绕 ${targetTopic} 组织讲解和练习，先处理当前最关键的薄弱点。`);
  }
  if (pacing === 'remedial') {
    directives.push(
      `采用低负荷辅导：先拆小步确认理解，再进入${targetTopic ? ` ${targetTopic} ` : ''}练习。`,
    );
  } else if (pacing === 'sprint') {
    directives.push('采用冲刺节奏：突出高频考点、短反馈和可立即执行的练习。');
  } else {
    directives.push('采用稳定节奏：讲解、例题和练习保持均衡推进。');
  }
  if (rawResourcePreferences.length > 0) {
    directives.push(
      `优先使用 ${rawResourcePreferences.join('、')} 呈现内容，并把材料压缩成可操作步骤。`,
    );
  }
  if (explanationStyle === 'step_first') {
    directives.push('讲解方式采用步骤优先：先给可执行步骤，再补充原因。');
  } else if (explanationStyle === 'principle_first') {
    directives.push('讲解方式采用原理优先：先解释为什么，再进入例题。');
  } else if (explanationStyle === 'example_first') {
    directives.push('讲解方式采用例子优先：先用例题或案例建立直觉。');
  } else {
    directives.push('讲解方式采用练习优先：先做小题，再根据错误讲解。');
  }
  directives.push(`默认难度使用 ${input.preferredDifficulty}，必要时根据作答表现动态调整。`);

  const evidence: TutoringPolicy['evidence'] = [];
  if (input.conversationProfile.learningGoal) {
    evidence.push({
      source: 'profile',
      summary: `学习目标：${input.conversationProfile.learningGoal.value}`,
      confidence: input.conversationProfile.learningGoal.confidence,
    });
  }
  if (conversationWeakPoint) {
    evidence.push({
      source: 'profile',
      summary: `对话识别薄弱点：${conversationWeakPoint}`,
      confidence: input.conversationProfile.knowledgeBase?.confidence,
    });
  }
  if (primaryWeakPoint) {
    evidence.push({
      source: 'performance',
      summary: `学习数据薄弱点：${primaryWeakPoint}`,
      confidence: input.weakPoints[0]?.mastery,
    });
  }
  if (input.learningPath?.next) {
    evidence.push({
      source: 'path',
      summary: `学习路径下一步：${input.learningPath.next}`,
    });
  }

  return {
    targetTopic,
    difficulty: input.preferredDifficulty,
    explanationStyle,
    resourceFormats,
    pacing,
    directives,
    evidence,
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
  const conversationProfile = buildConversationProfileFromSignals(input.profileSignals ?? []);
  const hasPersonalizationSignals = Object.keys(conversationProfile).length > 0;

  return {
    userId: input.userId,
    generatedAt: Date.now(),
    hasLearningData: dashboard.hasLearningData,
    hasPersonalizationSignals,
    conversationProfile: hasPersonalizationSignals ? conversationProfile : undefined,
    weakPoints: dashboard.weakPoints,
    masteryByKnowledge,
    recentAccuracy: dashboard.summary.recentAccuracy,
    dueReviews: dashboard.dueReviews,
    errorPatterns: serializeErrorPatterns(input.profile),
    learningPath,
    preferredDifficulty,
    tutoringPolicy: buildTutoringPolicy({
      conversationProfile,
      weakPoints: dashboard.weakPoints,
      learningPath,
      preferredDifficulty,
      recentAccuracy: dashboard.summary.recentAccuracy,
      primaryMastery,
    }),
    recommendation: buildRecommendation({
      hasLearningData: dashboard.hasLearningData,
      conversationProfile,
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
