import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { AuthLayout } from '@/components/sky/auth/auth-layout';

describe('mobile auth layout', () => {
  test('uses a phone-sized viewport instead of a desktop login card', () => {
    render(
      <AuthLayout>
        <button>登录</button>
      </AuthLayout>,
    );

    expect(screen.getByTestId('auth-layout-root')).toHaveClass('items-stretch', 'sm:items-center');
    expect(screen.getByTestId('auth-layout-viewport')).toHaveClass(
      'max-w-[430px]',
      'min-h-dvh',
      'sm:rounded-[2rem]',
      'pt-[max(1.25rem,env(safe-area-inset-top))]',
      'pb-[max(1.5rem,env(safe-area-inset-bottom))]',
    );
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
  });

  test('shows a high-contrast Sky Classroom brand mark on mobile auth screens', () => {
    render(
      <AuthLayout mobileViewport maxWidth="max-w-none">
        <button>Sign in</button>
      </AuthLayout>,
    );

    expect(screen.getByRole('link', { name: /Sky Classroom/ })).toHaveClass(
      'bg-white/70',
      'shadow-lg',
    );
    expect(screen.getByText('Sky Classroom')).toHaveClass('text-[22px]', 'text-slate-900');
  });

  test('still allows auth pages to override the mobile viewport width', () => {
    render(
      <AuthLayout maxWidth="max-w-sm" className="custom-auth-shell">
        <span>找回密码</span>
      </AuthLayout>,
    );

    expect(screen.getByTestId('auth-layout-viewport')).toHaveClass('max-w-sm', 'custom-auth-shell');
  });

  test('can stay in phone layout inside the mobile route shell', () => {
    const { container } = render(
      <AuthLayout mobileViewport maxWidth="max-w-none">
        <button>Sign in</button>
      </AuthLayout>,
    );

    expect(screen.getByTestId('auth-layout-root')).toHaveAttribute('data-mobile-viewport', 'true');
    expect(screen.getByTestId('auth-layout-root')).toHaveClass(
      'overflow-hidden',
      'rounded-[1.7rem]',
    );
    expect(screen.getByTestId('auth-layout-root')).not.toHaveClass('sm:items-center');
    expect(screen.getByTestId('auth-layout-viewport')).toHaveClass(
      'max-w-none',
      'min-h-dvh',
      'rounded-[1.7rem]',
      'border-0',
      'shadow-none',
    );
    expect(screen.getByTestId('auth-layout-viewport')).not.toHaveClass('sm:rounded-[2rem]');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(container.querySelector('.fixed.inset-0')).not.toBeInTheDocument();
    expect(container.querySelector('.absolute.inset-0')).toBeInTheDocument();
  });
});
