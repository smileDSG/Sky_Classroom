import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { SkyClassroomEntry } from '@/components/sky-classroom-entry';

const navigation = vi.hoisted(() => ({
  pathname: '/auth/login',
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push }),
}));

describe('sky classroom global entry', () => {
  test('is hidden on auth pages', () => {
    navigation.pathname = '/auth/login';

    render(<SkyClassroomEntry />);

    expect(screen.queryByText('天空课堂')).not.toBeInTheDocument();
  });

  test('still appears on ordinary web pages', () => {
    navigation.pathname = '/settings';

    render(<SkyClassroomEntry />);

    expect(screen.getByText('天空课堂')).toBeInTheDocument();
  });
});
