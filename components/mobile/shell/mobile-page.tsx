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
    <section className={cn('min-h-[calc(100dvh-4rem)] w-full px-4 pb-24 pt-4', className)}>
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
