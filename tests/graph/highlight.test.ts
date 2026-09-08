import { describe, it, expect } from 'vitest';
import { getHighlightedNodes, getNodeSummary, getGraphRecommendation } from '@/lib/graph/highlight';
import type { GraphNode } from '@/lib/graph/types';

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: 'n1',
    name: '代数',
    category: '代数',
    mastery: 80,
    problemCount: 10,
    mistakeCount: 2,
    children: [],
    ...overrides,
  };
}

describe('getHighlightedNodes', () => {
  it('marks mastery < 50 as weak', () => {
    const nodes = [makeNode({ mastery: 30 })];
    const result = getHighlightedNodes(nodes);
    expect(result[0].highlight).toBe('weak');
  });

  it('marks mastery 50-79 as normal', () => {
    const nodes = [makeNode({ mastery: 60 })];
    const result = getHighlightedNodes(nodes);
    expect(result[0].highlight).toBe('normal');
  });

  it('marks mastery >= 80 as strong', () => {
    const nodes = [makeNode({ mastery: 90 })];
    const result = getHighlightedNodes(nodes);
    expect(result[0].highlight).toBe('strong');
  });
});

describe('getNodeSummary', () => {
  it('strong node gives positive summary', () => {
    expect(getNodeSummary(makeNode({ name: '代数', mastery: 85 }))).toContain('掌握良好');
  });

  it('normal node gives consolidate summary', () => {
    expect(getNodeSummary(makeNode({ name: '几何', mastery: 65 }))).toContain('需要巩固');
  });

  it('weak node gives focus summary', () => {
    expect(getNodeSummary(makeNode({ name: '概率', mastery: 20 }))).toContain('较为薄弱');
  });
});

describe('getGraphRecommendation', () => {
  it('empty nodes → no-data summary', () => {
    const rec = getGraphRecommendation([]);
    expect(rec.summary).toContain('暂无学习数据');
    expect(rec.weakPointCount).toBe(0);
  });

  it('no weak points → positive summary', () => {
    const nodes = [makeNode({ id: 'a', mastery: 90 }), makeNode({ id: 'b', mastery: 85 })];
    const rec = getGraphRecommendation(nodes);
    expect(rec.weakPointCount).toBe(0);
    expect(rec.summary).toContain('继续保持');
  });

  it('few weak points → targeted summary', () => {
    const nodes = [makeNode({ id: 'a', mastery: 90 }), makeNode({ id: 'b', mastery: 30 })];
    const rec = getGraphRecommendation(nodes);
    expect(rec.weakPointCount).toBe(1);
    expect(rec.items).toHaveLength(1);
    expect(rec.items[0].priority).toBe('medium');
  });

  it('many weak points → systematic summary', () => {
    const nodes = [
      makeNode({ id: 'a', mastery: 20 }),
      makeNode({ id: 'b', mastery: 30 }),
      makeNode({ id: 'c', mastery: 40 }),
    ];
    const rec = getGraphRecommendation(nodes);
    expect(rec.weakPointCount).toBe(3);
    expect(rec.summary).toContain('制定系统复习计划');
  });
});
