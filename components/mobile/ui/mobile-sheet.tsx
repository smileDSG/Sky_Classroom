"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface MobileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function MobileSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: MobileSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onOpenChange(false);
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onOpenChange]);

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        "m-0 max-h-[85dvh] w-full max-w-none translate-y-full rounded-t-2xl bg-white p-0 shadow-2xl backdrop:bg-black/40 dark:bg-slate-950",
        "open:translate-y-0 open:transition-transform open:duration-300 open:ease-out",
        className,
      )}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onOpenChange(false);
        }
      }}
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            {title && (
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-[13px] text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </dialog>
  );
}
