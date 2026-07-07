/**
 * Module C — Graph builder from DAO mistake entries.
 *
 * Thin wrapper around lib/mistakes/knowledge-graph.ts that adapts
 * the canonical KnowledgeGraph type to the API-facing GraphResponse type.
 */
import type { GraphResponse } from './types';
import type { GraphEdge } from './types';
import type { KnowledgeEdge } from '@/lib/knowledge-graph/types';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import { buildKnowledgeGraph } from '@/lib/knowledge-graph';

function isGraphEdge(edge: KnowledgeEdge): edge is GraphEdge {
  return edge.relation !== 'extension';
}

export function buildGraphFromMistakes(mistakes: MistakeBookEntry[]): GraphResponse {
  const graph = buildKnowledgeGraph(mistakes as any);
  return {
    nodes: graph.nodes,
    edges: graph.edges.filter(isGraphEdge),
    weakPoints: graph.weakPoints,
  };
}
