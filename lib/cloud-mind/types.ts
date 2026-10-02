import type { KBStats } from '@/lib/knowledge-base/types';
import type { ConversationProfileSummary } from '@/lib/student/profile-signals';
import type { LearnerDecision } from '@/lib/adaptive-learning/decision/learner-decision';

export type EvidenceType = 'mistake' | 'profile' | 'memory' | 'knowledge' | 'behavior';

export interface EvidenceItem {
  type: EvidenceType;
  title: string;
  summary: string;
  sourceId?: string;
  confidence?: number;
}

export type LearningRecommendationAction =
  | 'start_plan'
  | 'review_cards'
  | 'review_mistakes'
  | 'practice_quiz'
  | 'micro_lesson'
  | 'build_knowledge';

export interface LearningRecommendation {
  id: string;
  title: string;
  reason: string;
  priority: number;
  actionType: LearningRecommendationAction;
  target: {
    href: string;
    label: string;
    params?: Record<string, string | number | boolean>;
  };
  evidence: EvidenceItem[];
}

export interface WeakPointSummary {
  knowledgePoint: string;
  mastery: number;
  recentMistakeCount: number;
  actionHref: string;
}

export interface DueReviewItem {
  id: string;
  kind: 'mistake' | 'memory-card';
  title: string;
  knowledgePoints: string[];
  dueAt: number | null;
  href: string;
}

export interface RecentLearningRecord {
  id: string;
  source:
    | 'quiz'
    | 'mistake'
    | 'memory'
    | 'knowledge'
    | 'write'
    | 'slides'
    | 'profile';
  title: string;
  detail: string;
  createdAt: number;
  href?: string;
}

export interface ToolStatus {
  id: string;
  label: string;
  href: string;
  group: 'diagnosis' | 'alchemy' | 'classroom';
  status: 'ready' | 'beta';
}

export interface CloudMindDashboardData {
  userId: string;
  generatedAt: number;
  hasLearningData: boolean;
  recommendations: LearningRecommendation[];
  weakPoints: WeakPointSummary[];
  dueReviews: DueReviewItem[];
  recentRecords: RecentLearningRecord[];
  knowledgeStats: KBStats | null;
  toolStatus: ToolStatus[];
  summary: {
    totalQuestions: number;
    totalCorrect: number;
    masteryAverage: number;
    recentAccuracy: number | null;
  };
}

export type PersonalizationDifficulty = 'easy' | 'medium' | 'hard';

export type CloudMindToolTarget = 'solve' | 'slides' | 'quiz' | 'memory' | 'teaching';

export type TutoringExplanationStyle =
  | 'step_first'
  | 'principle_first'
  | 'example_first'
  | 'practice_first';

export type TutoringPacing = 'remedial' | 'steady' | 'sprint';

export type ToolPersonalizationMode =
  | 'diagnose'
  | 'practice'
  | 'retain'
  | 'teach'
  | 'present'
  | 'plan';

export type TutoringResourceFormat =
  | 'worked_example'
  | 'code_case'
  | 'diagram'
  | 'practice'
  | 'video'
  | 'summary';

export interface TutoringPolicy {
  targetTopic?: string;
  difficulty: PersonalizationDifficulty;
  explanationStyle: TutoringExplanationStyle;
  resourceFormats: TutoringResourceFormat[];
  pacing: TutoringPacing;
  directives: string[];
  evidence: Array<{
    source: 'profile' | 'performance' | 'path';
    summary: string;
    confidence?: number;
  }>;
}

export interface ToolPersonalizationPolicy {
  mode: ToolPersonalizationMode;
  targetTopic?: string;
  knowledgePoints: string[];
  difficulty: PersonalizationDifficulty;
  explanationStyle: TutoringExplanationStyle;
  pacing: TutoringPacing;
  questionCount: number;
  durationMinutes: number;
  action: 'diagnostic' | 'teach' | 'review' | 'quiz';
  explanationMode: 'immediate' | 'on-request';
  reasonCodes: string[];
}

export interface ToolPersonalizationPolicies {
  solve: ToolPersonalizationPolicy;
  quiz: ToolPersonalizationPolicy;
  memory: ToolPersonalizationPolicy;
  teaching: ToolPersonalizationPolicy;
  slides: ToolPersonalizationPolicy;
  learningPath: ToolPersonalizationPolicy;
}

export interface PersonalizationShadowComparison {
  baselineTargetTool: CloudMindToolTarget | null;
  newTargetTool: CloudMindToolTarget | null;
  baselineHref: string | null;
  newHref: string | null;
  changed: boolean;
}

export interface PersonalizationContext {
  userId: string;
  generatedAt: number;
  hasLearningData: boolean;
  hasPersonalizationSignals?: boolean;
  conversationProfile?: ConversationProfileSummary;
  weakPoints: WeakPointSummary[];
  masteryByKnowledge: Record<string, number>;
  recentAccuracy: number | null;
  dueReviews: DueReviewItem[];
  errorPatterns: Array<{
    knowledgePoint: string;
    errorType: string;
    frequency: number;
    lastOccurrence: string;
  }>;
  learningPath?: {
    current?: string;
    next?: string;
    nodes: string[];
    reason: string;
  };
  preferredDifficulty: PersonalizationDifficulty;
  learnerDecision?: LearnerDecision;
  shadowComparison?: PersonalizationShadowComparison;
  tutoringPolicy?: TutoringPolicy;
  toolPolicies?: ToolPersonalizationPolicies;
  recommendation: {
    title: string;
    reason: string;
    targetTool: CloudMindToolTarget;
    href: string;
  } | null;
}

export type MemoryReviewRating = 'remembered' | 'fuzzy' | 'forgotten';

export interface MemoryReviewRecord {
  id: string;
  cardId: string;
  deckId: string;
  userId: string;
  rating: MemoryReviewRating;
  reviewCount: number;
  mastery: number;
  lastReviewedAt: string;
  nextReviewAt: string;
  sourceType?: 'mistake' | 'manual' | 'write' | 'memory';
  sourceId?: string;
  front?: string;
  back?: string;
  tags?: string[];
}
