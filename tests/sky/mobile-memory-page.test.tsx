import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MobileMemoryPage from '@/app/m/sky/cloud-mind/memory/page';
import type {
  MemoryCardDeck,
  MemoryCardsStreamEvent,
} from '@/lib/agents/cloud-mind/memory-cards-agent';

vi.mock('next/link', async () => {
  const ReactModule = await import('react');

  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      ReactModule.createElement('a', { href, ...props }, children),
  };
});

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('topic=函数&content=函数单调性错题整理'),
  usePathname: () => '/m/sky/cloud-mind/memory',
}));

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

const demoDeck: MemoryCardDeck = {
  topic: '函数',
  description: '函数单调性记忆卡片',
  cards: [
    {
      index: 1,
      front: '函数单调性判断口诀',
      back: '同增异减：内外层单调性相同时复合函数递增，相反时递减。',
      mnemonic: '“同增异减”四字诀。',
      relatedConcepts: ['单调性'],
      difficulty: 'medium',
      tags: ['函数'],
    },
  ],
  studyTips: '先理解再记忆。',
  reviewIntervals: [1, 2, 4],
};

describe('MobileMemoryPage', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/sky/cloud-mind/personalization-context') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              weakPoints: [{ knowledgePoint: '函数' }, { knowledgePoint: '导数' }],
              dueReviews: [],
            },
          }),
        } as Response;
      }
      if (url === '/api/sky/cloud-mind/memory-due') {
        return {
          ok: true,
          json: async () => ({ success: true, data: [] }),
        } as Response;
      }
      if (url === '/api/sky/cloud-mind/memory-cards/stream') {
        return sseResponse([
          { type: 'cards', cards: demoDeck.cards },
          { type: 'done', deck: demoDeck },
        ]);
      }
      if (url === '/api/sky/cloud-mind/memory-reviews' && init?.method === 'POST') {
        return { ok: true, json: async () => ({ success: true }) } as Response;
      }
      throw new Error(`Unexpected fetch: ${url} ${JSON.stringify(init)}`);
    });
    global.fetch = mockFetch;
  });

  it('renders a mobile generator prefilled from params and weak point chips', async () => {
    render(<MobileMemoryPage />);

    expect(screen.getByRole('heading', { name: '记忆卡片' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('函数')).toBeInTheDocument();
    expect(screen.getByDisplayValue('函数单调性错题整理')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sky/cloud-mind/personalization-context', {
        credentials: 'include',
      });
    });

    expect(await screen.findByRole('button', { name: '函数' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导数' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /高级模式/ })).toHaveAttribute(
      'href',
      '/sky/cloud-mind/memory?topic=%E5%87%BD%E6%95%B0&content=%E5%87%BD%E6%95%B0%E5%8D%95%E8%B0%83%E6%80%A7%E9%94%99%E9%A2%98%E6%95%B4%E7%90%86',
    );
  });

  it('renders streamed cards and flips to reveal the answer with rating buttons', async () => {
    render(<MobileMemoryPage />);

    fireEvent.click(screen.getByRole('button', { name: /生成复习卡/ }));

    expect(await screen.findByText('函数单调性判断口诀')).toBeInTheDocument();
    expect(screen.getByText('点击卡片查看答案')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('翻转记忆卡片'));
    expect(
      screen.getByText('同增异减：内外层单调性相同时复合函数递增，相反时递减。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '还不会' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '模糊' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '掌握了' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '掌握了' }));
    expect(screen.getByText('已记录 1 张')).toBeInTheDocument();
  });

  it('shows a due-review banner and starts reviewing from due cards', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/sky/cloud-mind/personalization-context') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { weakPoints: [] } }),
        } as Response;
      }
      if (url === '/api/sky/cloud-mind/memory-due') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: 'memory_review_due1',
                cardId: 'memory_deck_due1',
                deckId: 'memory_deck_due',
                userId: 'u1',
                rating: 'fuzzy',
                reviewCount: 2,
                mastery: 47,
                lastReviewedAt: '2026-09-10T00:00:00.000Z',
                nextReviewAt: '2026-09-10T00:00:00.000Z',
                sourceType: 'manual',
                front: '顶点式是什么？',
                back: 'y = a(x-h)^2 + k，顶点为 (h, k)。',
                tags: ['二次函数'],
              },
            ],
          }),
        } as Response;
      }
      if (url === '/api/sky/cloud-mind/memory-reviews' && init?.method === 'POST') {
        return { ok: true, json: async () => ({ success: true }) } as Response;
      }
      throw new Error(`Unexpected fetch: ${url} ${JSON.stringify(init)}`);
    });

    render(<MobileMemoryPage />);

    expect(await screen.findByText('今天 1 张待复习')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '开始复习' }));
    expect(screen.getByText('顶点式是什么？')).toBeInTheDocument();
    expect(screen.getByText('点击卡片查看答案')).toBeInTheDocument();
  });
});
