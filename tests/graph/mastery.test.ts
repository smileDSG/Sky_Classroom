import { describe, it, expect } from 'vitest';
import {
  calculateMastery,
  getWeakPoints,
  buildRecommendations,
  overallMastery,
} from '@/lib/graph/mastery';
import type { GraphNode } from '@/lib/graph/types';

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: 'n1',
    name: '一元一次方程',
    category: '代数',
    mastery: 80,
    problemCount: 10,
    mistakeCount: 2,
    children: [],
    ...overrides,
  };
}

describe('calculateMastery', () => {
  it('0 errors → mastery 100', () => {
    expect(calculateMastery(0, 10)).toBe(100);
  });

  it('5 errors out of 10 → mastery 50', () => {
    expect(calculateMastery(5, 10)).toBe(50);
  });

  it('10 errors out of 10 → mastery 0', () => {
    expect(calculateMastery(10, 10)).toBe(0);
  });

  it('total 0 → mastery 100 (no data)', () => {
    expect(calculateMastery(0, 0)).toBe(100);
  });
});

describe('getWeakPoints', () => {
  it('returns nodes below threshold 50', () => {
    const nodes = [
      makeNode({ id: 'a', name: '强项', mastery: 80 }),
      makeNode({ id: 'b', name: '弱项', mastery: 30 }),
      makeNode({ id: 'c', name: '极弱', mastery: 10 }),
    ];
    const weak = getWeakPoints(nodes);
    expect(weak).toHaveLength(2);
    expect(weak[0].mastery).toBe(10); // sorted weakest first
    expect(weak[1].mastery).toBe(30);
  });

  it('custom threshold', () => {
    const nodes = [
      makeNode({ id: 'a', mastery: 60 }),
      makeNode({ id: 'b', mastery: 40 }),
    ];
    expect(getWeakPoints(nodes, 70)).toHaveLength(2);
    expect(getWeakPoints(nodes, 30)).toHaveLength(0);
  });

  it('empty array returns empty', () => {
    expect(getWeakPoints([])).toHaveLength(0);
  });
});

describe('buildRecommendations', () => {
  it('high priority for mastery < 30', () => {
    const nodes = [makeNode({ mastery: 20 })];
    const recs = buildRecommendations(nodes);
    expect(recs[0].priority).toBe('high');
    expect(recs[0].suggestedPractice).toBe(5);
  });

  it('medium priority for mastery 30-49', () => {
    const nodes = [makeNode({ mastery: 40 })];
    const recs = buildRecommendations(nodes);
    expect(recs[0].priority).toBe('medium');
    expect(recs[0].suggestedPractice).toBe(3);
  });

  it('returns empty for no weak points', () => {
    expect(buildRecommendations([])).toHaveLength(0);
  });
});

describe('overallMastery', () => {
  it('average across nodes', () => {
    const nodes = [
      makeNode({ mastery: 100 }),
      makeNode({ mastery: 0 }),
    ];
    expect(overallMastery(nodes)).toBe(50);
  });

  it('empty → 100', () => {
    expect(overallMastery([])).toBe(100);
  });
});
