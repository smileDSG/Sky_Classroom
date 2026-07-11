import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MobileCourseStudioPage from '@/app/m/sky/cloud-mind/course-studio/page';

vi.mock('next/link', async () => {
  const ReactModule = await import('react');

  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      ReactModule.createElement('a', { href, ...props }, children),
  };
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/m/sky/cloud-mind/course-studio',
}));

describe('MobileCourseStudioPage', () => {
  it('renders a current-mobile entry page and advanced fallback', () => {
    render(<MobileCourseStudioPage />);

    expect(screen.getByRole('heading', { name: '课程工作室' })).toBeInTheDocument();
    expect(screen.getByText('讲义')).toBeInTheDocument();
    expect(screen.getByText('PPT')).toBeInTheDocument();
    expect(screen.getByText('导图')).toBeInTheDocument();
    expect(screen.queryByText('题库')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('学习目标'), {
      target: { value: '两周内补上 RAG 和过拟合' },
    });

    expect(screen.getByRole('link', { name: /打开完整工作室/ })).toHaveAttribute(
      'href',
      '/sky/cloud-mind/course-studio?goal=%E4%B8%A4%E5%91%A8%E5%86%85%E8%A1%A5%E4%B8%8A+RAG+%E5%92%8C%E8%BF%87%E6%8B%9F%E5%90%88&types=markdown_lecture%2Cppt_outline',
    );
  });
});
