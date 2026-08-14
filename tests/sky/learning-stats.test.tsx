/**
 * tests/sky/learning-stats.test.tsx
 *
 * Tests the Sky Classroom learning stats dashboard.
 */

import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LearningStats } from '@/components/sky/learning/learning-stats';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import type { MistakeRecord } from '@/lib/mistakes/types';

function makeMistake(overrides: Partial<MistakeRecord> = {}): MistakeRecord {
  return {
    id: 'm1',
    problem: 'x + 2 = 5, 求 x',
    userAnswer: 'x = 2',
    correctAnswer: 'x = 3',
    cause: 'calculation-error',
    solvedAt: new Date(),
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
    memoryProgress: {
      totalFlipped: 0,
      topicCount: 0,
      lastStudied: null,
    },
  });
}

describe('LearningStats', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders the useful empty state with practice actions', () => {
    render(<LearningStats />);

    expect(screen.getByText('还没有学习数据')).toBeDefined();
    expect(screen.getByText(/完成搜题、练习或复习后/)).toBeDefined();
    expect(screen.getByText('去搜题练习')).toBeDefined();
    expect(screen.getByText('AI 出题')).toBeDefined();
  });

  it('renders the diagnosis banner and key metrics when data exists', () => {
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
      memoryProgress: {
        totalFlipped: 6,
        topicCount: 2,
        lastStudied: new Date('2026-07-01T08:00:00Z').getTime(),
      },
    });

    render(<LearningStats />);

    expect(screen.getByText('今日学习诊断')).toBeDefined();
    expect(screen.getByText('总错题')).toBeDefined();
    expect(screen.getAllByText('待复习').length).toBeGreaterThan(0);
    expect(screen.getByText('掌握情况')).toBeDefined();
    expect(screen.getByText('记忆卡片')).toBeDefined();
    expect(screen.getByText('近 7 天新增 2 道，今日 2 道')).toBeDefined();
    expect(screen.getByText('已复习 1 道，复习率 50%')).toBeDefined();
    expect(screen.getByText(/2 个主题/)).toBeDefined();
  });

  it('renders trend, cause priority, subject distribution, and recent mistakes', () => {
    useSkyClassroomStore.setState({
      mistakes: [
        makeMistake({
          id: 'm1',
          cause: 'calculation-error',
          problem: '在 $\\triangle ABC$ 中，$\\angle A = 40^\\circ$',
          knowledgePoints: ['一元一次方程'],
        }),
        makeMistake({
          id: 'm2',
          cause: 'calculation-error',
          problem: '导数计算题',
          knowledgePoints: ['导数'],
        }),
        makeMistake({
          id: 'm3',
          cause: 'misreading',
          problem: '概率审题题',
          knowledgePoints: ['概率'],
          reviewed: true,
          reviewCount: 1,
        }),
      ],
    });

    const { container } = render(<LearningStats />);

    expect(screen.getByText('最近 14 天练习热度')).toBeDefined();
    expect(screen.getByText('错因优先级')).toBeDefined();
    expect(screen.getByText('学科薄弱分布')).toBeDefined();
    expect(screen.getByText('最近错题动态')).toBeDefined();
    expect(screen.getAllByText('计算失误').length).toBeGreaterThan(0);
    expect(screen.getAllByText('审题错误').length).toBeGreaterThan(0);
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(screen.getByText('导数计算题')).toBeDefined();
  });
});
