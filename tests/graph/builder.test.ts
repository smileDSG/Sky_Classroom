import { describe, it, expect } from 'vitest';
import { buildGraphFromMistakes } from '@/lib/graph/builder';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';

function makeEntry(overrides: Partial<MistakeBookEntry> = {}): MistakeBookEntry {
  return {
    id: 'm1',
    problemText: '1+1=?',
    userAnswer: '3',
    correctAnswer: '2',
    errorType: 'calculation',
    knowledgePoints: ['加法'],
    reviewCount: 0,
    masteryLevel: 0,
    reviewed: false,
    ...overrides,
  };
}

describe('buildGraphFromMistakes', () => {
  it('empty mistakes → empty graph', () => {
    const result = buildGraphFromMistakes([]);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.weakPoints).toHaveLength(0);
  });

  it('single mistake with one KP → one node', () => {
    const result = buildGraphFromMistakes([makeEntry({ knowledgePoints: ['加法'] })]);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('加法');
    expect(result.nodes[0].name).toBe('加法');
    expect(result.nodes[0].mistakeCount).toBe(1);
    expect(result.nodes[0].problemCount).toBe(1);
  });

  it('single mistake with multiple KPs → nodes + related edges', () => {
    const result = buildGraphFromMistakes([makeEntry({ knowledgePoints: ['加法', '进位'] })]);
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(2); // related both ways
    expect(result.edges[0].relation).toBe('related');
    expect(result.edges[1].relation).toBe('related');
  });

  it('multiple mistakes with same KP → dedup + merged counts', () => {
    const result = buildGraphFromMistakes([
      makeEntry({ id: 'm1', knowledgePoints: ['加法'] }),
      makeEntry({ id: 'm2', knowledgePoints: ['加法'] }),
    ]);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].mistakeCount).toBe(2);
    expect(result.nodes[0].problemCount).toBe(2);
  });

  it('mastery decreases as mistake count grows', () => {
    const single = buildGraphFromMistakes([makeEntry({ knowledgePoints: ['加法'] })]);
    const multi = buildGraphFromMistakes([
      makeEntry({ id: 'm1', knowledgePoints: ['加法'] }),
      makeEntry({ id: 'm2', knowledgePoints: ['加法'] }),
      makeEntry({ id: 'm3', knowledgePoints: ['加法'] }),
    ]);
    expect(single.nodes[0].mastery).toBeGreaterThan(multi.nodes[0].mastery);
  });

  it('mastery is bounded 0–100', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ id: `m${i}`, knowledgePoints: ['加法'] }),
    );
    const result = buildGraphFromMistakes(entries);
    expect(result.nodes[0].mastery).toBeGreaterThanOrEqual(0);
    expect(result.nodes[0].mastery).toBeLessThanOrEqual(100);
  });

  it('prefix matching → prerequisite edges', () => {
    const result = buildGraphFromMistakes([
      makeEntry({ knowledgePoints: ['二次函数', '二次函数图像'] }),
    ]);
    const prereqEdges = result.edges.filter((e) => e.relation === 'prerequisite');
    expect(prereqEdges.length).toBeGreaterThanOrEqual(1);
    expect(prereqEdges[0].from).toBe('二次函数');
    expect(prereqEdges[0].to).toBe('二次函数图像');
  });

  it('prerequisite edges populate children', () => {
    const result = buildGraphFromMistakes([
      makeEntry({ knowledgePoints: ['二次函数', '二次函数图像'] }),
    ]);
    const parent = result.nodes.find((n) => n.id === '二次函数');
    expect(parent?.children).toContain('二次函数图像');
  });

  it('nodes with mastery < 50 are weak points', () => {
    const entries = Array.from({ length: 8 }, (_, i) =>
      makeEntry({ id: `m${i}`, knowledgePoints: ['弱项'] }),
    );
    const result = buildGraphFromMistakes(entries);
    expect(result.weakPoints).toContain('弱项');
  });

  it('nodes with mastery >= 50 are not weak points', () => {
    const result = buildGraphFromMistakes([makeEntry({ knowledgePoints: ['强项'] })]);
    expect(result.weakPoints).not.toContain('强项');
  });

  it('category inference: 函数 keywords', () => {
    const result = buildGraphFromMistakes([makeEntry({ knowledgePoints: ['二次函数'] })]);
    expect(result.nodes[0].category).toBe('函数');
  });

  it('category inference: 几何 keywords', () => {
    const result = buildGraphFromMistakes([makeEntry({ knowledgePoints: ['三角形面积'] })]);
    expect(result.nodes[0].category).toBe('几何');
  });

  it('category inference: 概率 keywords', () => {
    const result = buildGraphFromMistakes([makeEntry({ knowledgePoints: ['概率分布'] })]);
    expect(result.nodes[0].category).toBe('概率');
  });

  it('category inference: default to 综合', () => {
    const result = buildGraphFromMistakes([makeEntry({ knowledgePoints: ['阅读理解'] })]);
    expect(result.nodes[0].category).toBe('综合');
  });

  it('returns GraphResponse shape with all fields', () => {
    const result = buildGraphFromMistakes([makeEntry({ knowledgePoints: ['加法'] })]);
    expect(result).toHaveProperty('nodes');
    expect(result).toHaveProperty('edges');
    expect(result).toHaveProperty('weakPoints');
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(Array.isArray(result.edges)).toBe(true);
    expect(Array.isArray(result.weakPoints)).toBe(true);
  });
});
