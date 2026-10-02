import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MobileCloudMindPage from '@/app/m/sky/cloud-mind/page';

vi.mock('next/link', async () => {
  const ReactModule = await import('react');

  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      ReactModule.createElement('a', { href, ...props }, children),
  };
});

describe('MobileCloudMindPage tool shelf', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });
    global.fetch = mockFetch;
  });

  it('keeps the current mobile shell and exposes current student tools', () => {
    render(<MobileCloudMindPage />);

    const expectedRoutes = [
      '/m/sky/cloud-mind/solve',
      '/m/sky/cloud-mind/slides',
      '/m/sky/cloud-mind/quiz',
      '/m/sky/cloud-mind/memory',
      '/m/sky/cloud-mind/teaching',
      '/m/sky/cloud-mind/course-studio',
    ];

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));

    for (const href of expectedRoutes) {
      expect(hrefs).toContain(href);
    }
    expect(hrefs).not.toContain('/m/sky/question-bank');
  });

  it('shows a due-review banner linking into the memory tool', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: 'r1',
            cardId: 'c1',
            deckId: 'd1',
            userId: 'u1',
            rating: 'fuzzy',
            reviewCount: 1,
            mastery: 41,
            lastReviewedAt: '2026-09-10T00:00:00.000Z',
            nextReviewAt: '2026-09-10T00:00:00.000Z',
            tags: ['二次函数'],
          },
          {
            id: 'r2',
            cardId: 'c2',
            deckId: 'd1',
            userId: 'u1',
            rating: 'remembered',
            reviewCount: 2,
            mastery: 65,
            lastReviewedAt: '2026-09-10T00:00:00.000Z',
            nextReviewAt: '2026-09-10T00:00:00.000Z',
            tags: ['导数'],
          },
        ],
      }),
    });

    render(<MobileCloudMindPage />);

    const banner = await screen.findByText('今天 2 张记忆卡待复习');
    expect(banner).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /开始复习/ })).toHaveAttribute(
      'href',
      '/m/sky/cloud-mind/memory',
    );
  });
});
