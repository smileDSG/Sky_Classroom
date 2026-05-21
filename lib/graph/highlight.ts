/**
 * Module C — Knowledge graph highlight / weak-point marker.
 *
 * Pure functions that annotate graph data for UI rendering.
 */
import type { GraphNode, LearningRecommendation } from './types';
import { getWeakPoints, buildRecommendations } from './mastery';

/** A node with UI highlight metadata */
export interface HighlightedNode extends GraphNode {
  highlight: 'weak' | 'normal' | 'strong';
}

/** Annotate all nodes with highlight levels for rendering */
export function getHighlightedNodes(
  nodes: GraphNode[],
  weakThreshold = 50,
  strongThreshold = 80,
): HighlightedNode[] {
  return nodes.map((n) => {
    let highlight: HighlightedNode['highlight'];
    if (n.mastery < weakThreshold) highlight = 'weak';
    else if (n.mastery >= strongThreshold) highlight = 'strong';
    else highlight = 'normal';
    return { ...n, highlight };
  });
}

/** Get summary text for a knowledge point */
export function getNodeSummary(node: GraphNode): string {
  const pct = node.mastery;
  if (pct >= 80) return `${node.name}掌握良好（${pct}%），建议保持`;
  if (pct >= 50) return `${node.name}需要巩固（${pct}%），建议适量练习`;
  return `${node.name}较为薄弱（${pct}%），建议重点复习`;
}

/** Build full recommendation text for the knowledge graph */
export interface GraphRecommendation {
  summary: string;
  weakPointCount: number;
  totalCount: number;
  items: LearningRecommendation[];
}

export function getGraphRecommendation(nodes: GraphNode[]): GraphRecommendation {
  const weakPoints = getWeakPoints(nodes);
  const totalCount = nodes.length;

  let summary: string;
  if (weakPoints.length === 0) {
    summary = totalCount === 0
      ? '暂无学习数据。完成一些练习后，知识图谱会自动生成。'
      : '当前没有明显薄弱点，继续保持！';
  } else if (weakPoints.length <= 2) {
    summary = `发现 ${weakPoints.length} 个薄弱知识点，建议针对性地加强练习。`;
  } else {
    summary = `发现 ${weakPoints.length} 个薄弱知识点，建议制定系统复习计划。`;
  }

  const items = buildRecommendations(weakPoints);

  return {
    summary,
    weakPointCount: weakPoints.length,
    totalCount,
    items,
  };
}
