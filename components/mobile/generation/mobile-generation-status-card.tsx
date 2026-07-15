'use client';

import { motion } from 'motion/react';
import { Sparkles, Loader2 } from 'lucide-react';

interface MobileGenerationStatusCardProps {
  phase: string;
  stepLabel: string;
  progress: number;
}

export function MobileGenerationStatusCard({
  phase,
  stepLabel,
  progress,
}: MobileGenerationStatusCardProps) {
  const isGenerating = phase === 'generating' || phase === 'generating_slides';

  return (
    <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#0d1728] p-5 shadow-xl">
      <div className="flex items-center gap-4">
        <div className="relative flex size-14 shrink-0 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-sky-500/20 border-t-sky-400" />
          <div className="flex size-10 items-center justify-center rounded-full bg-sky-500/15">
            {isGenerating ? (
              <Loader2 className="size-5 animate-spin text-sky-300" />
            ) : (
              <Sparkles className="size-5 text-sky-300" />
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-white">
            {phase === 'generating_slides' ? '生成幻灯片' : '生成课堂'}
          </p>
          <p className="truncate text-xs text-slate-400">{stepLabel}</p>
        </div>
        <span className="shrink-0 text-2xl font-black text-sky-400">{progress}%</span>
      </div>

      <div className="mt-5">
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          />
        </div>
      </div>
    </section>
  );
}
