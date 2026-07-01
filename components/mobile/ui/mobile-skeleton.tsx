import { cn } from '@/lib/utils';

interface MobileSkeletonProps {
  className?: string;
  count?: number;
}

export function MobileSkeleton({ className, count = 1 }: MobileSkeletonProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800"
          style={{ width: i % 2 === 0 ? '100%' : '75%' }}
        />
      ))}
    </div>
  );
}
