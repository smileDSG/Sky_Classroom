/**
 * Learning Path Engine — Long-term curriculum planning
 *
 * Builds and maintains multi-lesson learning paths based on:
 * - Knowledge graph (weak points, prerequisites)
 * - Student profile (mastery levels, error patterns)
 * - Teaching job history (completion, feedback, quiz results)
 */

import { nanoid } from 'nanoid';
import { buildKnowledgeGraph, recommendLearningPath } from '@/lib/knowledge-graph';
import { KNOWLEDGE_RELATIONS } from '@/lib/knowledge-graph/relations';
import type { KnowledgeGraph } from '@/lib/knowledge-graph/types';
import type { StudentProfile } from '@/lib/student/profile-types';
import type { TeachingJob } from '@/lib/server/teaching-job-store';
import type {
  LearningPath,
  LearningPathNode,
  PathEngineConfig,
} from './learning-path-types';
import { DEFAULT_PATH_CONFIG } from './learning-path-types';
import { createLogger } from '@/lib/logger';

const log = createLogger('LearningPathEngine');

interface RecordLike {
  id: string;
  knowledgePoints: string[];
  reviewCount?: number;
  reviewed?: boolean;
  lastReview?: number;
}

/**
 * Build a knowledge graph from the student's profile data.
 * Uses error patterns as proxy mistake records.
 */
function buildGraphFromProfile(profile: StudentProfile): KnowledgeGraph {
  const records: RecordLike[] = [];

  for (const [kp, mastery] of Object.entries(profile.masteryByKnowledge)) {
    // Simulate mistake records for weak points so the graph builder flags them
    const mistakeCount = Math.max(0, Math.ceil((100 - mastery) / 10));
    for (let i = 0; i < mistakeCount; i++) {
      records.push({
        id: `profile-${kp}-${i}`,
        knowledgePoints: [kp],
        reviewCount: mastery > 80 ? 5 : mastery > 50 ? 2 : 0,
        reviewed: mastery > 80,
        lastReview: Date.now() - (mastery > 80 ? 1 : 7) * 86400000,
      });
    }
  }

  return buildKnowledgeGraph(records);
}

/**
 * Collect prerequisite chain for a knowledge point using KNOWLEDGE_RELATIONS.
 */
function collectPrerequisites(point: string, visited = new Set<string>()): string[] {
  if (visited.has(point)) return [];
  visited.add(point);

  const rel = KNOWLEDGE_RELATIONS[point];
  const direct = rel?.prereqs ?? [];
  const transitive: string[] = [];
  for (const p of direct) {
    transitive.push(...collectPrerequisites(p, visited));
  }
  return [...transitive, ...direct];
}

/**
 * Group knowledge points into lesson-sized topics (1-3 points per topic).
 */
function groupIntoTopics(points: string[]): Array<{ topic: string; knowledgePoints: string[] }> {
  const groups: Array<{ topic: string; knowledgePoints: string[] }> = [];
  for (let i = 0; i < points.length; i += 3) {
    const kps = points.slice(i, i + 3);
    groups.push({
      topic: kps[0],
      knowledgePoints: kps,
    });
  }
  return groups;
}

/**
 * Build an initial learning path from a student profile.
 */
export function buildInitialPath(
  profile: StudentProfile,
  goalTopic?: string,
  config: PathEngineConfig = DEFAULT_PATH_CONFIG,
): LearningPath {
  const graph = buildGraphFromProfile(profile);

  let orderedPoints: string[];

  if (goalTopic && KNOWLEDGE_RELATIONS[goalTopic]) {
    // Goal-directed: prerequisites → goal → dependents
    const prereqs = collectPrerequisites(goalTopic);
    orderedPoints = [...prereqs, goalTopic];
  } else {
    // Reactive: use recommendLearningPath from weakest point
    const path = recommendLearningPath(graph);
    orderedPoints = path.nodes;
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const uniquePoints = orderedPoints.filter((p) => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });

  // Filter out already-mastered points unless they are prerequisites for weak points
  const weakSet = new Set(graph.weakPoints);
  const filtered = uniquePoints.filter((p, idx) => {
    const mastery = profile.masteryByKnowledge[p] ?? 0;
    const isWeak = weakSet.has(p);
    const isPrereqForLater = uniquePoints.slice(idx + 1).some((later) => {
      const prereqs = KNOWLEDGE_RELATIONS[later]?.prereqs ?? [];
      return prereqs.includes(p);
    });
    return isWeak || isPrereqForLater || mastery < config.masteryThresholdCompleted;
  });

  // Ensure minimum nodes
  let finalPoints = filtered;
  if (finalPoints.length < config.minNodes) {
    const extras = uniquePoints.filter((p) => !seen.has(p) || !finalPoints.includes(p));
    finalPoints = [...finalPoints, ...extras].slice(0, config.maxNodes);
  }

  // Cap at max
  finalPoints = finalPoints.slice(0, config.maxNodes);

  const topics = groupIntoTopics(finalPoints);

  const nodes: LearningPathNode[] = topics.map((t, i) => {
    const prereqs = t.knowledgePoints.flatMap((kp) =>
      (KNOWLEDGE_RELATIONS[kp]?.prereqs ?? []).filter((p) => !t.knowledgePoints.includes(p)),
    );
    const uniquePrereqs = [...new Set(prereqs)];

    return {
      id: nanoid(8),
      topic: t.topic,
      knowledgePoints: t.knowledgePoints,
      estimatedSections: Math.min(Math.max(t.knowledgePoints.length * 2, 2), 5),
      prerequisites: uniquePrereqs,
      status: i === 0 ? 'pending' : 'pending',
      masteryBefore: t.knowledgePoints.reduce((sum, kp) => sum + (profile.masteryByKnowledge[kp] ?? 0), 0) / t.knowledgePoints.length,
    };
  });

  const path: LearningPath = {
    id: nanoid(10),
    userId: profile.userId,
    title: goalTopic ? `攻克：${goalTopic}` : '个性化学习路径',
    nodes,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  log.info(`Built learning path ${path.id} for user ${profile.userId} with ${nodes.length} nodes`);
  return path;
}

/**
 * Calculate post-lesson mastery for knowledge points based on job feedback and quizzes.
 */
function calculatePostMastery(
  knowledgePoints: string[],
  job: TeachingJob,
  profile: StudentProfile,
): number {
  const baseMastery = knowledgePoints.reduce(
    (sum, kp) => sum + (profile.masteryByKnowledge[kp] ?? 0),
    0,
  ) / knowledgePoints.length;

  // Feedback signals
  const feedbacks = job.sectionFeedbacks ?? [];
  const masteredCount = feedbacks.filter((f) => f.feedbackType === 'mastered').length;
  const needsReviewCount = feedbacks.filter((f) => f.feedbackType === 'needs_review').length;
  const totalFeedback = masteredCount + needsReviewCount;

  // Quiz signals
  const quizzes = job.quizResults ?? [];
  const quizCorrect = quizzes.filter((q) => q.isCorrect).length;
  const quizTotal = quizzes.length;

  let adjustment = 0;

  if (totalFeedback > 0) {
    const feedbackRatio = masteredCount / totalFeedback;
    adjustment += (feedbackRatio - 0.5) * 30;
  }

  if (quizTotal > 0) {
    const quizRatio = quizCorrect / quizTotal;
    adjustment += (quizRatio - 0.5) * 40;
  }

  return Math.max(0, Math.min(100, Math.round(baseMastery + adjustment)));
}

/**
 * Update a learning path after a teaching job completes.
 */
export function updatePathAfterJob(
  path: LearningPath,
  job: TeachingJob,
  profile: StudentProfile,
  config: PathEngineConfig = DEFAULT_PATH_CONFIG,
): LearningPath {
  const updatedNodes = [...path.nodes];
  let modified = false;

  // Find the node that matches this job's topic or knowledge points
  const jobKPs = new Set(job.plan?.focusPoints ?? [job.topic]);
  const nodeIndex = updatedNodes.findIndex((n) =>
    n.teachingJobId === job.id ||
    n.knowledgePoints.some((kp) => jobKPs.has(kp)) ||
    n.topic === job.topic,
  );

  if (nodeIndex >= 0) {
    const node = updatedNodes[nodeIndex];
    const masteryAfter = calculatePostMastery(node.knowledgePoints, job, profile);

    updatedNodes[nodeIndex] = {
      ...node,
      teachingJobId: job.id,
      masteryAfter,
      status: masteryAfter >= config.masteryThresholdCompleted ? 'completed' : 'in_progress',
    };
    modified = true;

    // If completed, mark next pending node as in_progress
    if (masteryAfter >= config.masteryThresholdCompleted) {
      const nextIndex = updatedNodes.findIndex(
        (n, i) => i > nodeIndex && n.status === 'pending',
      );
      if (nextIndex >= 0) {
        updatedNodes[nextIndex] = {
          ...updatedNodes[nextIndex],
          status: 'in_progress',
        };
      }
    }

    // If very weak, insert a review node before the next node
    if (masteryAfter < config.masteryThresholdReview) {
      const reviewNode: LearningPathNode = {
        id: nanoid(8),
        topic: `复习：${node.topic}`,
        knowledgePoints: node.knowledgePoints,
        estimatedSections: 2,
        prerequisites: [],
        status: 'pending',
        masteryBefore: masteryAfter,
      };
      updatedNodes.splice(nodeIndex + 1, 0, reviewNode);
      modified = true;
    }
  }

  if (!modified) {
    log.warn(`No matching node found for job ${job.id} in path ${path.id}`);
  }

  return {
    ...path,
    nodes: updatedNodes,
    updatedAt: Date.now(),
  };
}

/**
 * Get the next recommended topic from a learning path.
 */
export function getNextRecommendedTopic(path: LearningPath): string | null {
  const nextNode = path.nodes.find(
    (n) => n.status === 'pending' || n.status === 'in_progress',
  );
  return nextNode?.topic ?? null;
}

/**
 * Get path completion percentage.
 */
export function getPathProgress(path: LearningPath): number {
  if (path.nodes.length === 0) return 0;
  const completed = path.nodes.filter((n) => n.status === 'completed').length;
  return Math.round((completed / path.nodes.length) * 100);
}
