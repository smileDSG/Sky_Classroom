import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MobileCloudMindPage from '@/app/m/sky/cloud-mind/page';

vi.mock('next/link', async () => {
  const ReactModule = await import('react');

  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      ReactModule.createElement('a', { href, ...props }, children),
  };
});

describe('MobileCloudMindPage tool shelf', () => {
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
});
