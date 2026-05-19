/**
 * Knowledge graph builder for Sky Classroom Module C (C-002).
 *
 * Builds a knowledge graph from MistakeRecord[], infers category from
 * knowledge-point names, assigns mastery scores, creates prerequisite
 * and related edges, and recommends a personalised learning path.
 */

import type {
  MistakeRecord,
  KnowledgeGraph,
  KnowledgeNode,
  KnowledgeEdge,
  LearningPath,
} from './types';

// ── Helpers ──────────────────────────────────────────────────────────

function inferCategory(name: string): string {
  if (/方程|函数|代数/.test(name)) return '代数';
  if (/几何|三角|圆/.test(name)) return '几何';
  if (/概率|统计/.test(name)) return '概率';
  return '综合';
}

// ── Build ────────────────────────────────────────────────────────────

export function buildKnowledgeGraph(
  mistakes: MistakeRecord[],
): KnowledgeGraph {
  // ── 1. Index knowledge points across all mistakes ──────────────
  const kpSet = new Set<string>();
  const kpMistakeIds = new Map<string, Set<string>>(); // KP → mistake ids
  const kpProblemCount = new Map<string, number>(); // KP → total appearances

  for (const m of mistakes) {
    // Dedupe within one record (defensive)
    const uniqueKps = [...new Set(m.knowledgePoints)];
    for (const kp of uniqueKps) {
      kpSet.add(kp);
      kpProblemCount.set(kp, (kpProblemCount.get(kp) ?? 0) + 1);
      if (!kpMistakeIds.has(kp)) {
        kpMistakeIds.set(kp, new Set());
      }
      kpMistakeIds.get(kp)!.add(m.id);
    }
  }

  // ── 2. Build nodes ────────────────────────────────────────────
  const nodes: KnowledgeNode[] = [];
  for (const kp of kpSet) {
    const mistakeCount = kpMistakeIds.get(kp)?.size ?? 0;
    nodes.push({
      id: kp,
      name: kp,
      category: inferCategory(kp),
      mastery: Math.max(0, 100 - mistakeCount * 20),
      problemCount: kpProblemCount.get(kp) ?? 0,
      mistakeCount,
      children: [],
    });
  }

  // ── 3. Build edges ────────────────────────────────────────────
  const edges: KnowledgeEdge[] = [];
  const edgeKey = (f: string, t: string, r: string) => `${f}→${t}:${r}`;
  const edgeSet = new Set<string>();

  const addEdge = (
    from: string,
    to: string,
    relation: KnowledgeEdge['relation'],
  ) => {
    if (from === to) return;
    const key = edgeKey(from, to, relation);
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push({ from, to, relation });
    }
  };

  // 3a. Related edges — knowledge points that co-occur in the same mistake
  for (const m of mistakes) {
    const kps = [...new Set(m.knowledgePoints)];
    for (let i = 0; i < kps.length; i++) {
      for (let j = i + 1; j < kps.length; j++) {
        addEdge(kps[i], kps[j], 'related');
        addEdge(kps[j], kps[i], 'related');
      }
    }
  }

  // 3b. Prerequisite edges — A is a prefix of B (e.g. "二次函数" → "二次函数图像")
  const kpList = [...kpSet];
  for (const a of kpList) {
    for (const b of kpList) {
      if (a !== b && b.startsWith(a)) {
        addEdge(a, b, 'prerequisite');
      }
    }
  }

  // ── 4. Populate children from prerequisite edges ──────────────
  for (const edge of edges) {
    if (edge.relation === 'prerequisite') {
      const parent = nodes.find((n) => n.id === edge.from);
      if (parent && !parent.children.includes(edge.to)) {
        parent.children.push(edge.to);
      }
    }
  }

  // ── 5. Weak points ────────────────────────────────────────────
  const weakPoints = nodes.filter((n) => n.mastery < 50).map((n) => n.id);

  return { nodes, edges, weakPoints };
}

// ── Learning path recommendation ─────────────────────────────────────

export function recommendLearningPath(graph: KnowledgeGraph): LearningPath {
  if (graph.nodes.length === 0) {
    return {
      startNode: '',
      nodes: [],
      reason: 'No knowledge nodes available yet.',
    };
  }

  // Build adjacency maps for prerequisite edges only
  const outgoing = new Map<string, string[]>(); // prereq → dependent
  const incoming = new Map<string, string[]>(); // dependent → prereq

  for (const edge of graph.edges) {
    if (edge.relation === 'prerequisite') {
      if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
      outgoing.get(edge.from)!.push(edge.to);
      if (!incoming.has(edge.to)) incoming.set(edge.to, []);
      incoming.get(edge.to)!.push(edge.from);
    }
  }

  // Find the weakest node (lowest mastery)
  let weakest = graph.nodes[0];
  for (const node of graph.nodes) {
    if (node.mastery < weakest.mastery) {
      weakest = node;
    }
  }

  // Topological DFS to collect prerequisites (reverse traversal)
  const prereqsInOrder: string[] = [];
  const visited = new Set<string>();

  function dfs(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const parents = incoming.get(nodeId) ?? [];
    // Sort for deterministic output
    for (const parent of [...parents].sort()) {
      dfs(parent);
    }

    prereqsInOrder.push(nodeId);
  }
  dfs(weakest.id);

  // BFS forward from the weakest node along outgoing prerequisite edges
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

  // Assemble the final path: prereqs (excluding weakest itself) + forward
  const prefixPrereqs = prereqsInOrder.filter((id) => id !== weakest.id);
  const fullPath = [...prefixPrereqs, ...forwardOrder];

  return {
    startNode: weakest.id,
    nodes: fullPath,
    reason: `Start with foundational concepts, then focus on "${weakest.name}" (mastery ${weakest.mastery}%) — your weakest knowledge area in ${weakest.category}.`,
  };
}

// ── Mastery summary ──────────────────────────────────────────────────

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
