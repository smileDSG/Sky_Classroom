import type { LearnerDecision } from '@/lib/adaptive-learning/decision/learner-decision';
import type {
  PersonalizationContext,
  PersonalizationDifficulty,
  TutoringPacing,
} from '@/lib/cloud-mind/types';

export type SlidesAdaptiveAction = LearnerDecision['action'];
export type SlidesAdaptiveFormat = LearnerDecision['format'];

export interface SlidesAdaptivePolicy {
  targetTopic: string | null;
  action: SlidesAdaptiveAction;
  difficulty: PersonalizationDifficulty;
  format: SlidesAdaptiveFormat;
  pacing: TutoringPacing;
  durationMinutes: number;
  questionCount: number;
  explanationMode: LearnerDecision['explanationMode'];
  reasonCodes: string[];
  summary: string;
  minPages: number;
  maxPages: number;
  contentPlan: string[];
}

const DEFAULT_SUMMARY = '根据当前画像调整课件的内容深度、讲解顺序和练习比例。';

function resolvePageRange(
  action: SlidesAdaptiveAction,
  durationMinutes: number,
  difficulty: PersonalizationDifficulty,
): { minPages: number; maxPages: number } {
  if (action === 'diagnostic') return { minPages: 6, maxPages: 8 };
  if (action === 'review') return { minPages: 8, maxPages: 12 };
  if (action === 'quiz') {
    return difficulty === 'hard' ? { minPages: 12, maxPages: 16 } : { minPages: 10, maxPages: 14 };
  }
  if (durationMinutes <= 8) return { minPages: 8, maxPages: 10 };
  if (durationMinutes <= 12) return { minPages: 10, maxPages: 14 };
  return { minPages: 12, maxPages: 16 };
}

function derivePacing(
  action: SlidesAdaptiveAction,
  difficulty: PersonalizationDifficulty,
): TutoringPacing {
  if (action === 'diagnostic' || action === 'teach') return 'remedial';
  if (action === 'quiz' && difficulty === 'hard') return 'sprint';
  return 'steady';
}

function deriveContentPlan(
  action: SlidesAdaptiveAction,
  format: SlidesAdaptiveFormat,
  questionCount: number,
): string[] {
  const formatStep =
    format === 'diagram'
      ? '用概念图和关系图建立直觉'
      : format === 'interactive'
        ? '用互动问题带动内容展开'
        : '用完整例题逐步拆解方法';

  if (action === 'diagnostic') {
    return ['先做前置知识快速检查', formatStep, `安排 ${questionCount} 个诊断检查点`];
  }
  if (action === 'review') {
    return [
      '先唤醒旧知识和关键公式',
      '对比高频易错点与正确方法',
      `安排 ${questionCount} 个巩固检查点`,
    ];
  }
  if (action === 'quiz') {
    return ['压缩回顾关键结论', formatStep, `安排 ${questionCount} 个递进验证题`];
  }
  return ['先补齐前置概念', formatStep, `安排 ${questionCount} 个即时理解检查`];
}

function buildPolicy(input: {
  targetTopic?: string | null;
  action?: SlidesAdaptiveAction;
  difficulty?: PersonalizationDifficulty;
  format?: SlidesAdaptiveFormat;
  pacing?: TutoringPacing;
  durationMinutes?: number;
  questionCount?: number;
  explanationMode?: LearnerDecision['explanationMode'];
  reasonCodes?: string[];
  summary?: string;
}): SlidesAdaptivePolicy {
  const action = input.action ?? 'teach';
  const difficulty = input.difficulty ?? 'medium';
  const format = input.format ?? (action === 'quiz' ? 'interactive' : 'worked-example');
  const durationMinutes = Math.max(5, Math.min(30, input.durationMinutes ?? 10));
  const questionCount = Math.max(1, Math.min(10, input.questionCount ?? 3));
  const pageRange = resolvePageRange(action, durationMinutes, difficulty);

  return {
    targetTopic: input.targetTopic?.trim() || null,
    action,
    difficulty,
    format,
    pacing: input.pacing ?? derivePacing(action, difficulty),
    durationMinutes,
    questionCount,
    explanationMode: input.explanationMode ?? 'immediate',
    reasonCodes: input.reasonCodes ?? [],
    summary: input.summary?.trim() || DEFAULT_SUMMARY,
    ...pageRange,
    contentPlan: deriveContentPlan(action, format, questionCount),
  };
}

export function buildSlidesAdaptivePolicyFromDecision(
  decision?: LearnerDecision | null,
): SlidesAdaptivePolicy | null {
  if (!decision) return null;
  return buildPolicy({
    targetTopic: decision.topic,
    action: decision.action,
    difficulty: decision.difficulty,
    format: decision.format,
    durationMinutes: decision.durationMinutes,
    questionCount: decision.questionCount,
    explanationMode: decision.explanationMode,
    reasonCodes: decision.reasonCodes,
    summary: decision.summary,
  });
}

export function buildSlidesAdaptivePolicyFromContext(
  context?: PersonalizationContext | null,
): SlidesAdaptivePolicy | null {
  if (!context) return null;
  const decision = context.learnerDecision;
  const toolPolicy = context.toolPolicies?.slides;
  const format: SlidesAdaptiveFormat =
    decision?.format ??
    (toolPolicy?.explanationStyle === 'principle_first'
      ? 'diagram'
      : toolPolicy?.explanationStyle === 'practice_first'
        ? 'interactive'
        : 'worked-example');

  return buildPolicy({
    targetTopic:
      toolPolicy?.targetTopic ??
      decision?.topic ??
      context.tutoringPolicy?.targetTopic ??
      context.learningPath?.next ??
      context.weakPoints[0]?.knowledgePoint,
    action: decision?.action ?? toolPolicy?.action,
    difficulty: decision?.difficulty ?? toolPolicy?.difficulty ?? context.preferredDifficulty,
    format,
    pacing: toolPolicy?.pacing ?? context.tutoringPolicy?.pacing,
    durationMinutes: decision?.durationMinutes ?? toolPolicy?.durationMinutes,
    questionCount: decision?.questionCount ?? toolPolicy?.questionCount,
    explanationMode: decision?.explanationMode ?? toolPolicy?.explanationMode,
    reasonCodes: decision?.reasonCodes ?? toolPolicy?.reasonCodes,
    summary: decision?.summary ?? context.tutoringPolicy?.directives[0],
  });
}

export function buildSlidesPromptDirective(policy?: SlidesAdaptivePolicy | null): string {
  if (!policy) return '';
  const actionDirective: Record<SlidesAdaptiveAction, string> = {
    diagnostic: '先确认前置知识，只讲最小必要内容，并用短问题发现真实断点。',
    teach: '先补基础概念，再用分步示例建立方法，避免直接跳到综合难题。',
    review: '以主动回忆、易错对比和间隔复习为主，不要大段重复首次讲解。',
    quiz: '减少重复讲解，增加递进练习、迁移题和结果验证。',
  };
  const formatDirective: Record<SlidesAdaptiveFormat, string> = {
    'worked-example': '以完整例题拆解为主要教学载体。',
    diagram: '优先使用关系图、流程图、示意图和视觉标注。',
    interactive: '每个核心段落后加入可回答的问题或挑战任务。',
  };

  return [
    'Learner-profile adaptation is mandatory for both outline and slide content.',
    `Profile judgement: ${policy.summary}`,
    `Adaptive action: ${policy.action}. ${actionDirective[policy.action]}`,
    `Content difficulty: ${policy.difficulty}.`,
    `Teaching format: ${policy.format}. ${formatDirective[policy.format]}`,
    `Pacing: ${policy.pacing}; target duration about ${policy.durationMinutes} minutes.`,
    `Include about ${policy.questionCount} learner checkpoints across the deck; explanation mode is ${policy.explanationMode}.`,
    `Recommended structure: ${policy.contentPlan.join(' → ')}.`,
    policy.targetTopic ? `Keep the learner focus on: ${policy.targetTopic}.` : '',
    policy.reasonCodes.length > 0 ? `Profile reason codes: ${policy.reasonCodes.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
