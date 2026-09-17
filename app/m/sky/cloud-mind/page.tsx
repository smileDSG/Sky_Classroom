'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Brain,
  CalendarClock,
  Camera,
  FileQuestion,
  Presentation,
  Route,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { MobileSkyShell } from '@/components/mobile/mobile-sky-shell';
import { MobileQuickEntranceNav } from '@/components/mobile/mobile-quick-entrance-nav';
import { cn } from '@/lib/utils';
import type { MemoryReviewRecord } from '@/lib/cloud-mind/types';

const tools: Array<{
  label: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  color: string;
  badge?: string;
}> = [
  {
    label: '拍照搜题',
    desc: '拍照识别题目',
    href: '/m/sky/cloud-mind/solve',
    icon: Camera,
    color: 'from-violet-500 to-purple-600',
    badge: '热门',
  },
  {
    label: 'PPT课件',
    desc: '一键生成课件',
    href: '/m/sky/cloud-mind/slides',
    icon: Presentation,
    color: 'from-cyan-500 to-blue-600',
    badge: '推荐',
  },
  {
    label: '智能出题',
    desc: '定制练习题',
    href: '/m/sky/cloud-mind/quiz',
    icon: FileQuestion,
    color: 'from-amber-500 to-orange-500',
    badge: '新',
  },
  {
    label: '记忆卡片',
    desc: '生成复习卡',
    href: '/m/sky/cloud-mind/memory',
    icon: Brain,
    color: 'from-rose-500 to-pink-600',
  },
  {
    label: '智能授课',
    desc: '生成教学方案',
    href: '/m/sky/cloud-mind/teaching',
    icon: BookOpen,
    color: 'from-emerald-500 to-teal-600',
  },
  {
    label: '课程工作室',
    desc: '生成个性资源',
    href: '/m/sky/cloud-mind/course-studio',
    icon: Route,
    color: 'from-sky-500 to-indigo-600',
  },
];

export default function MobileCloudMindPage() {
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/sky/cloud-mind/memory-due', { credentials: 'include' })
      .then((response) => response.json())
      .then((json: { success?: boolean; data?: MemoryReviewRecord[] }) => {
        if (cancelled || !json.success || !Array.isArray(json.data)) return;
        setDueCount(json.data.length);
      })
      .catch(() => {
        /* due reviews are optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <MobileSkyShell fullBleed>
      <div className="relative flex flex-col">
        {/* ambient top gradient that bleeds to the screen edges */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-gradient-to-b from-indigo-600/35 via-violet-600/20 to-transparent" />

        {/* hero */}
        <section className="relative px-5 pb-6 pt-9">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Sparkles className="size-4 text-white" />
            </span>
            <span className="text-[12px] font-semibold tracking-[0.2em] text-white/90">
              AI 工具集
            </span>
          </div>
          <h1 className="text-[32px] font-extrabold leading-none text-white">云端智囊</h1>
          <p className="mt-3 max-w-[280px] text-[13px] leading-relaxed text-white/90">
            拍照搜题、PPT 课件生成、智能出题、记忆卡片、智能授课，一站直达。
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[12px] text-white backdrop-blur-sm">
            <span>{tools.length} 大智能工具</span>
            <span className="h-3 w-px bg-white/25" />
            <span>持续更新</span>
          </div>
        </section>

        {/* due review reminder */}
        {dueCount > 0 && (
          <section className="relative px-4 pb-1">
            <Link
              href="/m/sky/cloud-mind/memory"
              className="flex items-center justify-between gap-2 rounded-[18px] border border-amber-300/30 bg-amber-400/15 px-4 py-3 backdrop-blur-sm transition-transform active:scale-[0.98]"
            >
              <span className="flex items-center gap-2 text-[13px] font-extrabold text-amber-100">
                <CalendarClock className="size-4 shrink-0" />
                今天 {dueCount} 张记忆卡待复习
              </span>
              <span className="shrink-0 rounded-full bg-amber-400/25 px-3 py-1 text-[12px] font-bold text-amber-100">
                开始复习
              </span>
            </Link>
          </section>
        )}

        {/* tools grid */}
        <section className="relative px-4 pb-24">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-white">全部工具</h2>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[12px] font-semibold text-slate-200">
              {tools.length} 个入口
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {tools.map((tool, index) => {
              const Icon = tool.icon;
              const isWide = index === tools.length - 1;

              return (
                <Link
                  key={tool.label}
                  href={tool.href}
                  className={cn(
                    'mobile-tactile-card group relative flex min-h-[84px] flex-col justify-between overflow-hidden rounded-[20px] border border-white/10 bg-[#132235]/80 p-3 transition-transform duration-200 active:scale-[0.98]',
                    isWide && 'col-span-2',
                  )}
                >
                  <div
                    className={`absolute -right-8 -top-8 size-24 rounded-full bg-gradient-to-br ${tool.color} opacity-30 blur-2xl`}
                  />

                  <div className="relative flex items-start justify-between">
                    <span
                      className={`flex size-9 items-center justify-center rounded-2xl bg-gradient-to-br ${tool.color} shadow-lg shadow-black/20`}
                    >
                      <Icon className="size-4.5 text-white" />
                    </span>
                    {tool.badge && (
                      <span className="rounded-full bg-amber-400/25 px-1.5 py-0.5 text-[10px] font-bold text-amber-100">
                        {tool.badge}
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <span className="block text-[14px] font-bold text-white">{tool.label}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-slate-300">
                      {tool.desc}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      <MobileQuickEntranceNav />
    </MobileSkyShell>
  );
}
