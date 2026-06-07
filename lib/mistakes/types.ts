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

// ── Knowledge graph ──────────────────────────────────────────────

export interface KnowledgeNode {
  id: string;
  name: string;
  category: string;           // 代数/几何/概率...
  mastery: number;            // 掌握度 0-100
  problemCount: number;
  mistakeCount: number;
  children: string[];         // 子知识点 ID
}

export interface KnowledgeEdge {
  from: string;
  to: string;
  relation: 'prerequisite' | 'related' | 'extension';
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  weakPoints: string[];       // 薄弱知识点（错误率 > 50%）
}

export interface LearningPath {
  startNode: string;
  nodes: string[];            // recommended learning order
  reason: string;
}
