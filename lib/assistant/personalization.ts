import type { GraphNode } from '@/lib/graph/types';
import type { StudentProfile } from '@/lib/student/profile-types';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import type { UserEntry } from '@/lib/storage/dao/users';
import type { QuestionBankEntry } from '@/lib/solve/types';
import type { TeachingPreference } from '@/lib/onboarding/types';
import type { ProductIdentity } from '@/lib/onboarding/catalog';
import { readUniversalOnboarding } from '@/lib/onboarding/migration';
import {
  buildIdentityProfileInstructions,
  getPrimaryIdentityProfile,
} from '@/lib/onboarding/selectors';

export type AssistantAnswerDepth = 'concise' | 'standard' | 'detailed' | 'comprehensive';
export type AssistantTeachingMode =
  | 'direct'
  | 'socratic'
  | 'visual'
  | 'example_first'
  | 'hint_first';
export type AssistantDifficulty = 'easier' | 'current' | 'challenge';
export type AssistantTone = 'friendly' | 'professional' | 'encouraging' | 'strict' | 'humorous';
export type AssistantNextAction = 'quiz' | 'review' | 'summary' | 'none';
export type AssistantPrimaryAction =
  | 'explain_problem'
  | 'hint_first'
  | 'generate_quiz'
  | 'add_mistake'
  | 'update_mastery'
  | 'review_plan'
  | 'retrieve_knowledge';

export interface AssistantPersonalization {
  educationLevel?: string | null;
  grade?: string | null;
  learningStyle?: string | null;
  detailLevel?: string | null;
  preferredLanguage?: string | null;
  aiPersonality?: string | null;
  aiName?: string | null;
  customInstructions?: string | null;
  showStepByStep?: boolean | null;
  enableMemory?: boolean | null;
  enableRAG?: boolean | null;
  teachingPreference?: TeachingPreference | null;
  productIdentity?: ProductIdentity | null;
  profileInstructions?: string[] | null;
}

export interface AssistantStrategy {
  answerDepth: AssistantAnswerDepth;
  teachingMode: AssistantTeachingMode;
  difficulty: AssistantDifficulty;
  tone: AssistantTone;
  shouldMentionProfile: boolean;
  recommendedNextAction: AssistantNextAction;
}

export interface BuildAssistantStrategyInput {
  userMessage: string;
  style?: string;
  profile?: StudentProfile | null;
  personalization?: AssistantPersonalization | null;
}

export interface AssistantRagEvidenceItem {
  type: 'mistake' | 'solve-history' | 'knowledge-graph';
  title: string;
  summary: string;
  sourceId?: string;
  knowledgePoints: string[];
  score: number;
}

export interface AssistantRagEvidence {
  summary: string;
  items: AssistantRagEvidenceItem[];
}

export interface BuildAssistantRagEvidenceInput {
  userMessage: string;
  mistakes?: MistakeBookEntry[] | null;
  graphNodes?: GraphNode[] | null;
  solveHistory?: QuestionBankEntry[] | null;
  maxItems?: number;
}

export interface AssistantActionPlan {
  primaryAction: AssistantPrimaryAction;
  reason: string;
  promptInstruction: string;
}

export interface AssistantPersonalizationStreamEvidenceItem {
  type: AssistantRagEvidenceItem['type'];
  title: string;
  summary: string;
  knowledgePoints: string[];
}

export interface AssistantPersonalizationStreamPayload {
  strategy: AssistantStrategy;
  evidence: {
    summary: string;
    items: AssistantPersonalizationStreamEvidenceItem[];
  } | null;
  actionPlan: AssistantActionPlan;
  focusTopic?: string;
}

export interface BuildAssistantPromptInput {
  userMessage: string;
  strategy: AssistantStrategy;
  evidence?: AssistantRagEvidence | null;
  actionPlan?: AssistantActionPlan | null;
  personalization?: AssistantPersonalization | null;
}

const DEFAULT_STRATEGY: AssistantStrategy = {
  answerDepth: 'standard',
  teachingMode: 'direct',
  difficulty: 'current',
  tone: 'friendly',
  shouldMentionProfile: false,
  recommendedNextAction: 'none',
};

const DEPTH_LABELS: Record<AssistantAnswerDepth, string> = {
  concise: '简洁，先给关键结论和最少步骤',
  standard: '标准，解释核心思路和必要步骤',
  detailed: '详细，拆清概念、步骤和检验方法',
  comprehensive: '全面，补充背景、变式和迁移提醒',
};

const MODE_LABELS: Record<AssistantTeachingMode, string> = {
  direct: '直接讲解',
  socratic: '启发式提问',
  visual: '图像化或结构化说明',
  example_first: '先用例子带入',
  hint_first: '先给提示，再逐步讲解',
};

const DIFFICULTY_LABELS: Record<AssistantDifficulty, string> = {
  easier: '降低一级，先补基础台阶',
  current: '保持当前难度',
  challenge: '可适当挑战或做迁移',
};

const TONE_LABELS: Record<AssistantTone, string> = {
  friendly: '友善自然',
  professional: '专业严谨',
  encouraging: '鼓励引导',
  strict: '严格指出问题但不打击',
  humorous: '轻松幽默但不影响准确性',
};

export const TEACHING_PREFERENCE_INSTRUCTIONS: Record<TeachingPreference, string> = {
  'example-first': '先给一个贴近当前知识点的例题，再抽象出规则。',
  'visual-explanation': '优先用表格、结构图或空间关系组织解释。',
  'step-by-step': '把推导拆成连续步骤，每步只引入一个新变化。',
  'practice-first': '先给低负担尝试题或提示，再根据作答讲解。',
  balanced: '根据问题在讲解、例子和练习之间保持均衡。',
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '');
}

function includesLoose(haystack: string, needle: string): boolean {
  const h = normalize(haystack);
  const n = normalize(needle);
  if (!h || !n) return false;
  return h.includes(n) || n.includes(h);
}

function getStyleDepth(style?: string): AssistantAnswerDepth {
  if (style === 'concise') return 'concise';
  if (style === 'detailed') return 'detailed';
  return DEFAULT_STRATEGY.answerDepth;
}

function getStyleMode(style?: string): AssistantTeachingMode {
  if (style === 'heuristic') return 'socratic';
  return DEFAULT_STRATEGY.teachingMode;
}

function getPreferredDepth(
  personalization?: AssistantPersonalization | null,
): AssistantAnswerDepth {
  switch (personalization?.detailLevel) {
    case 'concise':
    case 'standard':
    case 'detailed':
    case 'comprehensive':
      return personalization.detailLevel;
    default:
      return DEFAULT_STRATEGY.answerDepth;
  }
}

function getPreferredMode(
  personalization?: AssistantPersonalization | null,
): AssistantTeachingMode | null {
  switch (personalization?.learningStyle) {
    case 'visual':
      return 'visual';
    case 'kinesthetic':
      return 'example_first';
    case 'auditory':
      return 'socratic';
    case 'reading':
      return 'direct';
    default:
      return null;
  }
}

function getPreferredTone(personalization?: AssistantPersonalization | null): AssistantTone {
  switch (personalization?.aiPersonality) {
    case 'professional':
    case 'encouraging':
    case 'strict':
    case 'humorous':
    case 'friendly':
      return personalization.aiPersonality;
    default:
      return DEFAULT_STRATEGY.tone;
  }
}

function findRelevantWeakPoint(
  userMessage: string,
  profile?: StudentProfile | null,
): { point: string; mastery: number } | null {
  if (!profile) return null;

  for (const point of profile.weakPoints) {
    if (includesLoose(userMessage, point)) {
      return { point, mastery: profile.masteryByKnowledge[point] ?? 0 };
    }
  }

  const weakByMastery = Object.entries(profile.masteryByKnowledge)
    .filter(([, mastery]) => mastery < 50)
    .sort((a, b) => a[1] - b[1]);

  const matched = weakByMastery.find(([point]) => includesLoose(userMessage, point));
  return matched ? { point: matched[0], mastery: matched[1] } : null;
}

function hasRelevantErrorPattern(userMessage: string, profile?: StudentProfile | null): boolean {
  return Boolean(
    profile?.errorPatterns.some(
      (pattern) => pattern.frequency >= 2 && includesLoose(userMessage, pattern.knowledgePoint),
    ),
  );
}

function getOverallAccuracy(profile?: StudentProfile | null): number | null {
  if (!profile || profile.totalQuestions <= 0) return null;
  return Math.round((profile.totalCorrect / profile.totalQuestions) * 100);
}

export function buildAssistantStrategy(input: BuildAssistantStrategyInput): AssistantStrategy {
  const personalization = input.personalization;
  const relevantWeakPoint = findRelevantWeakPoint(input.userMessage, input.profile);
  const relevantErrorPattern = hasRelevantErrorPattern(input.userMessage, input.profile);
  const overallAccuracy = getOverallAccuracy(input.profile);
  const preferredMode = getPreferredMode(personalization);
  const preferredDepth =
    personalization?.detailLevel === undefined || personalization.detailLevel === null
      ? getStyleDepth(input.style)
      : getPreferredDepth(personalization);

  const strategy: AssistantStrategy = {
    ...DEFAULT_STRATEGY,
    answerDepth: preferredDepth,
    teachingMode: preferredMode ?? getStyleMode(input.style),
    tone: getPreferredTone(personalization),
  };

  if (
    relevantWeakPoint ||
    relevantErrorPattern ||
    (overallAccuracy !== null && overallAccuracy < 50)
  ) {
    strategy.difficulty = 'easier';
    strategy.shouldMentionProfile = Boolean(relevantWeakPoint || relevantErrorPattern);
    strategy.recommendedNextAction = 'quiz';
    if (!preferredMode || preferredMode === 'direct' || preferredMode === 'socratic') {
      strategy.teachingMode = 'hint_first';
    }
    if (!personalization?.aiPersonality) {
      strategy.tone = 'encouraging';
    }
  }

  if (!relevantWeakPoint && input.profile) {
    const matchedStrong = input.profile.strongPoints.find((point) =>
      includesLoose(input.userMessage, point),
    );
    if (matchedStrong) {
      strategy.difficulty = 'challenge';
      strategy.recommendedNextAction = 'none';
      strategy.shouldMentionProfile = true;
    }
  }

  return strategy;
}

function scoreKnowledgeMatch(userMessage: string, knowledgePoints: string[], text = ''): number {
  let score = 0;
  for (const point of knowledgePoints) {
    if (includesLoose(userMessage, point)) score += 3;
  }
  if (text && includesLoose(text, userMessage)) score += 1;
  return score;
}

function compactText(value: string, maxLength = 80): string {
  const singleLine = value.replace(/\s+/g, ' ').trim();
  return singleLine.length > maxLength ? `${singleLine.slice(0, maxLength)}...` : singleLine;
}

export function buildAssistantRagEvidence(
  input: BuildAssistantRagEvidenceInput,
): AssistantRagEvidence {
  const maxItems = input.maxItems ?? 5;
  const items: AssistantRagEvidenceItem[] = [];

  for (const mistake of input.mistakes ?? []) {
    const score = scoreKnowledgeMatch(
      input.userMessage,
      mistake.knowledgePoints,
      mistake.problemText,
    );
    if (score <= 0) continue;
    items.push({
      type: 'mistake',
      title: `错题：${compactText(mistake.problemText, 48)}`,
      summary: `知识点 ${mistake.knowledgePoints.join('、')}，错因 ${mistake.errorType}。`,
      sourceId: mistake.id,
      knowledgePoints: mistake.knowledgePoints,
      score,
    });
  }

  for (const entry of input.solveHistory ?? []) {
    const knowledgePoints = entry.knowledgePoints.map((point) => point.name);
    const score = scoreKnowledgeMatch(input.userMessage, knowledgePoints, entry.problemText);
    if (score <= 0) continue;
    items.push({
      type: 'solve-history',
      title: `历史题：${compactText(entry.problemText, 48)}`,
      summary: `曾练过 ${knowledgePoints.join('、')}。`,
      sourceId: entry.id,
      knowledgePoints,
      score,
    });
  }

  for (const node of input.graphNodes ?? []) {
    const score = scoreKnowledgeMatch(input.userMessage, [node.name]);
    if (score <= 0) continue;
    items.push({
      type: 'knowledge-graph',
      title: `知识点：${node.name}`,
      summary: `当前掌握度约 ${node.mastery}%。`,
      sourceId: node.id,
      knowledgePoints: [node.name],
      score,
    });
  }

  const ranked = items.sort((a, b) => b.score - a.score).slice(0, maxItems);
  const points = Array.from(new Set(ranked.flatMap((item) => item.knowledgePoints))).slice(0, 4);
  const summary =
    ranked.length > 0 ? `相关证据：${points.join('、')}。` : '暂无与当前问题强相关的历史证据。';

  return { summary, items: ranked };
}

export function buildAssistantActionPlan(message: string): AssistantActionPlan {
  if (/懂了|会了|明白了|掌握了|学会了/.test(message)) {
    return {
      primaryAction: 'update_mastery',
      reason: '用户表达已经理解，适合记录正向学习反馈。',
      promptInstruction: '先简短确认，再建议用一道小题自检；不要重复大段讲解。',
    };
  }

  if (/再.*题|练.*题|出.*题|小测|测验|quiz/i.test(message)) {
    return {
      primaryAction: 'generate_quiz',
      reason: '用户请求继续练习。',
      promptInstruction: '优先给一题同知识点的小练习，并说明它检验什么。',
    };
  }

  if (/复习|回顾|巩固|记忆卡|review/i.test(message)) {
    return {
      primaryAction: 'review_plan',
      reason: '用户请求复习或巩固。',
      promptInstruction: '先整理复习顺序，再给短周期练习建议。',
    };
  }

  if (/错题|加入|记录|收藏/.test(message)) {
    return {
      primaryAction: 'add_mistake',
      reason: '用户可能希望沉淀错题。',
      promptInstruction: '说明可记录的题干、错因和知识点，并询问是否需要加入错题本。',
    };
  }

  if (/提示|先别说答案|别直接|hint/i.test(message)) {
    return {
      primaryAction: 'hint_first',
      reason: '用户希望先获得提示。',
      promptInstruction: '只给第一层提示，等用户继续追问再展开。',
    };
  }

  if (/题|怎么做|求|证明|计算|方程|函数/.test(message)) {
    return {
      primaryAction: 'explain_problem',
      reason: '用户正在请求讲题或解题。',
      promptInstruction: '围绕题目逐步讲解，并在结尾给一个检验点。',
    };
  }

  return {
    primaryAction: 'retrieve_knowledge',
    reason: '用户请求知识解释或普通答疑。',
    promptInstruction: '先解释概念，再给一个贴近学生水平的例子。',
  };
}

function nextActionInstruction(action: AssistantNextAction): string {
  switch (action) {
    case 'quiz':
      return '结尾优先建议一道同知识点小练习。';
    case 'review':
      return '结尾优先建议短周期复习。';
    case 'summary':
      return '结尾优先给三点以内总结。';
    case 'none':
      return '结尾不强行追加任务。';
  }
}

export function buildAssistantPersonalizationPrompt(input: BuildAssistantPromptInput): string {
  const { strategy, evidence, actionPlan } = input;
  const lines = [
    '',
    '【个性化教学策略】',
    `- 回答深度：${DEPTH_LABELS[strategy.answerDepth]}。`,
    `- 教学方式：${MODE_LABELS[strategy.teachingMode]}。`,
    `- 难度调节：${DIFFICULTY_LABELS[strategy.difficulty]}。`,
    `- 交流语气：${TONE_LABELS[strategy.tone]}。`,
    `- 下一步：${nextActionInstruction(strategy.recommendedNextAction)}`,
  ];

  if (strategy.shouldMentionProfile) {
    lines.push('- 可以自然提及学生最近的薄弱点或错因，但不要说“根据用户画像”这类内部表述。');
  } else {
    lines.push('- 不要强行提及历史表现，只把画像用于调整讲法。');
  }

  if (input.personalization?.customInstructions) {
    lines.push(`- 用户特殊要求：${compactText(input.personalization.customInstructions, 120)}。`);
  }

  if (input.personalization?.teachingPreference) {
    lines.push(
      `- 讲解偏好：${TEACHING_PREFERENCE_INSTRUCTIONS[input.personalization.teachingPreference]}`,
    );
  }

  for (const instruction of input.personalization?.profileInstructions ?? []) {
    lines.push(`- ${compactText(instruction, 120)}。`);
  }

  if (evidence?.summary) {
    lines.push('', '【可用学习证据】', `- ${evidence.summary}`);
    for (const item of evidence.items.slice(0, 3)) {
      lines.push(`- ${item.title}：${item.summary}`);
    }
  }

  if (actionPlan) {
    lines.push(
      '',
      '【轻量行动决策】',
      `- ${actionPlan.reason}`,
      `- ${actionPlan.promptInstruction}`,
    );
  }

  lines.push('', '要求：隐藏以上策略标签，不要暴露内部证据编号；回答要像真正了解学生的老师。');

  return lines.join('\n').slice(0, 1800);
}

export function pickPersonalizationFromUser(user: UserEntry | null): AssistantPersonalization {
  if (!user) return {};
  const onboarding = readUniversalOnboarding(user);
  const primaryProfile = getPrimaryIdentityProfile(onboarding);
  return {
    educationLevel: user.educationLevel,
    grade: user.grade,
    learningStyle: user.learningStyle,
    detailLevel: user.detailLevel,
    preferredLanguage: user.preferredLanguage,
    aiPersonality: user.aiPersonality,
    aiName: user.aiName,
    customInstructions: user.customInstructions,
    showStepByStep: user.showStepByStep,
    enableMemory: user.enableMemory,
    enableRAG: user.enableRAG,
    teachingPreference:
      primaryProfile?.identity === 'learner' ? primaryProfile.preferences.explanationStyle : null,
    productIdentity: primaryProfile?.identity ?? null,
    profileInstructions: buildIdentityProfileInstructions(onboarding),
  };
}
