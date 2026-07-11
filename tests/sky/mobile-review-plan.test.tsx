import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MobileReviewPlanPage from '@/app/m/sky/learning/review/plan/page';

vi.mock('next/link', async () => {
  const ReactModule = await import('react');

  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      ReactModule.createElement('a', { href, ...props }, children),
  };
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/m/sky/learning/review/plan',
}));

describe('MobileReviewPlanPage', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });

  it('renders native due review tasks with quiz and memory follow-ups', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          dueToday: [
            {
              id: 'm1',
              problemText: '判断函数 f(x) 的单调性',
              userAnswer: '递增',
              correctAnswer: '先求导再判断符号',
              knowledgePoints: ['函数', '导数'],
              reviewCount: 1,
              masteryLevel: 2,
              reviewed: false,
            },
          ],
          dueCount: 1,
          upcoming: [],
          overdue: 0,
          completed: 0,
          total: 1,
          progress: { percentComplete: 20 },
        },
      }),
    });

    render(<MobileReviewPlanPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sky/review/due', {
        credentials: 'include',
        cache: 'no-store',
      });
    });

    expect(await screen.findByRole('heading', { name: '到期复习' })).toBeInTheDocument();
    expect(screen.getByText('判断函数 f(x) 的单调性')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /同类练习/ })).toHaveAttribute(
      'href',
      '/m/sky/cloud-mind/quiz?topic=%E5%87%BD%E6%95%B0',
    );
    expect(screen.getByRole('link', { name: /生成记忆卡/ })).toHaveAttribute(
      'href',
      '/m/sky/cloud-mind/memory?topic=%E5%87%BD%E6%95%B0&content=%E5%88%A4%E6%96%AD%E5%87%BD%E6%95%B0%20f(x)%20%E7%9A%84%E5%8D%95%E8%B0%83%E6%80%A7',
    );
  });

  it('renders an empty state when there are no review signals', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          dueToday: [],
          dueCount: 0,
          upcoming: [],
          overdue: 0,
          completed: 0,
          total: 0,
        },
      }),
    });

    render(<MobileReviewPlanPage />);

    expect(await screen.findByText('今天没有到期复习')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /去练一题/ })).toHaveAttribute(
      'href',
      '/m/sky/cloud-mind/solve',
    );
  });
});
