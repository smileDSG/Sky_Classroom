/**
 * Learning Path Types — Long-term curriculum planning
 */

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
