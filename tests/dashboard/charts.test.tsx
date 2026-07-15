import { render, screen } from '@testing-library/react';
import { LearningTrendChart } from '@/components/sky/dashboard/learning-trend-chart';
import { AbilityRadar } from '@/components/sky/dashboard/ability-radar';
import { StatCards, QuickActions, ActivityTimeline } from '@/components/sky/dashboard/stat-cards';
import type { MistakeRecord } from '@/lib/mistakes/types';
import { describe, it, expect } from 'vitest';

const demoMistakes: MistakeRecord[] = [
  {
    id: 't1', problem: 'test', userAnswer: 'a', correctAnswer: 'b',
    cause: 'calculation-error', solvedAt: new Date(), reviewed: false,
    reviewCount: 0, knowledgePoints: ['代数'],
  },
];

describe('LearningTrendChart', () => {
  const mockData = [
    { day: '周一', total: 3, reviewed: 1 },
    { day: '周二', total: 5, reviewed: 3 },
    { day: '周三', total: 2, reviewed: 2 },
    { day: '周四', total: 8, reviewed: 4 },
    { day: '周五', total: 4, reviewed: 2 },
    { day: '周六', total: 6, reviewed: 5 },
    { day: '周日', total: 1, reviewed: 1 },
  ];

  it('renders chart title and axis labels', () => {
    render(<LearningTrendChart data={mockData} />);
    expect(screen.getByText('近14天学习趋势')).toBeInTheDocument();
    expect(screen.getByText('周日')).toBeInTheDocument();
  });

  it('shows correct max count on Y axis', () => {
    render(<LearningTrendChart data={mockData} />);
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<LearningTrendChart data={[]} />);
    expect(screen.getByText('暂无数据，去搜题页开始练习')).toBeInTheDocument();
  });
});

describe('AbilityRadar', () => {
  const mockData = [
    { name: '代数', value: 75 },
    { name: '几何', value: 60 },
    { name: '函数', value: 80 },
    { name: '概率', value: 45 },
    { name: '统计', value: 70 },
  ];

  it('renders all 5 dimension labels', () => {
    render(<AbilityRadar data={mockData} />);
    for (const dim of mockData) {
      expect(screen.getByText(dim.name)).toBeInTheDocument();
    }
  });

  it('renders title', () => {
    render(<AbilityRadar data={mockData} />);
    expect(screen.getByText('能力雷达图')).toBeInTheDocument();
  });
});

describe('StatCards', () => {
  it('renders 3 stat cards', () => {
    render(<StatCards mistakes={demoMistakes} />);
    expect(screen.getByText('今日搜题')).toBeInTheDocument();
    expect(screen.getByText('错题待复习')).toBeInTheDocument();
    expect(screen.getByText('知识掌握度')).toBeInTheDocument();
  });
});

describe('QuickActions', () => {
  it('renders 4 action buttons', () => {
    render(<QuickActions />);
    expect(screen.getByText('拍照搜题')).toBeInTheDocument();
    expect(screen.getByText('幻灯片讲解')).toBeInTheDocument();
    expect(screen.getByText('学习数据')).toBeInTheDocument();
    expect(screen.getByText('AI 助手')).toBeInTheDocument();
  });
});

describe('ActivityTimeline', () => {
  it('shows empty state with no mistakes', () => {
    render(<ActivityTimeline mistakes={[]} />);
    expect(screen.getByText('还没有学习活动，去搜题页开始练习吧！')).toBeInTheDocument();
  });

  it('shows recent mistakes', () => {
    render(<ActivityTimeline mistakes={demoMistakes} />);
    expect(screen.getByText('test')).toBeInTheDocument();
  });
});
