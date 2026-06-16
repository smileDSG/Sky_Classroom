/**
 * Mistake Review Teaching Planner — 错题回溯授课引擎
 *
 * Analyzes selected mistakes, extracts weak knowledge points and error patterns,
 * then builds a focused lesson topic and plan for targeted review.
 */

import { createLogger } from '@/lib/logger';
import { KNOWLEDGE_RELATIONS, buildKnowledgeGraph } from '@/lib/knowledge-graph';
import type { KnowledgeGraph } from '@/lib/knowledge-graph/types';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';

const log = createLogger('MistakeReviewPlanner');

export interface MistakeReviewPlan {
  topic: string;
  title: string;
  weakPoints: string[];
  errorPatterns: Array<{ cause: string; count: number; examples: string[] }>;
  prerequisiteChain: string[];
  estimatedSections: number;
}

/**
 * Build a knowledge graph from MistakeBookEntry records.
 */
function buildGraphFromEntries(entries: MistakeBookEntry[]): KnowledgeGraph {
  return buildKnowledgeGraph(
    entries.map((e) => ({
      id: e.id,
      knowledgePoints: e.knowledgePoints,
      reviewCount: e.reviewCount,
      reviewed: e.reviewed,
      lastReview: e.lastReview,
    })),
  );
}

/**
 * Collect prerequisite chain for the given knowledge points.
 */
function collectPrerequisites(points: string[]): string[] {
  const chain = new Set<string>();
  for (const point of points) {
    const rel = KNOWLEDGE_RELATIONS[point];
    if (rel?.prereqs) {
      for (const p of rel.prereqs) chain.add(p);
    }
  }
  return [...chain];
}

/**
 * Analyze selected mistakes and generate a review teaching plan.
 */
export function planMistakeReview(mistakes: MistakeBookEntry[]): MistakeReviewPlan {
  if (mistakes.length === 0) {
    return {
      topic: '错题回顾',
      title: '错题回溯授课',
      weakPoints: [],
      errorPatterns: [],
      prerequisiteChain: [],
      estimatedSections: 0,
    };
  }

  // 1. Extract knowledge points
  const kpFrequency = new Map<string, number>();
  for (const m of mistakes) {
    for (const kp of m.knowledgePoints) {
      kpFrequency.set(kp, (kpFrequency.get(kp) ?? 0) + 1);
    }
  }

  // Sort by frequency (desc)
  const sortedKPs = [...kpFrequency.entries()].sort((a, b) => b[1] - a[1]);
  const weakPoints = sortedKPs.map(([kp]) => kp);

  // 2. Build knowledge graph to compute true weak points
  const graph = buildGraphFromEntries(mistakes);
  const graphWeakPoints = graph.weakPoints.length > 0
    ? graph.weakPoints
    : weakPoints.slice(0, 3);

  // 3. Analyze error patterns
  const causeMap = new Map<string, { count: number; examples: string[] }>();
  for (const m of mistakes) {
    const cause = m.errorType;
    if (!causeMap.has(cause)) {
      causeMap.set(cause, { count: 0, examples: [] });
    }
    const entry = causeMap.get(cause)!;
    entry.count += 1;
    if (entry.examples.length < 3) {
      entry.examples.push(m.problemText.slice(0, 60));
    }
  }
  const errorPatterns = [...causeMap.entries()].map(([cause, data]) => ({
    cause,
    count: data.count,
    examples: data.examples,
  })).sort((a, b) => b.count - a.count);

  // 4. Collect prerequisites
  const prerequisiteChain = collectPrerequisites(graphWeakPoints);

  // 5. Build topic string
  const topKP = graphWeakPoints[0] ?? weakPoints[0] ?? '错题';
  const topic = topKP;
  const title = `错题回溯：${topKP}${graphWeakPoints.length > 1 ? ' 等' : ''} (${mistakes.length}道错题)`;

  const estimatedSections = Math.min(
    Math.max(graphWeakPoints.length + (prerequisiteChain.length > 0 ? 1 : 0), 1),
    6,
  );

  log.info(
    `Mistake review planned: topic="${topic}", weakPoints=${graphWeakPoints.length}, ` +
    `patterns=${errorPatterns.length}, prerequisites=${prerequisiteChain.length}`,
  );

  return {
    topic,
    title,
    weakPoints: graphWeakPoints,
    errorPatterns,
    prerequisiteChain,
    estimatedSections,
  };
}

/**
 * Convert a MistakeReviewPlan into a teaching topic description
 * that can be submitted to the existing teaching job system.
 */
export function buildTeachingTopicFromReview(plan: MistakeReviewPlan): string {
  const parts: string[] = [plan.topic];

  if (plan.weakPoints.length > 1) {
    parts.push(`（重点：${plan.weakPoints.join('、')}）`);
  }

  if (plan.errorPatterns.length > 0) {
    const topCauses = plan.errorPatterns.slice(0, 2).map((p) => {
      const causeMap: Record<string, string> = {
        calculation: '计算失误',
        concept: '概念不清',
        reasoning: '推理错误',
        reading: '审题错误',
        careless: '粗心大意',
      };
      return causeMap[p.cause] ?? p.cause;
    });
    parts.push(`[需关注错因：${topCauses.join('、')}]`);
  }

  return parts.join('');
}
