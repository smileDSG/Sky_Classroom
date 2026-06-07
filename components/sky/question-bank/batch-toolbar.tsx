'use client';

import { motion } from 'motion/react';
import {
  CheckCircle2,
  CircleOff,
  Trash2,
  Download,
  Target,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BatchToolbarProps {
  selectedIds: string[];
  totalCount: number;
  onSelectAll: (checked: boolean) => void;
  onVerify: (verified: boolean) => void;
  onDelete: () => void;
  onExport: () => void;
  onQuiz: () => void;
  onClear: () => void;
}

export function BatchToolbar({
  selectedIds,
  totalCount,
  onSelectAll,
  onVerify,
  onDelete,
  onExport,
  onQuiz,
  onClear,
}: BatchToolbarProps) {
  if (selectedIds.length === 0) return null;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
    >
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl shadow-xl px-4 py-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer select-none pr-3 border-r border-slate-200 dark:border-slate-700">
          <input
            type="checkbox"
            checked={selectedIds.length > 0 && selectedIds.length === totalCount}
            onChange={(e) => onSelectAll(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          已选 {selectedIds.length} 题
        </label>

        <Button
          variant="ghost"
          size="xs"
          onClick={() => onVerify(true)}
          className="gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          审核
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onVerify(false)}
          className="gap-1 text-slate-600 hover:text-slate-700"
        >
          <CircleOff className="h-3.5 w-3.5" />
          取消审核
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={onExport}
          className="gap-1"
        >
          <Download className="h-3.5 w-3.5" />
          导出
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={onQuiz}
          className="gap-1 text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-900/20"
        >
          <Target className="h-3.5 w-3.5" />
          组卷练习
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={onDelete}
          className="gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
          删除
        </Button>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClear}
          className="ml-1 text-slate-400 hover:text-slate-600"
          aria-label="清除选择"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}
