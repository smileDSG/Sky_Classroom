import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CourseStudioPage } from '@/components/sky/course-studio/course-studio-page';

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

describe('CourseStudioPage', () => {
  const mockFetch = vi.fn();
  const personalizationContext = {
    userId: 'student-1',
    generatedAt: Date.now(),
    hasLearningData: true,
    hasPersonalizationSignals: true,
    weakPoints: [
      {
        knowledgePoint: 'RAG',
        mastery: 48,
        recentMistakeCount: 2,
        actionHref: '/sky/cloud-mind/quiz',
      },
    ],
    masteryByKnowledge: { RAG: 48 },
    recentAccuracy: 62,
    dueReviews: [],
    errorPatterns: [],
    preferredDifficulty: 'medium',
    learningPath: {
      current: '检索增强生成',
      next: '智能体工作流',
      nodes: ['RAG', '智能体工作流'],
      reason: '薄弱点优先',
    },
    tutoringPolicy: {
      targetTopic: 'RAG',
      difficulty: 'medium',
      explanationStyle: 'example_first',
      resourceFormats: ['code_case', 'diagram'],
      pacing: 'steady',
      directives: [],
      evidence: [{ source: 'profile', summary: '偏好代码案例' }],
    },
    recommendation: {
      title: '复习 RAG',
      reason: '最近准确率偏低',
      targetTool: 'quiz',
      href: '/sky/cloud-mind/quiz',
    },
  };

  const studentProfile = {
    userId: 'student-1',
    lastUpdated: '2026-07-03T00:00:00.000Z',
    dimensions: {
      majorBackground: { value: '软件工程大二', confidence: 0.8, evidence: ['profile'] },
      learningGoal: { value: '复习 RAG', confidence: 0.86, evidence: ['goal'] },
      knowledgeBase: {
        strongPoints: ['Python'],
        weakPoints: ['RAG'],
        confidence: 0.82,
        evidence: ['weak point'],
      },
      cognitiveStyle: { value: '例子优先', confidence: 0.78, evidence: ['style'] },
      errorPatternPreference: { value: ['概念边界'], confidence: 0.7, evidence: ['error'] },
      resourcePreference: { value: ['讲义', '题库'], confidence: 0.8, evidence: ['resource'] },
      learningPace: { value: '每天 45 分钟', confidence: 0.7, evidence: ['pace'] },
      currentLearningState: { value: '期末复习', confidence: 0.7, evidence: ['state'] },
    },
  };

  const p2Enhancements = {
    videoHandoff: {
      status: 'ready_for_generation' as const,
      providerHint: 'demo provider',
      scenes: [{ sceneId: 'scene-1', title: 'RAG 导入', durationSeconds: 40 }],
    },
    weeklyPlan: [
      {
        weekIndex: 1,
        theme: 'RAG 基础',
        goals: ['理解检索增强'],
        reviewItems: ['向量检索'],
        estimatedMinutes: 120,
      },
    ],
    spacedReviews: [{ knowledgePoint: 'RAG', dueInDays: 2, priority: 'high' }],
    masteryEstimates: [
      { knowledgePoint: 'RAG', mastery: 0.58, stability: 0.6, nextReviewInDays: 2 },
    ],
    classGroupProfile: {
      learnerCount: 8,
      weakPointTrends: [{ knowledgePoint: 'RAG', affectedLearners: 5, averageMastery: 0.52 }],
      tierRecommendations: [{ tier: '基础', learnerCount: 5, focus: '检索流程' }],
      teacherActions: ['补充一个检索案例'],
    },
  };

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: personalizationContext,
      }),
    } as Response);
    global.fetch = mockFetch;
  });

  it('keeps the initial course studio screen focused on one generation task', async () => {
    render(<CourseStudioPage />);

    expect(
      await screen.findByRole('heading', { name: '这次想生成什么学习资料？' }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('例如：帮我复习 RAG，准备期末考试')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /生成/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /讲义/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PPT/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /题库/ })).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sky/cloud-mind/personalization-context', {
        credentials: 'include',
        headers: expect.any(Headers),
      });
    });

    expect(screen.queryByLabelText('专业背景')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('学习目标')).not.toBeInTheDocument();
    expect(screen.queryByText('Agent 协同进度')).not.toBeInTheDocument();
    expect(screen.queryByText('P1 Evidence')).not.toBeInTheDocument();
    expect(screen.queryByText('P2 Long-Term')).not.toBeInTheDocument();
  });

  it('shows generated evidence sections as a tab-like detail navigation', async () => {
    mockFetch.mockImplementation(async (href: string) => {
      if (href === '/api/sky/cloud-mind/personalization-context') {
        return {
          ok: true,
          json: async () => ({ success: true, data: personalizationContext }),
        } as Response;
      }
      if (href === '/api/sky/content-safety/check') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              passed: true,
              riskLevel: 'low',
              categories: [],
              action: 'allow',
              message: '内容安全',
            },
          }),
        } as Response;
      }
      if (href === '/api/sky/student/profile/conversation') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { profile: studentProfile } }),
        } as Response;
      }
      if (href.startsWith('/api/sky/course-knowledge/search')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              results: [
                {
                  document: {
                    title: 'RAG 阅读材料',
                    kind: 'reading',
                    file: 'readings.md',
                    tags: ['RAG'],
                  },
                  score: 0.92,
                  snippet: '检索增强生成的基础流程',
                },
              ],
            },
          }),
        } as Response;
      }
      if (href === '/api/sky/resource-generation/jobs') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              jobId: 'job-1',
              progress: 100,
              studentProfile,
              safety: {
                passed: true,
                riskLevel: 'low',
                categories: [],
                action: 'allow',
                message: '内容安全',
              },
              courseHits: [
                {
                  document: {
                    title: 'RAG 阅读材料',
                    kind: 'reading',
                    file: 'readings.md',
                    tags: ['RAG'],
                  },
                  score: 0.92,
                  snippet: '检索增强生成的基础流程',
                },
              ],
              agentTrace: [{ agent: 'ResourceAgents', status: 'completed', output: '生成讲义' }],
              resources: [
                {
                  id: 'lecture-1',
                  type: 'markdown_lecture',
                  title: 'RAG 复习讲义',
                  sourceCitations: ['readings.md'],
                  contentPreview: '结构化解释和关键案例',
                  content: '# RAG 复习讲义\n\n结构化解释和关键案例',
                  trust: { confidence: 0.92, status: 'pass' },
                },
              ],
              learningPath: [
                {
                  dayRange: 'Day 1',
                  goal: '复习 RAG',
                  resources: ['lecture-1'],
                  reason: '薄弱点优先',
                },
              ],
              p2Enhancements,
              reviewResult: { passed: true, confidence: 0.92, issues: [], suggestions: [] },
            },
          }),
        } as Response;
      }
      throw new Error(`Unhandled fetch: ${href}`);
    });

    render(<CourseStudioPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sky/cloud-mind/personalization-context', {
        credentials: 'include',
        headers: expect.any(Headers),
      });
    });

    fireEvent.click(screen.getByRole('button', { name: /^生成$/ }));

    expect(await screen.findByText('已生成 1 份资料')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /为什么适合你/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /生成流程/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /可信审核/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /后续学习/ })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('软件工程大二');

    fireEvent.click(screen.getByRole('tab', { name: /可信审核/ }));

    expect(screen.getByRole('tabpanel')).toHaveTextContent('风险等级：low');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('RAG 阅读材料');
  });
});
