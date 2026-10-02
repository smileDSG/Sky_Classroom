'use client';

/**
 * 简洁模式开关（T03 / FR-07）。
 *
 * 写入 RetentionSlice.simpleMode / kagamiClosed（已纳入 persist → 自动跨端同步）。
 * 简洁模式门控动态背景与陪伴宠物（默认静默可关）；右下角小镜可单独关闭。
 * 不做奖励、不做红点，纯克制开关。
 */

import { Eye, EyeOff, Sparkles, Cat } from 'lucide-react';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked
            ? 'bg-sky-500'
            : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  );
}

export function SimpleModeToggle() {
  const simpleMode = useSkyClassroomStore((s) => s.simpleMode);
  const kagamiClosed = useSkyClassroomStore((s) => s.kagamiClosed);
  const setSimpleMode = useSkyClassroomStore((s) => s.setSimpleMode);
  const setKagamiClosed = useSkyClassroomStore((s) => s.setKagamiClosed);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-1 px-1 text-xs font-semibold tracking-wide text-slate-400 dark:text-slate-500">
        界面克制
      </div>
      <ToggleRow
        icon={<Sparkles className="h-4 w-4" />}
        title="简洁模式"
        description="隐藏动态背景与陪伴宠物，只留学习本身"
        checked={simpleMode}
        onChange={setSimpleMode}
      />
      <ToggleRow
        icon={kagamiClosed ? <EyeOff className="h-4 w-4" /> : <Cat className="h-4 w-4" />}
        title="关闭小镜"
        description="收起右下角 AI 助手小标"
        checked={kagamiClosed}
        onChange={setKagamiClosed}
      />
    </div>
  );
}
