'use client';

import { motion } from 'motion/react';
import { Sparkles, BookOpen, Lightbulb } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface GenerationStatusProps {
  phase: 'idle' | 'submitting' | 'generating_outline' | 'reviewing' | 'generating_slides' | 'done';
  progress: number;
  step: string;
  jobId: string | null;
}

const phaseLabels: Record<string, string> = {
  idle: '',
  submitting: '正在提交...',
  generating_outline: '正在生成大纲...',
  reviewing: '大纲已生成，点击查看',
  generating_slides: '正在生成幻灯片...',
  done: '课堂生成完成',
};

export function GenerationStatus({ phase, progress, step, jobId }: GenerationStatusProps) {
  const router = useRouter();

  if (phase !== 'idle' && phase !== 'done') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <button
          type="button"
          onClick={() => jobId && router.push(`/generation-progress?jobId=${jobId}`)}
          className="w-full text-left rounded-2xl border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 shadow-lg p-5 hover:shadow-xl hover:border-sky-300 dark:hover:border-sky-700 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-sky-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sky-700 dark:text-sky-300">
                {phaseLabels[phase] || '后台处理中'}
              </p>
              <p className="text-sm text-muted-foreground">
                {step || '后台处理中，可自由切换页面 — 点击查看详情'}
              </p>
            </div>
            <span className="text-lg font-bold text-sky-600">{progress}%</span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-sky-100 dark:bg-sky-900 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-sky-500"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </button>
      </motion.div>
    );
  }

  // Idle — onboarding guide
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="relative rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm p-5 overflow-hidden"
    >
      {/* Decorative gradient orb */}
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-br from-sky-400/20 to-blue-500/10 blur-2xl pointer-events-none" />

      <div className="relative flex items-start gap-4">
        <motion.div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-500 shadow-lg shadow-sky-500/25"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <BookOpen className="h-6 w-6 text-white" />
        </motion.div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
            开始你的第一个课堂
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            在上方输入框中描述你想要的课堂内容，点击"创建课堂"即可开始
          </p>
          <div className="flex flex-wrap gap-2">
            <motion.span
              whileHover={{ scale: 1.05 }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/50 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-default"
            >
              <Lightbulb className="w-3 h-3 text-amber-500" />
              试试输入"初中物理：力的作用"
            </motion.span>
            <motion.span
              whileHover={{ scale: 1.05 }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/50 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-default"
            >
              <Sparkles className="w-3 h-3 text-sky-500" />
              或点击"模板"快速开始
            </motion.span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
