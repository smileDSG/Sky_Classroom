/**
 * Module C — Graph builder from DAO mistake entries.
 *
 * Thin wrapper around lib/mistakes/knowledge-graph.ts that adapts
 * the canonical KnowledgeGraph type to the API-facing GraphResponse type.
 */
import type { GraphResponse } from './types';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import { buildKnowledgeGraph } from '@/lib/mistakes/knowledge-graph';

export function buildGraphFromMistakes(mistakes: MistakeBookEntry[]): GraphResponse {
  const graph = buildKnowledgeGraph(mistakes as any);
  return {
    nodes: graph.nodes,
    edges: graph.edges.filter((e) => e.relation !== 'extension'),
    weakPoints: graph.weakPoints,
  };
}
