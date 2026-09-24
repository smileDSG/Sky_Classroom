import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PanelShell({
  icon: Icon,
  title,
  eyebrow,
  action,
  error,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-sky-100/10 dark:bg-[#081423]/95 dark:shadow-none',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-300/20 dark:bg-sky-300/10 dark:text-sky-100">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            {eyebrow && (
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {eyebrow}
              </div>
            )}
            <h2 className="text-base font-semibold leading-6 text-slate-950 dark:text-white">
              {title}
            </h2>
          </div>
        </div>
        {action}
      </div>
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700 dark:border-red-200/20 dark:bg-red-300/10 dark:text-red-100">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}
