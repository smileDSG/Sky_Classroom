'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Star,
  Brain,
  TrendingUp,
  Feather,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: '摘星锦囊', href: '/sky', icon: Star },
  { label: '云端智囊', href: '/sky/cloud-mind', icon: Brain, badge: 'New' },
  { label: '天梯工坊', href: '/sky/learning', icon: TrendingUp },
  { label: '云翼助手', href: '/sky/assistant', icon: Feather },
  { label: '天穹讲课', href: '/', icon: Globe },
];

export function SkyTabBar() {
  const pathname = usePathname();

  return (
    <nav className="relative flex items-center justify-center gap-1 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-sm p-1 border border-slate-200/30 dark:border-slate-700/30">
      {NAV_ITEMS.map((item) => {
        let isActive: boolean;
        if (item.href === '/sky') {
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
              'relative flex flex-col items-center rounded-lg px-3 py-2 text-xs font-medium transition-all duration-300 min-w-[72px]',
              isActive
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            )}
          >
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 rounded-lg bg-white/80 dark:bg-slate-700/60 shadow-sm shadow-indigo-500/10 dark:shadow-indigo-500/5 border border-slate-200/40 dark:border-slate-600/40"
                transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className="relative z-10 flex flex-col items-center">
              <div className="relative">
                <Icon className="w-4 h-4" />
                {item.badge && (
                  <span className="absolute -top-1 -right-2 flex h-3 w-3 items-center justify-center rounded-full bg-amber-400 text-[8px] font-semibold text-amber-800 dark:text-amber-900">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="mt-0.5">{item.label}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
