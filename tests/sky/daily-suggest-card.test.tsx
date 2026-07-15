import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DailySuggestCard } from '@/components/sky/dashboard/daily-suggest-card';
import type { MistakeRecord } from '@/lib/mistakes/types';

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
        custom: _custom,
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

function makeMistake(overrides?: Partial<MistakeRecord>): MistakeRecord {
  return {
    id: 'mistake-1',
    problem: '二次函数顶点坐标怎么求？',
    userAnswer: 'x = 2',
    correctAnswer: '(-b / 2a, f(-b / 2a))',
    cause: 'concept-unclear',
    solvedAt: new Date(),
    reviewed: false,
    reviewCount: 0,
    knowledgePoints: ['二次函数'],
    ...overrides,
  };
}

describe('DailySuggestCard', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });

  it('uses parent-provided stats and does not fetch learning stats by itself', () => {
    render(
      <DailySuggestCard
        mistakes={[makeMistake()]}
        stats={{ streakDays: 2, masteryPercent: 45 }}
      />,
    );

    expect(screen.getByText('今日学习建议')).toBeInTheDocument();
    expect(screen.queryByText('换一批')).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
