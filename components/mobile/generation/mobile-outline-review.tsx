'use client';

import { motion } from 'motion/react';
import { Loader2, Check } from 'lucide-react';
import { OutlinesEditor } from '@/components/generation/outlines-editor';
import { Sparkles } from 'lucide-react';
import type { SceneOutline } from '@/lib/types/generation';

interface MobileOutlineReviewProps {
  outlines: SceneOutline[];
  totalScenes?: number;
  alwaysReview: boolean;
  onAlwaysReviewChange: (enabled: boolean) => void;
  onOutlinesChange: (outlines: SceneOutline[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
  isCancelling: boolean;
}

export function MobileOutlineReview({
  outlines,
  totalScenes,
  alwaysReview,
  onAlwaysReviewChange,
  onOutlinesChange,
  onConfirm,
  onCancel,
  isLoading,
  isCancelling,
}: MobileOutlineReviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-[calc(100dvh-7rem)] flex-col"
    >
      <section className="mb-3 overflow-hidden rounded-[22px] border border-white/10 bg-[#0d1728] p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-sky-500/15">
            <Sparkles className="size-5 text-sky-300" />
          </span>
          <div>
            <h2 className="text-base font-bold text-white">大纲已生成</h2>
            <p className="text-xs text-slate-400">{totalScenes ?? outlines.length} 个场景 · 可编辑调整</p>
          </div>
        </div>
      </section>

      <div className="flex-1 overflow-hidden rounded-[22px] border border-white/10 bg-[#0d1728] shadow-xl">
        <div className="h-full overflow-y-auto p-4">
          <OutlinesEditor
            outlines={outlines}
            onChange={onOutlinesChange}
            onConfirm={onConfirm}
            onBack={onCancel}
            alwaysReview={alwaysReview}
            onAlwaysReviewChange={onAlwaysReviewChange}
            isLoading={isLoading}
          />
        </div>
      </div>

      <div className="sticky bottom-0 mt-3 grid grid-cols-2 gap-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
        <button
          type="button"
          onClick={onCancel}
          disabled={isCancelling || isLoading}
          className="rounded-2xl border border-white/10 bg-[#172436] py-3.5 text-sm font-bold text-slate-200 transition-colors active:bg-[#1f2f45] disabled:opacity-50"
        >
          {isCancelling ? '取消中...' : '取消生成'}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading || outlines.length === 0}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          确认大纲
        </button>
      </div>
    </motion.div>
  );
}
