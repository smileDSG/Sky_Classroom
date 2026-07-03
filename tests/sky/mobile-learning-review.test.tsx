import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MobileReviewPage from '@/app/m/sky/learning/review/page';

vi.mock('next/link', async () => {
  const ReactModule = await import('react');

  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      ReactModule.createElement('a', { href, ...props }, children),
  };
});

describe('MobileReviewPage', () => {
  it('renders a compact star tips dashboard with functional mobile routes', () => {
    render(<MobileReviewPage />);

    expect(screen.getByText('下午好，同学！')).toBeInTheDocument();
    expect(screen.getByText('欢迎来到摘星锦囊')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /拍照搜题开始学习/ })).toHaveAttribute(
      'href',
      '/m/sky/cloud-mind/solve',
    );

    expect(screen.queryByText('先从这里开始')).not.toBeInTheDocument();
    expect(screen.queryByText('摘星功能')).not.toBeInTheDocument();
    expect(screen.queryByText('保留必要入口，避免重复面板抢占注意力。')).not.toBeInTheDocument();

    const startSection = screen.getByLabelText('核心学习入口');
    expect(within(startSection).getByRole('link', { name: /拍照搜题/ })).toHaveAttribute(
      'href',
      '/m/sky/cloud-mind/solve',
    );
    expect(within(startSection).getByRole('link', { name: /生成课件/ })).toHaveAttribute(
      'href',
      '/m/sky/cloud-mind/slides',
    );
    expect(within(startSection).getByRole('link', { name: /AI 助手/ })).toHaveAttribute(
      'href',
      '/m/sky/assistant?view=chat',
    );
    expect(within(startSection).getByRole('link', { name: /复习计划/ })).toHaveAttribute(
      'href',
      '/m/sky/learning/review/plan',
    );
  });
});
