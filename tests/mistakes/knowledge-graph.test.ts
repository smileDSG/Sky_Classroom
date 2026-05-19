/**
 * tests/mistakes/knowledge-graph.test.ts
 * Sky Classroom — 知识图谱测试
 *
 * 测试模块：
 *   - buildKnowledgeGraph       知识图谱构建
 *   - getMasterySummary         掌握度汇总
 *   - recommendLearningPath     学习路径推荐
 *
 * 纯函数测试，无 DOM / IndexedDB 依赖。
 */

import { describe, it, expect } from 'vitest';
import {
  buildKnowledgeGraph,
  recommendLearningPath,
  getMasterySummary,
} from '@/lib/mistakes/knowledge-graph';
import type {
  MistakeRecord,
  KnowledgeGraph,
  LearningPath,
} from '@/lib/mistakes/types';
import type { MistakeCause } from '@/lib/solve/types';

// ── 测试辅助 ──────────────────────────────────────────────────────────

/**
 * 快捷构造单条错题记录，用于按需拼装测试数据。
 */
function makeMistake(overrides?: Partial<MistakeRecord>): MistakeRecord {
  return {
    id: `m-${Math.random().toString(36).slice(2, 8)}`,
    problem: '1 + 1 = ?',
    userAnswer: '3',
    correctAnswer: '2',
    cause: 'calculation-error' as MistakeCause,
    solvedAt: new Date(),
    reviewed: false,
    reviewCount: 0,
    knowledgePoints: ['test-kp'],
    ...overrides,
  };
}

/**
 * 返回一组预定义的错题数组，覆盖常见的知识点组合场景：
 *  - 单一知识点
 *  - 关联知识点（同一个错题中共同出现）
 *  - 前置知识关系（字符串前缀匹配）
 */
function makeTestMistakes(): MistakeRecord[] {
  return [
    {
      id: 'm1',
      problem: '解方程 x^2 - 4 = 0',
      userAnswer: 'x=4',
      correctAnswer: 'x=2',
      cause: 'calculation-error' as MistakeCause,
      solvedAt: new Date('2026-05-15'),
      reviewed: false,
      reviewCount: 0,
      knowledgePoints: ['一元二次方程'],
    },
    {
      id: 'm2',
      problem: '画出 y = x^2 的图像',
      userAnswer: '',
      correctAnswer: '抛物线',
      cause: 'concept-unclear' as MistakeCause,
      solvedAt: new Date('2026-05-16'),
      reviewed: false,
      reviewCount: 0,
      knowledgePoints: ['二次函数', '二次函数图像'],
    },
    {
      id: 'm3',
      problem: '计算概率与统计',
      userAnswer: '0.3',
      correctAnswer: '0.5',
      cause: 'calculation-error' as MistakeCause,
      solvedAt: new Date('2026-05-17'),
      reviewed: false,
      reviewCount: 0,
      knowledgePoints: ['概率', '统计'],
    },
  ];
}

// ── buildKnowledgeGraph ───────────────────────────────────────────────

describe('buildKnowledgeGraph', () => {
  // ── 1. 空数组 ───────────────────────────────────────────────────
  it('传入空错题数组时应返回空图', () => {
    const graph = buildKnowledgeGraph([]);
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.weakPoints).toEqual([]);
  });

  // ── 2. 单个知识点 ──────────────────────────────────────────────
  it('单个知识点：1 个 node、0 条 edge、mastery = 80（1 个错题）', () => {
    const graph = buildKnowledgeGraph([makeTestMistakes()[0]]);

    expect(graph.nodes).toHaveLength(1);
    const node = graph.nodes[0];
    expect(node.id).toBe('一元二次方程');
    expect(node.mastery).toBe(80); // 100 - 1 * 20
    expect(node.mistakeCount).toBe(1);
    expect(node.problemCount).toBe(1);
    expect(node.category).toBe('代数');

    expect(graph.edges).toHaveLength(0);
    expect(graph.weakPoints).toHaveLength(0);
  });

  // ── 3. 多个知识点 → related 边 ──────────────────────────────────
  it('同一错题中的多个知识点应建立 related 边', () => {
    // m3 包含 ['概率', '统计']，两者共现应产生双向 related 边
    const graph = buildKnowledgeGraph([makeTestMistakes()[2]]);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(2);

    const relatedEdges = graph.edges.filter((e) => e.relation === 'related');
    expect(relatedEdges).toHaveLength(2);
    // 双向 related
    expect(relatedEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: '概率', to: '统计', relation: 'related' }),
        expect.objectContaining({ from: '统计', to: '概率', relation: 'related' }),
      ]),
    );
  });

  // ── 4. prerequisite 关系 ────────────────────────────────────────
  it('B 的知识点名称以 A 开头时自动建立 prerequisite 边', () => {
    // m2 包含 ['二次函数', '二次函数图像']
    // "二次函数图像" startsWith "二次函数" → prerequisite 边
    const graph = buildKnowledgeGraph([makeTestMistakes()[1]]);

    expect(graph.nodes).toHaveLength(2);

    const prereqEdge = graph.edges.find((e) => e.relation === 'prerequisite');
    expect(prereqEdge).toBeDefined();
    expect(prereqEdge).toEqual(
      expect.objectContaining({
        from: '二次函数',
        to: '二次函数图像',
        relation: 'prerequisite',
      }),
    );

    // prerequisite 边的 from 节点应把 to 加入 children
    const parentNode = graph.nodes.find((n) => n.id === '二次函数');
    expect(parentNode).toBeDefined();
    expect(parentNode!.children).toContain('二次函数图像');
  });

  // ── 5. weakPoints 检测 ──────────────────────────────────────────
  it('mastery < 50 的节点应出现在 weakPoints 中', () => {
    // 5 个错题都指向同一个知识点 → mastery = 100 - 5*20 = 0 → 弱点
    const template = makeTestMistakes()[0];
    const repeatedMistakes: MistakeRecord[] = Array.from(
      { length: 5 },
      (_, i) => ({
        ...template,
        id: `weak-${i}`,
      }),
    );

    const graph = buildKnowledgeGraph(repeatedMistakes);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].mastery).toBeLessThan(50);
    expect(graph.weakPoints).toContain('一元二次方程');
  });

  it('mastery >= 50 的节点不出现在 weakPoints 中', () => {
    const graph = buildKnowledgeGraph([makeTestMistakes()[0]]); // mastery=80
    expect(graph.nodes[0].mastery).toBe(80);
    expect(graph.weakPoints).not.toContain('一元二次方程');
  });

  // ── 6. mastery 计算（底线 0）───────────────────────────────────
  it('5 个错题 → mastery = 0（100 - 5*20 = 0，不低于 0）', () => {
    const template = makeTestMistakes()[0];
    const repeatedMistakes: MistakeRecord[] = Array.from(
      { length: 5 },
      (_, i) => ({
        ...template,
        id: `mastery-floor-${i}`,
      }),
    );

    const graph = buildKnowledgeGraph(repeatedMistakes);
    expect(graph.nodes[0].mastery).toBe(0);
  });

  it('超过 5 个错题时 mastery 仍为 0（不会降至负数）', () => {
    const template = makeTestMistakes()[0];
    const repeatedMistakes: MistakeRecord[] = Array.from(
      { length: 7 },
      (_, i) => ({
        ...template,
        id: `mastery-neg-${i}`,
      }),
    );

    const graph = buildKnowledgeGraph(repeatedMistakes);
    expect(graph.nodes[0].mastery).toBe(0);
    expect(graph.nodes[0].mastery).not.toBeLessThan(0);
  });
});

// ── getMasterySummary ─────────────────────────────────────────────────

describe('getMasterySummary', () => {
  it('空图时全部返回 0', () => {
    const graph: KnowledgeGraph = { nodes: [], edges: [], weakPoints: [] };
    const summary = getMasterySummary(graph);

    expect(summary).toEqual({
      overallMastery: 0,
      masteredCount: 0,
      weakCount: 0,
      totalCount: 0,
    });
  });

  it('overallMastery 为所有节点 mastery 的平均值（四舍五入）', () => {
    // 代数 1 次错题 → mastery=80，统计 3 次错题 → mastery=40
    const records: MistakeRecord[] = [
      makeMistake({ id: 's1', knowledgePoints: ['代数'] }),
      makeMistake({ id: 's2', knowledgePoints: ['统计'] }),
      makeMistake({ id: 's3', knowledgePoints: ['统计'] }),
      makeMistake({ id: 's4', knowledgePoints: ['统计'] }),
    ];
    const graph = buildKnowledgeGraph(records);
    const summary = getMasterySummary(graph);

    expect(summary.totalCount).toBe(2);
    expect(summary.overallMastery).toBe(60); // (80 + 40) / 2
    expect(summary.masteredCount).toBe(1);   // 代数 >= 80
    expect(summary.weakCount).toBe(1);        // 统计 < 50
  });

  it('所有节点均 mastered 时 masteredCount 等于 totalCount', () => {
    const graph = buildKnowledgeGraph(makeTestMistakes());
    const summary = getMasterySummary(graph);

    expect(summary.totalCount).toBe(5);
    expect(summary.overallMastery).toBe(80);
    expect(summary.masteredCount).toBe(5);
    expect(summary.weakCount).toBe(0);
  });
});

// ── recommendLearningPath ─────────────────────────────────────────────

describe('recommendLearningPath', () => {
  it('返回有效的 LearningPath（startNode 非空，nodes 非空）', () => {
    const graph = buildKnowledgeGraph(makeTestMistakes());
    const path = recommendLearningPath(graph);

    expect(path).toBeDefined();
    expect(path.startNode).toBeTruthy();
    expect(path.nodes.length).toBeGreaterThan(0);
    // startNode 必须在推荐路径中
    expect(path.nodes).toContain(path.startNode);
    expect(path.reason).toBeTruthy();
  });

  it('空图时返回空路径并附带说明', () => {
    const graph: KnowledgeGraph = { nodes: [], edges: [], weakPoints: [] };
    const path = recommendLearningPath(graph);

    expect(path.startNode).toBe('');
    expect(path.nodes).toEqual([]);
    expect(path.reason).toBe('No knowledge nodes available yet.');
  });

  it('推荐路径以最薄弱知识点为起点', () => {
    // 构造：统计 mastery=40（弱），代数 mastery=80
    const records: MistakeRecord[] = [
      makeMistake({ id: 'p1', knowledgePoints: ['代数'] }),
      makeMistake({ id: 'p2', knowledgePoints: ['统计'] }),
      makeMistake({ id: 'p3', knowledgePoints: ['统计'] }),
      makeMistake({ id: 'p4', knowledgePoints: ['统计'] }),
    ];
    const graph = buildKnowledgeGraph(records);
    const path = recommendLearningPath(graph);

    expect(path.startNode).toBe('统计'); // mastery 40 是最弱的
    expect(path.nodes[0]).toBe('统计');
    expect(path.reason).toContain('统计');
    expect(path.reason).toContain('mastery 40%');
  });

  it('路径中包含前置知识点（prerequisite 拓扑排序）', () => {
    // 构造：二次函数图像 错误较多 → weakest
    // 二次函数 是 二次函数图像 的前置
    const records: MistakeRecord[] = [
      makeMistake({
        id: 'pre1',
        knowledgePoints: ['二次函数', '二次函数图像'],
      }),
      makeMistake({
        id: 'pre2',
        knowledgePoints: ['二次函数图像'],
      }),
      makeMistake({
        id: 'pre3',
        knowledgePoints: ['二次函数图像'],
      }),
      makeMistake({
        id: 'pre4',
        knowledgePoints: ['二次函数图像'],
      }),
    ];
    // 二次函数: 1 mistake → mastery=80
    // 二次函数图像: 4 mistakes → mastery=20 → weakest
    const graph = buildKnowledgeGraph(records);
    const path = recommendLearningPath(graph);

    expect(path.startNode).toBe('二次函数图像');
    // 前置知识点 二次函数 应排在 二次函数图像 之前
    const funcIdx = path.nodes.indexOf('二次函数');
    const imageIdx = path.nodes.indexOf('二次函数图像');
    expect(funcIdx).not.toBe(-1);
    expect(imageIdx).not.toBe(-1);
    expect(funcIdx).toBeLessThan(imageIdx);
  });
});
