import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { QUICK_IDENTITY_KEY } from '@/lib/onboarding/quick-onboarding';

vi.mock('@/components/auth/auth-provider', () => ({
  useOptionalAuth: () => ({ user: null, refresh: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-study-timer', () => ({
  useStudyTimer: vi.fn(),
}));

vi.mock('@/lib/hooks/use-theme', () => ({
  useTheme: () => ({ resolvedTheme: 'light', isMounted: false }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/sky',
}));

vi.mock('@/components/sky/home/header-controls', () => ({
  HeaderControls: () => <div data-testid="header-controls" />,
}));

vi.mock('@/components/sky/home/floating-user-card', () => ({
  FloatingUserCard: () => <div data-testid="floating-user-card" />,
}));

vi.mock('@/components/settings', () => ({
  SettingsDialog: () => <div data-testid="settings-dialog" />,
}));

vi.mock('@/components/billing/upgrade-dialog', () => ({
  UpgradeDialog: () => <div data-testid="upgrade-dialog" />,
}));

vi.mock('@/components/sky/layout/sky-tab-bar', () => ({
  SkyTabBar: () => <div data-testid="sky-tab-bar" />,
}));

vi.mock('@/components/sky/layout/background-tasks-indicator', () => ({
  BackgroundTasksIndicator: () => <div data-testid="background-tasks-indicator" />,
}));

describe('SkyAppShell mobile integration', () => {
  beforeEach(() => localStorage.clear());

  test('renders desktop and mobile shell containers without duplicating business children visibly', () => {
    render(
      <SkyAppShell>
        <div>页面正文</div>
      </SkyAppShell>,
    );

    expect(screen.getAllByText('页面正文')).toHaveLength(2);
    expect(screen.getByLabelText('移动端主导航')).toBeInTheDocument();
  });

  test('allows each desktop workspace section to expand and collapse', () => {
    render(
      <SkyAppShell>
        <div>页面正文</div>
      </SkyAppShell>,
    );

    const learningSection = screen.getByRole('button', { name: '学习工作台' });

    expect(learningSection).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(learningSection);
    expect(learningSection).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(learningSection);
    expect(learningSection).toHaveAttribute('aria-expanded', 'true');
  });

  test('hides teaching section for a learner', async () => {
    localStorage.setItem(QUICK_IDENTITY_KEY, 'learner');
    render(
      <SkyAppShell>
        <div>页面正文</div>
      </SkyAppShell>,
    );

    expect(await screen.findByRole('button', { name: '学习工作台' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '云端智囊' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '备课工作区' })).not.toBeInTheDocument();
  });

  test('shows only teaching section for an educator', async () => {
    localStorage.setItem(QUICK_IDENTITY_KEY, 'educator');
    render(
      <SkyAppShell>
        <div>页面正文</div>
      </SkyAppShell>,
    );

    expect(await screen.findByRole('button', { name: '备课工作区' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '学习工作台' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '云端智囊' })).not.toBeInTheDocument();
  });
});
