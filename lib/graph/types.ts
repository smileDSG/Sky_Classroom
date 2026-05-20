/**
 * Module C — Knowledge graph type definitions.
 *
 * Compatible with both the client-side lib/mistakes/types.ts types and
 * the API response shape from GET /api/sky/knowledge-graph.
 */

/** A knowledge point node in the graph */
export interface GraphNode {
  id: string;
  name: string;
  category: string;
  mastery: number;        // 0–100
  problemCount: number;
  mistakeCount: number;
  children: string[];     // child knowledge-point IDs
}

/** An edge connecting two knowledge points */
export interface GraphEdge {
  from: string;
  to: string;
  relation: 'prerequisite' | 'related' | 'extension';
}

/** Full knowledge graph response */
export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  weakPoints: string[];
}

/** Mastery summary */
export interface MasterySummary {
  overallMastery: number;
  masteredCount: number;
  weakCount: number;
  totalCount: number;
}

/** A single learning recommendation */
export interface LearningRecommendation {
  knowledgePoint: string;
  currentMastery: number;
  suggestedPractice: number;  // number of practice problems recommended
  priority: 'high' | 'medium' | 'low';
}
