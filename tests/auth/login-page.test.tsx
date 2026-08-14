import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { mockLogin } = vi.hoisted(() => ({ mockLogin: vi.fn() }));

vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => ({ login: mockLogin, isGuest: true }),
}));

import LoginPage from '@/app/auth/login/page';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('login page account hints', () => {
  it('shows the ordinary demo credentials when the server enables them', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ enabled: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<LoginPage />);

    expect(await screen.findByText('普通测试用户')).toBeInTheDocument();
    expect(screen.getByText('demo')).toBeInTheDocument();
    expect(screen.getByText('SkyClassroom123!')).toBeInTheDocument();
    expect(screen.getByText('管理员')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/demo-account');
  });

  it('keeps the administrator hint but hides demo credentials when disabled', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ enabled: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<LoginPage />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/auth/demo-account'));
    expect(screen.getByText('管理员')).toBeInTheDocument();
    expect(screen.queryByText('普通测试用户')).not.toBeInTheDocument();
    expect(screen.queryByText('SkyClassroom123!')).not.toBeInTheDocument();
  });

  it('fails closed when the availability request errors', async () => {
    mockFetch.mockRejectedValue(new Error('network unavailable'));

    render(<LoginPage />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/auth/demo-account'));
    expect(screen.getByText('管理员')).toBeInTheDocument();
    expect(screen.queryByText('普通测试用户')).not.toBeInTheDocument();
  });
});
