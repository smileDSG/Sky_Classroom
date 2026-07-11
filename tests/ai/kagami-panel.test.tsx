import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KagamiPanel } from '@/components/ai/kagami-panel';

vi.mock('next/navigation', () => ({
  usePathname: () => '/m/sky',
}));

vi.mock('@/lib/hooks/use-scroll-isolation', () => ({
  useScrollIsolation: vi.fn(),
}));

describe('KagamiPanel mobile drawer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens as an accessible drawer and keeps the chat input full width', () => {
    render(<KagamiPanel mobile />);

    act(() => {
      window.dispatchEvent(new CustomEvent('open-kagami-panel'));
    });

    const dialog = screen.getByRole('dialog', { name: '小镜课堂' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveClass('h-[min(72dvh,620px)]');
    expect(screen.getByAltText('小镜头像')).toBeInTheDocument();
    expect(screen.getByText('随时可以提问')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '梳理知识点' }));
    expect(screen.getByPlaceholderText('输入题目……')).toHaveValue('梳理知识点');
    expect(screen.getByRole('button', { name: '发送问题' })).toBeEnabled();
  });

  it('switches persona and closes through the labelled header control', () => {
    render(<KagamiPanel mobile />);

    act(() => {
      window.dispatchEvent(new CustomEvent('open-kagami-panel'));
    });

    fireEvent.click(screen.getByTitle('当前：二次元版 — 点击切换常规版'));
    expect(screen.getByRole('dialog', { name: 'AI 学习助手' })).toBeInTheDocument();
    expect(localStorage.getItem('kagami-panel-mode')).toBe('normal');

    fireEvent.click(screen.getAllByRole('button', { name: '关闭学习助手' })[1]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
