/**
 * Module C — Graph builder from DAO mistake entries.
 *
 * Reads MistakeBookEntry[] and constructs GraphResponse
 * (nodes + edges + weakPoints) for the knowledge-graph API.
 */
import type { GraphNode, GraphEdge, GraphResponse } from './types';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
function inferCategory(name: string): string {
  if (/方程|函数|代数/.test(name)) return '代数';
  if (/几何|三角|圆/.test(name)) return '几何';
  if (/概率|统计/.test(name)) return '概率';
  return '综合';
}

export function buildGraphFromMistakes(mistakes: MistakeBookEntry[]): GraphResponse {
  // 1. Index knowledge points
  const kpSet = new Set<string>();
  const kpMistakeIds = new Map<string, Set<string>>();
  const kpAppearanceCount = new Map<string, number>();

  for (const m of mistakes) {
    const uniqueKps = [...new Set(m.knowledgePoints)];
    for (const kp of uniqueKps) {
      kpSet.add(kp);
      kpAppearanceCount.set(kp, (kpAppearanceCount.get(kp) ?? 0) + 1);
      if (!kpMistakeIds.has(kp)) {
        kpMistakeIds.set(kp, new Set());
      }
      kpMistakeIds.get(kp)!.add(m.id);
    }
  }

  // 2. Build nodes
  const nodes: GraphNode[] = [];
  for (const kp of kpSet) {
    const mistakeCount = kpMistakeIds.get(kp)?.size ?? 0;
    const problemCount = kpAppearanceCount.get(kp) ?? 0;
    nodes.push({
      id: kp,
      name: kp,
      category: inferCategory(kp),
      mastery: Math.max(0, Math.round(100 - mistakeCount * 20)),
      problemCount,
      mistakeCount,
      children: [],
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
