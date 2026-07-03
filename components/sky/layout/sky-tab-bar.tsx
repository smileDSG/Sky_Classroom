'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { Star, Brain, TrendingUp, Feather, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS: { label: string; href: string; icon: typeof Star; badge?: number }[] = [
  { label: '天穹授课', href: '/', icon: GraduationCap },
  { label: '今日学习', href: '/sky', icon: Star },
  { label: '云端智囊', href: '/sky/cloud-mind', icon: Brain },
  { label: '学习路线', href: '/sky/learning', icon: TrendingUp },
  { label: '云翼助手', href: '/sky/assistant', icon: Feather },
];

export function SkyTabBar() {
  const pathname = usePathname();

  return (
    <nav className="relative flex items-center rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-1.5 border border-slate-200/40 dark:border-slate-700/30 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.06)] dark:shadow-[0_2px_16px_-4px_rgba(0,0,0,0.2)]">
      {NAV_ITEMS.map((item) => {
        let isActive: boolean;
        if (item.href === '/') {
          isActive = pathname === '/';
        } else if (item.href === '/sky') {
          isActive = pathname === '/sky';
        } else {
          isActive = pathname.startsWith(item.href);
        }

        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-300 min-w-[96px] justify-center',
              isActive
                ? 'text-slate-800 dark:text-slate-100'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
            )}
          >
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 rounded-xl bg-white/90 dark:bg-slate-800/80 shadow-sm border border-slate-200/60 dark:border-slate-600/30"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <div className="relative">
                <Icon
                  className={cn(
                    'w-[15px] h-[15px] transition-colors duration-300',
                    isActive
                      ? 'text-sky-600 dark:text-sky-400'
                      : 'text-slate-400 dark:text-slate-500',
                  )}
                />
              </div>
              <span>{item.label}</span>
            </span>
            {isActive && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-gradient-to-r from-sky-400 to-blue-500"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
