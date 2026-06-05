/**
 * Module C — Knowledge graph mastery calculation.
 *
 * Pure functions that work with GraphNode arrays.
 */
import type { GraphNode, LearningRecommendation } from './types';

/**
 * Calculate mastery level from error counts.
 * mastery = max(0, 100 - (errorCount / max(totalCount, 1)) * 100)
 */
export function calculateMastery(errorCount: number, totalCount: number): number {
  if (totalCount <= 0) return 100;
  const rate = errorCount / totalCount;
  return Math.max(0, Math.round(100 - rate * 100));
}

/**
 * Get weak points: nodes with mastery below the given threshold (default 50).
 * Returns nodes sorted from weakest to strongest.
 */
export function getWeakPoints(
  nodes: GraphNode[],
  threshold = 50,
): GraphNode[] {
  return nodes
    .filter((n) => n.mastery < threshold)
    .sort((a, b) => a.mastery - b.mastery);
}

/**
 * Build learning recommendations for weak points.
 */
export function buildRecommendations(
  weakPoints: GraphNode[],
  options?: { maxPerPoint?: number; defaultSuggest?: number },
): LearningRecommendation[] {
  const maxPerPoint = options?.maxPerPoint ?? 5;
  const defaultSuggest = options?.defaultSuggest ?? 3;

  return weakPoints.map((wp) => {
    let suggested = 0;
    let priority: LearningRecommendation['priority'];

    if (wp.mastery < 30) {
      suggested = maxPerPoint;
      priority = 'high';
    } else {
      suggested = defaultSuggest;
      priority = 'medium';
    }

    return {
      knowledgePoint: wp.name,
      currentMastery: wp.mastery,
      suggestedPractice: suggested,
      priority,
    };
  });
}

/** Overall mastery average across all nodes */
export function overallMastery(nodes: GraphNode[]): number {
  if (nodes.length === 0) return 100;
  const sum = nodes.reduce((a, n) => a + n.mastery, 0);
  return Math.round(sum / nodes.length);
}
