/**
 * tests/sky/learning-stats.test.tsx
 *
 * 测试 Sky Classroom 学习统计组件：
 *   - LearningStats (统计卡 + 错因分布条形图)
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { LearningStats } from '@/components/sky/learning/learning-stats';
import type { MistakeRecord } from '@/lib/mistakes/types';

// ── Helpers ──────────────────────────────────────────────────────────

function makeMistake(overrides: Partial<MistakeRecord> = {}): MistakeRecord {
  return {
    id: 'm1',
    problem: 'x + 2 = 5, 求 x',
    userAnswer: 'x = 2',
    correctAnswer: 'x = 3',
    cause: 'calculation-error',
    solvedAt: new Date('2025-06-01T10:00:00Z'),
    reviewed: false,
    reviewCount: 0,
    knowledgePoints: ['一元一次方程'],
    ...overrides,
  };
}

function resetStore() {
  localStorage.clear();
  useSkyClassroomStore.setState({
    mistakes: [],
    knowledgeGraph: null,
    activeFilter: null,
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe('LearningStats', () => {
  beforeEach(() => {
    resetStore();
  });

  // ── 1. 空状态渲染 ─────────────────────────────────────────────
  it('空状态渲染 → 显示"还没有学习数据"', () => {
    render(<LearningStats />);

    expect(screen.getByText('还没有学习数据')).toBeDefined();
    expect(
      screen.getByText(/完成一些搜题练习后/),
    ).toBeDefined();
  });

  // ── 2. 有数据时渲染统计卡片 ─────────────────────────────────
  it('有数据时渲染统计卡片 → 总错题数/已复习/薄弱点数', () => {
    useSkyClassroomStore.setState({
      mistakes: [
        makeMistake({ id: 'm1', reviewed: false }),
        makeMistake({
          id: 'm2',
          reviewed: true,
          reviewCount: 1,
          cause: 'concept-unclear',
          problem: 'y = x^2 的导数',
          knowledgePoints: ['导数'],
        }),
      ],
    });

    render(<LearningStats />);

    // 总错题数 = 2
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('总错题数')).toBeDefined();

    // 已复习数 = 1
    expect(screen.getByText('已复习 · 复习率 50%')).toBeDefined();

    // 薄弱知识点: knowledge-graph 基于 mistakes 构建
    // 2 个不同的 KP（一元一次方程 / 导数），每个 mastery = 100 - mistakeCount * 20 = 100 - 20 = 80
    // mastery >= 80 → 不是 weak, weakPoints = []
    // weakCount = 0
    expect(screen.getByText('薄弱知识点')).toBeDefined();
  });

  // ── 3. 错因分布条形图 ───────────────────────────────────────
  it('有数据时渲染错因分布条形图', () => {
    useSkyClassroomStore.setState({
      mistakes: [
        makeMistake({ id: 'm1', cause: 'calculation-error' }),
      ],
    });

    render(<LearningStats />);

    // 条形图标题
    expect(screen.getByText('错因分布')).toBeDefined();

    // 每种错因标签都在 DOM 中
    const causeLabels = [
      '概念不清',
      '计算失误',
      '审题错误',
      '方法错误',
      '粗心',
      '格式错误',
    ];
    for (const label of causeLabels) {
      expect(screen.getByText(label)).toBeDefined();
    }

    // 对应计数: calculation-error = 1, 其余 = 0
    // 计数 "1" 在 stat card (总错题数) 和条形图 (计算失误计数) 各出现一次
    const ones = screen.getAllByText('1');
    expect(ones.length).toBeGreaterThanOrEqual(2);
  });
});
