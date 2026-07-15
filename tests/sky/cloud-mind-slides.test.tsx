import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CloudMindSlidesPage from '@/app/sky/cloud-mind/slides/page';
import { EmptyState } from '@/components/sky/slides/states/empty-state';

vi.mock('@/components/sky/slides/slides-page', () => ({
  default: ({
    initialTopic,
    personalizationNotice,
  }: {
    initialTopic?: string;
    personalizationNotice?: string | null;
  }) => (
    <section>
      <div data-testid="slides-topic">{initialTopic ?? ''}</div>
      <div data-testid="slides-notice">{personalizationNotice ?? ''}</div>
    </section>
  ),
}));

vi.mock('@/components/sky/slides/design-system/celestial-canvas', () => ({
  CelestialCanvas: () => <div data-testid="celestial-canvas" />,
}));

vi.mock('motion/react', async () => {
  const ReactModule = await import('react');
  type MockMotionProps = React.PropsWithChildren<
    {
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
      whileHover?: unknown;
      whileTap?: unknown;
    } & React.HTMLAttributes<HTMLElement>
  >;

  const createMotionComponent = (tag: keyof React.JSX.IntrinsicElements) =>
    ReactModule.forwardRef<HTMLElement, MockMotionProps>(
      (
        {
          children,
          initial: _initial,
          animate: _animate,
          transition: _transition,
          whileHover: _whileHover,
          whileTap: _whileTap,
          ...props
        },
        ref,
      ) => ReactModule.createElement(tag as string, { ref, ...props }, children),
    );

  return {
    motion: new Proxy(
      {},
      {
        get: (_target, tag: string) =>
          createMotionComponent(tag as keyof React.JSX.IntrinsicElements),
      },
    ),
  };
});

describe('CloudMindSlidesPage', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });

  it('prefills the PPT topic from the personalization context', async () => {
    const topic = '\u4e8c\u6b21\u51fd\u6570';
    const policyTopic = 'vector retrieval';
    mockFetch.mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          userId: 'student-1',
          generatedAt: Date.now(),
          hasLearningData: true,
          weakPoints: [],
          masteryByKnowledge: {},
          recentAccuracy: null,
          dueReviews: [],
          errorPatterns: [],
          learningPath: {
            next: topic,
            nodes: [topic],
            reason: 'active path',
          },
          preferredDifficulty: 'medium',
          tutoringPolicy: {
            targetTopic: policyTopic,
            difficulty: 'medium',
            explanationStyle: 'example_first',
            resourceFormats: ['code_case', 'diagram'],
            pacing: 'steady',
            directives: ['围绕 vector retrieval 组织讲解和练习。'],
            evidence: [],
          },
          recommendation: null,
        },
      }),
    } as Response);

    render(<CloudMindSlidesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('slides-topic')).toHaveTextContent(policyTopic);
    });
    expect(screen.getByTestId('slides-notice')).toHaveTextContent(policyTopic);
    expect(mockFetch).toHaveBeenCalledWith('/api/sky/cloud-mind/personalization-context');
  });
});

describe('Slides EmptyState', () => {
  it('renders a lightweight personalization notice above the topic input', () => {
    render(
      <EmptyState
        topic=""
        difficulty="senior"
        generating={false}
        personalizationNotice="Personalized from ladder data"
        onTopicChange={vi.fn()}
        onDifficultyChange={vi.fn()}
        onGenerate={vi.fn()}
      />,
    );

    expect(screen.getByText('Personalized from ladder data')).toBeInTheDocument();
  });
});
