import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type WorkspaceMode = 'edit' | 'run';

export interface WorkspaceShellProps {
  title: string;
  description: string;
  panel: ReactNode;
  main: ReactNode;
  aside: ReactNode;
  actions?: ReactNode;
  status?: ReactNode;
  mode?: WorkspaceMode;
  className?: string;
}

interface WorkspaceRegionProps {
  children: ReactNode;
  className?: string;
  title?: string;
  testId?: string;
}

const regionClassName =
  'min-w-0 rounded-xl border border-[#E4EDF7] bg-white p-4 shadow-sm shadow-sky-950/[0.03]';

export function WorkspaceHeader({
  title,
  description,
  status,
}: Pick<WorkspaceShellProps, 'title' | 'description' | 'status'>) {
  return (
    <header
      className="flex min-w-0 items-start justify-between gap-4"
      data-tour-step="page-header"
    >
      <div className="min-w-0">
        <h1 id="workspace-shell-title" className="text-2xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {status && <div className="shrink-0">{status}</div>}
    </header>
  );
}

function WorkspaceRegion({ children, className, title, testId }: WorkspaceRegionProps) {
  return (
    <section className={cn(regionClassName, className)} data-workspace-region={testId}>
      {title && <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>}
      {children}
    </section>
  );
}

export function WorkspacePanel(props: WorkspaceRegionProps) {
  return <WorkspaceRegion {...props} testId="panel" />;
}

export function WorkspaceMain(props: WorkspaceRegionProps) {
  return <WorkspaceRegion {...props} testId="main" />;
}

export function WorkspaceAside(props: WorkspaceRegionProps) {
  return <WorkspaceRegion {...props} testId="aside" />;
}

export function WorkspacePrimaryAction({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      type={props.type ?? 'button'}
      data-primary="true"
      className={cn(
        'inline-flex min-h-10 items-center justify-center rounded-lg bg-[#5B8DEF] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#4d7fe2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B8DEF]/50 disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
    />
  );
}

export function WorkspaceActionBar({ children }: { children: ReactNode }) {
  return (
    <footer
      className="sticky bottom-0 z-10 mt-5 border-t border-[#E4EDF7] bg-white/95 px-4 py-3 shadow-[0_-8px_24px_-20px_rgba(15,23,42,0.4)] backdrop-blur-sm md:px-5"
      role="toolbar"
      aria-label="工作台操作"
    >
      <div className="mx-auto flex max-w-[1360px] items-center justify-end gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </footer>
  );
}

export function WorkspaceShell({
  title,
  description,
  panel,
  main,
  aside,
  actions,
  status,
  mode = 'edit',
  className,
}: WorkspaceShellProps) {
  const titleId = 'workspace-shell-title';

  return (
    <div className={cn('min-h-full bg-[#F5F9FF]', className)}>
      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6 lg:px-8">
        <WorkspaceHeader title={title} description={description} status={status} />

        <main id="workspace-shell-content" aria-labelledby={titleId} className="min-w-0">
          <div
            data-testid="workspace-grid"
            data-mode={mode}
            className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,300px)] lg:grid-cols-[240px_minmax(0,1fr)_300px] lg:gap-5"
          >
            <div
              className="min-w-0 md:col-span-2 lg:col-span-1 lg:row-span-1"
              data-testid="workspace-panel"
            >
              {panel}
            </div>
            <div
              className="min-w-0 md:col-start-1 md:row-start-2 lg:col-start-2 lg:row-start-1"
              data-testid="workspace-main"
            >
              {main}
            </div>
            <aside
              aria-label="工作台辅助信息"
              className="min-w-0 md:col-start-2 md:row-start-2 lg:col-start-3 lg:row-start-1"
              data-testid="workspace-aside"
            >
              {aside}
            </aside>
          </div>
        </main>
      </div>

      {actions && <WorkspaceActionBar>{actions}</WorkspaceActionBar>}
    </div>
  );
}
