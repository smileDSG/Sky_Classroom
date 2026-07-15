import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('MobileReviewPlanPage', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        dueToday: [
          {
            id: 'mistake-1',
            problemText: '二次函数顶点坐标求错',
            userAnswer: '(-2, 3)',
            correctAnswer: '(2, -1)',
            errorType: 'concept',
            knowledgePoints: ['二次函数', '配方法'],
            reviewCount: 2,
            nextReview: Date.now() - 60_000,
            masteryLevel: 2,
            reviewed: false,
          },
        ],
        dueCount: 1,
        upcoming: [
          { date: '2026-07-09', dayLabel: '明天', count: 2 },
          { date: '2026-07-12', dayLabel: '周日', count: 1 },
        ],
        overdue: 1,
        completed: 8,
        total: 12,
        progress: {
          totalCount: 12,
          masteredCount: 4,
          percentComplete: 67,
          completedRounds: 18,
          totalRounds: 27,
        },
      }),
    });
    global.fetch = mockFetch;
  });

  it('renders a native mobile review plan instead of a desktop iframe', async () => {
    const { container } = render(<MobileReviewPlanPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sky/review/due', {
        credentials: 'include',
        cache: 'no-store',
      });
    });

    expect(container.querySelector('iframe')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '到期复习' })).toBeInTheDocument();
    expect(screen.getByText('今日待复习')).toBeInTheDocument();
    expect(screen.getByText('逾期')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText('二次函数顶点坐标求错')).toBeInTheDocument();
    expect(screen.getByText('二次函数')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /已掌握/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /还需巩固/ })).toBeInTheDocument();
    expect(screen.getByText('未来复习')).toBeInTheDocument();
    expect(screen.getByText('明天')).toBeInTheDocument();

    const bottomNav = container.querySelector('nav.mobile-tactile-nav');
    expect(bottomNav).toBeInTheDocument();
    expect(within(bottomNav as HTMLElement).getByRole('link', { name: /我的/ })).toHaveAttribute(
      'href',
      '/m/sky/profile',
    );
  });
});
