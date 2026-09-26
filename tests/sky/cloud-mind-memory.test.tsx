import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CloudMindMemoryPage from '@/app/sky/cloud-mind/memory/page';
import { useTaskStore } from '@/lib/store/use-task-store';
import type { MemoryCardsStreamEvent } from '@/lib/agents/cloud-mind/memory-cards-agent';

vi.mock('@/components/sky/layout/app-shell', () => ({
  SkyAppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/hooks/use-theme', () => ({
  useTheme: () => ({ setForceDark: vi.fn() }),
}));

vi.mock('@/components/sky/slides/design-system/celestial-canvas', () => ({
  CelestialCanvas: () => <div data-testid="celestial-canvas" />,
}));

vi.mock('motion/react', async () => {
  const ReactModule = await import('react');
  const MotionDiv = ReactModule.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    ),
  );

  return {
    motion: new Proxy(
      {},
      {
        get: () => MotionDiv,
      },
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

const mockDeck = {
  topic: '二次函数',
  description: '二次函数记忆卡片',
  cards: [
    {
      index: 1,
      front: '二次函数的一般式是什么？',
      back:
        '正确答案是 $a=\\frac{5}{3}, b=-2, c=\\frac{1}{3}$。\n\n' +
        '这张卡片故意放入较长说明，用来覆盖背面内容较多时的显示：先列方程，再代入三个点，最后用消元法验证结果是否满足每个坐标。',
      mnemonic: '把“代入、消元、验证”当成三步检查清单。',
      relatedConcepts: ['一般式'],
      difficulty: 'easy',
      tags: ['二次函数'],
    },
    {
      index: 2,
      front: '待定系数法为什么要验证？',
      back: '验证可以发现代入或消元中的错误，尤其是含有 $\\frac{1}{3}$ 这类分数时。',
      relatedConcepts: ['待定系数法'],
      difficulty: 'medium',
      tags: ['验证'],
    },
  ],
  studyTips: '先理解再记忆。',
  reviewIntervals: [1, 2, 4, 7],
};

function sseResponse(events: MemoryCardsStreamEvent[]): Response {
  const encoder = new TextEncoder();
  const payload = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
  const bytes = encoder.encode(payload);
  let offset = 0;
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
    body: {
      getReader: () => ({
        read: async () => {
          if (offset >= bytes.length) return { done: true, value: undefined };
          const chunk = bytes.slice(offset, offset + 256);
          offset += chunk.length;
          return { done: false, value: chunk };
        },
        cancel: async () => {},
        releaseLock: () => {},
      }),
    },
  } as unknown as Response;
}

describe('CloudMindMemoryPage', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/student/profile') {
        return {
          json: async () => ({ success: true, data: { hasProfile: false } }),
        } as Response;
      }
      if (url === '/api/sky/cloud-mind/personalization-context') {
        return {
          json: async () => ({
            success: true,
            data: {
              userId: 'test-user',
              generatedAt: Date.now(),
              hasLearningData: false,
              weakPoints: [],
              masteryByKnowledge: {},
              recentAccuracy: null,
              dueReviews: [],
              errorPatterns: [],
              preferredDifficulty: 'medium',
              recommendation: {
                title: 'Start with quiz',
                reason: 'No learning data yet',
                targetTool: 'quiz',
                href: '/sky/cloud-mind/quiz',
              },
            },
          }),
        } as Response;
      }
      if (url === '/api/sky/cloud-mind/memory-reviews?due=true') {
        return {
          json: async () => ({ success: true, data: [] }),
        } as Response;
      }
      if (url === '/api/sky/cloud-mind/memory-cards/stream') {
        return sseResponse([{ type: 'done', deck: mockDeck }]);
      }
      if (url === '/api/sky/cloud-mind/memory-reviews' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { profileImpact: [], decision: null } }),
        } as Response;
      }
      throw new Error(`Unexpected fetch: ${url} ${JSON.stringify(init)}`);
    });
    global.fetch = mockFetch;
    useTaskStore.setState({
      tasks: {},
      dismissedIds: new Set<string>(),
      activeSolveTaskId: null,
      abortControllers: new Map<string, AbortController>(),
    });
  });

  it('submits manual content to the streaming endpoint', async () => {
    render(<CloudMindMemoryPage />);

    expect(screen.getByTestId('workspace-panel')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-main')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-aside')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-grid')).toHaveAttribute('data-mode', 'edit');

    const [topicInput, contentTextarea] = screen.getAllByRole('textbox');
    fireEvent.change(topicInput, { target: { value: '二次函数、待定系数法' } });
    fireEvent.change(contentTextarea, {
      target: {
        value: '已知二次函数 y = ax^2 + bx + c 的图象经过点 (1,0)、(-1,4) 和 (2,3)，求 a、b、c。',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /生成记忆卡/ }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sky/cloud-mind/memory-cards/stream',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    const streamCall = mockFetch.mock.calls.find(
      ([input]) => String(input) === '/api/sky/cloud-mind/memory-cards/stream',
    );
    expect(streamCall).toBeDefined();

    const requestBody = JSON.parse((streamCall?.[1] as RequestInit).body as string);
    expect(requestBody).toMatchObject({
      content: '已知二次函数 y = ax^2 + bx + c 的图象经过点 (1,0)、(-1,4) 和 (2,3)，求 a、b、c。',
      topic: '二次函数、待定系数法',
      cardCount: 12,
    });
    expect(requestBody.auto).toBeUndefined();
  });

  it('prefills topic and content from personalization context', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/sky/cloud-mind/personalization-context') {
        return {
          json: async () => ({
            success: true,
            data: {
              userId: 'test-user',
              generatedAt: Date.now(),
              hasLearningData: true,
              weakPoints: [
                {
                  knowledgePoint: '二次函数',
                  mastery: 42,
                  recentMistakeCount: 2,
                  actionHref: '/sky/cloud-mind/quiz?topic=%E4%BA%8C%E6%AC%A1%E5%87%BD%E6%95%B0',
                },
              ],
              masteryByKnowledge: { 二次函数: 42 },
              recentAccuracy: 55,
              dueReviews: [],
              errorPatterns: [],
              preferredDifficulty: 'easy',
              recommendation: {
                title: 'Practice weak point',
                reason: 'Weak point detected',
                targetTool: 'quiz',
                href: '/sky/cloud-mind/quiz?topic=%E4%BA%8C%E6%AC%A1%E5%87%BD%E6%95%B0',
              },
            },
          }),
        } as Response;
      }
      if (url === '/api/sky/cloud-mind/memory-cards') {
        return {
          json: async () => ({ success: true, data: mockDeck }),
        } as Response;
      }
      return {
        json: async () => ({ success: true, data: { hasProfile: false } }),
      } as Response;
    });

    render(<CloudMindMemoryPage />);

    await waitFor(() => {
      const [topicInput, contentTextarea] = screen.getAllByRole('textbox');
      expect(topicInput).toHaveValue('二次函数');
      expect((contentTextarea as HTMLTextAreaElement).value).toContain('二次函数');
    });
  });

  it('renders LaTeX formulas in generated cards with KaTeX', async () => {
    const { container } = render(<CloudMindMemoryPage />);

    const [topicInput, contentTextarea] = screen.getAllByRole('textbox');
    fireEvent.change(topicInput, { target: { value: '二次函数' } });
    fireEvent.change(contentTextarea, { target: { value: '求二次函数待定系数。' } });

    fireEvent.click(screen.getByRole('button', { name: /生成记忆卡/ }));

    await waitFor(() => {
      expect(container.querySelector('.katex')).not.toBeNull();
    });
  });

  it('asks learners to confirm mastery before counting a card as collected', async () => {
    render(<CloudMindMemoryPage />);

    const [, contentTextarea] = screen.getAllByRole('textbox');
    fireEvent.change(contentTextarea, { target: { value: '求二次函数待定系数。' } });
    fireEvent.click(screen.getByRole('button', { name: /生成记忆卡/ }));

    await screen.findByText('二次函数的一般式是什么？');
    fireEvent.click(screen.getByRole('button', { name: /开始复习/ }));

    expect(screen.getByText('已完成 0/2 张')).toBeInTheDocument();

    // 翻到背面后才会出现评分按钮
    fireEvent.click(screen.getByText('点击查看答案'));
    expect(screen.getByRole('button', { name: '已掌握' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '还需复习' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '没记住' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '已掌握' }));

    expect(screen.getByText('已完成 1/2 张')).toBeInTheDocument();
  });

  it('keeps long study-card content inside a bounded scroll area', async () => {
    render(<CloudMindMemoryPage />);

    const [, contentTextarea] = screen.getAllByRole('textbox');
    fireEvent.change(contentTextarea, { target: { value: '求二次函数待定系数。' } });
    fireEvent.click(screen.getByRole('button', { name: /生成记忆卡/ }));

    await screen.findByText('二次函数的一般式是什么？');
    fireEvent.click(screen.getByRole('button', { name: /开始复习/ }));

    expect(screen.getByTestId('memory-card-shell')).toHaveClass('h-[360px]', 'sm:h-[400px]');
    expect(screen.getByTestId('memory-card-back-scroll')).toHaveClass('overflow-y-auto');
  });
});
