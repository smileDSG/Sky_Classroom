'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Clipboard, Map, Route, Sparkles } from 'lucide-react';
import { MobileQuickEntranceNav } from '@/components/mobile/mobile-quick-entrance-nav';
import { MobileSkyShell } from '@/components/mobile/mobile-sky-shell';
import { cn } from '@/lib/utils';

const resourceTypes = [
  { id: 'markdown_lecture', label: '讲义', icon: BookOpen },
  { id: 'mind_map', label: '导图', icon: Map },
  { id: 'self_check', label: '自查清单', icon: Clipboard },
  { id: 'learning_path', label: '学习路径', icon: Route },
];

export default function MobileCourseStudioPage() {
  const [goal, setGoal] = useState('两周内补上机器学习基础和过拟合');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    resourceTypes.map((item) => item.id),
  );

  const advancedHref = useMemo(() => {
    const params = new URLSearchParams();
    if (goal.trim()) params.set('goal', goal.trim());
    if (selectedTypes.length > 0) params.set('types', selectedTypes.join(','));
    const query = params.toString();
    return `/sky/cloud-mind/course-studio${query ? `?${query}` : ''}`;
  }, [goal, selectedTypes]);

  const toggleType = (typeId: string) => {
    setSelectedTypes((prev) =>
      prev.includes(typeId) ? prev.filter((item) => item !== typeId) : [...prev, typeId],
    );
  };

  return (
    <MobileSkyShell fullBleed>
      <div className="space-y-3 px-4 pb-24">
        <section className="rounded-[22px] border border-sky-200/15 bg-[#0d1728] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <Link
            href="/m/sky/cloud-mind"
            className="mb-3 inline-flex items-center gap-1 text-[12px] font-bold text-slate-400"
          >
            <ArrowLeft className="size-3.5" />
            返回 AI 工具
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-sky-500 text-white">
              <Route className="size-5" />
            </span>
            <div>
              <h1 className="text-[24px] font-extrabold leading-none text-white">课程工作室</h1>
              <p className="mt-1 text-[12px] font-semibold text-slate-400">
                先收集目标，再生成讲义、导图、自查清单和学习路径。
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[20px] border border-white/10 bg-[#0d1728] p-3">
          <label htmlFor="course-goal" className="block text-[12px] font-extrabold text-slate-300">
            学习目标
          </label>
          <textarea
            id="course-goal"
            aria-label="学习目标"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            className="mt-2 min-h-28 w-full rounded-[13px] border border-white/10 bg-white/[0.055] px-3 py-3 text-[14px] font-semibold leading-6 text-white outline-none focus:border-sky-300/40"
          />

          <div className="mt-4 text-[12px] font-extrabold text-slate-300">资源类型</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {resourceTypes.map((type) => {
              const Icon = type.icon;
              const selected = selectedTypes.includes(type.id);
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => toggleType(type.id)}
                  className={cn(
                    'flex h-11 items-center justify-center gap-2 rounded-[13px] border text-[13px] font-extrabold',
                    selected
                      ? 'border-sky-300/30 bg-sky-400/15 text-sky-100'
                      : 'border-white/10 bg-white/[0.045] text-slate-400',
                  )}
                >
                  <Icon className="size-4" />
                  {type.label}
                </button>
              );
            })}
          </div>

          <Link
            href={advancedHref}
            className="mt-4 flex h-11 items-center justify-center gap-2 rounded-[13px] bg-sky-500 text-[13px] font-extrabold text-white active:bg-sky-400"
          >
            <Sparkles className="size-4" />
            继续生成课程资料
          </Link>
        </section>

        <section className="rounded-[18px] border border-white/10 bg-white/[0.04] p-3">
          <h2 className="text-[14px] font-extrabold text-white">从这里开始整理学习资料</h2>
          <p className="mt-1 text-[12px] font-semibold leading-5 text-slate-400">
            这里负责收集目标和资源类型。完整生成追踪、可信审核和多资源预览继续进入桌面工作室承接。
          </p>
        </section>
      </div>
      <MobileQuickEntranceNav />
    </MobileSkyShell>
  );
}
