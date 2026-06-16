/**
 * Shared types for the Sky Classroom mistakes/knowledge-graph module.
 */

import type { MistakeCause } from '@/lib/solve/types';

// ── Mistake tracker ──────────────────────────────────────────────

export interface MistakeRecord {
  id: string;
  problem: string;
  userAnswer: string;
  correctAnswer: string;
  cause: MistakeCause;
  solvedAt: Date;
  reviewed: boolean;
  reviewCount: number;
  knowledgePoints: string[];
  /** Timestamp of the most recent review */
  lastReview?: number;
  /** Computed next review timestamp (ms epoch) */
  nextReview?: number;
  /** Mastery level = reviewCount, capped at EBBINGHAUS_INTERVALS.length */
  masteryLevel?: number;
  /** Source of the mistake entry */
  source?: 'classroom-quiz' | 'solve' | 'manual' | 'review';
  /** Session ID (stageId or solve session) that produced this mistake */
  sourceSessionId?: string;
  /** Step-by-step solution process (AI-generated or manually entered) */
  solutionSteps?: string[];
  /** Tiered hints: [思路方向, 关键公式, 详细计算] */
  hints?: string[];
  /** Detailed explanation of why the user's answer was wrong */
  errorExplanation?: string;
}

export type MistakeFilter =
  | { type: 'cause'; value: MistakeCause }
  | { type: 'knowledgePoint'; value: string }
  | { type: 'dateRange'; from: Date; to: Date }
  | { type: 'reviewed'; value: boolean };

export interface MistakeStats {
  totalCount: number;
  reviewedCount: number;
  causeDistribution: Record<MistakeCause, number>;
  recentCount: number;  // last 7 days
}

// ── Knowledge graph (re-exported from unified module) ───────────

export type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraph,
  LearningPath,
} from '@/lib/knowledge-graph/types';
