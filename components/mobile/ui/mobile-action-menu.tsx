'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface MobileActionItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

interface MobileActionMenuProps {
  items: MobileActionItem[];
  className?: string;
}

export function MobileActionMenu({ items, className }: MobileActionMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="ghost"
        size="icon"
        className="size-10"
        onClick={() => setOpen(!open)}
        aria-label="更多操作"
      >
        <MoreHorizontal className="size-4" />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-950">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors',
                  item.destructive
                    ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900',
                )}
              >
                {item.icon && <span className="size-4">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
