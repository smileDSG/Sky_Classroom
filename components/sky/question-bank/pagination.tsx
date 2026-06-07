'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  className,
}: PaginationProps) {
  const safePage = Math.max(1, Math.min(page, totalPages || 1));

  const pages = useMemo<(number | string)[]>(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const items: (number | string)[] = [];
    if (safePage > 3) {
      items.push(1, '...');
    }
    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);
    for (let i = start; i <= end; i++) {
      items.push(i);
    }
    if (safePage < totalPages - 2) {
      items.push('...', totalPages);
    } else if (safePage === totalPages - 2) {
      items.push(totalPages);
    }
    if (!items.includes(1)) items.unshift(1);
    if (!items.includes(totalPages)) items.push(totalPages);
    return items;
  }, [safePage, totalPages]);

  if (totalPages <= 1 && !onPageSizeChange) return null;

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      {onPageSizeChange && (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span>每页</span>
          <div className="flex items-center gap-1">
            {pageSizeOptions.map((size) => (
              <button
                key={size}
                onClick={() => onPageSizeChange(size)}
                className={cn(
                  'h-7 min-w-[2rem] rounded-md px-2 text-xs font-medium transition-colors',
                  pageSize === size
                    ? 'bg-sky-500 text-white'
                    : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                )}
              >
                {size}
              </button>
            ))}
          </div>
          <span>条</span>
        </div>
      )}

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
          aria-label="第一页"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          aria-label="上一页"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>

        {pages.map((p, i) =>
          typeof p === 'string' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-xs text-slate-400">
              ...
            </span>
          ) : (
            <Button
              key={p}
              variant={p === safePage ? 'default' : 'ghost'}
              size="icon-xs"
              onClick={() => onPageChange(p)}
              className={cn(
                'min-w-[1.75rem] px-1.5 text-xs',
                p === safePage && 'bg-sky-500 text-white hover:bg-sky-600'
              )}
              aria-label={`第 ${p} 页`}
              aria-current={p === safePage ? 'page' : undefined}
            >
              {p}
            </Button>
          )
        )}

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
          aria-label="下一页"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onPageChange(totalPages)}
          disabled={safePage >= totalPages}
          aria-label="最后一页"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
