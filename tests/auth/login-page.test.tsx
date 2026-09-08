import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { mockLogin } = vi.hoisted(() => ({ mockLogin: vi.fn() }));

vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => ({ login: mockLogin, isGuest: true }),
}));

import LoginPage from '@/app/auth/login/page';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'development');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('login page account hints', () => {
  it('shows the admin experience account in development', async () => {
    render(<LoginPage />);

    expect(await screen.findByText('体验账号')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
  });

  it('does not show the admin account in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    render(<LoginPage />);

    expect(screen.queryByText('体验账号')).not.toBeInTheDocument();
    expect(screen.queryByText('admin')).not.toBeInTheDocument();
  });
});
