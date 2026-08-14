import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CloudMindPage from '@/app/sky/cloud-mind/page';
import { buildToolPersonalizationPolicies } from '@/lib/cloud-mind/tool-policies';
import type { CloudMindDashboardData, PersonalizationContext } from '@/lib/cloud-mind/types';

vi.mock('@/components/sky/layout/app-shell', () => ({
  SkyAppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
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
        variants: _variants,
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
    motion: new Proxy(
      {},
      {
        get: () => MotionDiv,
      },
    ),
  };
});

const dashboard: CloudMindDashboardData = {
  userId: 'student-1',
  generatedAt: Date.now(),
  hasLearningData: true,
  recommendations: [
    {
      id: 'rec-1',
      title: '先复习二次函数',
      reason: '最近二次函数相关题目波动较大。',
      priority: 100,
      actionType: 'practice_quiz',
      target: {
        href: '/sky/cloud-mind/quiz?topic=%E4%BA%8C%E6%AC%A1%E5%87%BD%E6%95%B0',
        label: '开始练习',
      },
      evidence: [
        {
          type: 'profile',
          title: '学情画像',
          summary: '二次函数当前掌握度 48%',
        },
        {
          type: 'knowledge',
          title: '知识库资料',
          summary: '这条知识库证据不应该显示在首页。',
        },
      ],
    },
  ],
  weakPoints: [
    {
      knowledgePoint: '二次函数',
      mastery: 48,
      recentMistakeCount: 3,
      actionHref: '/sky/cloud-mind/quiz?topic=%E4%BA%8C%E6%AC%A1%E5%87%BD%E6%95%B0',
    },
  ],
  dueReviews: [
    {
      id: 'due-1',
      kind: 'mistake',
      title: '顶点式应用题',
      knowledgePoints: ['二次函数'],
      dueAt: Date.now() - 1000,
      href: '/sky/learning',
    },
  ],
  recentRecords: [
    {
      id: 'record-1',
      source: 'quiz',
      title: '二次函数小测',
      detail: '4/5 正确',
      createdAt: Date.now() - 60 * 60 * 1000,
      href: '/sky/cloud-mind/quiz',
    },
    {
      id: 'record-hidden',
      source: 'write',
      title: '写作素材记录',
      detail: '不显示',
      createdAt: Date.now(),
    },
  ],
  knowledgeStats: null,
  toolStatus: [],
  summary: {
    totalQuestions: 10,
    totalCorrect: 7,
    masteryAverage: 62,
    recentAccuracy: 80,
  },
};

const personalizationContext = {
  userId: 'student-1',
  generatedAt: Date.now(),
  hasLearningData: true,
  hasPersonalizationSignals: true,
  weakPoints: dashboard.weakPoints,
  masteryByKnowledge: { 二次函数: 48 },
  recentAccuracy: 80,
  dueReviews: dashboard.dueReviews,
  errorPatterns: [],
  preferredDifficulty: 'medium',
  toolPolicies: buildToolPersonalizationPolicies({
    tutoringPolicy: {
      targetTopic: '二次函数',
      difficulty: 'medium',
      explanationStyle: 'step_first',
      resourceFormats: ['worked_example'],
      pacing: 'steady',
      directives: [],
      evidence: [],
    },
    weakPoints: dashboard.weakPoints,
    dueReviews: dashboard.dueReviews,
  }),
  recommendation: null,
} as PersonalizationContext;

describe('CloudMindPage', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch
      .mockResolvedValueOnce({
        json: async () => ({ success: true, data: dashboard }),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ success: true, data: personalizationContext }),
      } as Response);
    global.fetch = mockFetch;
  });

  it('keeps six tool cards while giving each card a personalized next action', async () => {
    render(<CloudMindPage />);

    expect(screen.getByText('拍照搜题')).toBeInTheDocument();
    expect(screen.getByText('PPT课件生成')).toBeInTheDocument();
    expect(screen.getByText('智能出题')).toBeInTheDocument();
    expect(screen.getByText('记忆卡片')).toBeInTheDocument();
    expect(screen.getByText('智能授课')).toBeInTheDocument();
    expect(screen.getByText('课程资源工坊')).toBeInTheDocument();

    expect(await screen.findByText('今日推荐工具')).toBeInTheDocument();
    expect(screen.getAllByText('先复习二次函数')).toHaveLength(2);
    expect(
      screen
        .getAllByRole('link', { name: '开始练习' })
        .some(
          (link) =>
            link.getAttribute('href') ===
            '/sky/cloud-mind/quiz?topic=%E4%BA%8C%E6%AC%A1%E5%87%BD%E6%95%B0',
        ),
    ).toBe(true);
    expect(screen.getByRole('link', { name: '生成记忆卡片' })).toHaveAttribute(
      'href',
      expect.stringContaining('/sky/cloud-mind/memory?topic='),
    );
    expect(screen.getByRole('link', { name: '智能出题：开始小测' })).toHaveAttribute(
      'href',
      expect.stringContaining('topic=%E4%BA%8C%E6%AC%A1%E5%87%BD%E6%95%B0'),
    );
    expect(screen.getByRole('link', { name: '课程资源工坊：进入资源工坊' })).toHaveAttribute(
      'href',
      expect.stringContaining('topic=%E4%BA%8C%E6%AC%A1%E5%87%BD%E6%95%B0'),
    );

    expect(screen.queryByText('待复习队列')).not.toBeInTheDocument();
    expect(screen.queryByText('最近薄弱点')).not.toBeInTheDocument();
    expect(screen.queryByText('最近正确率')).not.toBeInTheDocument();
    expect(screen.queryByText('最近记录')).not.toBeInTheDocument();
    expect(screen.queryByText('学情画像')).not.toBeInTheDocument();

    expect(screen.queryByText('智能写作')).not.toBeInTheDocument();
    expect(screen.queryByText('智能翻译')).not.toBeInTheDocument();
    expect(screen.queryByText('知识库')).not.toBeInTheDocument();
    expect(screen.queryByText('知识库资料')).not.toBeInTheDocument();
    expect(screen.queryByText('写作素材记录')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sky/cloud-mind/dashboard', {
        credentials: 'include',
      });
    });
  });
});
