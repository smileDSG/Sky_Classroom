/**
 * Learning Path Engine — Long-term curriculum planning
 *
 * Builds and maintains multi-lesson learning paths based on:
 * - Knowledge graph (weak points, prerequisites)
 * - Student profile (mastery levels, error patterns)
 * - Teaching job history (completion, feedback, quiz results)
 * - Full workshop data (mistakes, review schedule, learning stats, quiz performance)
 */

import { nanoid } from 'nanoid';
import { buildKnowledgeGraph, recommendLearningPath } from '@/lib/knowledge-graph';
import { KNOWLEDGE_RELATIONS } from '@/lib/knowledge-graph/relations';
import { buildReviewSchedule } from '@/lib/schedule/review-scheduler';
import type { KnowledgeGraph } from '@/lib/knowledge-graph/types';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import type { StudentProfile } from '@/lib/student/profile-types';
import type { TeachingJob } from '@/lib/server/teaching-job-store';
import { createLogger } from '@/lib/logger';
import type {
  LearningPath,
  LearningPathNode,
  PathEngineConfig,
  PathGenerationContext,
  PathGenerationOptions,
  PriorityStrategy,
  ScoredKnowledgePoint,
  ScoreWeights,
  StrategyAlias,
} from './learning-path-types';
import { DEFAULT_PATH_CONFIG } from './learning-path-types';

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
 * Build a fallback knowledge-point list from the built-in relation map when
 * the student has no workshop data yet. If a goal topic is given, anchor the
 * path on its prerequisite chain; otherwise pick a balanced set of foundational
 * high-school math topics. Returns de-duplicated, ordered points.
 */
function seedFallbackPoints(goalTopic: string | undefined, maxNodes: number): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (kp: string) => {
    if (!seen.has(kp)) {
      seen.add(kp);
      ordered.push(kp);
    }
  };

  if (goalTopic && KNOWLEDGE_RELATIONS[goalTopic]) {
    // Prerequisite chain first (deepest first), then the goal itself.
    for (const p of collectPrerequisites(goalTopic)) push(p);
    push(goalTopic);
  }

  // Foundational backbone used when there is no goal or the chain is too short.
  const FOUNDATION = [
    '函数概念',
    '一次函数',
    '一元一次方程',
    '一元二次方程',
    '二次函数',
    '不等式',
    '三角形',
    '全等三角形',
    '相似三角形',
    '勾股定理',
    '概率',
    '统计',
  ];
  for (const kp of FOUNDATION) {
    if (ordered.length >= maxNodes) break;
    push(kp);
  }

  return ordered.slice(0, maxNodes);
}

// ── New workshop-aware path generation ───────────────────────────────

/** Build a minimal context from a profile for backward-compatible callers. */
function buildMinimalContext(profile: StudentProfile): PathGenerationContext {
  return {
    profile,
    mistakes: [],
    knowledgeGraph: buildGraphFromProfile(profile),
    reviewSchedule: buildReviewSchedule([]),
    learningStats: null,
    quizSummary: profile.recentQuizPerformance ?? null,
  };
}

/** Map user-facing strategy/priorities to internal score weights. */
export function resolveWeights(options?: PathGenerationOptions): ScoreWeights {
  const strategy = options?.strategy;
  const priorities = options?.priorities;

  // Multi-select explicit priorities take precedence
  if (priorities && priorities.length > 0 && !strategy) {
    const selected = new Set(priorities);
    const pick = (key: PriorityStrategy) => (selected.has(key) ? 1.5 : selected.has('balanced') ? 1.0 : 0.5);
    return {
      weakness: pick('weakness'),
      reviewUrgency: pick('review'),
      errorPattern: pick('error-pattern'),
      recentQuiz: selected.has('balanced') ? 0.8 : 0.5,
      goalBoost: selected.has('goal-topic') ? 2.0 : 0.5,
    };
  }

  switch (strategy) {
    case 'weakness-first':
      return { weakness: 2.0, reviewUrgency: 0.5, errorPattern: 0.5, recentQuiz: 0.5, goalBoost: 0.3 };
    case 'review-first':
      return { weakness: 0.5, reviewUrgency: 2.0, errorPattern: 0.5, recentQuiz: 0.3, goalBoost: 0.3 };
    case 'error-first':
      return { weakness: 0.5, reviewUrgency: 0.5, errorPattern: 2.0, recentQuiz: 0.5, goalBoost: 0.3 };
    case 'goal-topic':
      return { weakness: 0.5, reviewUrgency: 0.3, errorPattern: 0.3, recentQuiz: 0.3, goalBoost: 2.5 };
    case 'balanced':
    default:
      return { weakness: 1.0, reviewUrgency: 1.0, errorPattern: 1.0, recentQuiz: 0.8, goalBoost: 0.5 };
  }
}

/** Normalize weights so they sum to 1. */
function normalizeWeights(weights: ScoreWeights): ScoreWeights {
  const sum =
    weights.weakness +
    weights.reviewUrgency +
    weights.errorPattern +
    weights.recentQuiz +
    weights.goalBoost;
  if (sum === 0) return weights;
  return {
    weakness: weights.weakness / sum,
    reviewUrgency: weights.reviewUrgency / sum,
    errorPattern: weights.errorPattern / sum,
    recentQuiz: weights.recentQuiz / sum,
    goalBoost: weights.goalBoost / sum,
  };
}

/** Count due/overdue mistakes per knowledge point. */
function groupDueMistakesByKP(
  mistakes: MistakeBookEntry[],
): Map<string, { due: number; overdue: number }> {
  const now = Date.now();
  const map = new Map<string, { due: number; overdue: number }>();
  for (const m of mistakes) {
    if (m.reviewed || !m.nextReview || m.nextReview > now) continue;
    const overdue = m.nextReview > 0 && m.nextReview < now - 24 * 60 * 60 * 1000;
    for (const kp of m.knowledgePoints) {
      const entry = map.get(kp) ?? { due: 0, overdue: 0 };
      entry.due += 1;
      if (overdue) entry.overdue += 1;
      map.set(kp, entry);
    }
  }
  return map;
}

/** Aggregate error-pattern frequency per knowledge point. */
function groupErrorPatternsByKP(profile: StudentProfile): Map<string, number> {
  const map = new Map<string, number>();
  for (const pattern of profile.errorPatterns ?? []) {
    map.set(pattern.knowledgePoint, (map.get(pattern.knowledgePoint) ?? 0) + pattern.frequency);
  }
  return map;
}

/** Compute shortest prerequisite distance from goal topic to every KP. */
function computeGoalDistanceMap(goalTopic?: string): Map<string, number> {
  const distances = new Map<string, number>();
  if (!goalTopic) return distances;

  // Direct match
  distances.set(goalTopic, 0);

  // BFS outward through prerequisite edges
  const queue: Array<{ point: string; distance: number }> = [{ point: goalTopic, distance: 0 }];
  const visited = new Set<string>([goalTopic]);

  while (queue.length > 0) {
    const { point, distance } = queue.shift()!;
    const rel = KNOWLEDGE_RELATIONS[point];
    const prereqs = rel?.prereqs ?? [];
    for (const prereq of prereqs) {
      if (visited.has(prereq)) continue;
      visited.add(prereq);
      const d = distance + 1;
      distances.set(prereq, d);
      queue.push({ point: prereq, distance: d });
    }
  }

  return distances;
}

/**
 * Score every candidate knowledge point across multiple workshop dimensions.
 */
export function scoreKnowledgePoints(
  context: PathGenerationContext,
  options?: PathGenerationOptions,
): ScoredKnowledgePoint[] {
  const { profile, mistakes, knowledgeGraph, quizSummary } = context;
  const weights = normalizeWeights(resolveWeights(options));
  const dueByKP = groupDueMistakesByKP(mistakes);
  const errorByKP = groupErrorPatternsByKP(profile);
  const goalDistances = computeGoalDistanceMap(options?.goalTopic);

  // Candidate set: profile mastery + graph nodes
  const candidateSet = new Set<string>(Object.keys(profile.masteryByKnowledge));
  for (const node of knowledgeGraph.nodes) {
    candidateSet.add(node.name);
  }
  if (options?.goalTopic) {
    candidateSet.add(options.goalTopic);
    const prereqs = collectPrerequisites(options.goalTopic);
    for (const p of prereqs) candidateSet.add(p);
  }

  const nodeMap = new Map(knowledgeGraph.nodes.map((n) => [n.name, n]));
  const result: ScoredKnowledgePoint[] = [];

  for (const kp of candidateSet) {
    const mastery = profile.masteryByKnowledge[kp] ?? nodeMap.get(kp)?.mastery ?? 50;
    const mistakeCount = nodeMap.get(kp)?.mistakeCount ?? 0;

    // 0-100: lower mastery + more mistakes = higher score
    const weakness = Math.min(100, 100 - mastery + mistakeCount * 5);

    // 0-100: more due/overdue reviews = higher score
    const dueInfo = dueByKP.get(kp);
    const reviewUrgency = Math.min(100, (dueInfo?.due ?? 0) * 20 + (dueInfo?.overdue ?? 0) * 10);

    // 0-100: more frequent error patterns = higher score
    const errorPattern = Math.min(100, (errorByKP.get(kp) ?? 0) * 15);

    // 0-100: lower recent quiz accuracy = higher score
    const recentAccuracy = quizSummary?.accuracyByKnowledge?.[kp] ?? 50;
    const recentQuiz = 100 - recentAccuracy;

    // 0-100: closer to goal topic = higher score
    const distance = goalDistances.get(kp);
    let goalBoost = 0;
    if (distance !== undefined) {
      goalBoost = distance === 0 ? 100 : distance === 1 ? 70 : distance === 2 ? 40 : 20;
    }

    const score = Math.round(
      weakness * weights.weakness +
      reviewUrgency * weights.reviewUrgency +
      errorPattern * weights.errorPattern +
      recentQuiz * weights.recentQuiz +
      goalBoost * weights.goalBoost,
    );

    result.push({
      knowledgePoint: kp,
      score,
      breakdown: {
        weakness,
        reviewUrgency,
        errorPattern,
        recentQuiz,
        goalBoost,
      },
    });
  }

  return result;
}

/**
 * Sort knowledge points by score and insert prerequisites before each point.
 */
export function rankKnowledgePoints(
  scored: ScoredKnowledgePoint[],
  _context: PathGenerationContext,
  _options?: PathGenerationOptions,
): string[] {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const item of sorted) {
    if (seen.has(item.knowledgePoint)) continue;

    // Insert prerequisites first
    const prereqs = collectPrerequisites(item.knowledgePoint);
    for (const prereq of prereqs) {
      if (!seen.has(prereq)) {
        ordered.push(prereq);
        seen.add(prereq);
      }
    }

    ordered.push(item.knowledgePoint);
    seen.add(item.knowledgePoint);
  }

  return ordered;
}

/**
 * Build an initial learning path from a full workshop context.
 */
export function buildInitialPathFromContext(
  context: PathGenerationContext,
  options?: PathGenerationOptions,
  config: PathEngineConfig = DEFAULT_PATH_CONFIG,
): LearningPath {
  const { profile } = context;
  const goalTopic = options?.goalTopic;

  const scored = scoreKnowledgePoints(context, options);
  let orderedPoints = rankKnowledgePoints(scored, context, options);

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const uniquePoints = orderedPoints.filter((p) => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });

  // Filter out already-mastered points unless they are prerequisites for weak/goal points
  const weakSet = new Set(context.knowledgeGraph.weakPoints);
  const goalDistances = computeGoalDistanceMap(goalTopic);
  const filtered = uniquePoints.filter((p, idx) => {
    const mastery = profile.masteryByKnowledge[p] ??
      context.knowledgeGraph.nodes.find((n) => n.name === p)?.mastery ??
      0;
    const isWeak = weakSet.has(p);
    const isGoalRelated = goalDistances.has(p);
    const isPrereqForLater = uniquePoints.slice(idx + 1).some((later) => {
      const prereqs = KNOWLEDGE_RELATIONS[later]?.prereqs ?? [];
      return prereqs.includes(p);
    });
    return isWeak || isGoalRelated || isPrereqForLater || mastery < config.masteryThresholdCompleted;
  });

  // Ensure minimum nodes
  let finalPoints = filtered;
  if (finalPoints.length < config.minNodes) {
    const extras = uniquePoints.filter((p) => !finalPoints.includes(p));
    finalPoints = [...finalPoints, ...extras].slice(0, config.maxNodes);
  }

  // Fallback: when the user has no workshop data yet (no mistakes / profile /
  // graph), the candidate set above is empty and we would otherwise produce a
  // path with zero nodes. Seed it from the built-in knowledge system so the
  // generated path is always meaningful, not a blank shell.
  if (finalPoints.length < config.minNodes) {
    const seeded = seedFallbackPoints(goalTopic, config.maxNodes);
    const existing = new Set(finalPoints);
    for (const p of seeded) {
      if (existing.has(p)) continue;
      finalPoints.push(p);
      existing.add(p);
      if (finalPoints.length >= config.minNodes && finalPoints.length >= 3) break;
    }
    finalPoints = finalPoints.slice(0, config.maxNodes);
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
      status: 'pending',
      masteryBefore:
        t.knowledgePoints.reduce((sum, kp) => sum + (profile.masteryByKnowledge[kp] ?? 0), 0) /
        t.knowledgePoints.length,
    };
  });

  const title = goalTopic
    ? `攻克：${goalTopic}`
    : options?.strategy
      ? `个性化学习路径 · ${getStrategyLabel(options.strategy)}`
      : '个性化学习路径';

  const path: LearningPath = {
    id: nanoid(10),
    userId: profile.userId,
    title,
    nodes,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  log.info(`Built learning path ${path.id} for user ${profile.userId} with ${nodes.length} nodes`);
  return path;
}

function getStrategyLabel(strategy: StrategyAlias): string {
  const labels: Record<StrategyAlias, string> = {
    balanced: '均衡提升',
    'weakness-first': '薄弱优先',
    'review-first': '复习到期优先',
    'error-first': '错因攻坚',
    'goal-topic': '目标主题',
  };
  return labels[strategy] ?? '均衡提升';
}

/**
 * Build an initial learning path from a student profile (backward-compatible).
 */
export function buildInitialPath(
  profile: StudentProfile,
  goalTopic?: string,
  config: PathEngineConfig = DEFAULT_PATH_CONFIG,
): LearningPath {
  const context = buildMinimalContext(profile);
  const options: PathGenerationOptions = goalTopic
    ? { goalTopic, strategy: 'goal-topic' }
    : { strategy: 'balanced' };
  return buildInitialPathFromContext(context, options, config);
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
