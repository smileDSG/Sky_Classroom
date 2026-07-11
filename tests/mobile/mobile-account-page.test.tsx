import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import MobileAccountPage from '@/app/m/account/page';

const routerMock = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: () => '/m/account',
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

vi.mock('@/components/account/personalization-form', () => ({
  PersonalizationForm: () => <div>个性化表单</div>,
}));

vi.mock('@/components/account/account-info', () => ({
  AccountInfo: () => <div>账户信息</div>,
}));

vi.mock('@/components/account/security-form', () => ({
  SecurityForm: () => <div>安全设置</div>,
}));

vi.mock('@/components/account/plan-billing-section', () => ({
  PlanBillingSection: () => <div>套餐信息</div>,
}));

describe('mobile account page', () => {
  test('renders header and tabs, switches sections', () => {
    render(<MobileAccountPage />);

    expect(screen.getByText('账户中心')).toBeInTheDocument();
    expect(screen.getByText('个人资料表单')).toBeInTheDocument();

    fireEvent.click(screen.getByText('安全'));
    expect(screen.getByText('安全设置')).toBeInTheDocument();

    fireEvent.click(screen.getByText('订阅'));
    expect(screen.getByText('套餐信息')).toBeInTheDocument();
  });
});
