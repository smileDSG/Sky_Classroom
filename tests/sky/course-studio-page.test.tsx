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

// 可控的 useSearchParams / useRouter mock：测试可自主注入 resourceJobId 并断言跳转。
const nav = vi.hoisted(() => {
  const params = new URLSearchParams();
  const push = vi.fn();
  return { params, push };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => nav.params,
}));

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

  const generationResult = {
    jobId: 'job-1',
    progress: 100,
    studentProfile,
    safety: {
      passed: true,
      riskLevel: 'low' as const,
      categories: [],
      action: 'allow' as const,
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
  };

  beforeEach(() => {
    mockFetch.mockReset();
    nav.params = new URLSearchParams();
    nav.push.mockReset();
    mockFetch.mockImplementation(async (href: string, init?: RequestInit) => {
      if (href === '/api/sky/cloud-mind/personalization-context') {
        return jsonResponse({ success: true, data: personalizationContext });
      }
      if (href === '/api/sky/resource-generation/jobs' && init?.method === 'POST') {
        return jsonResponse({ success: true, jobId: 'job-1' }, 202);
      }
      if (href === '/api/sky/resource-generation/jobs/job-1' && !init?.method) {
        return jsonResponse({
          success: true,
          jobId: 'job-1',
          status: 'succeeded',
          step: 'completed',
          progress: 100,
          message: '学习资料已生成完成',
          result: generationResult,
          done: true,
        });
      }
      throw new Error(`Unhandled fetch: ${href}`);
    });
    global.fetch = mockFetch;
  });

  it('keeps the initial course studio screen focused on one generation task', async () => {
    render(<CourseStudioPage />);

    expect(
      await screen.findByRole('heading', { name: '这次想生成什么样的学习包？' }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('例如：帮我复习导数，准备期末考试')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^生成$/ })).toBeInTheDocument();
    for (const label of ['讲义', '导图', '自查清单', '学习路径']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}$`) })).toBeInTheDocument();
    }
  });

  it('sends only the selected resource type to the server (on-demand single generation)', async () => {
    render(<CourseStudioPage />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sky/cloud-mind/personalization-context',
        expect.any(Object),
      );
    });

    // Unselect 3 types, keep only 讲义.
    for (const label of ['导图', '自查清单', '学习路径']) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}$`) }));
    }

    fireEvent.click(screen.getByRole('button', { name: /^生成$/ }));

    const postCall = mockFetch.mock.calls.find(
      ([href, init]) =>
        href === '/api/sky/resource-generation/jobs' && (init as any)?.method === 'POST',
    );
    expect(postCall).toBeDefined();
    const json = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(json.resourceTypes).toEqual(['markdown_lecture']);
  });

  it('shows an error with a retry button and preserves the input when submission fails', async () => {
    mockFetch.mockImplementation(async (href: string, init?: RequestInit) => {
      if (href === '/api/sky/cloud-mind/personalization-context') {
        return jsonResponse({ success: true, data: personalizationContext });
      }
      if (href === '/api/sky/resource-generation/jobs' && init?.method === 'POST') {
        return jsonResponse({ success: false, error: '生成任务提交失败' }, 500);
      }
      throw new Error(`Unhandled fetch: ${href}`);
    });
    global.fetch = mockFetch;

    render(<CourseStudioPage />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    const intent = screen.getByPlaceholderText('例如：帮我复习导数，准备期末考试');
    fireEvent.change(intent, { target: { value: '我的导数复习需求' } });
    fireEvent.click(screen.getByRole('button', { name: /^生成$/ }));

    expect(await screen.findByText('生成任务提交失败')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^重试$/ })).toBeInTheDocument();
    // 输入不丢失：失败后 textarea 仍保留用户填写的内容。
    expect(intent).toHaveValue('我的导数复习需求');
  });

  it('renders the generated result when a background job finishes', async () => {
    nav.params.set('resourceJobId', 'job-1');
    render(<CourseStudioPage />);

    expect(await screen.findByText('已生成 1 份资料')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /为什么适合你/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /生成流程/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /后续学习/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /为什么适合你/ }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('软件工程大二');
  });
});

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}
