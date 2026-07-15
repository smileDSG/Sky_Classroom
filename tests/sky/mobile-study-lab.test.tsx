import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MobileStudyLabPage from '@/app/m/sky/study-lab/page';

vi.mock('next/link', async () => {
  const ReactModule = await import('react');

  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      ReactModule.createElement('a', { href, ...props }, children),
  };
});

describe('MobileStudyLabPage', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        generatedAt: Date.now(),
        mistakes: [],
        review: { dueCount: 2, overdue: 1, completed: 0, total: 2 },
        learningStats: { masteryPercent: 64 },
        memoryProgress: { totalFlipped: 8, topicCount: 3, lastStudied: Date.now() },
        profile: {
          masteryByKnowledge: { 函数: 42 },
          weakPoints: ['函数'],
          totalQuestions: 10,
          totalCorrect: 6,
        },
      }),
    });
    global.fetch = mockFetch;
  });

  it('loads workshop data and renders functional mobile learning routes', async () => {
    render(<MobileStudyLabPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sky/workshop', {
        credentials: 'include',
        cache: 'no-store',
      });
    });

    expect(await screen.findByText('个人学习路径')).toBeInTheDocument();
    expect(screen.getByText('处理 2 道到期复习')).toBeInTheDocument();
    expect(screen.getByText('04')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /开始今日任务/ })).toHaveAttribute(
      'href',
      '/m/sky/learning/review/plan',
    );

    const toolSection = screen.getByLabelText('学习工具入口');
    [
      ['/m/sky/learning/mistakes', /错题本/],
      ['/m/sky/learning/review/plan', /复习计划/],
      ['/m/sky/learning/graph', /知识图谱/],
      ['/m/sky/learning/stats', /学习统计/],
      ['/m/sky/learning/profile', /学情分析/],
    ].forEach(([href, name]) => {
      expect(within(toolSection).getByRole('link', { name: name as RegExp })).toHaveAttribute(
        'href',
        href,
      );
    });
  });
});
