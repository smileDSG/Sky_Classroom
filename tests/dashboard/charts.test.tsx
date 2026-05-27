import { render, screen } from '@testing-library/react';
import { LearningTrendChart } from '@/components/sky/dashboard/learning-trend-chart';
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
