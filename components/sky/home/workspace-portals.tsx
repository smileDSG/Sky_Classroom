'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowUpRight, Compass, LibraryBig, Presentation, type LucideProps } from 'lucide-react';
import { useQuickIdentity } from '@/lib/hooks/use-quick-identity';
import {
  isSkySectionVisible,
  SECTION_META,
  type SkySection,
} from '@/components/sky/layout/sky-section-nav';
import { cn } from '@/lib/utils';

interface QuickLink {
  label: string;
  href: string;
}

interface Workspace {
  key: SkySection;
  role: string;
  tagline: string;
  href: string;
  icon: ComponentType<LucideProps>;
  quickLinks: QuickLink[];
  accent: {
    bar: string;
    glow: string;
    iconWrap: string;
    hoverBorder: string;
    hoverShadow: string;
    arrow: string;
    chip: string;
  };
}

const workspaces: Workspace[] = [
  {
    key: 'learning',
    role: '学生 · 每日',
    tagline: '今天学什么、为什么学、下一步怎么走',
    href: '/sky',
    icon: Compass,
    quickLinks: [
      { label: '今日计划', href: '/sky/learning/today' },
      { label: '学习路径', href: '/sky/learning/path' },
      { label: '错题本', href: '/sky/learning/mistakes' },
    ],
    accent: {
      bar: 'from-sky-400 via-blue-400 to-indigo-400',
      glow: 'bg-sky-400/25',
      iconWrap:
        'bg-sky-100 text-sky-700 ring-sky-300/60 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/25',
      hoverBorder: 'hover:border-sky-300/80 dark:hover:border-sky-400/40',
      hoverShadow: 'hover:shadow-sky-500/10',
      arrow: 'group-hover:text-sky-600 dark:group-hover:text-sky-200',
      chip: 'hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:hover:border-sky-400/40 dark:hover:bg-sky-400/10 dark:hover:text-sky-100',
    },
  },
  {
    key: 'resources',
    role: '工具 · 随取',
    tagline: '题目、讲解、复习和课程材料，一站取用',
    href: '/sky/cloud-mind',
    icon: LibraryBig,
    quickLinks: [
      { label: '拍题解析', href: '/sky/cloud-mind/solve' },
      { label: '记忆复习', href: '/sky/cloud-mind/memory' },
      { label: 'PPT课件', href: '/sky/cloud-mind/slides' },
    ],
    accent: {
      bar: 'from-violet-400 via-purple-400 to-fuchsia-400',
      glow: 'bg-violet-400/25',
      iconWrap:
        'bg-violet-100 text-violet-700 ring-violet-300/60 dark:bg-violet-400/15 dark:text-violet-200 dark:ring-violet-400/25',
      hoverBorder: 'hover:border-violet-300/80 dark:hover:border-violet-400/40',
      hoverShadow: 'hover:shadow-violet-500/10',
      arrow: 'group-hover:text-violet-600 dark:group-hover:text-violet-200',
      chip: 'hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:hover:border-violet-400/40 dark:hover:bg-violet-400/10 dark:hover:text-violet-100',
    },
  },
  {
    key: 'teaching',
    role: '教师 · 备课',
    tagline: '课程、教案、课件和课堂历史，集中打理',
    href: '/sky/teaching',
    icon: Presentation,
    quickLinks: [
      { label: '课件设计', href: '/sky/teaching/slides' },
      { label: '授课记录', href: '/sky/teaching/history' },
    ],
    accent: {
      bar: 'from-emerald-400 via-teal-400 to-cyan-400',
      glow: 'bg-emerald-400/25',
      iconWrap:
        'bg-emerald-100 text-emerald-700 ring-emerald-300/60 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-400/25',
      hoverBorder: 'hover:border-emerald-300/80 dark:hover:border-emerald-400/40',
      hoverShadow: 'hover:shadow-emerald-500/10',
      arrow: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-200',
      chip: 'hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:border-emerald-400/40 dark:hover:bg-emerald-400/10 dark:hover:text-emerald-100',
    },
  },
];

export function SkyWorkspacePortals() {
  const router = useRouter();
  const identity = useQuickIdentity();

  useEffect(() => {
    const prefetch = () => {
      for (const workspace of workspaces) router.prefetch(workspace.href);
    };
    const timer = window.setTimeout(prefetch, 600);
    return () => window.clearTimeout(timer);
  }, [router]);

  const visibleWorkspaces = workspaces.filter((ws) => isSkySectionVisible(ws.key, identity));

  const heading =
    identity === 'educator' ? '备课工作区' : identity === 'learner' ? '学习工作区' : '三大工作区';
  const subtitle =
    identity === 'educator'
      ? '课程、教案、课件和课堂历史，集中打理'
      : identity === 'learner'
        ? '学习 · 资源，一处进入'
        : '学习 · 资源 · 备课，一处进入';

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.5 }}
      aria-label={heading}
      className="w-full"
    >
      <div className="mb-4 flex items-end justify-between gap-3 px-1">
        <div className="flex items-center gap-2.5">
          <span
            className="h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-sky-400 via-blue-400 to-indigo-400"
            aria-hidden="true"
          />
          <h2 className="text-base font-bold tracking-tight text-slate-800 dark:text-slate-100">
            {heading}
          </h2>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>
      </div>

      <div
        className={cn(
          'grid gap-3 md:gap-4',
          visibleWorkspaces.length === 1 && 'mx-auto max-w-md grid-cols-1',
          visibleWorkspaces.length === 2 && 'mx-auto max-w-3xl grid-cols-1 sm:grid-cols-2',
          visibleWorkspaces.length >= 3 && 'grid-cols-1 sm:grid-cols-3',
        )}
      >
        {visibleWorkspaces.map((ws, i) => {
          const Icon = ws.icon;
          return (
            <motion.div
              key={ws.key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42 + i * 0.09, duration: 0.45 }}
              whileHover={{ y: -6 }}
              className="h-full"
            >
              <div
                className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-lg shadow-slate-900/5 backdrop-blur-sm transition-all duration-300 dark:border-slate-700/80 dark:bg-slate-900/90 dark:shadow-slate-950/30 ${ws.accent.hoverBorder} hover:shadow-xl ${ws.accent.hoverShadow}`}
              >
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${ws.accent.bar}`} />
                <div
                  className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl opacity-50 transition-opacity duration-500 group-hover:opacity-90 ${ws.accent.glow}`}
                  aria-hidden="true"
                />

                <Link
                  href={ws.href}
                  onFocus={() => router.prefetch(ws.href)}
                  className="relative flex flex-1 flex-col p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 md:p-6"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner shadow-white/10 ring-1 transition-transform duration-300 group-hover:scale-110 md:h-14 md:w-14 ${ws.accent.iconWrap}`}
                    >
                      <Icon className="h-6 w-6 md:h-7 md:w-7" />
                    </div>
                    <span className="rounded-full border border-slate-200/80 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-slate-400 dark:border-slate-700 dark:text-slate-500">
                      {ws.role}
                    </span>
                  </div>

                  <h3 className="mt-4 text-xl font-bold tracking-tight text-slate-900 dark:text-white md:text-2xl">
                    {SECTION_META[ws.key].label}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {ws.tagline}
                  </p>

                  <span
                    className={`mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-400 transition-colors duration-300 dark:text-slate-500 ${ws.accent.arrow}`}
                  >
                    进入{SECTION_META[ws.key].label}
                    <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </Link>

                <div className="relative flex flex-wrap gap-1.5 border-t border-slate-100 px-5 py-4 dark:border-slate-800 md:px-6">
                  {ws.quickLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onFocus={() => router.prefetch(link.href)}
                      className={`inline-flex min-h-8 items-center rounded-lg border border-transparent px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 dark:text-slate-400 ${ws.accent.chip}`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
