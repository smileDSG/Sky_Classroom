import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LearningProfilePage from '@/app/sky/learning/profile/page';

type TestSearchParams = Record<string, string | string[] | undefined>;

async function renderLearningProfilePage(searchParams: TestSearchParams = {}) {
  const page = await LearningProfilePage({ searchParams });
  return render(page);
}

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

vi.mock('@/components/sky/student/profile-onboarding-chat', () => ({
  ProfileOnboardingChat: ({
    title,
    description,
    starterQuestion,
    placeholder,
    submitLabel,
    suggestionPrompts,
    onPatchChange,
  }: {
    title?: string;
    description?: string;
    starterQuestion?: string;
    placeholder?: string;
    submitLabel?: string;
    suggestionPrompts?: Array<{ label: string; text: string }>;
    onPatchChange?: (patch: {
      learningGoal?: { value: string; confidence: number; evidence: string[] };
      knowledgeBase?: {
        weakPoints: string[];
        strongPoints: string[];
        confidence: number;
        evidence: string[];
      };
      resourcePreference?: { value: string[]; confidence: number; evidence: string[] };
      interactionPreference?: { value: string; confidence: number; evidence: string[] };
    }) => void;
  }) => (
    <section aria-label="画像对话采集">
      <h2>{title}</h2>
      <p>{description}</p>
      <p>{starterQuestion}</p>
      {suggestionPrompts?.map((prompt) => (
        <button type="button" key={prompt.label}>
          {prompt.label}: {prompt.text}
        </button>
      ))}
      <textarea aria-label="画像补充输入" placeholder={placeholder} />
      <button
        type="button"
        onClick={() =>
          onPatchChange?.({
            learningGoal: {
              value: '两周内补强机器学习',
              confidence: 0.86,
              evidence: ['两周内', '机器学习'],
            },
            knowledgeBase: {
              weakPoints: ['过拟合', '模型评估'],
              strongPoints: [],
              confidence: 0.82,
              evidence: ['过拟合', '模型评估'],
            },
            resourcePreference: {
              value: ['代码案例', '图解'],
              confidence: 0.8,
              evidence: ['代码', '图解'],
            },
            interactionPreference: {
              value: '步骤优先',
              confidence: 0.78,
              evidence: ['步骤'],
            },
          })
        }
      >
        {submitLabel}
      </button>
    </section>
  ),
}));

describe('LearningProfilePage', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          userId: 'student-1',
          generatedAt: Date.now(),
          hasLearningData: false,
          hasPersonalizationSignals: false,
          weakPoints: [],
          masteryByKnowledge: {},
          recentAccuracy: null,
          dueReviews: [],
          errorPatterns: [],
          preferredDifficulty: 'medium',
          recommendation: null,
          conversationProfile: null,
        },
      }),
    } as Response);
    global.fetch = mockFetch;
  });

  it('renders a dedicated profile-completion page', async () => {
    await renderLearningProfilePage();

    expect(await screen.findByRole('heading', { name: '完善学习情况' })).toBeInTheDocument();
    expect(screen.getByText('让摘星锦囊先认识你的目标、薄弱点和学习偏好。')).toBeInTheDocument();
    expect(screen.getByLabelText('画像对话采集')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /返回摘星锦囊/ })).toHaveAttribute('href', '/sky');
  });

  it('returns to the learning workshop when opened from there', async () => {
    await renderLearningProfilePage({ from: 'learning' });

    expect(await screen.findByRole('link', { name: /返回天梯工坊/ })).toHaveAttribute(
      'href',
      '/sky/learning',
    );
    expect(screen.queryByRole('link', { name: /返回摘星锦囊/ })).not.toBeInTheDocument();
  });

  it('shows empty profile fields before the learner adds conversational signals', async () => {
    await renderLearningProfilePage();

    expect(await screen.findAllByText('待补充')).toHaveLength(4);
    expect(screen.getByText('先说清楚你最想达成的学习结果。')).toBeInTheDocument();
    expect(screen.getByText('目标已明确')).toBeInTheDocument();
    expect(screen.getByText('薄弱点已明确')).toBeInTheDocument();
    expect(screen.queryByText('专业背景')).not.toBeInTheDocument();
    expect(screen.queryByText('学习节奏')).not.toBeInTheDocument();
    expect(screen.queryByText('当前状态')).not.toBeInTheDocument();
  });

  it('updates the live profile preview after the chat extracts a profile patch', async () => {
    await renderLearningProfilePage();

    fireEvent.click(await screen.findByRole('button', { name: '更新学习情况' }));

    expect(screen.getByText('两周内补强机器学习')).toBeInTheDocument();
    expect(screen.getByText('过拟合、模型评估')).toBeInTheDocument();
    expect(screen.getByText('代码案例、图解')).toBeInTheDocument();
    expect(screen.getByText('步骤优先')).toBeInTheDocument();
    expect(screen.getByText('4/4')).toBeInTheDocument();
  });

  it('passes profile-aware prompt suggestions into the conversational input', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          userId: 'student-1',
          generatedAt: Date.now(),
          hasLearningData: true,
          hasPersonalizationSignals: true,
          weakPoints: [{ knowledgePoint: '过拟合', mastery: 42, evidenceCount: 3 }],
          masteryByKnowledge: { 过拟合: 42 },
          recentAccuracy: 58,
          dueReviews: [],
          errorPatterns: [],
          preferredDifficulty: 'easy',
          learningPath: { next: '模型评估', nodes: ['过拟合', '模型评估'], reason: '薄弱点优先' },
          tutoringPolicy: {
            targetTopic: '过拟合',
            difficulty: 'easy',
            explanationStyle: 'example_first',
            resourceFormats: ['code_case', 'diagram'],
            pacing: 'remedial',
            directives: [],
            evidence: [],
          },
          conversationProfile: {
            learningGoal: {
              value: '两周内补强机器学习',
              confidence: 0.86,
              evidence: ['两周内', '机器学习'],
              source: 'onboarding_chat',
              updatedAt: Date.now(),
            },
            resourcePreference: {
              value: ['代码案例', '图解'],
              confidence: 0.8,
              evidence: ['代码', '图解'],
              source: 'onboarding_chat',
              updatedAt: Date.now(),
            },
            interactionPreference: {
              value: '步骤优先',
              confidence: 0.78,
              evidence: ['步骤'],
              source: 'onboarding_chat',
              updatedAt: Date.now(),
            },
          },
          recommendation: null,
        },
      }),
    } as Response);

    await renderLearningProfilePage();

    expect(await screen.findByText(/继续补强/)).toHaveTextContent('过拟合');
    expect(screen.getByText(/目标和偏好/)).toHaveTextContent('两周内补强机器学习');
    expect(screen.getByText(/目标和偏好/)).toHaveTextContent('代码案例、图解');
  });

  it('provides next action links for personalized study workflows', async () => {
    await renderLearningProfilePage();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sky/cloud-mind/personalization-context', {
        credentials: 'include',
        cache: 'no-store',
      });
    });

    expect(screen.getByRole('link', { name: /生成个性化资料/ })).toHaveAttribute(
      'href',
      '/sky/cloud-mind/course-studio',
    );
    expect(screen.getByRole('link', { name: /开始智能练习/ })).toHaveAttribute(
      'href',
      '/sky/cloud-mind/quiz',
    );
    expect(screen.getByRole('link', { name: /查看个人学习计划/ })).toHaveAttribute(
      'href',
      '/sky/learning#learning-plan',
    );
    expect(screen.getByRole('link', { name: /查看完整分析/ })).toHaveAttribute(
      'href',
      '/sky/student',
    );
  });
});
