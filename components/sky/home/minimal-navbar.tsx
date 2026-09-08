'use client';

import { motion } from 'motion/react';
import { HeaderControls } from './header-controls';

// 精简导航栏组件
export function MinimalNavbar({ userSection }: { userSection: React.ReactNode }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* 背景模糊层 */}
      <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/30" />

      {/* 内容 */}
      <div className="relative flex items-center justify-between h-16 px-4 md:px-6">
        {/* 左侧 - Logo */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <img src="/logo-icon.svg" alt="智眸无界" className="w-10 h-10" />
          <span className="text-lg font-bold bg-gradient-to-r from-sky-600 to-blue-600 dark:from-sky-400 dark:to-blue-400 bg-clip-text text-transparent hidden sm:block">
            智眸无界
          </span>
        </motion.div>

        {/* 右侧 - 工具栏 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2"
        >
          <HeaderControls />

          {/* 用户区域 */}
          {userSection}
        </motion.div>
      </div>
    </header>
  );
}
