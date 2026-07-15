'use client';

import { MobileBottomNav } from './mobile-bottom-nav';
import { MobileTopBar } from './mobile-top-bar';

interface MobileSkyShellProps {
  children: React.ReactNode;
  backHref?: string;
  title?: string;
}

export function MobileSkyShell({ children, backHref, title }: MobileSkyShellProps) {
  return (
    <div
      data-sky-responsive-mobile-shell
      className="flex min-h-dvh flex-col overflow-x-hidden bg-slate-50 text-slate-950 antialiased dark:bg-slate-950 dark:text-slate-50"
    >
      <MobileTopBar backHref={backHref} title={title} />
      <main data-sky-responsive-mobile-main className="flex flex-1 flex-col">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
