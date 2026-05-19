/**
 * Sky Classroom mistakes module — barrel export.
 */

export type {
  MistakeRecord,
  MistakeFilter,
  MistakeStats,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraph,
  LearningPath,
} from './types';

export { getDB, addMistake, getAllMistakes, updateMistake, deleteMistake, clearAll } from './db';
export {
  trackMistake,
  getMistakes,
  markReviewed,
  deleteMistake as deleteTrackedMistake,
  getMistakeStats,
  exportMistakes,
} from './mistake-tracker';
export { analyzeMistakeCause, extractNumbers } from './cause-analyzer';
export { buildKnowledgeGraph, recommendLearningPath, getMasterySummary } from './knowledge-graph';
export { syncMistakesFromQuizzes } from './bridge';
