import { cn } from "@/lib/utils";

interface MobileStickyActionBarProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileStickyActionBar({
  children,
  className,
}: MobileStickyActionBarProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.35rem)] z-40 border-t border-slate-200/70 bg-white/90 p-3 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/90",
        className,
      )}
    >
      <div className="mx-auto flex max-w-md gap-2">{children}</div>
    </div>
  );
}
