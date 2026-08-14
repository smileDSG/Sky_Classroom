'use client';

import { motion } from 'motion/react';
import { BookOpen, Lightbulb, Compass, FileStack } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface GenerationStatusProps {
  phase: 'idle' | 'submitting' | 'generating_outline' | 'reviewing' | 'generating_slides' | 'done';
  progress: number;
  step: string;
  jobId: string | null;
}

const phaseLabels: Record<string, string> = {
  idle: '',
  submitting: '提交请求中...',
  generating_outline: '构思课堂结构...',
  reviewing: '大纲就绪，等待确认',
  generating_slides: '正在安排课堂内容...',
  done: '课堂已就绪',
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
          className="w-full text-left rounded-2xl border border-slate-200/70 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm p-5 hover:shadow-[0_4px_24px_-8px_rgba(15,23,42,0.1)] hover:border-slate-300/70 dark:hover:border-slate-600/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-4">
            {/* Workshop cards metaphor */}
            <div className="relative flex items-center justify-center h-11 w-11 shrink-0">
              <motion.div
                className="absolute h-6 w-5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200/40 dark:border-slate-700/30"
                animate={{ y: [0, 1, 0], rotate: [-2, 0, -2] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute h-6 w-5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm flex items-center justify-center"
                animate={{ y: [0, -2, 0], rotate: [1, 3, 1] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
                style={{ marginLeft: 3, marginTop: -4 }}
              >
                <div className="w-3 h-[2px] rounded-full bg-slate-200 dark:bg-slate-500" />
              </motion.div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">
                {phaseLabels[phase] || '处理中'}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                {step || '可自由浏览其他页面，后台继续处理 — 点击查看详情'}
              </p>
            </div>
            <span className="text-sm font-semibold text-slate-500 tabular-nums tracking-wide">
              {progress}%
            </span>
          </div>
          <div className="mt-3.5 h-[2px] rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-slate-600 dark:bg-slate-400"
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
      className="relative rounded-2xl border border-slate-200/50 dark:border-slate-700/40 bg-white/60 dark:bg-slate-800/30 backdrop-blur-sm p-5 overflow-hidden"
    >
      {/* Subtle paper texture */}
      <div
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/40">
          <BookOpen className="h-5 w-5 text-slate-500 dark:text-slate-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100 mb-1">
            开始你的第一个课堂
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            在上方输入想弄懂的知识点，点击“开始讲解”即可开始
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/40 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-default border border-slate-200/50 dark:border-slate-600/30">
              <Lightbulb className="w-3 h-3 text-amber-500" />
              试试输入"高中物理：电磁感应"
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/40 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-default border border-slate-200/50 dark:border-slate-600/30">
              <Compass className="w-3 h-3 text-sky-500" />
              或点击"模板"快速开始
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
