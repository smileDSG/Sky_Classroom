'use client';

import { HelpCircle } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

export function PBLGuideInline() {
  return (
    <HoverCard openDelay={0} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button className="flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
          <HelpCircle className="h-4 w-4" />
          <span>How it works</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        collisionPadding={16}
        className="w-[380px] overflow-y-auto rounded-xl p-5"
        style={{ maxHeight: 'var(--radix-hover-card-content-available-height, 70vh)' }}
      >
        <GuideContent />
      </HoverCardContent>
    </HoverCard>
  );
}

export function PBLGuidePanel() {
  return (
    <HoverCard openDelay={0} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          title="使用帮助"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="end"
        collisionPadding={16}
        className="w-[380px] overflow-y-auto rounded-xl p-5"
        style={{ maxHeight: 'var(--radix-hover-card-content-available-height, 80vh)' }}
      >
        <GuideContent />
      </HoverCardContent>
    </HoverCard>
  );
}

function GuideContent() {
  return (
    <div className="space-y-5 text-[13px] leading-relaxed text-slate-900 dark:text-slate-100">
      <section>
        <h4 className="mb-1 font-semibold">第一步：选择角色</h4>
        <p className="text-slate-500 dark:text-slate-400">
          从项目角色中选择你的分工，进入对应的协作任务。
        </p>
      </section>

      <hr className="border-slate-200 dark:border-slate-800" />

      <section>
        <h4 className="mb-1 font-semibold">第二步：完成任务</h4>
        <p className="mb-3 text-slate-500 dark:text-slate-400">
          每个任务代表一个学习目标，你可以查看任务、获取引导并提交成果。
        </p>

        <ol className="list-inside list-decimal space-y-3 text-slate-500 dark:text-slate-400">
          <li>
            <span className="font-medium text-slate-900 dark:text-slate-100">查看当前任务</span>
            <p className="ml-[1.125rem] mt-0.5">了解任务标题、说明、负责人和完成要求。</p>
          </li>
          <li>
            <span className="font-medium text-slate-900 dark:text-slate-100">获取指导</span>
            <code className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">
              @question
            </code>
            <p className="ml-[1.125rem] mt-0.5">提问助手会给出引导性问题和提示。</p>
          </li>
          <li>
            <span className="font-medium text-slate-900 dark:text-slate-100">提交作品</span>
            <code className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">
              @judge
            </code>
            <p className="ml-[1.125rem] mt-0.5">评审助手会判断是否完成，并给出修改建议。</p>
          </li>
        </ol>
      </section>

      <hr className="border-slate-200 dark:border-slate-800" />

      <section>
        <h4 className="mb-1 font-semibold">第三步：完成项目</h4>
        <p className="text-slate-500 dark:text-slate-400">
          所有任务完成后，项目会进入总结阶段，方便复盘课堂成果。
        </p>
      </section>
    </div>
  );
}
