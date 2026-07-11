import { cn } from "@/lib/utils";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function MobileErrorState({
  title,
  description,
  onRetry,
  retryLabel = "重试",
  className,
}: MobileErrorStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[12rem] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/50 px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-900/50",
        className,
      )}
    >
      <div className="mb-3 text-rose-500">
        <AlertCircle className="size-8" />
      </div>
      <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-4 gap-1.5"
        >
          <RefreshCw className="size-3.5" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
