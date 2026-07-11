import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import MobileSettingsPage from '@/app/m/settings/page';

const routerMock = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: () => '/m/settings',
}));

vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => ({
    isLoading: false,
    user: { id: 'u1', username: 'tester', planType: 'free' },
  }),
}));

vi.mock('@/components/account/profile-form', () => ({
  ProfileForm: () => <div>个人资料表单</div>,
}));

vi.mock('@/components/account/account-info', () => ({
  AccountInfo: () => <div>账户信息</div>,
}));

vi.mock('@/components/account/security-form', () => ({
  SecurityForm: () => <div>安全设置</div>,
}));

describe('mobile settings page', () => {
  test('renders header and tabs, switches sections', () => {
    render(<MobileSettingsPage />);

    expect(screen.getByText('完整设置')).toBeInTheDocument();
    expect(screen.getByText('个人资料表单')).toBeInTheDocument();

    fireEvent.click(screen.getByText('账户'));
    expect(screen.getByText('账户信息')).toBeInTheDocument();

    fireEvent.click(screen.getByText('安全'));
    expect(screen.getByText('安全设置')).toBeInTheDocument();
  });
});
