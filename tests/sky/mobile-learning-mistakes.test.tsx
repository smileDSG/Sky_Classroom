import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MobileMistakeBookPage from '@/app/m/sky/learning/mistakes/page';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';

vi.mock('next/link', async () => {
  const ReactModule = await import('react');

  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children: React.ReactNode;
      onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    }) => ReactModule.createElement('a', { href, ...props }, children),
  };
});

describe('MobileMistakeBookPage', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    useSkyClassroomStore.setState({ mistakes: [] });
    global.fetch = mockFetch;
  });

  it('renders a native mobile mistake book instead of mirroring the desktop page in an iframe', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        mistakes: [
          {
            id: 'm1',
            problem: '判断函数 f(x) 的单调性',
            userAnswer: '递增',
            correctAnswer: '先求导再判断符号',
            cause: 'concept-unclear',
            solvedAt: Date.now(),
            reviewed: false,
            reviewCount: 1,
            knowledgePoints: ['函数', '导数'],
            nextReview: Date.now() - 1000,
          },
        ],
      }),
    });

    const { container } = render(<MobileMistakeBookPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sky/workshop', {
        credentials: 'include',
        cache: 'no-store',
      });
    });

    expect(container.querySelector('iframe')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '错题本' })).toBeInTheDocument();
    expect(screen.getByText('判断函数 f(x) 的单调性')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /按薄弱点再练一组/ })).toHaveAttribute(
      'href',
      '/m/sky/cloud-mind/quiz?topic=%E5%87%BD%E6%95%B0',
    );
    expect(screen.getByRole('link', { name: /返回天梯工坊/ })).toHaveAttribute(
      'href',
      '/m/sky/study-lab',
    );
  });

  it('paginates the mobile mistake list so the page stays short', async () => {
    const now = Date.now();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        mistakes: Array.from({ length: 7 }, (_, index) => ({
          id: `m${index + 1}`,
          problem: `Mistake ${index + 1}`,
          userAnswer: `wrong ${index + 1}`,
          correctAnswer: `right ${index + 1}`,
          cause: 'concept-unclear',
          solvedAt: now - index * 1000,
          reviewed: false,
          reviewCount: 0,
          knowledgePoints: [`Topic ${index + 1}`],
          nextReview: now - 1000,
        })),
      }),
    });

    render(<MobileMistakeBookPage />);

    expect(await screen.findByText('Mistake 1')).toBeInTheDocument();
    expect(screen.getByText('Mistake 5')).toBeInTheDocument();
    expect(screen.queryByText('Mistake 6')).not.toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '下一页' }));

    expect(screen.getByText('Mistake 6')).toBeInTheDocument();
    expect(screen.queryByText('Mistake 1')).not.toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });
});
