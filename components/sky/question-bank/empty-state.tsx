'use client';

import { motion } from 'motion/react';
import { FileQuestion, SearchX, RotateCcw, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  hasFilters: boolean;
  onClearFilters?: () => void;
}

export function EmptyState({ hasFilters, onClearFilters }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/60 p-12 backdrop-blur-sm"
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-sky-200/30 dark:bg-sky-900/20 blur-xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-sky-100 dark:bg-sky-900/30">
          {hasFilters ? (
            <SearchX className="h-10 w-10 text-sky-500" />
          ) : (
            <FileQuestion className="h-10 w-10 text-sky-500" />
          )}
        </div>
      </div>

      <h3 className="mt-5 text-lg font-semibold text-slate-800 dark:text-slate-100">
        {hasFilters ? '没有找到匹配的题目' : '题库还是空的'}
      </h3>
      <p className="mt-1 max-w-xs text-center text-sm text-slate-500 dark:text-slate-400">
        {hasFilters
          ? '换个筛选条件试试，或者去添加一些新题目到题库中'
          : '快去拍照搜题或手动录入，让题库丰富起来吧'}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {hasFilters && onClearFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            清除筛选条件
          </Button>
        )}
        <Button variant="default" size="sm" asChild>
          <a href="/sky/solve">
            <Camera className="mr-1.5 h-4 w-4" />
            去拍照搜题
          </a>
        </Button>
      </div>
    </motion.div>
  );
}
