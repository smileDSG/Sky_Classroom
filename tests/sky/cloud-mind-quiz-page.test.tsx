import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CloudMindQuizPage from '@/app/sky/cloud-mind/quiz/page';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/sky/cloud-mind/quiz',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('motion/react', () => {
  const createMotionElement = (Tag: 'div' | 'button') => {
    const MotionElement = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
      ({ children, ...props }, ref) => {
        const domProps = { ...props } as React.HTMLAttributes<HTMLElement> &
          Record<string, unknown>;
        delete domProps.animate;
        delete domProps.initial;
        delete domProps.transition;
        delete domProps.variants;
        delete domProps.exit;
        delete domProps.layout;
        delete domProps.whileTap;

        return (
          <Tag ref={ref as React.Ref<never>} {...domProps}>
            {children}
          </Tag>
        );
      },
    );
    MotionElement.displayName = `Motion${Tag[0].toUpperCase()}${Tag.slice(1)}`;
    return MotionElement;
  };
  const MotionDiv = createMotionElement('div');
  const MotionButton = createMotionElement('button');

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: new Proxy(
      {},
      {
        get: (_target, property) => (property === 'button' ? MotionButton : MotionDiv),
      },
    ),
  };
});

vi.mock('@/components/sky/slides/design-system/celestial-canvas', () => ({
  CelestialCanvas: () => <div data-testid="celestial-canvas" />,
}));

vi.mock('@/components/sky/solve/math-renderer', () => ({
  MathRenderer: ({ content }: { content: string }) => <span>{content}</span>,
}));

vi.mock('@/lib/store/use-task-store', () => {
  const mockStore = {
    tasks: {},
    dismissedIds: new Set<string>(),
    getTask: vi.fn(),
    updateTask: vi.fn(),
    removeTask: vi.fn(),
    addTask: vi.fn(),
    dismissTask: vi.fn(),
    dismissCompletedTasks: vi.fn(),
  };
  const mockFn = vi.fn((selector?: (s: typeof mockStore) => unknown) =>
    selector ? selector(mockStore) : mockStore,
  );
  mockFn.getState = vi.fn(() => mockStore);
  mockFn.subscribe = vi.fn(() => vi.fn());
  return { useTaskStore: mockFn };
});

vi.mock('@/lib/hooks/use-theme', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light', isMounted: true, setTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/store/use-sky-classroom-store', () => {
  const mockStore = {
    mistakes: [],
    addMistake: vi.fn(),
    markReviewed: vi.fn(),
  };
  const mockFn = vi.fn((selector?: (s: typeof mockStore) => unknown) =>
    selector ? selector(mockStore) : mockStore,
  );
  mockFn.getState = vi.fn(() => mockStore);
  return { useSkyClassroomStore: mockFn };
});

describe('CloudMindQuizPage', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: null }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the idle quiz state without reading derived counts before initialization', () => {
    expect(() => render(<CloudMindQuizPage />)).not.toThrow();
    const headings = screen.getAllByRole('heading', { name: '星际试炼场' });
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it('shows the question type selector in AI mode with all three types', () => {
    render(<CloudMindQuizPage />);
    screen.getAllByRole('button', { name: 'AI 出题' }).forEach((button) => {
      fireEvent.click(button);
    });

    expect(screen.getAllByRole('button', { name: /填空题/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /选择题/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /判断题/ }).length).toBeGreaterThan(0);
  });

  it('applies the exam preset and sends the selected goal when starting a trial', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/sky/cloud-mind/quiz' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ success: true, jobId: 'job-1', progress: 0, phase: 'queued' }),
        };
      }
      return { ok: true, json: async () => ({ success: true, data: null }) };
    });

    render(<CloudMindQuizPage />);
    fireEvent.click(screen.getAllByRole('button', { name: /考前速练/ })[0]);

    expect(screen.getAllByText('限时模考').length).toBeGreaterThan(0);
    expect(screen.getAllByText('10 题').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: /开启试炼/ })[0]);

    await waitFor(() => {
      const request = fetchMock.mock.calls.find(
        ([input, init]) => String(input) === '/api/sky/cloud-mind/quiz' && init?.method === 'POST',
      );
      expect(request).toBeDefined();
      expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
        difficulty: 'medium',
        count: 10,
        questionType: 'choice',
        goal: 'mock',
      });
    });
  });

  it('previews one real question and marks it stale after configuration changes', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/sky/cloud-mind/quiz-preview') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            signature: 'preview-signature',
            question: {
              questionType: 'choice',
              question: '下列函数中，哪一个是二次函数？',
              options: ['y=x²+1', 'y=2x+1', 'y=1/x', 'y=3'],
            },
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true, data: null }) };
    });

    render(<CloudMindQuizPage />);
    fireEvent.click(screen.getAllByRole('button', { name: /预览 1 道样题/ })[0]);

    expect(await screen.findByText('下列函数中，哪一个是二次函数？')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /挑战/ })[0]);
    expect(await screen.findByText('预览已过期')).toBeInTheDocument();
  });

  it('does not loop when the completed quiz initializes its mistake book selection', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/api/sky/question-bank?') && !init?.method) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            questions: [1, 2, 3].map((id) => ({
              id,
              content: `题目 ${id}`,
              questionType: 'choice',
              options: ['选项 A', '选项 B', '选项 C', '选项 D'],
              answer: 'B',
              explanation: `解析 ${id}`,
            })),
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({ success: true, data: null }),
      };
    });

    render(<CloudMindQuizPage />);
    screen.getAllByRole('button', { name: '题库练习' }).forEach((button) => {
      fireEvent.click(button);
    });
    screen.getAllByRole('button', { name: '3 题' }).forEach((button) => {
      fireEvent.click(button);
    });
    screen.getAllByRole('button', { name: '从题库抽题' }).forEach((button) => {
      fireEvent.click(button);
    });
    await waitFor(() => {
      expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual(
        expect.arrayContaining([expect.stringContaining('/api/sky/question-bank')]),
      );
    });

    for (let index = 0; index < 3; index += 1) {
      expect((await screen.findAllByText(/^题目 [123]$/)).length).toBeGreaterThan(0);
      const optionButton = screen
        .getAllByRole('button')
        .find((button) => button.textContent?.includes('选项 A'));
      expect(optionButton).not.toBeNull();
      fireEvent.click(optionButton!);
      const nextButton = (
        await screen.findAllByRole('button', {
          name: index === 2 ? /查看成绩/ : /下一题/,
        })
      )[0];
      await waitFor(() => expect(nextButton).not.toBeDisabled());
      fireEvent.click(nextButton);
    }

    await waitFor(() => {
      expect(screen.getAllByText('错题加入复习计划').length).toBeGreaterThan(0);
    });
  });
});
