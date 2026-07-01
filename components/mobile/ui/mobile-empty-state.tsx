import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

interface MobileEmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function MobileEmptyState({
  title,
  description,
  icon,
  action,
  className,
}: MobileEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[12rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-900/50",
        className,
      )}
    >
      <div className="mb-3 text-slate-400 dark:text-slate-500">
        {icon ?? <Inbox className="size-8" />}
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
