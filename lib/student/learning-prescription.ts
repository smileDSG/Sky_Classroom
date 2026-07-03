import type { ConversationalProfilePatch } from './conversation-profile';

export interface StudentProfileForPrescription {
  userId: string;
  masteryBySubject: Record<string, number>;
  masteryByKnowledge: Record<string, number>;
  weakPoints: string[];
  strongPoints: string[];
  errorPatterns: Array<{
    knowledgePoint: string;
    errorType: string;
    frequency: number;
    lastOccurrence: string | number | Date;
  }>;
  totalQuestions: number;
  totalCorrect: number;
  lastUpdated: string | number | Date;
}

export interface PrescriptionTopic {
  name: string;
  mastery: number;
  reason: string;
  suggestedAction: string;
  errorType?: string;
  errorFrequency: number;
}

export type PrescriptionActionKey = 'teach' | 'quiz' | 'review' | 'graph' | 'diagnostic';

export interface PrescriptionAction {
  key: PrescriptionActionKey;
  label: string;
  description: string;
  href?: string;
  topics: string[];
}

export interface PrescriptionEvidence {
  label: string;
  value: string;
  source: 'performance' | 'preference' | 'mixed';
}

export interface LearningPrescription {
  headline: string;
  summary: string;
  priorityTopics: PrescriptionTopic[];
  recommendedMode: string;
  nextActions: PrescriptionAction[];
  evidence: PrescriptionEvidence[];
  accuracy: number;
}

const ERROR_TYPE_LABELS: Record<string, string> = {
  'concept-unclear': '概念不清',
  'calculation-error': '计算失误',
  misreading: '审题错误',
  'method-wrong': '方法选择',
  careless: '粗心',
  'format-error': '格式问题',
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function encodeTopics(topics: string[]): string {
  return encodeURIComponent(topics.join('、'));
}

function getAccuracy(profile: StudentProfileForPrescription): number {
  if (profile.totalQuestions <= 0) return 0;
  return Math.round((profile.totalCorrect / profile.totalQuestions) * 100);
}

function isRecent(value: string | number | Date): boolean {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time < 14 * 24 * 60 * 60 * 1000;
}

function getRecommendedMode(preference?: ConversationalProfilePatch): string {
  const resourceModes = preference?.resourcePreference?.value ?? [];
  const interaction = preference?.interactionPreference?.value;
  const pace = preference?.learningPace?.value;
  const modes: string[] = [];

  if (resourceModes.includes('代码案例')) modes.push('代码案例');
  if (resourceModes.includes('图解')) modes.push('图解拆解');
  if (resourceModes.includes('练习')) modes.push('针对练习');
  if (interaction?.includes('步骤')) modes.push('步骤拆解');
  if (interaction?.includes('原理')) modes.push('先补原理');
  if (modes.length === 0) modes.push('短讲解 + 小练习');

  return pace ? `${unique(modes).join(' + ')} · ${pace}` : unique(modes).join(' + ');
}

function buildTopicReason(input: {
  name: string;
  mastery: number;
  errorType?: string;
  errorFrequency: number;
  mentionedByUser: boolean;
}): string {
  const parts = [`掌握度 ${input.mastery}%`];
  if (input.errorFrequency > 0) {
    const label = input.errorType
      ? (ERROR_TYPE_LABELS[input.errorType] ?? input.errorType)
      : '错因';
    parts.push(`${label}出现 ${input.errorFrequency} 次`);
  }
  if (input.mentionedByUser) parts.push('画像对话中也提到这里卡住');
  return parts.join('，');
}

function buildPriorityTopics(
  profile: StudentProfileForPrescription,
  preference?: ConversationalProfilePatch,
): PrescriptionTopic[] {
  const conversationalWeak = new Set(preference?.knowledgeBase?.weakPoints ?? []);
  const candidateNames = unique([
    ...profile.weakPoints,
    ...Object.entries(profile.masteryByKnowledge)
      .filter(([, mastery]) => mastery < 60)
      .map(([name]) => name),
    ...Array.from(conversationalWeak),
  ]);

  return candidateNames
    .map((name) => {
      const mastery = profile.masteryByKnowledge[name] ?? (conversationalWeak.has(name) ? 45 : 50);
      const errors = profile.errorPatterns.filter((pattern) => pattern.knowledgePoint === name);
      const errorFrequency = errors.reduce((sum, pattern) => sum + pattern.frequency, 0);
      const latestError = [...errors].sort(
        (a, b) => new Date(b.lastOccurrence).getTime() - new Date(a.lastOccurrence).getTime(),
      )[0];
      const mentionedByUser = conversationalWeak.has(name);
      const score =
        (100 - mastery) * 0.5 +
        errorFrequency * 12 +
        (mentionedByUser ? 15 : 0) +
        (latestError && isRecent(latestError.lastOccurrence) ? 10 : 0);

      return {
        name,
        mastery,
        reason: buildTopicReason({
          name,
          mastery,
          errorType: latestError?.errorType,
          errorFrequency,
          mentionedByUser,
        }),
        suggestedAction: mastery < 35 ? '先补概念，再做辨析题' : '用短练习校准掌握度',
        errorType: latestError?.errorType,
        errorFrequency,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ score: _score, ...topic }) => topic);
}

function buildActions(topics: string[]): PrescriptionAction[] {
  const primary = topics.slice(0, 3);
  const query = encodeTopics(primary);

  return [
    {
      key: 'teach',
      label: '生成个性化讲解',
      description: '按你的薄弱点和讲解偏好生成一段短讲解。',
      href: `/sky/cloud-mind/teaching?topic=${query}`,
      topics: primary,
    },
    {
      key: 'quiz',
      label: '针对出题',
      description: '围绕当前优先薄弱点生成练习题。',
      href: `/sky/cloud-mind/quiz?topic=${query}`,
      topics: primary,
    },
    {
      key: 'review',
      label: '加入复习计划',
      description: '把这些薄弱点放进今天的复习队列。',
      topics: primary,
    },
    {
      key: 'graph',
      label: '查看知识图谱',
      description: '查看薄弱点与前置知识之间的关系。',
      href: '/sky/learning/graph',
      topics: primary,
    },
  ];
}

function buildEvidence(
  profile: StudentProfileForPrescription,
  preference: ConversationalProfilePatch | undefined,
  topics: PrescriptionTopic[],
  accuracy: number,
): PrescriptionEvidence[] {
  const evidence: PrescriptionEvidence[] = [
    {
      label: '做题正确率',
      value:
        profile.totalQuestions > 0
          ? `${accuracy}% (${profile.totalCorrect}/${profile.totalQuestions})`
          : '暂无做题数据',
      source: 'performance',
    },
  ];

  if (topics[0]) {
    evidence.push({
      label: '首要薄弱点',
      value: `${topics[0].name}：${topics[0].reason}`,
      source: preference?.knowledgeBase?.weakPoints.includes(topics[0].name)
        ? 'mixed'
        : 'performance',
    });
  }

  if (preference?.learningGoal?.value) {
    evidence.push({
      label: '学习目标',
      value: preference.learningGoal.value,
      source: 'preference',
    });
  }

  if (preference?.resourcePreference?.value.length) {
    evidence.push({
      label: '资源偏好',
      value: preference.resourcePreference.value.join('、'),
      source: 'preference',
    });
  }

  return evidence;
}

export function buildLearningPrescription(
  profile: StudentProfileForPrescription,
  preference?: ConversationalProfilePatch,
): LearningPrescription {
  const accuracy = getAccuracy(profile);
  const priorityTopics = buildPriorityTopics(profile, preference);
  const recommendedMode = getRecommendedMode(preference);

  if (profile.totalQuestions === 0 && priorityTopics.length === 0) {
    return {
      headline: '还没有足够数据生成学习处方',
      summary: '先完成一次诊断，或用 2 分钟告诉我你的学习目标。',
      priorityTopics: [],
      recommendedMode,
      nextActions: [
        {
          key: 'diagnostic',
          label: '去做一次诊断',
          description: '用一组短题校准当前基础。',
          href: '/sky/cloud-mind/teaching',
          topics: [],
        },
      ],
      evidence: [
        {
          label: '画像状态',
          value: '暂无做题、错题或测验数据',
          source: 'performance',
        },
      ],
      accuracy,
    };
  }

  const topNames = priorityTopics.map((topic) => topic.name).slice(0, 3);
  const first = topNames[0] ?? '当前主题';
  const second = topNames[1];
  const headline = second ? `先补${first}，再练${second}` : `先补${first}`;

  return {
    headline,
    summary: `正确率 ${accuracy}% · 薄弱点 ${priorityTopics.length} 个 · 推荐方式：${recommendedMode}`,
    priorityTopics,
    recommendedMode,
    nextActions: buildActions(topNames),
    evidence: buildEvidence(profile, preference, priorityTopics, accuracy),
    accuracy,
  };
}
