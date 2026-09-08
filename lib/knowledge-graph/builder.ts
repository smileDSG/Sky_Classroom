/**
 * Unified Knowledge Graph Builder
 *
 * Builds a knowledge graph from mistake or learning records.
 * Previously located in lib/mistakes/knowledge-graph.ts.
 */

import type { KnowledgeGraph, KnowledgeNode, KnowledgeEdge, LearningPath } from './types';
import { KNOWLEDGE_RELATIONS } from './relations';

const EBBINGHAUS_MAX_ROUNDS = 6;

export function inferCategory(name: string): string {
  if (/方程|不等式|多项式|因式|整式|分式|根式|指数|对数|代数/.test(name)) return '代数';
  if (/函数|映射|单调|奇偶|周期|反函数|一次|二次|幂|指对/.test(name)) return '函数';
  if (/几何|三角|圆|向量|直线|平面|立体|棱|球|柱|锥|角|平行|垂直|相似|全等/.test(name))
    return '几何';
  if (/概率|随机|期望|方差|分布|频率|事件/.test(name)) return '概率';
  if (/统计|样本|总体|回归|相关|抽样|频率分布|中位|众数|平均/.test(name)) return '统计';
  if (/数列|等差|等比|通项|求和|递推/.test(name)) return '数列';
  if (/导数|微分|极限|积分|连续|可导/.test(name)) return '微积分';
  if (/集合|逻辑|充要|命题|子集|交集|并集|补集/.test(name)) return '集合与逻辑';
  return '综合';
}

interface RecordLike {
  id: string;
  knowledgePoints: string[];
  reviewCount?: number;
  reviewed?: boolean;
  lastReview?: number;
}

function calcNodeMastery(mistakesForKP: RecordLike[]): number {
  const count = mistakesForKP.length;
  if (count === 0) return 100;

  const penalty = count * 10;

  const avgReviewProgress =
    mistakesForKP.reduce((sum, m) => {
      return sum + Math.min((m.reviewCount ?? 0) / EBBINGHAUS_MAX_ROUNDS, 1);
    }, 0) / count;
  const reviewBonus = avgReviewProgress * 60;

  const now = Date.now();
  const staleCount = mistakesForKP.filter((m) => {
    if (m.reviewed) return false;
    if (!m.lastReview) return false;
    return now - m.lastReview > 7 * 86400000;
  }).length;
  const decay = staleCount * 5;

  return Math.max(0, Math.min(100, Math.round(100 - penalty + reviewBonus - decay)));
}

export function buildKnowledgeGraph<T extends RecordLike>(records: T[]): KnowledgeGraph {
  const kpSet = new Set<string>();
  const kpMistakeIds = new Map<string, Set<string>>();
  const kpProblemCount = new Map<string, number>();
  const kpMistakes = new Map<string, T[]>();

  for (const m of records) {
    const uniqueKps = [...new Set(m.knowledgePoints)];
    for (const kp of uniqueKps) {
      kpSet.add(kp);
      kpProblemCount.set(kp, (kpProblemCount.get(kp) ?? 0) + 1);
      if (!kpMistakeIds.has(kp)) {
        kpMistakeIds.set(kp, new Set());
        kpMistakes.set(kp, []);
      }
      kpMistakeIds.get(kp)!.add(m.id);
      kpMistakes.get(kp)!.push(m);
    }
  }

  const nodes: KnowledgeNode[] = [];
  for (const kp of kpSet) {
    const mistakeCount = kpMistakeIds.get(kp)?.size ?? 0;
    const relatedMistakes = kpMistakes.get(kp) ?? [];
    const reviewProgress =
      relatedMistakes.length > 0
        ? relatedMistakes.reduce(
            (sum, m) => sum + Math.min((m.reviewCount ?? 0) / EBBINGHAUS_MAX_ROUNDS, 1),
            0,
          ) / relatedMistakes.length
        : 0;
    nodes.push({
      id: kp,
      name: kp,
      category: inferCategory(kp),
      mastery: calcNodeMastery(relatedMistakes),
      problemCount: kpProblemCount.get(kp) ?? 0,
      mistakeCount,
      children: [],
      reviewProgress,
    });
  }

  const edges: KnowledgeEdge[] = [];
  const edgeKey = (f: string, t: string, r: string) => `${f}→${t}:${r}`;
  const edgeSet = new Set<string>();

  const addEdge = (from: string, to: string, relation: KnowledgeEdge['relation']) => {
    if (from === to) return;
    const key = edgeKey(from, to, relation);
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push({ from, to, relation });
    }
  };

  for (const m of records) {
    const kps = [...new Set(m.knowledgePoints)];
    for (let i = 0; i < kps.length; i++) {
      for (let j = i + 1; j < kps.length; j++) {
        addEdge(kps[i], kps[j], 'related');
        addEdge(kps[j], kps[i], 'related');
      }
    }
  }

  for (const [kp, rels] of Object.entries(KNOWLEDGE_RELATIONS)) {
    if (!kpSet.has(kp)) continue;
    for (const prereq of rels.prereqs ?? []) {
      if (kpSet.has(prereq)) addEdge(prereq, kp, 'prerequisite');
    }
    for (const related of rels.related ?? []) {
      if (kpSet.has(related)) addEdge(kp, related, 'related');
    }
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of edges) {
    if (edge.relation === 'prerequisite') {
      const parent = nodeMap.get(edge.from);
      if (parent && !parent.children.includes(edge.to)) {
        parent.children.push(edge.to);
      }
    }
  }

  const weakPoints = nodes.filter((n) => n.mastery < 50).map((n) => n.id);

  return { nodes, edges, weakPoints };
}

export function recommendLearningPath(graph: KnowledgeGraph): LearningPath {
  if (graph.nodes.length === 0) {
    return { startNode: '', nodes: [], reason: 'No knowledge nodes available yet.' };
  }

  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  for (const edge of graph.edges) {
    if (edge.relation === 'prerequisite') {
      if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
      outgoing.get(edge.from)!.push(edge.to);
      if (!incoming.has(edge.to)) incoming.set(edge.to, []);
      incoming.get(edge.to)!.push(edge.from);
    }
  }

  let weakest = graph.nodes[0];
  for (const node of graph.nodes) {
    if (node.mastery < weakest.mastery) weakest = node;
  }

  const prereqsInOrder: string[] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(nodeId: string) {
    if (visited.has(nodeId)) return;
    if (inStack.has(nodeId)) return;
    inStack.add(nodeId);
    const parents = incoming.get(nodeId) ?? [];
    for (const parent of [...parents].sort()) dfs(parent);
    inStack.delete(nodeId);
    visited.add(nodeId);
    prereqsInOrder.push(nodeId);
  }
  dfs(weakest.id);

  const forwardVisited = new Set<string>(prereqsInOrder);
  const queue: string[] = [weakest.id];
  const forwardOrder: string[] = [];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    forwardOrder.push(curr);
    const dependents = (outgoing.get(curr) ?? []).sort();
    for (const dep of dependents) {
      if (!forwardVisited.has(dep)) {
        forwardVisited.add(dep);
        queue.push(dep);
      }
    }
  }

  const prefixPrereqs = prereqsInOrder.filter((id) => id !== weakest.id);
  const fullPath = [...prefixPrereqs, ...forwardOrder];

  return {
    startNode: weakest.id,
    nodes: fullPath,
    reason: `Start with foundational concepts, then focus on "${weakest.name}" (mastery ${weakest.mastery}%) — your weakest knowledge area in ${weakest.category}.`,
  };
}

export function getMasterySummary(graph: KnowledgeGraph): {
  overallMastery: number;
  masteredCount: number;
  weakCount: number;
  totalCount: number;
} {
  const totalCount = graph.nodes.length;
  if (totalCount === 0) {
    return { overallMastery: 0, masteredCount: 0, weakCount: 0, totalCount: 0 };
  }
  const masterySum = graph.nodes.reduce((sum, n) => sum + n.mastery, 0);
  const overallMastery = Math.round(masterySum / totalCount);
  const masteredCount = graph.nodes.filter((n) => n.mastery >= 80).length;
  const weakCount = graph.nodes.filter((n) => n.mastery < 50).length;
  return { overallMastery, masteredCount, weakCount, totalCount };
}
