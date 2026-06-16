/**
 * Unified Knowledge Graph — barrel export.
 *
 * Cross-module shared types and builders for knowledge graphs.
 */

export type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraph,
  KnowledgeRelation,
  LearningPath,
} from './types';

export {
  KNOWLEDGE_RELATIONS,
} from './relations';

export {
  buildKnowledgeGraph,
  recommendLearningPath,
  getMasterySummary,
  inferCategory,
} from './builder';
