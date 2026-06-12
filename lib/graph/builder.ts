/**
 * Module C — Graph builder from DAO mistake entries.
 *
 * Reads MistakeBookEntry[] and constructs GraphResponse
 * (nodes + edges + weakPoints) for the knowledge-graph API.
 */
import type { GraphNode, GraphEdge, GraphResponse } from './types';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import { KNOWLEDGE_RELATIONS } from '@/lib/mistakes/knowledge-relations';

const EBBINGHAUS_MAX_ROUNDS = 6;

function inferCategory(name: string): string {
  if (/方程|函数|代数/.test(name)) return '代数';
  if (/几何|三角|圆/.test(name)) return '几何';
  if (/概率|统计/.test(name)) return '概率';
  return '综合';
}

/**
 * Calculate mastery for a knowledge point based on its associated mistakes.
 * Factors in: mistake count (penalty), review progress (bonus), and time decay.
 */
function calcNodeMastery(mistakesForKP: MistakeBookEntry[]): number {
  const count = mistakesForKP.length;
  if (count === 0) return 100;

  const penalty = count * 10;

  const avgReviewProgress = mistakesForKP.reduce((sum, m) => {
    return sum + Math.min(m.reviewCount / EBBINGHAUS_MAX_ROUNDS, 1);
  }, 0) / count;
  const reviewBonus = avgReviewProgress * 60;

  const now = Date.now();
  const staleCount = mistakesForKP.filter((m) => {
    if (m.reviewed) return false;
    if (!m.lastReview) return false;
    return (now - m.lastReview) > 7 * 86400000;
  }).length;
  const decay = staleCount * 5;

  return Math.max(0, Math.min(100, Math.round(100 - penalty + reviewBonus - decay)));
}

export function buildGraphFromMistakes(mistakes: MistakeBookEntry[]): GraphResponse {
  // 1. Index knowledge points
  const kpSet = new Set<string>();
  const kpMistakeIds = new Map<string, Set<string>>();
  const kpAppearanceCount = new Map<string, number>();
  const kpMistakes = new Map<string, MistakeBookEntry[]>();

  for (const m of mistakes) {
    const uniqueKps = [...new Set(m.knowledgePoints)];
    for (const kp of uniqueKps) {
      kpSet.add(kp);
      kpAppearanceCount.set(kp, (kpAppearanceCount.get(kp) ?? 0) + 1);
      if (!kpMistakeIds.has(kp)) {
        kpMistakeIds.set(kp, new Set());
        kpMistakes.set(kp, []);
      }
      kpMistakeIds.get(kp)!.add(m.id);
      kpMistakes.get(kp)!.push(m);
    }
  }

  // 2. Build nodes
  const nodes: GraphNode[] = [];
  for (const kp of kpSet) {
    const mistakeCount = kpMistakeIds.get(kp)?.size ?? 0;
    const problemCount = kpAppearanceCount.get(kp) ?? 0;
    const relatedMistakes = kpMistakes.get(kp) ?? [];
    const reviewProgress = relatedMistakes.length > 0
      ? relatedMistakes.reduce((sum, m) => sum + Math.min(m.reviewCount / EBBINGHAUS_MAX_ROUNDS, 1), 0) / relatedMistakes.length
      : 0;
    nodes.push({
      id: kp,
      name: kp,
      category: inferCategory(kp),
      mastery: calcNodeMastery(relatedMistakes),
      problemCount,
      mistakeCount,
      children: [],
      reviewProgress,
    });
  }

  // 3. Build edges
  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>();

  const addEdge = (from: string, to: string, relation: GraphEdge['relation']) => {
    if (from === to) return;
    const key = `${from}→${to}:${relation}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push({ from, to, relation });
    }
  };

  // 3a. Related edges from co-occurrence
  for (const m of mistakes) {
    const kps = [...new Set(m.knowledgePoints)];
    for (let i = 0; i < kps.length; i++) {
      for (let j = i + 1; j < kps.length; j++) {
        addEdge(kps[i], kps[j], 'related');
        addEdge(kps[j], kps[i], 'related');
      }
    }
  }

  // 3b. Prerequisite edges from prefix
  const kpList = [...kpSet];
  for (const a of kpList) {
    for (const b of kpList) {
      if (a !== b && b.startsWith(a)) {
        addEdge(a, b, 'prerequisite');
      }
    }
  }

  // 3c. Mapping table edges — from the knowledge relations table
  for (const [kp, rels] of Object.entries(KNOWLEDGE_RELATIONS)) {
    if (!kpSet.has(kp)) continue;
    for (const prereq of rels.prereqs ?? []) {
      if (kpSet.has(prereq)) addEdge(prereq, kp, 'prerequisite');
    }
    for (const related of rels.related ?? []) {
      if (kpSet.has(related)) addEdge(kp, related, 'related');
    }
  }

  // 4. Populate children
  for (const edge of edges) {
    if (edge.relation === 'prerequisite') {
      const parent = nodes.find((n) => n.id === edge.from);
      if (parent && !parent.children.includes(edge.to)) {
        parent.children.push(edge.to);
      }
    }
  }

  // 5. Weak points
  const weakPoints = nodes.filter((n) => n.mastery < 50).map((n) => n.id);

  return { nodes, edges, weakPoints };
}
