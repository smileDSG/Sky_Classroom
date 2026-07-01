import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";

interface MobileConfidenceBadgeProps {
  value?: number;
  className?: string;
}

export function MobileConfidenceBadge({
  value,
  className,
}: MobileConfidenceBadgeProps) {
  if (value == null) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
          className,
        )}
      >
        <HelpCircle className="size-3" />
        未评估
      </span>
    );
  }

  const percentage = Math.round(value * 100);

  if (value >= 0.7) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
          className,
        )}
      >
        <CheckCircle2 className="size-3" />
        {percentage}% 可信
      </span>
    );
  }

  if (value >= 0.4) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
          className,
        )}
      >
        <AlertTriangle className="size-3" />
        {percentage}% 需复核
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
        className,
      )}
    >
      <AlertTriangle className="size-3" />
      {percentage}% 低置信度
    </span>
  );
}
