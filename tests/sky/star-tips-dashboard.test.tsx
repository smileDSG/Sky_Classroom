import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SkyDashboardPage from '@/app/sky/page';
import type { MistakeRecord } from '@/lib/mistakes/types';

vi.mock('@/components/sky/layout/app-shell', () => ({
  SkyAppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

const stableUser = { id: 'student-1' };

vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => ({ user: stableUser }),
}));

vi.mock('@/lib/hooks/use-theme', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('next/link', async () => {
  const ReactModule = await import('react');

  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      ReactModule.createElement('a', { href, ...props }, children),
  };
});

vi.mock('motion/react', async () => {
  const ReactModule = await import('react');
  const MotionDiv = ReactModule.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => {
      const {
        animate: _animate,
        initial: _initial,
        transition: _transition,
        exit: _exit,
        whileHover: _whileHover,
        ...domProps
      } = props as React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>;

      return (
        <div ref={ref} {...domProps}>
          {children}
        </div>
      );
    },
  );

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: new Proxy(
      {},
      {
        get: () => MotionDiv,
      },
    ),
  };
});

const mistake: MistakeRecord = {
  id: 'mistake-1',
  problem: '二次函数顶点坐标怎么求？',
  userAnswer: 'x = 2',
  correctAnswer: '(-b / 2a, f(-b / 2a))',
  cause: 'concept-unclear',
  solvedAt: new Date(),
  reviewed: false,
  reviewCount: 0,
  knowledgePoints: ['二次函数'],
};

vi.mock('@/lib/store/use-sky-classroom-store', () => ({
  useSkyClassroomStore: (selector: (state: { mistakes: MistakeRecord[] }) => unknown) =>
    selector({ mistakes: [mistake] }),
}));

vi.mock('@/lib/mistakes/bridge', () => ({
  syncMistakesFromQuizzes: vi.fn(),
}));

describe('SkyDashboardPage', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/sky/learning-stats') {
        return Promise.resolve({
          json: async () => ({
            success: true,
            todayStudyMinutes: 18,
            streakDays: 2,
            masteryPercent: 45,
          }),
        } as Response);
      }
      if (url === '/api/sky/cloud-mind/personalization-context') {
        return Promise.resolve({
          json: async () => ({
            success: true,
            data: {
              userId: 'student-1',
              generatedAt: Date.now(),
              hasLearningData: true,
              weakPoints: [],
              masteryByKnowledge: {},
              recentAccuracy: 72,
              dueReviews: [],
              errorPatterns: [],
              preferredDifficulty: 'medium',
              recommendation: {
                title: '复习 2 条到期内容',
                reason: '先把到期内容转成短周期卡片，能减少遗忘并更新掌握度。',
                targetTool: 'memory',
                href: '/sky/cloud-mind/memory?topic=%E4%BA%8C%E6%AC%A1%E5%87%BD%E6%95%B0',
              },
            },
          }),
        } as Response);
      }
      if (url === '/api/sky/learning-path') {
        return Promise.resolve({
          json: async () => ({ success: true, data: { path: null } }),
        } as Response);
      }
      return Promise.resolve({
        json: async () => ({ success: false }),
      } as Response);
    });
    global.fetch = mockFetch;
  });

  it("keeps the overview focused on today's plan and routes detail work to dedicated pages", async () => {
    render(<SkyDashboardPage />);

    expect(await screen.findByText('今天优先完成')).toBeInTheDocument();
    expect(screen.getByText('今天的安排')).toBeInTheDocument();
    expect(screen.getByText('学习快照')).toBeInTheDocument();
    expect(screen.getByText('完成后，再深入处理')).toBeInTheDocument();
    expect(screen.getByText('复习 2 条到期内容')).toBeInTheDocument();
    expect(
      screen.getByText('先把到期内容转成短周期卡片，能减少遗忘并更新掌握度。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /开始行动/ })).toHaveAttribute(
      'href',
      '/sky/cloud-mind/memory?topic=%E4%BA%8C%E6%AC%A1%E5%87%BD%E6%95%B0',
    );

    expect(screen.getByRole('link', { name: /查看完整学习记录/ })).toHaveAttribute(
      'href',
      '/sky/learning/profile-dashboard',
    );
    expect(
      screen
        .getAllByRole('link', { name: /学习路径/ })
        .some((link) => link.getAttribute('href') === '/sky/learning/path'),
    ).toBe(true);
    expect(screen.queryByRole('tablist', { name: '首页视图' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: '学习计划时间范围' })).not.toBeInTheDocument();
    expect(screen.queryByText('趋势与能力')).not.toBeInTheDocument();
    expect(screen.queryByText('关键入口')).not.toBeInTheDocument();

    await waitFor(() => {
      const learningStatsCalls = mockFetch.mock.calls.filter(
        ([url]) => url === '/api/sky/learning-stats',
      );
      expect(learningStatsCalls).toHaveLength(1);
    });
    const personalizationCalls = mockFetch.mock.calls.filter(
      ([url]) => url === '/api/sky/cloud-mind/personalization-context',
    );
    expect(personalizationCalls).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith('/api/sky/learning-stats', {
      credentials: 'include',
    });
  });
});
