import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { MobileBottomNav } from '@/components/mobile/shell/mobile-bottom-nav';
import { MobilePage } from '@/components/mobile/shell/mobile-page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/sky/learning',
}));

describe('mobile shell', () => {
  test('bottom nav renders core routes and highlights active route', () => {
    render(<MobileBottomNav />);

    expect(screen.getByRole('link', { name: /首页/ })).toHaveAttribute('href', '/sky');
    expect(screen.getByRole('link', { name: /智囊/ })).toHaveAttribute('href', '/sky/cloud-mind');
    expect(screen.getByRole('link', { name: /工坊/ })).toHaveAttribute('href', '/sky/learning');
    expect(screen.getByRole('link', { name: /助手/ })).toHaveAttribute('href', '/sky/assistant');
    expect(screen.getByRole('link', { name: /我的/ })).toHaveAttribute('href', '/account');
    expect(screen.getByRole('link', { name: /工坊/ })).toHaveAttribute('aria-current', 'page');
  });

  test('mobile page applies bottom spacing for fixed navigation', () => {
    render(<MobilePage title="测试页">正文</MobilePage>);

    expect(screen.getByRole('heading', { name: '测试页' })).toBeInTheDocument();
    expect(screen.getByText('正文')).toBeInTheDocument();
  });
});
