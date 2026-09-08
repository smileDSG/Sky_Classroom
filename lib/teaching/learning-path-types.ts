/**
 * Learning Path Types — Long-term curriculum planning
 */

import type { StudentProfile } from '@/lib/student/profile-types';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import type { KnowledgeGraph } from '@/lib/knowledge-graph/types';
import type { ReviewSchedule } from '@/lib/schedule/review-scheduler';
import type { QuizPerformanceSummary } from '@/lib/student/quiz-performance-analyzer';

export interface LearningPathNode {
  id: string;
  topic: string;
  knowledgePoints: string[];
  estimatedSections: number;
  prerequisites: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  teachingJobId?: string;
  masteryBefore?: number;
  masteryAfter?: number;
}

export interface LearningPath {
  id: string;
  userId: string;
  title: string;
  nodes: LearningPathNode[];
  createdAt: number;
  updatedAt: number;
}

export interface PathEngineConfig {
  maxNodes: number;
  minNodes: number;
  masteryThresholdCompleted: number;
  masteryThresholdReview: number;
}

export const DEFAULT_PATH_CONFIG: PathEngineConfig = {
  maxNodes: 10,
  minNodes: 3,
  masteryThresholdCompleted: 80,
  masteryThresholdReview: 50,
};

/** Strategy choices shown to the user in the generation dialog */
export type PriorityStrategy = 'weakness' | 'review' | 'error-pattern' | 'goal-topic' | 'balanced';

/** User-facing strategy alias (single-select convenience) */
export type StrategyAlias =
  | 'balanced'
  | 'weakness-first'
  | 'review-first'
  | 'error-first'
  | 'goal-topic';

/** Options sent from the learning-path generation dialog */
export interface PathGenerationOptions {
  goalTopic?: string;
  priorities?: PriorityStrategy[];
  strategy?: StrategyAlias;
}

/** Weights used to combine scoring factors */
export interface ScoreWeights {
  weakness: number;
  reviewUrgency: number;
  errorPattern: number;
  recentQuiz: number;
  goalBoost: number;
}

/** A knowledge point with its per-factor scores */
export interface ScoredKnowledgePoint {
  knowledgePoint: string;
  score: number;
  breakdown: {
    weakness: number;
    reviewUrgency: number;
    errorPattern: number;
    recentQuiz: number;
    goalBoost: number;
  };
}

/** Response shape of /api/sky/learning-stats */
export interface LearningStatsResponse {
  todayStudyMinutes: number;
  streakDays: number;
  masteryPercent: number;
  checkedInToday: boolean;
  problemsAttempted?: number;
  problemsCorrect?: number;
  scenesCompleted?: number;
}

/** Rich context that feeds the learning-path engine with all 天梯工坊 data */
export interface PathGenerationContext {
  profile: StudentProfile;
  mistakes: MistakeBookEntry[];
  knowledgeGraph: KnowledgeGraph;
  reviewSchedule: ReviewSchedule;
  learningStats: LearningStatsResponse | null;
  quizSummary: QuizPerformanceSummary | null;
}
