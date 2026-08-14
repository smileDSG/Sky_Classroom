import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import type { QuizAttempt } from '@/lib/student/quiz-attempts';
import type { StudentProfile } from '@/lib/student/profile-types';
import type { KnowledgeState } from '@/lib/adaptive-learning/contracts';
import type { DiagnosticCandidate } from '@/lib/adaptive-learning/profile/diagnostic-candidates';
import { getLearnerDecision } from '@/lib/adaptive-learning/decision/learner-decision';
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
import { buildToolPersonalizationPolicies } from './tool-policies';
import { resolveTopicLabel } from './topic-label';
import type {
  CloudMindToolTarget,
  DueReviewItem,
  MemoryReviewRecord,
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
  knowledgeStates?: KnowledgeState[];
  abilityTheta?: number;
  diagnosticCandidates?: DiagnosticCandidate[];
  dueMemoryReviews?: MemoryReviewRecord[];
  /** False keeps new learner decisions shadow-only for this request. */
  useLearnerDecision?: boolean;
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

function buildDueMemoryReviewItems(reviews: MemoryReviewRecord[]): DueReviewItem[] {
  return reviews.slice(0, 6).map((review) => ({
    id: review.id,
    kind: 'memory-card',
    title: review.front?.slice(0, 42) || '到期记忆卡',
    knowledgePoints: review.tags ?? [],
    dueAt: new Date(review.nextReviewAt).getTime(),
    href: withQuery('/sky/cloud-mind/memory', {
      topic: review.tags?.[0],
    }),
  }));
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
  fallbackValues: Iterable<string> = [],
): PersonalizationContext['errorPatterns'] {
  return (profile?.errorPatterns ?? []).slice(0, 8).map((pattern) => ({
    knowledgePoint: resolveTopicLabel(pattern.knowledgePoint, fallbackValues) ?? '当前知识点',
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
  const nodes = learningPath.nodes.map((node) => resolveTopicLabel(node.topic) ?? '当前学习主题');

  return {
    current: resolveTopicLabel(inProgress?.topic),
    next: resolveTopicLabel(next?.topic),
    nodes,
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
  learnerDecision?: PersonalizationContext['learnerDecision'];
}): PersonalizationContext['recommendation'] {
  const primaryWeakPoint = input.weakPoints[0];
  const readableTopics = [
    ...input.weakPoints.map((point) => point.knowledgePoint),
    ...(input.learningPath?.nodes ?? []),
  ];
  const conversationWeakPoint = resolveTopicLabel(
    input.conversationProfile?.knowledgeBase?.weakPoints[0],
    readableTopics,
  );
  const conversationGoal = resolveTopicLabel(input.conversationProfile?.learningGoal?.value);
  const conversationTopic = conversationWeakPoint ?? conversationGoal;
  const learningTopic =
    resolveTopicLabel(input.learningPath?.next, readableTopics) ??
    resolveTopicLabel(input.learningPath?.current, readableTopics);

  const decisionTopic = resolveTopicLabel(input.learnerDecision?.topic, readableTopics);
  if (input.learnerDecision && decisionTopic) {
    const decision = { ...input.learnerDecision, topic: decisionTopic };
    const sharedParams = {
      topic: decision.topic,
      difficulty: decision.difficulty,
      decision: decision.action,
    };
    if (decision.action === 'teach') {
      return {
        title: `先补充 ${decision.topic}`,
        reason: decision.summary,
        targetTool: 'teaching',
        href: withQuery('/sky/cloud-mind/teaching', sharedParams),
      };
    }
    if (decision.action === 'review') {
      return {
        title: `复习 ${decision.topic}`,
        reason: decision.summary,
        targetTool: 'memory',
        href: withQuery('/sky/cloud-mind/memory', sharedParams),
      };
    }
    return {
      title: decision.action === 'diagnostic' ? `诊断 ${decision.topic}` : `练习 ${decision.topic}`,
      reason: decision.summary,
      targetTool: 'quiz',
      href: withQuery('/sky/cloud-mind/quiz', {
        ...sharedParams,
        mode: decision.action === 'diagnostic' ? 'diagnostic' : undefined,
      }),
    };
  }

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

function decisionTargetTool(
  action: NonNullable<PersonalizationContext['learnerDecision']>['action'],
): NonNullable<PersonalizationContext['recommendation']>['targetTool'] {
  if (action === 'teach') return 'teaching';
  if (action === 'review') return 'memory';
  return 'quiz';
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
  if (/slow|较少|少于|轻量/i.test(learningPace)) return 'remedial';
  if (/fast|密集|强化|10\s*小时/i.test(learningPace)) return 'sprint';
  if (/两周|一周|考试|比赛|截止|deadline|ddl|冲刺/i.test(learningPace)) return 'sprint';
  if (
    (input.recentAccuracy !== null && input.recentAccuracy < 60) ||
    (input.primaryMastery !== null && input.primaryMastery < 60)
  ) {
    return 'remedial';
  }
  return 'steady';
}

function deriveSelfReportedDifficulty(
  conversationProfile: ConversationProfileSummary,
): PersonalizationDifficulty | null {
  const state = conversationProfile.currentLearningState?.value ?? '';
  if (/基础扎实|挑战高阶|advanced/i.test(state)) return 'hard';
  if (/刚开始|基础薄弱|不稳定|starting|developing/i.test(state)) return 'easy';
  if (/基础较稳|准备进阶|solid/i.test(state)) return 'medium';
  return null;
}

function buildTutoringPolicy(input: {
  conversationProfile: ConversationProfileSummary;
  weakPoints: PersonalizationContext['weakPoints'];
  learningPath?: PersonalizationContext['learningPath'];
  preferredDifficulty: PersonalizationDifficulty;
  recentAccuracy: number | null;
  primaryMastery: number | null;
  learnerDecision?: PersonalizationContext['learnerDecision'];
}): TutoringPolicy {
  const readableTopics = [
    ...input.weakPoints.map((point) => point.knowledgePoint),
    ...(input.learningPath?.nodes ?? []),
  ];
  const conversationWeakPoint = resolveTopicLabel(
    input.conversationProfile.knowledgeBase?.weakPoints[0],
    readableTopics,
  );
  const primaryWeakPoint = input.weakPoints[0]?.knowledgePoint;
  const learningTopic =
    resolveTopicLabel(input.learningPath?.next, readableTopics) ??
    resolveTopicLabel(input.learningPath?.current, readableTopics);
  const goal = resolveTopicLabel(input.conversationProfile.learningGoal?.value);
  const decisionTopic = resolveTopicLabel(input.learnerDecision?.topic, readableTopics);
  const targetTopic =
    decisionTopic ?? primaryWeakPoint ?? conversationWeakPoint ?? learningTopic ?? goal;
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
  const rawDueReviews = [
    ...buildDueMemoryReviewItems(input.dueMemoryReviews ?? []),
    ...dashboard.dueReviews,
  ].slice(0, 8);
  const readableTopicFallbacks = dashboard.weakPoints.map((point) => point.knowledgePoint);
  const dueReviews = rawDueReviews.map((item) => ({
    ...item,
    knowledgePoints: item.knowledgePoints
      .map((point) => resolveTopicLabel(point, readableTopicFallbacks))
      .filter((point): point is string => Boolean(point)),
  }));
  const masteryByKnowledge = input.profile?.masteryByKnowledge ?? {};
  const primaryMastery = getPrimaryMastery({
    weakPoints: dashboard.weakPoints,
    masteryByKnowledge,
  });
  const conversationProfile = buildConversationProfileFromSignals(input.profileSignals ?? []);
  const observedDifficulty = derivePreferredDifficulty({
    hasLearningData: dashboard.hasLearningData || dueReviews.length > 0,
    recentAccuracy: dashboard.summary.recentAccuracy,
    primaryMastery,
  });
  const preferredDifficulty = dashboard.hasLearningData
    ? observedDifficulty
    : (deriveSelfReportedDifficulty(conversationProfile) ?? observedDifficulty);
  const learningPath = summarizeLearningPath(input.learningPath);
  const hasPersonalizationSignals = Object.keys(conversationProfile).length > 0;
  const rawLearnerDecision = input.knowledgeStates
    ? getLearnerDecision({
        knowledgeStates: input.knowledgeStates,
        fallbackTopic:
          dashboard.weakPoints[0]?.knowledgePoint ?? learningPath?.next ?? learningPath?.current,
        abilityTheta: input.abilityTheta,
        diagnosticCandidates: input.diagnosticCandidates,
      })
    : undefined;
  const decisionTopicCandidates = [
    ...dashboard.weakPoints.map((point) => point.knowledgePoint),
    ...(learningPath?.nodes ?? []),
    ...dueReviews.flatMap((item) => item.knowledgePoints),
  ];
  const learnerDecision = rawLearnerDecision
    ? {
        ...rawLearnerDecision,
        topic:
          resolveTopicLabel(rawLearnerDecision.topic ?? undefined, decisionTopicCandidates) ?? null,
      }
    : undefined;
  const effectiveLearnerDecision = input.useLearnerDecision === false ? undefined : learnerDecision;
  const effectiveDifficulty = effectiveLearnerDecision?.difficulty ?? preferredDifficulty;
  const tutoringPolicy = buildTutoringPolicy({
    conversationProfile,
    weakPoints: dashboard.weakPoints,
    learningPath,
    preferredDifficulty: effectiveDifficulty,
    recentAccuracy: dashboard.summary.recentAccuracy,
    primaryMastery,
    learnerDecision: effectiveLearnerDecision,
  });
  const recommendationInput = {
    hasLearningData: dashboard.hasLearningData || dueReviews.length > 0,
    conversationProfile,
    weakPoints: dashboard.weakPoints,
    dueReviews,
    learningPath,
    preferredDifficulty: effectiveDifficulty,
    selfReportedWeakSubjects: input.selfReportedWeakSubjects,
  };
  const baselineRecommendation = buildRecommendation(recommendationInput);
  const newRecommendation = buildRecommendation({
    ...recommendationInput,
    learnerDecision,
  });
  const recommendation =
    input.useLearnerDecision === false ? baselineRecommendation : newRecommendation;
  const shadowComparison = learnerDecision
    ? {
        baselineTargetTool: baselineRecommendation?.targetTool ?? null,
        newTargetTool: decisionTargetTool(learnerDecision.action),
        baselineHref: baselineRecommendation?.href ?? null,
        newHref: newRecommendation?.href ?? null,
        changed:
          baselineRecommendation?.targetTool !== decisionTargetTool(learnerDecision.action) ||
          baselineRecommendation?.href !== recommendation?.href,
      }
    : undefined;

  return {
    userId: input.userId,
    generatedAt: Date.now(),
    hasLearningData: dashboard.hasLearningData,
    hasPersonalizationSignals,
    conversationProfile: hasPersonalizationSignals ? conversationProfile : undefined,
    weakPoints: dashboard.weakPoints,
    masteryByKnowledge,
    recentAccuracy: dashboard.summary.recentAccuracy,
    dueReviews,
    errorPatterns: serializeErrorPatterns(input.profile, readableTopicFallbacks),
    learningPath,
    preferredDifficulty: effectiveDifficulty,
    learnerDecision,
    shadowComparison,
    tutoringPolicy,
    toolPolicies: buildToolPersonalizationPolicies({
      decision: effectiveLearnerDecision,
      tutoringPolicy,
      weakPoints: dashboard.weakPoints,
      dueReviews,
      learningPath,
    }),
    recommendation,
  };
}

export function isCloudMindToolTarget(value: string): value is CloudMindToolTarget {
  return ['solve', 'slides', 'quiz', 'memory', 'teaching'].includes(value);
}
