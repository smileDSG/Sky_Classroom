import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MobileMemoryPage from '@/app/m/sky/cloud-mind/memory/page';

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

describe('MobileMemoryPage', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          weakPoints: [{ knowledgePoint: '函数' }, { knowledgePoint: '导数' }],
          dueReviews: [],
          learningPath: { next: '函数' },
        },
      }),
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

  it('shows a local study preview after generating demo cards', async () => {
    render(<MobileMemoryPage />);

    fireEvent.click(screen.getByRole('button', { name: /生成复习卡/ }));

    expect(await screen.findByText('函数')).toBeInTheDocument();
    expect(screen.getByText('点击卡片查看答案')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('翻转记忆卡片'));
    expect(screen.getByText(/函数单调性错题整理/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '还不会' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '模糊' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '掌握了' })).toBeInTheDocument();
  });
});
