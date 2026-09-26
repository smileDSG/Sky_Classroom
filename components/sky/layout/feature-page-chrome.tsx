import type { ReactNode } from 'react';

interface FeaturePageHeaderProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  accentClassName?: string;
}

export function FeaturePageHeader({
  icon,
  title,
  description,
  action,
  accentClassName = 'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
}: FeaturePageHeaderProps) {
  return (
    <div data-tour-step="page-header" className="mb-6 flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accentClassName}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </h1>
          <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

interface FeatureWorkspaceProps {
  children: ReactNode;
  preview: ReactNode;
  className?: string;
  primaryTourStep?: boolean;
}

export function FeatureWorkspace({
  children,
  preview,
  className = '',
  primaryTourStep = true,
}: FeatureWorkspaceProps) {
  return (
    <div className={`grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)] ${className}`}>
      <section data-tour-step={primaryTourStep ? 'page-primary' : undefined} className="min-w-0">
        {children}
      </section>
      <aside className="min-w-0">{preview}</aside>
    </div>
  );
}
