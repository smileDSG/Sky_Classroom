'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { BookOpenCheck, LibraryBig, Presentation, Search } from 'lucide-react';

const quickAccessItems = [
  {
    icon: BookOpenCheck,
    title: '今日学习',
    desc: '查看任务和下一步建议',
    color: 'text-sky-500',
    bg: 'bg-sky-500/10 hover:bg-sky-500/20',
    border: 'border-sky-200/50 dark:border-sky-800/30',
    href: '/sky',
  },
  {
    icon: Presentation,
    title: '备课工作台',
    desc: '生成教案和互动课堂',
    color: 'text-sky-500',
    bg: 'bg-sky-500/10 hover:bg-sky-500/20',
    border: 'border-sky-200/50 dark:border-sky-800/30',
    href: '/sky/teaching',
  },
  {
    icon: Search,
    title: '题目与练习',
    desc: '拍题、诊断和针对练习',
    color: 'text-sky-500',
    bg: 'bg-sky-500/10 hover:bg-sky-500/20',
    border: 'border-sky-200/50 dark:border-sky-800/30',
    href: '/sky/cloud-mind/solve',
  },
  {
    icon: LibraryBig,
    title: '课程资源',
    desc: '讲义、题库和记忆材料',
    color: 'text-sky-500',
    bg: 'bg-sky-500/10 hover:bg-sky-500/20',
    border: 'border-sky-200/50 dark:border-sky-800/30',
    href: '/sky/cloud-mind/course-studio',
  },
];

export function QuickAccessGrid() {
  const router = useRouter();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {quickAccessItems.map((item, i) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06 }}
            whileHover={{ y: -5, scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onMouseEnter={() => router.prefetch(item.href)}
            onClick={() => router.push(item.href)}
            className={`
              group relative flex items-center gap-3 rounded-xl border ${item.border}
              ${item.bg} backdrop-blur-sm cursor-pointer
              p-4 transition-all duration-300
              hover:shadow-xl hover:border-opacity-80
              overflow-hidden
            `}
          >
            {/* Shimmer overlay on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </div>

            {/* Decorative corner dot */}
            <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-current opacity-20 group-hover:opacity-50 transition-opacity" />

            <div
              className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${item.bg} group-hover:scale-110 transition-transform duration-300`}
            >
              <Icon className={`h-5 w-5 ${item.color}`} />
            </div>
            <div className="min-w-0 relative">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                {item.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.desc}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
