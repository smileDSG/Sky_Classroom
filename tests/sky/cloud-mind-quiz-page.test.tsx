import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CloudMindQuizPage from '@/app/sky/cloud-mind/quiz/page';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('motion/react', () => {
  const MotionElement = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => {
      const domProps = { ...props } as React.HTMLAttributes<HTMLDivElement> &
        Record<string, unknown>;
      delete domProps.animate;
      delete domProps.initial;
      delete domProps.transition;
      delete domProps.variants;
      delete domProps.exit;
      delete domProps.layout;

      return (
        <div ref={ref} {...domProps}>
          {children}
        </div>
      );
    },
  );
  MotionElement.displayName = 'MotionElement';

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: new Proxy(
      {},
      {
        get: () => MotionElement,
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

vi.mock('@/lib/store/use-task-store', () => ({
  useTaskStore: {
    getState: () => ({
      tasks: {},
      getTask: () => undefined,
      updateTask: vi.fn(),
      removeTask: vi.fn(),
      addTask: vi.fn(),
    }),
    subscribe: () => () => undefined,
  },
}));

describe('CloudMindQuizPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: null }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the idle quiz state without reading derived counts before initialization', () => {
    expect(() => render(<CloudMindQuizPage />)).not.toThrow();
    expect(screen.getByRole('heading', { name: '星际试炼场' })).toBeInTheDocument();
  });
});
