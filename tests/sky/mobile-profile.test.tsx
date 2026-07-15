import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MobileProfilePage from '@/app/m/sky/profile/page';

const authMock = vi.hoisted(() => ({
  logout: vi.fn(),
}));

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
}));

const settingsMock = vi.hoisted(() => {
  const setModel = vi.fn();
  const createState = () => ({
    providerId: 'openai',
    modelId: 'gpt-4.1-mini',
    providersConfig: {
      openai: {
        name: 'OpenAI',
        apiKey: '',
        baseUrl: '',
        models: [
          { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini' },
          { id: 'gpt-4.1', name: 'GPT-4.1' },
        ],
        isServerConfigured: true,
      },
      google: {
        name: 'Google',
        apiKey: '',
        baseUrl: '',
        models: [{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }],
        isServerConfigured: false,
      },
    },
    setModel,
  });
  const mock = {
    setModel,
    state: createState(),
    reset() {
      mock.state = createState();
      setModel.mockClear();
    },
  };

  return mock;
});

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: () => '/m/sky/profile',
}));

vi.mock('next/link', async () => {
  const ReactModule = await import('react');

  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      ReactModule.createElement('a', { href, ...props }, children),
  };
});

vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-default',
      email: null,
      username: 'admin',
      role: 'admin',
      status: 'active',
      planType: 'free',
      emailVerified: false,
      createdAt: 1720000000000,
    },
    isLoading: false,
    isGuest: false,
    logout: authMock.logout,
  }),
}));

vi.mock('@/lib/hooks/use-theme', () => ({
  useTheme: () => ({
    theme: 'system',
    setTheme: vi.fn(),
    resolvedTheme: 'light',
    forceDark: false,
  }),
}));

vi.mock('@/lib/store/settings', () => ({
  useSettingsStore: (selector: (store: typeof settingsMock.state) => unknown) =>
    selector(settingsMock.state),
}));

describe('MobileProfilePage', () => {
  beforeEach(() => {
    settingsMock.reset();
    authMock.logout.mockClear();
    routerMock.push.mockClear();
  });

  it('renders account, learning, model, and theme controls for the mobile profile center', () => {
    render(<MobileProfilePage />);

    expect(screen.getByRole('heading', { name: '个人中心' })).toBeInTheDocument();
    expect(screen.getByText(/admin/)).toBeInTheDocument();
    expect(screen.getByText('学习入口')).toBeInTheDocument();
    expect(screen.getByText('模型设置')).toBeInTheDocument();
    expect(screen.getByLabelText('模型服务商')).toHaveValue('openai');
    expect(screen.getByLabelText('默认模型')).toHaveValue('gpt-4.1-mini');
    expect(screen.getByTestId('mobile-theme-control')).toBeInTheDocument();
  });

  it('updates the selected model from the mobile profile center', () => {
    render(<MobileProfilePage />);

    fireEvent.change(screen.getByLabelText('默认模型'), {
      target: { value: 'gpt-4.1' },
    });

    expect(settingsMock.setModel).toHaveBeenCalledWith('openai', 'gpt-4.1');
  });

  it('keeps the bottom nav profile tab on the mobile profile route', () => {
    const { container } = render(<MobileProfilePage />);
    const bottomNav = container.querySelector('nav.mobile-tactile-nav');

    expect(bottomNav).toBeInTheDocument();
    expect(bottomNav?.querySelector('a[href="/m/sky/learning/profile"]')).not.toBeInTheDocument();
    expect(bottomNav?.querySelector('a[href="/m/sky/profile"]')).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
