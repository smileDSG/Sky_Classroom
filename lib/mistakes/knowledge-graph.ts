/**
 * Knowledge graph builder for Sky Classroom Module C (C-002).
 *
 * @deprecated Use `lib/knowledge-graph/builder.ts` instead. Kept for backward compatibility.
 */

export {
  buildKnowledgeGraph,
  recommendLearningPath,
  getMasterySummary,
  inferCategory,
} from '@/lib/knowledge-graph/builder';

export type {
  KnowledgeGraph,
  KnowledgeNode,
  KnowledgeEdge,
  LearningPath,
} from '@/lib/knowledge-graph/types';
