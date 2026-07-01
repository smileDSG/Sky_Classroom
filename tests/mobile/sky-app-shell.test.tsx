import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { SkyAppShell } from '@/components/sky/layout/app-shell';

vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => ({ user: null, refresh: vi.fn() }),
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
  test('renders desktop and mobile shell containers without duplicating business children visibly', () => {
    render(
      <SkyAppShell>
        <div>页面正文</div>
      </SkyAppShell>,
    );

    expect(screen.getAllByText('页面正文')).toHaveLength(2);
    expect(screen.getByLabelText('移动端主导航')).toBeInTheDocument();
  });
});
