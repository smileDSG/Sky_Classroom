/**
 * Unified Knowledge Graph Types
 *
 * Shared across mistakes, teaching, and student-profile modules.
 * Previously defined in lib/mistakes/types.ts; extracted here for cross-module reuse.
 */

export interface KnowledgeNode {
  id: string;
  name: string;
  category: string;
  mastery: number;
  problemCount: number;
  mistakeCount: number;
  children: string[];
  reviewProgress: number;
}

export interface KnowledgeEdge {
  from: string;
  to: string;
  relation: 'prerequisite' | 'related' | 'extension';
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  weakPoints: string[];
}

export interface KnowledgeRelation {
  prereqs?: string[];
  related?: string[];
}

export interface LearningPath {
  startNode: string;
  nodes: string[];
  reason: string;
}
