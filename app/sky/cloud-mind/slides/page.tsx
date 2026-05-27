'use client';

import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { motion } from 'motion/react';
import { Presentation, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CloudMindSlidesPage() {
  return (
    <SkyAppShell>
      <div className="mx-auto max-w-7xl">
        {/* Breadcrumb */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-3"
        >
          <Link
            href="/sky/cloud-mind"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            云端智囊
          </Link>
          <span className="text-slate-300">/</span>
          <div className="flex items-center gap-2">
            <Presentation className="h-4 w-4 text-cyan-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">幻灯片讲解</span>
          </div>
        </motion.div>

        {/* Placeholder for slides feature */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-3xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-20"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg mb-6">
            <Presentation className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            幻灯片讲解
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-center max-w-md mb-8">
            上传 PPT 或 PDF 课件，AI 将为你生成精美的讲解内容、重点标注和课后笔记。
          </p>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-white font-medium shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/30 transition-all hover:-translate-y-0.5">
              <Presentation className="h-5 w-5" />
              上传课件
            </button>
          </div>
        </motion.div>
      </div>
    </SkyAppShell>
  );
}
