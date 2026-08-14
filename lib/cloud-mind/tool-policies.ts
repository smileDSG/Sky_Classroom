import type { LearnerDecision } from '@/lib/adaptive-learning/decision/learner-decision';
import type {
  DueReviewItem,
  ToolPersonalizationPolicies,
  ToolPersonalizationPolicy,
  TutoringPolicy,
  WeakPointSummary,
} from './types';
import { isInternalKnowledgePoint, resolveTopicLabel } from './topic-label';

function unique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function firstDisplayable(values: Array<string | null | undefined>): string | undefined {
  return values
    .map((value) => resolveTopicLabel(value))
    .find((value): value is string => Boolean(value));
}

function withToolReasonCodes(policy: ToolPersonalizationPolicy, toolCode: string) {
  return {
    ...policy,
    reasonCodes: unique([...policy.reasonCodes, toolCode]),
  };
}

function basePolicy(input: {
  decision?: LearnerDecision;
  tutoringPolicy: TutoringPolicy;
  weakPoints: WeakPointSummary[];
  dueReviews: DueReviewItem[];
  targetTopic?: string;
}): ToolPersonalizationPolicy {
  const decision = input.decision;
  const targetTopic = firstDisplayable([
    input.targetTopic,
    decision?.topic,
    input.weakPoints[0]?.knowledgePoint,
  ]);
  const knowledgePoints = unique([
    targetTopic,
    ...input.weakPoints.slice(0, 3).map((point) => point.knowledgePoint),
    ...input.dueReviews.slice(0, 3).flatMap((item) => item.knowledgePoints),
  ])
    .filter((value) => !isInternalKnowledgePoint(value))
    .slice(0, 8);

  return {
    mode: 'teach',
    targetTopic,
    knowledgePoints,
    difficulty: decision?.difficulty ?? input.tutoringPolicy.difficulty,
    explanationStyle: input.tutoringPolicy.explanationStyle,
    pacing: input.tutoringPolicy.pacing,
    questionCount: decision?.questionCount ?? 5,
    durationMinutes: decision?.durationMinutes ?? 15,
    action: decision?.action ?? 'teach',
    explanationMode: decision?.explanationMode ?? 'immediate',
    reasonCodes: decision?.reasonCodes ?? [],
  };
}

export function buildToolPersonalizationPolicies(input: {
  decision?: LearnerDecision;
  tutoringPolicy: TutoringPolicy;
  weakPoints: WeakPointSummary[];
  dueReviews: DueReviewItem[];
  learningPath?: { current?: string; next?: string };
}): ToolPersonalizationPolicies {
  const targetTopic = firstDisplayable([
    input.decision?.topic,
    input.tutoringPolicy.targetTopic,
    input.learningPath?.next,
    input.learningPath?.current,
    input.weakPoints[0]?.knowledgePoint,
    ...input.dueReviews.flatMap((item) => item.knowledgePoints),
  ]);
  const shared = basePolicy({ ...input, targetTopic });
  const reviewTopics = unique(input.dueReviews.slice(0, 3).flatMap((item) => item.knowledgePoints));
  const reviewTopic = firstDisplayable([...reviewTopics, targetTopic]);
  const hasEvidence = input.weakPoints.length > 0 || input.dueReviews.length > 0;
  const diagnostic = input.decision?.action === 'diagnostic' || !hasEvidence;

  return {
    solve: withToolReasonCodes(
      {
        ...shared,
        mode: 'diagnose',
        targetTopic: reviewTopic,
        difficulty: diagnostic ? 'easy' : shared.difficulty,
        questionCount: 1,
        durationMinutes: 5,
        action: diagnostic ? 'diagnostic' : 'teach',
        explanationMode: 'immediate',
      },
      'tool-solve',
    ),
    quiz: withToolReasonCodes(
      {
        ...shared,
        mode: 'practice',
        action: diagnostic ? 'diagnostic' : 'quiz',
        questionCount: input.decision?.questionCount ?? (diagnostic ? 3 : 5),
        durationMinutes: input.decision?.durationMinutes ?? (diagnostic ? 5 : 12),
        explanationMode: diagnostic ? 'immediate' : 'on-request',
      },
      'tool-quiz',
    ),
    memory: withToolReasonCodes(
      {
        ...shared,
        mode: 'retain',
        targetTopic: reviewTopic,
        knowledgePoints: unique([...reviewTopics, ...shared.knowledgePoints])
          .filter((value) => !isInternalKnowledgePoint(value))
          .slice(0, 8),
        action: 'review',
        questionCount: Math.max(5, Math.min(12, input.dueReviews.length || shared.questionCount)),
        durationMinutes: Math.max(8, Math.min(20, input.dueReviews.length * 2 || 10)),
        explanationMode: 'on-request',
      },
      'tool-memory',
    ),
    teaching: withToolReasonCodes(
      {
        ...shared,
        mode: 'teach',
        action: 'teach',
        questionCount: 3,
        durationMinutes: input.decision?.action === 'teach' ? shared.durationMinutes : 10,
        explanationMode: 'immediate',
      },
      'tool-teaching',
    ),
    slides: withToolReasonCodes(
      {
        ...shared,
        mode: 'present',
        action: 'teach',
        questionCount: 0,
        durationMinutes: Math.max(12, shared.durationMinutes),
        explanationMode: 'on-request',
      },
      'tool-slides',
    ),
    learningPath: withToolReasonCodes(
      {
        ...shared,
        mode: 'plan',
        targetTopic: input.learningPath?.next ?? input.learningPath?.current ?? targetTopic,
        action: 'teach',
        questionCount: 0,
        durationMinutes: Math.max(20, shared.durationMinutes),
        explanationMode: 'on-request',
      },
      'tool-learning-path',
    ),
  };
}
