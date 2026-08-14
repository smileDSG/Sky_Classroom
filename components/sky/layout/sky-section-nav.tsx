'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  BookOpenCheck,
  Brain,
  CalendarClock,
  Camera,
  FileQuestion,
  FolderKanban,
  History,
  LibraryBig,
  Network,
  NotebookPen,
  Presentation,
  Route,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SkySection = 'learning' | 'resources' | 'teaching';

interface SectionNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
}

export interface SectionNavGroup {
  label: string;
  items: SectionNavItem[];
}

const SECTION_META: Record<SkySection, { label: string; description: string }> = {
  learning: {
    label: '学习工作台',
    description: '今天学什么、为什么学、下一步怎么走',
  },
  resources: {
    label: '学习资源',
    description: '题目、讲解、复习和课程材料',
  },
  teaching: {
    label: '备课工作区',
    description: '课程、教案、课件和课堂历史',
  },
};

export const SECTION_GROUPS: Record<SkySection, SectionNavGroup[]> = {
  learning: [
    {
      label: '开始学习',
      items: [
        { label: '学习总览', href: '/sky', icon: BookOpenCheck, exact: true },
        { label: '今日计划', href: '/sky/learning/today', icon: CalendarClock },
      ],
    },
    {
      label: '学习进度',
      items: [
        { label: '学习路径', href: '/sky/learning/path', icon: Route },
        { label: '复习计划', href: '/sky/learning/review', icon: CalendarClock },
        { label: '错题本', href: '/sky/learning/mistakes', icon: NotebookPen },
        { label: '知识地图', href: '/sky/learning/graph', icon: Network },
      ],
    },
    {
      label: '复盘反馈',
      items: [
        { label: '学习分析', href: '/sky/learning/profile', icon: ShieldCheck },
        { label: '学习统计', href: '/sky/learning/stats', icon: BarChart3 },
        { label: '学习记录', href: '/sky/learning/profile-dashboard', icon: History },
      ],
    },
  ],
  resources: [
    {
      label: '开始使用',
      items: [
        { label: '资源总览', href: '/sky/cloud-mind', icon: LibraryBig, exact: true },
        { label: '拍题解析', href: '/sky/cloud-mind/solve', icon: Camera },
        { label: '题目生成', href: '/sky/cloud-mind/quiz', icon: FileQuestion },
      ],
    },
    {
      label: '记忆与讲解',
      items: [
        { label: '记忆复习', href: '/sky/cloud-mind/memory', icon: Brain },
        { label: '学习问答', href: '/sky/assistant', icon: Sparkles },
      ],
    },
    {
      label: '课程材料',
      items: [
        { label: '课程资源', href: '/sky/cloud-mind/course-studio', icon: FolderKanban },
        { label: 'PPT课件', href: '/sky/cloud-mind/slides', icon: Presentation },
      ],
    },
  ],
  teaching: [
    {
      label: '课程准备',
      items: [
        { label: '备课总览', href: '/sky/teaching', icon: FolderKanban, exact: true },
        { label: '授课设计', href: '/sky/teaching/design', icon: NotebookPen },
      ],
    },
    {
      label: '教学材料',
      items: [
        { label: '课程资源', href: '/sky/teaching/resources', icon: LibraryBig },
        { label: '课件设计', href: '/sky/teaching/slides', icon: Presentation },
      ],
    },
    {
      label: '课堂沉淀',
      items: [{ label: '授课记录', href: '/sky/teaching/history', icon: History }],
    },
    {
      label: '智能授课',
      items: [{ label: 'AI授课', href: '/sky/cloud-mind/teaching', icon: Sparkles }],
    },
  ],
};

function getSectionItems(section: SkySection): SectionNavItem[] {
  return SECTION_GROUPS[section].flatMap((group) => group.items);
}

function isItemActive(pathname: string, item: SectionNavItem, section: SkySection): boolean {
  if (item.href.includes('#') || item.href.includes('?')) return false;
  if (item.exact) return pathname === item.href;

  const isMatch = pathname === item.href || pathname.startsWith(`${item.href}/`);
  if (!isMatch) return false;

  return !getSectionItems(section).some(
    (other) =>
      other !== item &&
      !other.href.includes('#') &&
      !other.href.includes('?') &&
      other.href.length > item.href.length &&
      (pathname === other.href || pathname.startsWith(`${other.href}/`)),
  );
}

export function SkySectionNav({ section }: { section: SkySection }) {
  const pathname = usePathname();
  const meta = SECTION_META[section];

  return (
    <nav
      aria-label={`${meta.label}页面导航`}
      className="border-b border-slate-200/70 pb-4 dark:border-cyan-100/10 md:hidden"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden="true" />
            {meta.label}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {meta.description}
          </p>
        </div>

        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SECTION_GROUPS[section].map((group, groupIndex) => (
            <div
              key={group.label}
              className={cn(
                'min-w-0',
                groupIndex > 0 && 'border-slate-200/70 sm:border-l sm:pl-4 dark:border-cyan-100/10',
              )}
            >
              <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-slate-400 dark:text-slate-500">
                {group.label}
              </div>
              <div className="flex flex-wrap gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(pathname, item, section);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60',
                        active
                          ? 'bg-sky-500 text-white shadow-sm dark:bg-sky-300 dark:text-slate-950'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-sky-700 dark:text-slate-300 dark:hover:bg-white/[0.07] dark:hover:text-sky-100',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}
