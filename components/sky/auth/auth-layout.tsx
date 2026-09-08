'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

// ── Auth Layout ──────────────────────────────────────────────────

interface AuthLayoutProps {
  children: React.ReactNode;
  className?: string;
  /** Override max-width of the mobile auth viewport. */
  maxWidth?: string;
  /** Keep the layout in phone mode even when the browser viewport is desktop-sized. */
  mobileViewport?: boolean;
}

export function AuthLayout({
  children,
  className,
  maxWidth = 'max-w-[430px]',
  mobileViewport = false,
}: AuthLayoutProps) {
  return (
    <div
      data-testid="auth-layout-root"
      data-mobile-viewport={mobileViewport ? 'true' : undefined}
      className={cn(
        'relative flex min-h-dvh items-stretch justify-center overflow-x-hidden bg-sky-50',
        mobileViewport && 'overflow-hidden rounded-[1.7rem]',
        !mobileViewport && 'sm:items-center sm:p-6',
      )}
    >
      {/* ── Sky gradient background ── */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-200 via-sky-100 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />

      {/* Sunrise/sunset glow */}
      <div
        className="absolute inset-0 opacity-60 dark:opacity-30 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 120% 80% at 50% -20%, rgba(135,206,235,0.4) 0%, transparent 50%),
            radial-gradient(ellipse 80% 60% at 80% 100%, rgba(255,183,178,0.2) 0%, transparent 40%)
          `,
        }}
      />

      {/* ── Bottom gradient fade ── */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white/60 dark:from-slate-950/60 to-transparent pointer-events-none" />

      {/* ── Main card ── */}
      <div
        data-testid="auth-layout-viewport"
        className={cn(
          'relative z-10 flex min-h-dvh w-full flex-col overflow-y-auto',
          maxWidth,
          !mobileViewport && 'sm:min-h-[min(844px,calc(100dvh-3rem))]',
          mobileViewport
            ? 'rounded-[1.7rem] border-0'
            : 'border-x border-white/50 dark:border-slate-700/50 sm:rounded-[2rem] sm:border',
          'bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl',
          mobileViewport
            ? 'shadow-none'
            : 'shadow-none sm:shadow-2xl sm:shadow-sky-200/35 dark:sm:shadow-slate-950/60',
          mobileViewport
            ? 'px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]'
            : 'px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:p-7',
          className,
        )}
      >
        {/* Logo header */}
        <div className="mb-7 flex flex-col items-center">
          <Link
            href="/"
            className="group flex min-h-14 items-center gap-3 rounded-2xl border border-white/80 bg-white/70 px-3.5 py-2 shadow-lg shadow-sky-200/45 backdrop-blur-md transition-transform active:scale-[0.99] dark:border-slate-700/70 dark:bg-slate-900/72 dark:shadow-slate-950/40"
          >
            <img
              src="/logo-icon.svg"
              alt="天空课堂"
              className="size-12 transition-transform group-hover:scale-105"
            />
            <span className="text-[22px] font-black leading-none text-slate-900 drop-shadow-[0_1px_0_rgba(255,255,255,0.7)] dark:text-sky-100">
              天空课堂
            </span>
          </Link>
        </div>

        {/* Content */}
        <div>{children}</div>
      </div>
    </div>
  );
}
