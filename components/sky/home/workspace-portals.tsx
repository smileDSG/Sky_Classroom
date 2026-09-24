'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Compass, LibraryBig, Presentation, type LucideProps } from 'lucide-react';
import { useQuickIdentity } from '@/lib/hooks/use-quick-identity';
import {
  isSkySectionVisible,
  SECTION_META,
  type SkySection,
} from '@/components/sky/layout/sky-section-nav';

interface Workspace {
  key: SkySection;
  tagline: string;
  href: string;
  icon: ComponentType<LucideProps>;
}

const workspaces: Workspace[] = [
  {
    key: 'learning',
    tagline: '今日计划、学习路径、错题本',
    href: '/sky',
    icon: Compass,
  },
  {
    key: 'resources',
    tagline: '拍题解析、记忆复习、PPT 课件',
    href: '/sky/cloud-mind',
    icon: LibraryBig,
  },
  {
    key: 'teaching',
    tagline: '课件设计、授课记录',
    href: '/sky/teaching',
    icon: Presentation,
  },
];

// 首页右列的紧凑工作区入口：每行一个入口，图标 + 名称 + 一句话说明。
// 深层入口（今日计划、错题本等）由 /sky 内的栏目导航承担，首页不重复铺设。
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

  return (
    <section aria-label="工作区">
      <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">工作区</h2>

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white dark:divide-slate-800 dark:border-slate-700/60 dark:bg-slate-900">
        {visibleWorkspaces.map((ws) => {
          const Icon = ws.icon;
          return (
            <Link
              key={ws.key}
              href={ws.href}
              onFocus={() => router.prefetch(ws.href)}
              className="group flex items-center gap-3 px-3 py-3 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 dark:hover:bg-slate-800/60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-sky-100 group-hover:text-sky-600 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-sky-500/15 dark:group-hover:text-sky-300">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                  {SECTION_META[ws.key].label}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-400 dark:text-slate-500">
                  {ws.tagline}
                </span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-sky-600 dark:text-slate-600 dark:group-hover:text-sky-400" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
