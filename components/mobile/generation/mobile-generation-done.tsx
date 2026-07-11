'use client';

import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';

interface MobileGenerationDoneProps {
  scenesCount?: number;
  onGoToClassroom: () => void;
}

export function MobileGenerationDone({ scenesCount, onGoToClassroom }: MobileGenerationDoneProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center"
    >
      <div className="flex size-24 items-center justify-center rounded-full bg-green-500/15 shadow-lg shadow-green-500/10">
        <CheckCircle2 className="size-12 text-green-400" />
      </div>
      <h2 className="mt-6 text-2xl font-black text-white">课堂生成完成！</h2>
      <p className="mt-2 text-sm text-slate-400">
        {scenesCount ? `共 ${scenesCount} 个场景` : '可以开始学习了'}
      </p>
      <button
        type="button"
        onClick={onGoToClassroom}
        className="mt-8 w-full max-w-xs rounded-2xl bg-gradient-to-r from-sky-500 to-blue-500 py-3.5 text-base font-bold text-white shadow-lg shadow-sky-500/25 transition-transform active:scale-[0.98]"
      >
        进入课堂
      </button>
    </motion.div>
  );
}
