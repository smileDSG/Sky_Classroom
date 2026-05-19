/**
 * tests/sky/dashboard.test.tsx
 *
 * 测试 Sky Classroom 首页仪表盘组件：
 *   - StatCards        (统计卡：今日搜题 / 待复习 / 掌握度)
 *   - QuickActions     (快捷入口：拍照 / 语音 / 文字 / 幻灯片)
 *   - ActivityTimeline (最近活动时间线)
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { StatCards, QuickActions, ActivityTimeline } from '@/components/sky/dashboard/stat-cards';
import type { MistakeRecord } from '@/lib/mistakes/types';

// ── Mock next/link ──────────────────────────────────────────────────
// QuickActions 使用 <Link href=...>，在 jsdom 中需 mock 为原生 <a>

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) =>
    React.createElement(
      'a',
      { href, 'data-test-next-link': true, ...props },
      children,
    ),
}));

// ── Helpers ──────────────────────────────────────────────────────────

function makeMistake(overrides: Partial<MistakeRecord> = {}): MistakeRecord {
  return {
    id: 'm1',
    problem: 'x + 2 = 5, 求 x',
    userAnswer: 'x = 2',
    correctAnswer: 'x = 3',
    cause: 'calculation-error',
    solvedAt: new Date(), // today by default
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

// ── StatCards ────────────────────────────────────────────────────────

describe('StatCards', () => {
  beforeEach(() => {
    resetStore();
  });

  it('空数据 → 显示 0, 0, 0%', () => {
    render(<StatCards mistakes={[]} />);

    // 三个数字
    const zeroValues = screen.getAllByText('0');
    // 至少应有 "0" (今日搜题) 和 "0" (错题待复习)
    expect(zeroValues.length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText('0%')).toBeDefined();
  });

  it('有数据 → 正确计算待复习数和掌握度', () => {
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);

    const mistakes: MistakeRecord[] = [
      makeMistake({ id: 'm1', solvedAt: today, reviewed: false }),
      makeMistake({ id: 'm2', solvedAt: today, reviewed: true, reviewCount: 1 }),
      makeMistake({ id: 'm3', solvedAt: yesterday, reviewed: false }),
    ];

    render(<StatCards mistakes={mistakes} />);

    // 今日搜题 = 2 (m1, m2 are today)
    // 待复习 = 2 (m1, m3 not reviewed)
    // 两者都是 2，所以 '2' 文本出现至少 2 次
    const twos = screen.getAllByText('2');
    expect(twos.length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText('错题待复习')).toBeDefined();

    // 掌握度 = 1/3 = 33% (m2 reviewed)
    expect(screen.getByText('33%')).toBeDefined();
    expect(screen.getByText('知识掌握度')).toBeDefined();
  });
});

// ── QuickActions ─────────────────────────────────────────────────────

describe('QuickActions', () => {
  it('渲染 4 个入口 → 拍照/幻灯片/学习数据/AI助手', () => {
    render(<QuickActions />);

    expect(screen.getByText('拍照搜题')).toBeDefined();
    expect(screen.getByText('幻灯片讲解')).toBeDefined();
    expect(screen.getByText('学习数据')).toBeDefined();
    expect(screen.getByText('AI 助手')).toBeDefined();

    // 验证都是 Link（<a>）
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(4);

    // 每个 Link 都有 href
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(
      hrefs.every((h) =>
        h === '/sky/solve' ||
        h === '/sky/slides' ||
        h === '/sky/learning' ||
        h === '/sky/assistant',
      ),
    ).toBe(true);
  });
});

// ── ActivityTimeline ─────────────────────────────────────────────────

describe('ActivityTimeline', () => {
  beforeEach(() => {
    resetStore();
  });

  it('空数据 → 显示"还没有学习活动"', () => {
    render(<ActivityTimeline mistakes={[]} />);

    expect(
      screen.getByText(/还没有学习活动/),
    ).toBeDefined();
  });

  it('有数据 → 显示最近 5 条', () => {
    const mistakes: MistakeRecord[] = Array.from({ length: 7 }, (_, i) =>
      makeMistake({
        id: `m${i + 1}`,
        problem: `问题 ${i + 1}: 这是一道关于知识点的很长的题目描述内容`,
        solvedAt: new Date(Date.now() - i * 3600000), // each 1 hour apart
        cause:
          i % 2 === 0 ? 'calculation-error' : 'concept-unclear',
      }),
    );

    render(<ActivityTimeline mistakes={mistakes} />);

    // 标题
    expect(screen.getByText('最近活动')).toBeDefined();

    // 截断后的文本（只取前 60 字符 + ...）
    // "问题 1: 这是一道关于知识点的很长的题目描述内容" length > 60 → truncated
    // 应显示截断后的文本片段
    expect(screen.getByText(/问题 1/)).toBeDefined();
    expect(screen.getByText(/问题 5/)).toBeDefined();

    // 第 6、7 条不应该出现（只显示最近 5 条）
    expect(screen.queryByText(/问题 6/)).toBeNull();
    expect(screen.queryByText(/问题 7/)).toBeNull();
  });
});
