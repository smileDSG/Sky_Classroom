'use client';

import Link from 'next/link';
import { Bell, ChevronLeft, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileTopBarProps {
  title?: string;
  backHref?: string;
}

export function MobileTopBar({ title = '天空课堂', backHref }: MobileTopBarProps) {
  return (
    <header
      data-sky-responsive-top-bar
      className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 px-4 py-3 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/85"
    >
      <div className="flex min-h-11 w-full items-center justify-between gap-3">
        {backHref ? (
          <Link
            href={backHref}
            className="flex min-w-0 items-center gap-1 text-slate-900 dark:text-slate-50"
          >
            <ChevronLeft className="size-6 shrink-0" />
            <span className="truncate text-base font-semibold">{title}</span>
          </Link>
        ) : (
          <Link href="/m/sky" className="flex min-w-0 items-center gap-2">
            <img src="/logo-icon.svg" alt="" className="size-8 shrink-0" />
            <span className="truncate text-base font-semibold text-slate-900 dark:text-slate-50">
              {title}
            </span>
          </Link>
        )}
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="size-11" aria-label="通知">
            <Bell className="size-4" />
          </Button>
          <Button asChild variant="ghost" size="icon" className="size-11" aria-label="设置">
            <Link href="/m/sky/profile">
              <Settings className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
