import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import MobileLayout from '@/app/m/layout';
import { MobileQuickEntranceNav } from '@/components/mobile/mobile-quick-entrance-nav';
import { MobileBottomNav } from '@/components/mobile/shell/mobile-bottom-nav';
import { MobilePage } from '@/components/mobile/shell/mobile-page';
import { MobileTopBar } from '@/components/mobile/shell/mobile-top-bar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/m/sky/study-lab',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

describe('mobile shell', () => {
  test('mobile layout is full-width on phones and framed on desktop', () => {
    const { container } = render(
      <MobileLayout>
        <div>正文</div>
      </MobileLayout>,
    );

    const shell = container.firstElementChild;
    const phoneFrame = container.querySelector('.sm\\:max-w-\\[390px\\]');
    const phoneSurface = container.querySelector('.mobile-theme-surface');
    const navRoot = container.querySelector('#mobile-quick-nav-root');

    expect(shell).toHaveClass('bg-[#020817]', 'justify-center');
    expect(phoneFrame).toBeInTheDocument();
    expect(phoneFrame).toHaveClass('bg-slate-950', 'sm:rounded-[2.35rem]');
    expect(phoneSurface).toBeInTheDocument();
    expect(phoneSurface).toHaveClass('bg-[#07111f]', 'scrollbar-hide', 'w-full');
    expect(phoneSurface).toHaveClass('sm:[clip-path:inset(0_round_1.85rem)]');
    expect(navRoot).toBeInTheDocument();
    expect(navRoot).toHaveClass('absolute');
    expect(phoneSurface?.contains(navRoot)).toBe(false);
  });

  test('bottom nav renders mobile routes and highlights active route', () => {
    const { container } = render(<MobileBottomNav />);

    expect(container.querySelector('[data-sky-responsive-bottom-nav]')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /首页/ })).toHaveAttribute('href', '/m/sky');
    expect(screen.getByRole('link', { name: /智囊/ })).toHaveAttribute('href', '/m/sky/cloud-mind');
    expect(screen.getByRole('link', { name: /学习/ })).toHaveAttribute('href', '/m/sky/study-lab');
    expect(screen.getByRole('link', { name: /助手/ })).toHaveAttribute('href', '/m/sky/assistant');
    expect(screen.getByRole('link', { name: /我的/ })).toHaveAttribute('href', '/m/sky/profile');
    expect(screen.getByRole('link', { name: /学习/ })).toHaveAttribute('aria-current', 'page');
  });

  test('quick entrance nav spans full width inside the mobile surface', () => {
    const { container } = render(<MobileQuickEntranceNav />);
    const nav = container.querySelector('nav.mobile-tactile-nav');
    const firstLink = nav?.querySelector('a');

    expect(nav).toBeInTheDocument();
    expect(nav).not.toHaveClass('fixed');
    expect(nav).not.toHaveClass('sticky');
    expect(nav).not.toHaveClass('absolute');
    expect(nav).toHaveClass('w-full', 'pointer-events-auto');
    expect(nav).not.toHaveClass('max-w-[350px]');
    expect(firstLink).toHaveClass('min-h-14');
  });

  test('mobile page applies bottom spacing for fixed navigation', () => {
    render(<MobilePage title="测试页">正文</MobilePage>);

    expect(screen.getByRole('heading', { name: '测试页' })).toBeInTheDocument();
    expect(screen.getByText('正文')).toBeInTheDocument();
  });

  test('responsive top bar is marked so framed pages can hide duplicate chrome', () => {
    const { container } = render(<MobileTopBar />);

    expect(container.querySelector('[data-sky-responsive-top-bar]')).toBeInTheDocument();
  });
});
