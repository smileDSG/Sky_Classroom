'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpenCheck,
  Clock,
  FolderKanban,
  LibraryBig,
  NotebookPen,
  Presentation,
} from 'lucide-react';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { SkySectionNav } from '@/components/sky/layout/sky-section-nav';
import { TeachingPage } from '@/app/sky/teaching/teaching-page';
import { PageTour } from '@/components/sky/tour/page-tour';

interface TeacherWorkspacePageProps {
  initialTopic?: string;
  showHistoryInitially?: boolean;
}

const WORKSPACE_ENTRIES = [
  {
    label: '课程项目',
    detail: '从课程资料出发，整理讲义、导图和案例。',
    href: '/sky/cloud-mind/course-studio',
    icon: FolderKanban,
    tone: 'emerald',
  },
  {
    label: '大纲与场景',
    detail: '先确定教学目标，再组织每一段课堂内容。',
    href: '/sky/cloud-mind/course-studio?view=outline',
    icon: NotebookPen,
    tone: 'violet',
  },
  {
    label: '课件设计',
    detail: '把课程结构转成可继续编辑的 PPT 页面。',
    href: '/sky/cloud-mind/slides',
    icon: Presentation,
    tone: 'sky',
  },
  {
    label: '授课历史',
    detail: '继续查看已经生成的课堂和讲解记录。',
    href: '/sky/teaching/history',
    icon: Clock,
    tone: 'rose',
  },
] as const;

const TONE_CLASSES = {
  emerald:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-200/20 dark:bg-emerald-300/10 dark:text-emerald-100',
  violet:
    'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-200/20 dark:bg-violet-300/10 dark:text-violet-100',
  sky: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-200/20 dark:bg-sky-300/10 dark:text-sky-100',
  amber:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-200/20 dark:bg-amber-300/10 dark:text-amber-100',
  rose: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-200/20 dark:bg-rose-300/10 dark:text-rose-100',
} as const;

export function TeacherWorkspacePage({
  initialTopic,
  showHistoryInitially = false,
}: TeacherWorkspacePageProps) {
  return (
    <SkyAppShell>
      <div className="mx-auto max-w-6xl space-y-5 pb-8">
        <SkySectionNav section="teaching" />

        <section
          data-tour-step="page-header"
          className="overflow-hidden rounded-[24px] border border-violet-200/80 bg-[linear-gradient(135deg,#f5f3ff_0%,#f8fafc_55%,#ffffff_100%)] shadow-[0_20px_60px_rgba(79,70,229,0.12)] dark:border-violet-200/15 dark:bg-[linear-gradient(135deg,#17143a_0%,#0b1729_58%,#07111f_100%)] dark:shadow-[0_24px_68px_rgba(0,0,0,0.3)]"
        >
          <div className="flex flex-col gap-5 p-5 md:flex-row md:items-end md:justify-between md:p-7">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white dark:bg-violet-300 dark:text-slate-950">
                  <BookOpenCheck className="h-4 w-4" />
                </span>
                <span className="rounded-full border border-violet-200 bg-white/75 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:border-violet-200/20 dark:bg-white/[0.08] dark:text-violet-100">
                  教师工作区
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold leading-tight text-slate-950 dark:text-white md:text-3xl">
                备课工作台
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-200">
                从课程目标开始，逐步完成大纲、课堂讲解、课件、练习和历史沉淀。学生端的知识点微课仍然在资源中心独立使用。
              </p>
            </div>
            <Link
              href="/sky/cloud-mind/course-studio"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 dark:bg-violet-300 dark:text-slate-950 dark:hover:bg-violet-200 dark:focus-visible:ring-offset-slate-950"
            >
              新建课程项目
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section aria-labelledby="teacher-workspace-tools" data-tour-step="page-primary">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2
                id="teacher-workspace-tools"
                className="text-lg font-semibold text-slate-950 dark:text-white"
              >
                备课流程
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                不同入口对应不同阶段，已经生成的内容可以继续编辑和复用。
              </p>
            </div>
            <span className="hidden items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 sm:inline-flex">
              <LibraryBig className="h-3.5 w-3.5" />4 个工作入口
            </span>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {WORKSPACE_ENTRIES.map((entry) => {
              const Icon = entry.icon;
              return (
                <Link
                  key={entry.label}
                  href={entry.href}
                  className="group flex min-h-40 flex-col rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-200/40 dark:border-cyan-100/10 dark:bg-[#0b1729]/80 dark:shadow-none dark:hover:border-violet-200/30 dark:hover:bg-[#10203a]"
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border ${TONE_CLASSES[entry.tone]}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {entry.label}
                  </span>
                  <span className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {entry.detail}
                  </span>
                  <span className="mt-auto flex items-center gap-1 pt-3 text-xs font-semibold text-violet-700 dark:text-violet-100">
                    进入
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section id="teaching-canvas" className="scroll-mt-5 pt-1">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">智能授课台</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                生成教案后，在这里逐段讲解、插入检查点，并查看授课历史。
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-100">
              <NotebookPen className="h-3.5 w-3.5" />
              可从课程项目带入主题
            </span>
          </div>
          <TeachingPage initialTopic={initialTopic} showHistoryInitially={showHistoryInitially} />
        </section>
      </div>
      <PageTour id="teaching-overview" />
    </SkyAppShell>
  );
}
