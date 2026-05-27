'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Presentation,
  Search,
  Brain,
  MessageSquare,
} from 'lucide-react';

const quickAccessItems = [
  {
    icon: Presentation,
    title: 'PPT 课件生成',
    desc: '一键生成精美课件',
    color: 'text-sky-500',
    bg: 'bg-sky-500/10 hover:bg-sky-500/20',
    border: 'border-sky-200/50 dark:border-sky-800/30',
    href: '/sky/slides',
  },
  {
    icon: Search,
    title: '拍照搜题',
    desc: '拍照秒出解析答案',
    color: 'text-violet-500',
    bg: 'bg-violet-500/10 hover:bg-violet-500/20',
    border: 'border-violet-200/50 dark:border-violet-800/30',
    href: '/sky/solve',
  },
  {
    icon: Brain,
    title: '云端智囊',
    desc: 'AI 智能学习工具集',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10 hover:bg-amber-500/20',
    border: 'border-amber-200/50 dark:border-amber-800/30',
    href: '/sky/cloud-mind',
  },
  {
    icon: MessageSquare,
    title: '互动课堂',
    desc: '沉浸式 AI 教学',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
    border: 'border-emerald-200/50 dark:border-emerald-800/30',
    href: '/sky/assistant',
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

            <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${item.bg} group-hover:scale-110 transition-transform duration-300`}>
              <Icon className={`h-5 w-5 ${item.color}`} />
            </div>
            <div className="min-w-0 relative">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                {item.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {item.desc}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
