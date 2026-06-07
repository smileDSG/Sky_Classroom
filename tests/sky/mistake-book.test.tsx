/**
 * tests/sky/mistake-book.test.tsx
 *
 * 测试 Sky Classroom 错题本组件：
 *   - MistakeBook (错题列表 + 筛选栏 + 复习操作)
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { MistakeBook } from '@/components/sky/learning/mistake-book';
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

describe('MistakeBook', () => {
  beforeEach(() => {
    resetStore();
  });

  // ── 1. 空状态渲染 ─────────────────────────────────────────────
  it('空状态渲染 → 显示"还没有错题记录"', () => {
    render(<MistakeBook />);

    expect(screen.getByText('还没有错题记录')).toBeDefined();
    expect(
      screen.getByText(/去搜题页练习一下吧/),
    ).toBeDefined();
  });

  // ── 2. 有错题时渲染列表 ──────────────────────────────────────
  it('有错题时渲染列表 → 卡片展示错题信息', () => {
    useSkyClassroomStore.setState({
      mistakes: [
        makeMistake({ id: 'm1' }),
        makeMistake({
          id: 'm2',
          cause: 'concept-unclear',
          problem: 'y = x^2 的导数',
          userAnswer: 'y = 2x',
          correctAnswer: 'y\' = 2x',
          knowledgePoints: ['导数'],
        }),
      ],
    });

    render(<MistakeBook />);

    // 每张卡片的题目文本
    expect(screen.getByText(/x \+ 2 = 5/)).toBeDefined();
    expect(screen.getByText(/y = x\^2 的导数/)).toBeDefined();

    // 答案信息（每条唯一）
    expect(screen.getByText('我的答案：x = 2')).toBeDefined();
    expect(screen.getByText('正确答案：x = 3')).toBeDefined();
    expect(screen.getByText("我的答案：y = 2x")).toBeDefined();
    expect(screen.getByText("正确答案：y' = 2x")).toBeDefined();

    // 错因 badge (也出现在 filter 栏中，所以至少 2 个)
    const calcErrors = screen.getAllByText('计算失误');
    expect(calcErrors.length).toBeGreaterThanOrEqual(2); // filter button + card badge
    const conceptUnclear = screen.getAllByText('概念不清');
    expect(conceptUnclear.length).toBeGreaterThanOrEqual(2); // filter button + card badge

    // 知识点 badge
    expect(screen.getByText('一元一次方程')).toBeDefined();
    expect(screen.getByText('导数')).toBeDefined();
  });

  // ── 3. 错因筛选按钮 ──────────────────────────────────────────
  it('错因筛选按钮存在 → 7 个按钮（全部 + 6 种错因）', () => {
    // 即使没有错题，筛选栏也会在错题列表不为空时显示。
    // 需要有错题才能看到筛选栏。
    useSkyClassroomStore.setState({
      mistakes: [makeMistake()],
    });

    render(<MistakeBook />);

    // "全部错因" 按钮
    expect(screen.getByText('全部错因')).toBeDefined();
    // 6 种错因 (filter 按钮 + 卡片 badge 均出现，用 getAllByText 容许多个)
    const causeLabels = [
      '概念不清',
      '计算失误',
      '审题错误',
      '方法错误',
      '粗心',
      '格式错误',
    ];
    for (const label of causeLabels) {
      const elements = screen.getAllByText(label);
      expect(elements.length).toBeGreaterThanOrEqual(1);
    }
  });

  // ── 4. 复习状态切换 ──────────────────────────────────────────
  it('复习状态切换存在 → 全部/未复习/已复习 三个按钮', () => {
    useSkyClassroomStore.setState({
      mistakes: [makeMistake()],
    });

    render(<MistakeBook />);

    expect(screen.getByText('全部')).toBeDefined();
    expect(screen.getByText('未复习')).toBeDefined();
    expect(screen.getByText('已复习')).toBeDefined();
  });
});
