'use client';

import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { SolvePage } from '@/components/sky/solve/solve-page';
import { motion } from 'motion/react';
import { Camera, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CloudMindSolvePage() {
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
            <Camera className="h-4 w-4 text-violet-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">拍照搜题</span>
          </div>
        </motion.div>

        <SolvePage />
      </div>
    </SkyAppShell>
  );
}
