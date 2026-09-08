'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight, MoveHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileHomeRailProps {
  title: string;
  description: string;
  moreHref: string;
  moreLabel?: string;
  children: ReactNode;
}

export function MobileHomeRail({
  title,
  description,
  moreHref,
  moreLabel = '更多',
  children,
}: MobileHomeRailProps) {
  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300/70">{description}</p>
        </div>
        <Link
          href={moreHref}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium text-sky-200"
        >
          {moreLabel}
          <ChevronRight className="size-3" />
        </Link>
      </div>

      <div className="flex items-center gap-2 px-0.5 text-[11px] text-sky-200/70">
        <MoveHorizontal className="size-3.5 shrink-0" />
        <span>左右滑动查看更多</span>
      </div>

      <div className={cn('flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pr-8')}>
        {children}
      </div>
    </section>
  );
}
