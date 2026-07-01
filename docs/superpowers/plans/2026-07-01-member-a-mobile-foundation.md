# Member A Mobile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Before implementation, use superpowers:using-git-worktrees or create/switch to a non-master feature branch. For production code changes, use superpowers:test-driven-development. Before claiming completion, use superpowers:verification-before-completion.

**Goal:** Build the mobile foundation owned by Member A: mobile shell, shared mobile UI, mobile hooks, account/auth mobile adaptation, PWA basics, and mobile smoke verification.

**Architecture:** Keep the existing Next.js app and business logic. Add a reusable `components/mobile` foundation and wire it into `SkyAppShell` with responsive desktop/mobile shells. Business pages owned by Member B should consume these components instead of reimplementing mobile navigation, safe-area, loading, error, source, confidence, or agent-progress UI.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui/Radix, lucide-react, Vitest, Playwright.

---

## 0. Scope Lock

### Member A Owns

- `components/mobile/shell/*`
- `components/mobile/ui/*`
- `components/mobile/hooks/*`
- `lib/mobile/*`
- `components/sky/layout/app-shell.tsx`
- `app/auth/*` mobile polish
- `app/account/page.tsx` mobile polish
- `app/manifest.ts` or `public/manifest.json`
- `e2e/tests/mobile/*`
- `docs/superpowers/plans/2026-07-01-member-a-mobile-foundation.md`

### Member A Does Not Own

- Agent business workflows.
- Learning profile algorithms and update logic.
- RAG retrieval, factual verification, and content safety strategy.
- Learning path and workshop recommendation algorithms.
- AI teaching, solving, quiz, memory-card, or slide business flows.
- Mobile-only duplicated API routes or mobile-only duplicated data stores.

### Branch Rule

Implementation must not happen directly on `master`.

Recommended branch:

```bash
git checkout -b codex/member-a-mobile-foundation
```

If using a git worktree:

```bash
git worktree add .worktrees/member-a-mobile-foundation -b codex/member-a-mobile-foundation
```

Before creating `.worktrees`, verify it is ignored:

```bash
git check-ignore -q .worktrees
```

If not ignored, add `.worktrees/` to `.gitignore` in a separate small commit.

---

## 1. Current State Summary

- `components/sky/layout/app-shell.tsx` is currently one shell. It renders a sticky desktop-style header, `SkyTabBar`, `HeaderControls`, `FloatingUserCard`, and `BackgroundTasksIndicator`.
- `SkyTabBar` is a horizontal tab bar with routes: `/`, `/sky`, `/sky/cloud-mind`, `/sky/learning`, `/sky/assistant`.
- Mobile behavior is not isolated. The existing header wraps and scrolls horizontally on smaller widths.
- `app/account/page.tsx` uses a fixed header and a two-column layout with a persistent left sidebar. This needs a mobile tab/sheet layout.
- `app/auth/login/page.tsx` already uses a responsive card through `AuthLayout`, but it needs viewport/safe-area review and smoke coverage.
- `public/manifest.json` exists, but the mobile PWA baseline still needs verification and possibly a Next `app/manifest.ts`.
- Existing scripts: `pnpm check`, `pnpm lint`, `npx tsc --noEmit`, `pnpm test`, `pnpm test:e2e`.

---

## 2. Implementation Tasks

### Task A-P0-001: Create Mobile Foundation File Structure

**Objective:** Add the directory structure and public exports that Member B can import from.

**Files:**

- Create: `components/mobile/index.ts`
- Create: `components/mobile/shell/index.ts`
- Create: `components/mobile/ui/index.ts`
- Create: `components/mobile/hooks/index.ts`
- Create: `lib/mobile/navigation.ts`
- Create: `lib/mobile/viewport.ts`
- Create: `lib/mobile/capabilities.ts`
- Create: `lib/mobile/route-context.ts`

**TDD note:** Barrel files and static route constants are low-risk configuration-like files. Tests start in Task A-P0-002 when behavior begins.

- [ ] Step 1: Create directory structure.

```bash
mkdir components/mobile
mkdir components/mobile/shell
mkdir components/mobile/ui
mkdir components/mobile/hooks
mkdir lib/mobile
```

- [ ] Step 2: Create `lib/mobile/navigation.ts`.

```ts
import type { LucideIcon } from 'lucide-react';
import { Brain, Feather, Home, Star, TrendingUp, User } from 'lucide-react';

export interface MobileNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
}

export const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { label: '首页', href: '/sky', icon: Home, exact: true },
  { label: '智囊', href: '/sky/cloud-mind', icon: Brain },
  { label: '工坊', href: '/sky/learning', icon: TrendingUp },
  { label: '助手', href: '/sky/assistant', icon: Feather },
  { label: '我的', href: '/account', icon: User, exact: true },
];

export const MOBILE_PRIMARY_ACTION = {
  label: '生成台',
  href: '/sky/study-lab',
  icon: Star,
};

export function isMobileNavActive(pathname: string, item: MobileNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
```

- [ ] Step 3: Create `lib/mobile/viewport.ts`.

```ts
export const MOBILE_VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 568 },
  { name: 'mobile-375', width: 375, height: 667 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-412', width: 412, height: 915 },
  { name: 'mobile-landscape', width: 667, height: 375 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

export type MobileViewportName = (typeof MOBILE_VIEWPORTS)[number]['name'];
```

- [ ] Step 4: Create placeholder exports.

```ts
// components/mobile/index.ts
export * from './shell';
export * from './ui';
export * from './hooks';
```

```ts
// components/mobile/shell/index.ts
export * from './mobile-bottom-nav';
export * from './mobile-page';
export * from './mobile-sky-shell';
export * from './mobile-sticky-action-bar';
export * from './mobile-top-bar';
```

```ts
// components/mobile/ui/index.ts
export * from './mobile-action-menu';
export * from './mobile-agent-progress';
export * from './mobile-confidence-badge';
export * from './mobile-empty-state';
export * from './mobile-error-state';
export * from './mobile-sheet';
export * from './mobile-skeleton';
export * from './mobile-source-list';
export * from './mobile-upload-button';
```

```ts
// components/mobile/hooks/index.ts
export * from './use-is-mobile';
export * from './use-keyboard-inset';
export * from './use-mobile-viewport';
```

- [ ] Step 5: Run TypeScript after component files exist in later tasks. Do not run now because barrel exports intentionally point to files created in later tasks.

---

### Task A-P0-002: Implement Mobile Hooks

**Objective:** Provide mount-safe hooks for mobile detection, viewport data, and keyboard inset handling.

**Files:**

- Create: `components/mobile/hooks/use-is-mobile.ts`
- Create: `components/mobile/hooks/use-mobile-viewport.ts`
- Create: `components/mobile/hooks/use-keyboard-inset.ts`
- Test: `tests/mobile/hooks.test.tsx`

- [ ] Step 1: Write failing tests in `tests/mobile/hooks.test.tsx`.

```tsx
import { renderHook, act } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { useIsMobile } from '@/components/mobile/hooks/use-is-mobile';
import { useMobileViewport } from '@/components/mobile/hooks/use-mobile-viewport';

function resizeTo(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  window.dispatchEvent(new Event('resize'));
}

describe('mobile hooks', () => {
  test('useIsMobile returns true under the md breakpoint after mount', () => {
    resizeTo(390, 844);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  test('useIsMobile returns false at desktop width', () => {
    resizeTo(1024, 768);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  test('useMobileViewport tracks width height and orientation', () => {
    resizeTo(667, 375);

    const { result } = renderHook(() => useMobileViewport());

    expect(result.current.width).toBe(667);
    expect(result.current.height).toBe(375);
    expect(result.current.orientation).toBe('landscape');

    act(() => resizeTo(390, 844));

    expect(result.current.width).toBe(390);
    expect(result.current.height).toBe(844);
    expect(result.current.orientation).toBe('portrait');
  });
});
```

- [ ] Step 2: Run the failing tests.

```bash
pnpm vitest run tests/mobile/hooks.test.tsx
```

Expected: FAIL because the hook files do not exist.

- [ ] Step 3: Implement `components/mobile/hooks/use-is-mobile.ts`.

```ts
'use client';

import { useEffect, useState } from 'react';

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < breakpoint);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [breakpoint]);

  return isMobile;
}
```

- [ ] Step 4: Implement `components/mobile/hooks/use-mobile-viewport.ts`.

```ts
'use client';

import { useEffect, useState } from 'react';

export interface MobileViewportState {
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
}

function readViewport(): MobileViewportState {
  const width = window.innerWidth;
  const height = window.innerHeight;
  return {
    width,
    height,
    orientation: width > height ? 'landscape' : 'portrait',
  };
}

export function useMobileViewport(): MobileViewportState {
  const [viewport, setViewport] = useState<MobileViewportState>({
    width: 0,
    height: 0,
    orientation: 'portrait',
  });

  useEffect(() => {
    const update = () => setViewport(readViewport());
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return viewport;
}
```

- [ ] Step 5: Implement `components/mobile/hooks/use-keyboard-inset.ts`.

```ts
'use client';

import { useEffect, useState } from 'react';

export function useKeyboardInset() {
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const update = () => {
      const inset = Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop);
      setKeyboardInset(Math.round(inset));
    };

    update();
    visualViewport.addEventListener('resize', update);
    visualViewport.addEventListener('scroll', update);
    return () => {
      visualViewport.removeEventListener('resize', update);
      visualViewport.removeEventListener('scroll', update);
    };
  }, []);

  return keyboardInset;
}
```

- [ ] Step 6: Run hook tests.

```bash
pnpm vitest run tests/mobile/hooks.test.tsx
```

Expected: PASS.

---

### Task A-P0-003: Implement Mobile Shell Components

**Objective:** Add mobile top bar, bottom nav, page container, sticky action bar, and complete mobile shell wrapper.

**Files:**

- Create: `components/mobile/shell/mobile-top-bar.tsx`
- Create: `components/mobile/shell/mobile-bottom-nav.tsx`
- Create: `components/mobile/shell/mobile-page.tsx`
- Create: `components/mobile/shell/mobile-sticky-action-bar.tsx`
- Create: `components/mobile/shell/mobile-sky-shell.tsx`
- Test: `tests/mobile/shell.test.tsx`

- [ ] Step 1: Write failing tests in `tests/mobile/shell.test.tsx`.

```tsx
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
```

- [ ] Step 2: Run the failing tests.

```bash
pnpm vitest run tests/mobile/shell.test.tsx
```

Expected: FAIL because shell components do not exist.

- [ ] Step 3: Implement `mobile-top-bar.tsx`.

```tsx
'use client';

import Link from 'next/link';
import { Bell, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileTopBarProps {
  title?: string;
}

export function MobileTopBar({ title = '天空课堂' }: MobileTopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 px-4 py-3 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/85">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <Link href="/sky" className="flex min-w-0 items-center gap-2">
          <img src="/logo-icon.svg" alt="" className="size-8 shrink-0" />
          <span className="truncate text-base font-semibold text-slate-900 dark:text-slate-50">
            {title}
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="size-10" aria-label="通知">
            <Bell className="size-4" />
          </Button>
          <Button asChild variant="ghost" size="icon" className="size-10" aria-label="设置">
            <Link href="/settings">
              <Settings className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] Step 4: Implement `mobile-bottom-nav.tsx`.

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MOBILE_NAV_ITEMS, isMobileNavActive } from '@/lib/mobile/navigation';
import { cn } from '@/lib/utils';

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/90 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1.5 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/90"
      aria-label="移动端主导航"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = isMobileNavActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-medium transition-colors',
                active
                  ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900',
              )}
            >
              <Icon className="size-4" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] Step 5: Implement `mobile-page.tsx`.

```tsx
import { cn } from '@/lib/utils';

interface MobilePageProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function MobilePage({
  title,
  description,
  children,
  className,
  contentClassName,
}: MobilePageProps) {
  return (
    <section className={cn('min-h-[calc(100dvh-4rem)] px-4 pb-24 pt-4', className)}>
      {(title || description) && (
        <div className="mb-4 space-y-1">
          {title && (
            <h1 className="text-xl font-semibold leading-tight text-slate-950 dark:text-slate-50">
              {title}
            </h1>
          )}
          {description && (
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">{description}</p>
          )}
        </div>
      )}
      <div className={cn('space-y-4', contentClassName)}>{children}</div>
    </section>
  );
}
```

- [ ] Step 6: Implement `mobile-sticky-action-bar.tsx`.

```tsx
import { cn } from '@/lib/utils';

interface MobileStickyActionBarProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileStickyActionBar({ children, className }: MobileStickyActionBarProps) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.35rem)] z-40 border-t border-slate-200/70 bg-white/90 p-3 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/90',
        className,
      )}
    >
      <div className="mx-auto flex max-w-md gap-2">{children}</div>
    </div>
  );
}
```

- [ ] Step 7: Implement `mobile-sky-shell.tsx`.

```tsx
'use client';

import { MobileBottomNav } from './mobile-bottom-nav';
import { MobileTopBar } from './mobile-top-bar';

interface MobileSkyShellProps {
  children: React.ReactNode;
}

export function MobileSkyShell({ children }: MobileSkyShellProps) {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <MobileTopBar />
      <main>{children}</main>
      <MobileBottomNav />
    </div>
  );
}
```

- [ ] Step 8: Run shell tests.

```bash
pnpm vitest run tests/mobile/shell.test.tsx
```

Expected: PASS.

---

### Task A-P0-004: Implement Shared Mobile UI Components

**Objective:** Provide reusable UI primitives for Member B's mobile business pages.

**Files:**

- Create: `components/mobile/ui/mobile-empty-state.tsx`
- Create: `components/mobile/ui/mobile-error-state.tsx`
- Create: `components/mobile/ui/mobile-skeleton.tsx`
- Create: `components/mobile/ui/mobile-confidence-badge.tsx`
- Create: `components/mobile/ui/mobile-source-list.tsx`
- Create: `components/mobile/ui/mobile-agent-progress.tsx`
- Create: `components/mobile/ui/mobile-sheet.tsx`
- Create: `components/mobile/ui/mobile-action-menu.tsx`
- Create: `components/mobile/ui/mobile-upload-button.tsx`
- Test: `tests/mobile/ui.test.tsx`

- [ ] Step 1: Write failing tests in `tests/mobile/ui.test.tsx`.

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { MobileAgentProgress } from '@/components/mobile/ui/mobile-agent-progress';
import { MobileConfidenceBadge } from '@/components/mobile/ui/mobile-confidence-badge';
import { MobileEmptyState } from '@/components/mobile/ui/mobile-empty-state';
import { MobileErrorState } from '@/components/mobile/ui/mobile-error-state';
import { MobileSourceList } from '@/components/mobile/ui/mobile-source-list';

describe('mobile shared UI', () => {
  test('empty and error states render accessible messages', () => {
    render(<MobileEmptyState title="暂无资源" description="稍后再试" />);
    expect(screen.getByText('暂无资源')).toBeInTheDocument();
    expect(screen.getByText('稍后再试')).toBeInTheDocument();

    render(<MobileErrorState title="加载失败" description="网络错误" />);
    expect(screen.getByText('加载失败')).toBeInTheDocument();
    expect(screen.getByText('网络错误')).toBeInTheDocument();
  });

  test('confidence badge labels review state', () => {
    const { rerender } = render(<MobileConfidenceBadge value={0.82} />);
    expect(screen.getByText(/82%/)).toBeInTheDocument();
    expect(screen.getByText(/可信/)).toBeInTheDocument();

    rerender(<MobileConfidenceBadge value={0.42} />);
    expect(screen.getByText(/42%/)).toBeInTheDocument();
    expect(screen.getByText(/需复核/)).toBeInTheDocument();
  });

  test('source list renders sources', () => {
    render(
      <MobileSourceList
        sources={[
          { title: '人工智能导论 第一章', excerpt: '机器学习基础', href: '/source/1' },
        ]}
      />,
    );

    expect(screen.getByText('人工智能导论 第一章')).toBeInTheDocument();
    expect(screen.getByText('机器学习基础')).toBeInTheDocument();
  });

  test('agent progress renders stages', () => {
    render(
      <MobileAgentProgress
        stages={[
          { id: 'profile', label: '画像分析', status: 'done' },
          { id: 'generate', label: '资源生成', status: 'active' },
        ]}
      />,
    );

    expect(screen.getByText('画像分析')).toBeInTheDocument();
    expect(screen.getByText('资源生成')).toBeInTheDocument();
  });
});
```

- [ ] Step 2: Run the failing tests.

```bash
pnpm vitest run tests/mobile/ui.test.tsx
```

Expected: FAIL because UI components do not exist.

- [ ] Step 3: Implement minimal components.

Implementation requirements:

- Use `lucide-react` icons when an icon is needed.
- Every component accepts `className`.
- No business API calls.
- No hard-coded fake business data.
- Text must wrap or truncate within 320px.
- Buttons must be at least 40px high, preferably 44px.

Suggested APIs:

```ts
export interface MobileSource {
  title: string;
  excerpt?: string;
  href?: string;
}

export type MobileAgentStageStatus = 'pending' | 'active' | 'done' | 'error';

export interface MobileAgentStage {
  id: string;
  label: string;
  status: MobileAgentStageStatus;
  description?: string;
}
```

- [ ] Step 4: Run UI tests.

```bash
pnpm vitest run tests/mobile/ui.test.tsx
```

Expected: PASS.

- [ ] Step 5: Run targeted typecheck if dependencies are installed.

```bash
npx tsc --noEmit
```

Expected: PASS, or report existing unrelated failures with exact messages.

---

### Task A-P0-005: Wire Mobile Shell Into SkyAppShell

**Objective:** Preserve desktop shell while rendering `MobileSkyShell` on mobile widths.

**Files:**

- Modify: `components/sky/layout/app-shell.tsx`
- Test: `tests/mobile/sky-app-shell.test.tsx`

- [ ] Step 1: Write failing test in `tests/mobile/sky-app-shell.test.tsx`.

```tsx
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
```

- [ ] Step 2: Run the failing test.

```bash
pnpm vitest run tests/mobile/sky-app-shell.test.tsx
```

Expected: FAIL before the mobile shell is wired.

- [ ] Step 3: Refactor `SkyAppShell`.

Implementation approach:

- Keep the current desktop markup in a `DesktopSkyShell` internal component.
- Add `<div className="hidden md:block">` around desktop shell.
- Add `<div className="md:hidden">` around `MobileSkyShell`.
- Keep `BackgroundTasksIndicator`, `SettingsDialog`, and `UpgradeDialog` in the desktop shell only unless mobile explicitly needs them.
- Do not introduce `window.innerWidth` branching.

Target shape:

```tsx
export function SkyAppShell({ children }: SkyAppShellProps) {
  return (
    <>
      <div className="hidden md:block">
        <DesktopSkyShell>{children}</DesktopSkyShell>
      </div>
      <div className="md:hidden">
        <MobileSkyShell>{children}</MobileSkyShell>
      </div>
    </>
  );
}
```

- [ ] Step 4: Run the shell integration test.

```bash
pnpm vitest run tests/mobile/sky-app-shell.test.tsx
```

Expected: PASS.

- [ ] Step 5: Manual viewport check.

Start dev server:

```bash
pnpm dev
```

Open `/sky` at:

- 320 x 568
- 375 x 667
- 390 x 844
- 412 x 915
- 1440 x 900

Expected:

- Mobile widths show top bar and bottom nav.
- Desktop width shows original desktop header/tab bar.
- No basic horizontal overflow.

---

### Task A-P0-006: Mobile Account and Auth Adaptation

**Objective:** Make auth and account pages usable on mobile without changing auth business logic.

**Files:**

- Modify: `app/account/page.tsx`
- Review and lightly modify if needed: `app/auth/login/page.tsx`
- Review and lightly modify if needed: `app/auth/register/page.tsx`
- Review and lightly modify if needed: `components/sky/auth/auth-layout.tsx`
- Test: `tests/mobile/account-page.test.tsx`

- [ ] Step 1: Write failing test for mobile account navigation.

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import AccountPage from '@/app/account/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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
vi.mock('@/components/account/sidebar-nav', () => ({
  SidebarNav: ({ active, onChange }: { active: string; onChange: (value: string) => void }) => (
    <button onClick={() => onChange('security')}>切换安全</button>
  ),
}));

describe('mobile account page', () => {
  test('renders account content and can switch sections', async () => {
    render(<AccountPage />);

    expect(screen.getByText('个人资料表单')).toBeInTheDocument();
    await userEvent.click(screen.getByText('切换安全'));
    expect(screen.getByText('安全设置')).toBeInTheDocument();
  });
});
```

- [ ] Step 2: Run the test.

```bash
pnpm vitest run tests/mobile/account-page.test.tsx
```

Expected: PASS may already happen. If it passes immediately, add a specific mobile-layout assertion after implementation or keep this as regression coverage for section switching.

- [ ] Step 3: Adapt account layout.

Implementation requirements:

- Desktop keeps current two-column sidebar layout.
- Mobile uses horizontal tabs or `MobileSheet`; do not show a fixed 52px sidebar.
- Header remains reachable and does not cover content.
- Add an open-source/about entry either in account sections or as a link card.
- Use `pb-24` or equivalent so content is not covered by bottom navigation when reached from `/account`.

- [ ] Step 4: Review auth pages.

Manual checks:

- Login page at 320px has no horizontal overflow.
- Submit button remains visible.
- Error message wraps.
- Register/reset/forgot pages follow same layout behavior.

- [ ] Step 5: Run account test.

```bash
pnpm vitest run tests/mobile/account-page.test.tsx
```

Expected: PASS.

---

### Task A-P0-007: PWA Basics

**Objective:** Ensure the app has a basic PWA manifest suitable for mobile install prompts.

**Files:**

- Modify or verify: `public/manifest.json`
- Optional create: `app/manifest.ts`
- Test: `tests/mobile/manifest.test.ts`

- [ ] Step 1: Write failing or confirming manifest test.

```ts
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

describe('mobile PWA manifest', () => {
  test('public manifest contains installable mobile basics', () => {
    const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.display).toMatch(/standalone|fullscreen|minimal-ui/);
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.theme_color).toMatch(/^#/);
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });
});
```

- [ ] Step 2: Run manifest test.

```bash
pnpm vitest run tests/mobile/manifest.test.ts
```

Expected: FAIL only if manifest is missing required fields.

- [ ] Step 3: Update manifest if needed.

Required fields:

```json
{
  "name": "天空课堂",
  "short_name": "天空课堂",
  "description": "AI 驱动的智能教学平台",
  "start_url": "/sky",
  "display": "standalone",
  "background_color": "#f8fafc",
  "theme_color": "#0ea5e9",
  "icons": [
    {
      "src": "/logo-icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] Step 4: Run manifest test again.

```bash
pnpm vitest run tests/mobile/manifest.test.ts
```

Expected: PASS.

---

### Task A-P0-008: Mobile Playwright Smoke Coverage

**Objective:** Add basic mobile viewport e2e coverage for shell, nav, auth, and account/about entry.

**Files:**

- Create: `e2e/tests/mobile/smoke.spec.ts`
- Optional create: `e2e/tests/mobile/helpers.ts`

- [ ] Step 1: Create Playwright smoke test.

```ts
import { expect, test } from '@playwright/test';

const mobileViewports = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
];

for (const viewport of mobileViewports) {
  test(`mobile shell works at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/sky');

    await expect(page.getByRole('navigation', { name: '移动端主导航' })).toBeVisible();
    await expect(page.getByRole('link', { name: /工坊/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /助手/ })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
}

test('mobile login page accepts input', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/auth/login');

  await page.getByLabel(/用户名/).fill('admin');
  await page.getByLabel(/密码/).fill('123');

  await expect(page.getByRole('button', { name: /登录/ })).toBeVisible();
});
```

- [ ] Step 2: Run smoke e2e.

```bash
pnpm test:e2e -- e2e/tests/mobile/smoke.spec.ts
```

Expected: PASS if dev server and dependencies are available. If existing app startup fails, record the exact failure and run unit tests as the fallback.

---

### Task A-P0-009: Documentation for Member B

**Objective:** Make the mobile foundation easy for Member B to use.

**Files:**

- Create: `components/mobile/README.md`

- [ ] Step 1: Write usage documentation.

Required sections:

- What Member A owns.
- When to use `MobilePage`.
- When to use `MobileSheet`.
- How to show source/citation with `MobileSourceList`.
- How to show confidence/review state with `MobileConfidenceBadge`.
- How to show agent generation progress with `MobileAgentProgress`.
- Rule: ask Member A to extend shared components instead of copying mobile UI into business pages.

Example content:

```md
# Mobile Foundation

Use these components for mobile Sky Classroom pages. They handle safe-area, spacing,
touch sizing, empty/error/loading states, and common competition presentation UI.

## Page Wrapper

```tsx
<MobilePage title="个性化学习工作台">
  <MobileAgentProgress stages={stages} />
</MobilePage>
```

## Confidence

```tsx
<MobileConfidenceBadge value={0.82} />
```

## Sources

```tsx
<MobileSourceList sources={[{ title: '人工智能导论 第一章', excerpt: '机器学习基础' }]} />
```
```

- [ ] Step 2: Ask Member B to review README before building business pages.

---

## 3. Final Verification Checklist

Before saying this work is complete, run fresh verification:

```bash
pnpm check
pnpm lint
npx tsc --noEmit
pnpm test
pnpm test:e2e -- e2e/tests/mobile/smoke.spec.ts
```

If any command fails because of existing main-branch issues:

- Record command.
- Record exit code.
- Record first relevant error.
- State whether it is related to Member A changes.
- Provide targeted passing command results.

Manual viewport checklist:

- [ ] 320 x 568: `/sky` no horizontal overflow.
- [ ] 375 x 667: `/sky` bottom nav does not cover content.
- [ ] 390 x 844: `/auth/login` accepts input and button is visible.
- [ ] 412 x 915: `/account` content readable and section navigation usable.
- [ ] 667 x 375 landscape: shell does not collapse.
- [ ] 1440 x 900 desktop: original desktop shell remains usable.

---

## 4. Human Acceptance Gates

After implementation, present these to the user for acceptance:

1. Mobile shell acceptance:
   - `/sky` at 390px shows top bar and bottom nav.
   - Desktop `/sky` still shows the original desktop header/tab bar.

2. Shared component acceptance:
   - Show a small local demo or test screenshots of empty/error/confidence/source/agent progress states.
   - Confirm Member B can import from `@/components/mobile`.

3. Account/auth acceptance:
   - `/auth/login` is usable on mobile.
   - `/account` is usable on mobile.
   - About/open-source entry is visible.

4. PWA/test acceptance:
   - Manifest basics exist.
   - Mobile smoke test exists.
   - Verification commands and outcomes are reported.

---

## 5. Execution Order

Recommended commit order:

1. `feat: add mobile foundation constants`
2. `feat: add mobile viewport hooks`
3. `feat: add mobile shell components`
4. `feat: add shared mobile ui states`
5. `feat: wire mobile shell into sky app`
6. `feat: adapt account auth and pwa basics`
7. `test: add mobile smoke coverage`
8. `docs: document mobile foundation usage`

If the team prefers fewer commits, use PR-level grouping:

- PR 1: `feat: add mobile shell and shared mobile UI`
- PR 3: `feat: add mobile account home and pwa basics`

---

## 6. Self-Review Against Requirements

- Mobile shell: covered by A-P0-003 and A-P0-005.
- Top bar, bottom nav, page container, sticky action bar: covered by A-P0-003.
- Shared UI: covered by A-P0-004.
- Hooks: covered by A-P0-002.
- Account/auth: covered by A-P0-006.
- PWA: covered by A-P0-007.
- Mobile Playwright: covered by A-P0-008.
- Member B handoff comfort: covered by A-P0-009.
- No mobile-only business API or store fork: stated in scope lock and task constraints.
- Desktop regression: covered in final verification and manual viewport checklist.
