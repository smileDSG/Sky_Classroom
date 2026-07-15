import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MobileLearningProfilePage from '@/app/m/sky/learning/profile/page';

vi.mock('next/link', async () => {
  const ReactModule = await import('react');

  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      ReactModule.createElement('a', { href, ...props }, children),
  };
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/m/sky/learning/profile',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('MobileLearningProfilePage', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        generatedAt: 1720000000000,
        mistakes: [],
        review: { dueCount: 3, overdue: 1, completed: 8, total: 11 },
        learningStats: {
          masteryPercent: 72,
          todayStudyMinutes: 36,
          streakDays: 5,
          problemsAttempted: 18,
          problemsCorrect: 13,
        },
        memoryProgress: { totalFlipped: 12, topicCount: 4, lastStudied: 1720000000000 },
        profile: {
          masteryByKnowledge: {
            二次函数: 48,
            函数图像: 64,
            方程思想: 82,
          },
          weakPoints: ['二次函数', '函数图像'],
          strongPoints: ['方程思想'],
          errorPatterns: [{ knowledgePoint: '二次函数', errorType: 'concept-unclear', frequency: 4 }],
          totalQuestions: 18,
          totalCorrect: 13,
        },
      }),
    });
    global.fetch = mockFetch;
  });

  it('renders a legible dark mobile learning profile dashboard', async () => {
    const { container } = render(<MobileLearningProfilePage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sky/workshop', {
        credentials: 'include',
        cache: 'no-store',
      });
    });

    expect(container.querySelector('iframe')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '学习画像' })).toBeInTheDocument();

    const hero = screen.getByLabelText('学习画像总览');
    expect(hero).toHaveClass('bg-[#f8fbff]');
    expect(within(hero).getByText('学情分析')).toBeInTheDocument();
    expect(within(hero).getByText('掌握度')).toBeInTheDocument();
    expect(within(hero).getByText('正确率')).toBeInTheDocument();
    expect(within(hero).getByText('今日学习')).toBeInTheDocument();
    expect(within(hero).getByText('连续学习')).toBeInTheDocument();
    expect(within(hero).getAllByText('72%').length).toBeGreaterThan(0);

    expect(screen.getByText('画像完整度')).toBeInTheDocument();
    expect(screen.getByText('题目样本')).toBeInTheDocument();
    expect(screen.getAllByText('薄弱点').length).toBeGreaterThan(0);
    expect(screen.getAllByText('二次函数').length).toBeGreaterThan(0);
    expect(screen.getByText('学习偏好')).toBeInTheDocument();
    expect(screen.getByText('下一步行动')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /处理到期复习/ })).toHaveAttribute(
      'href',
      '/m/sky/learning/review/plan',
    );

    const bottomNav = container.querySelector('nav.mobile-tactile-nav');
    expect(bottomNav).toBeInTheDocument();
    expect(within(bottomNav as HTMLElement).getByRole('link', { name: /我的/ })).toHaveAttribute(
      'href',
      '/m/sky/profile',
    );
  });
});
