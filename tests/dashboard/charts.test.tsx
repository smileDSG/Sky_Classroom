import { render, screen } from '@testing-library/react';
import { LearningTrendChart } from '@/components/sky/dashboard/learning-trend-chart';
import { AbilityRadar } from '@/components/sky/dashboard/ability-radar';
import { describe, it, expect } from 'vitest';

describe('LearningTrendChart', () => {
  const mockData = [
    { day: '周一', count: 3 },
    { day: '周二', count: 5 },
    { day: '周三', count: 2 },
    { day: '周四', count: 8 },
    { day: '周五', count: 4 },
    { day: '周六', count: 6 },
    { day: '周日', count: 1 },
  ];

  it('renders chart title and axis labels', () => {
    render(<LearningTrendChart data={mockData} />);
    expect(screen.getByText('近7天学习趋势')).toBeInTheDocument();
    expect(screen.getByText('周日')).toBeInTheDocument();
  });

  it('shows correct max count on Y axis', () => {
    render(<LearningTrendChart data={mockData} />);
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<LearningTrendChart data={[]} />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
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
