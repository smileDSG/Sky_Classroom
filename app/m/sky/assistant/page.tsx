'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Brain,
  ChartNoAxesColumnIncreasing,
  Cloud,
  Feather,
  GraduationCap,
  History,
  MessageCircle,
  Moon,
  Plus,
  Send,
  Settings,
  Sparkles,
  Star,
  Telescope,
  Wind,
  X,
  type LucideIcon,
} from 'lucide-react';
import { MobileSkyFrame } from '@/components/mobile/mobile-sky-frame';
import { MobileSkyShell } from '@/components/mobile/mobile-sky-shell';

const tabs: Array<{ label: string; href: string; icon: LucideIcon; active?: boolean }> = [
  { label: '天穹授课', href: '/m/sky', icon: GraduationCap },
  { label: '摘星锦囊', href: '/m/sky/learning/review', icon: Star },
  { label: '云端智囊', href: '/m/sky/cloud-mind', icon: Brain },
  { label: '天梯工坊', href: '/m/sky/study-lab', icon: ChartNoAxesColumnIncreasing },
  { label: '云翼助手', href: '/m/sky/assistant', icon: Telescope, active: true },
];

const assistantNav: Array<{
  label: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
}> = [
  {
    label: '对话',
    desc: '与小镜交流',
    href: '/m/sky/assistant?view=chat',
    icon: MessageCircle,
    active: true,
  },
  {
    label: '历史',
    desc: '过往对话',
    href: '/m/sky/assistant?view=history',
    icon: History,
  },
  {
    label: '设置',
    desc: '个性配置',
    href: '/m/sky/assistant?view=settings',
    icon: Settings,
  },
];

const quickPrompts = ['帮我看看这道化学题', '什么是化学里的核心概念', '怎么高效复习错题'];

const subjectOptions = ['数学', '物理', '化学', '语文', '英语'];
const styleOptions = [
  { label: '详细', value: 'detailed' },
  { label: '简洁', value: 'concise' },
  { label: '启发式', value: 'heuristic' },
];
const difficultyOptions = [
  { label: '初中', value: 'junior' },
  { label: '高中', value: 'senior' },
  { label: '大学', value: 'college' },
];

export default function MobileAssistantPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 px-4 py-6 text-sm font-semibold text-slate-400">
          加载助手...
        </div>
      }
    >
      <MobileAssistantContent />
    </Suspense>
  );
}

function MobileAssistantContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get('view');
  const [subject, setSubject] = useState('化学');
  const [style, setStyle] = useState('detailed');
  const [difficulty, setDifficulty] = useState('junior');
  const [question, setQuestion] = useState('');
  const styleLabel = useMemo(
    () => styleOptions.find((item) => item.value === style)?.label ?? '详细',
    [style],
  );
  const difficultyLabel = useMemo(
    () => difficultyOptions.find((item) => item.value === difficulty)?.label ?? '初中',
    [difficulty],
  );

  const openAssistantChat = (prompt?: string) => {
    const text = (prompt ?? question).trim();
    const params = new URLSearchParams({
      view: 'chat',
      subject,
      style,
      difficulty,
    });
    if (text) params.set('q', text);
    router.push(`/m/sky/assistant?${params.toString()}`);
  };

  if (view) {
    const query = searchParams.toString();
    return <MobileSkyFrame src={`/sky/assistant${query ? `?${query}` : ''}`} />;
  }

  return (
    <MobileSkyShell>
      <div className="space-y-2.5 pb-4">
        <nav className="grid grid-cols-5 gap-1 rounded-[18px] border border-white/8 bg-white/[0.04] p-1.5">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-[14px] px-1 py-1.5 text-center ${
                  item.active
                    ? 'bg-white/10 text-white ring-1 ring-sky-300/25'
                    : 'text-slate-400 active:bg-white/7'
                }`}
              >
                <Icon className={`size-3.5 ${item.active ? 'text-sky-300' : 'text-slate-500'}`} />
                <span className="w-full truncate text-[10px] font-semibold leading-tight">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <section className="overflow-hidden rounded-[22px] border border-sky-200/15 bg-[#0d1728] shadow-[0_18px_44px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="relative p-4">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(14,165,233,0.26),rgba(79,70,229,0.2)_58%,rgba(15,23,42,0))]" />
            <div className="absolute -right-10 -top-14 size-36 rounded-full bg-white/10 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-[13px] bg-white/12 text-sky-100 ring-1 ring-white/12">
                  <Feather className="size-4" />
                </span>
                <span>
                  <span className="block text-[11px] font-extrabold tracking-[0.18em] text-sky-100">
                    AI 助教
                  </span>
                  <span className="mt-0.5 block text-[10px] font-semibold text-sky-100/70">
                    小镜课堂
                  </span>
                </span>
              </div>
              <h1 className="mt-3 text-[28px] font-extrabold leading-none text-white">云翼助手</h1>
              <p className="mt-3 line-clamp-2 text-[13px] font-semibold leading-6 text-sky-50/85">
                小镜随时待命，为你解答疑惑、梳理思路。
              </p>
              <div className="mt-3 flex items-center gap-3 text-[10px] font-bold text-sky-100/80">
                <span className="inline-flex items-center gap-1">
                  <Wind className="size-3" />
                  即时响应
                </span>
                <span className="h-3 w-px bg-white/25" />
                <span className="inline-flex items-center gap-1">
                  <Cloud className="size-3" />
                  云端记忆
                </span>
              </div>
            </div>
          </div>
        </section>

        <section aria-label="助手导航" className="grid grid-cols-3 gap-2">
          {assistantNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`rounded-[17px] border p-2.5 active:scale-[0.99] ${
                  item.active
                    ? 'border-sky-200/25 bg-sky-300/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'border-white/8 bg-[#0d1728] text-slate-400'
                }`}
              >
                <span
                  className={`flex size-8 items-center justify-center rounded-[12px] ${
                    item.active ? 'bg-sky-500 text-white' : 'bg-white/7 text-slate-400'
                  }`}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="mt-2 block truncate text-[12px] font-extrabold">{item.label}</span>
                <span className="mt-0.5 block truncate text-[9px] font-semibold text-slate-500">
                  {item.desc}
                </span>
              </Link>
            );
          })}
        </section>

        <section className="rounded-[20px] border border-white/10 bg-[#0d1728] shadow-[0_16px_38px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.055)]">
          <div className="border-b border-white/8 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[13px] font-extrabold text-slate-300">助手配置</span>
              <span className="rounded-full bg-white/7 px-2 py-0.5 text-[9px] font-bold text-slate-400">
                可进入真实助手调整
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <ConfigGroup
                title="学科"
                options={subjectOptions}
                active={subject}
                onChange={setSubject}
              />
              <ConfigGroup
                title="风格"
                options={styleOptions}
                active={style}
                onChange={setStyle}
              />
              <ConfigGroup
                title="难度"
                options={difficultyOptions}
                active={difficulty}
                onChange={setDifficulty}
              />
            </div>
          </div>

          <div className="border-b border-white/8 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[16px] font-extrabold text-white">小镜课堂</span>
                  <span className="rounded-full bg-sky-400/14 px-1.5 py-0.5 text-[9px] font-bold text-sky-200">
                    {subject}
                  </span>
                  <span className="rounded-full bg-white/7 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">
                    {difficultyLabel}
                  </span>
                  <span className="rounded-full bg-white/7 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">
                    {styleLabel}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <Plus className="size-4" />
                <Moon className="size-4" />
                <X className="size-4" />
              </div>
            </div>
          </div>

          <div className="flex min-h-[260px] flex-col items-center justify-center px-4 py-6 text-center">
            <div className="flex size-16 items-center justify-center overflow-hidden rounded-full border border-white/12 bg-white/[0.06] shadow-lg shadow-slate-950/25 ring-4 ring-sky-300/8">
              <img
                src="/avatars/kagami/chibi.png"
                alt="小镜头像"
                className="h-full w-full object-cover"
              />
            </div>
            <p className="mt-4 text-[12px] font-semibold text-slate-400">
              哈？遇到不会的题目了？告诉我吧。
            </p>
            <div className="mt-4 w-full max-w-[260px] space-y-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setQuestion(prompt);
                    openAssistantChat(prompt);
                  }}
                  className="block rounded-[11px] border border-sky-200/15 bg-white/[0.035] px-3 py-2 text-left text-[11px] font-semibold text-slate-300 active:bg-white/[0.06]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-white/8 p-2.5">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                openAssistantChat();
              }}
              className="flex h-10 items-center gap-2 rounded-[13px] border border-white/10 bg-white/[0.055] px-3 text-[12px] font-semibold text-slate-400 focus-within:border-sky-300/35"
            >
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="输入你的问题..."
                className="min-w-0 flex-1 bg-transparent text-left text-slate-100 outline-none placeholder:text-slate-500"
              />
              <button
                type="submit"
                aria-label="发送问题"
                className="flex size-8 shrink-0 items-center justify-center rounded-[11px] bg-sky-500 text-white disabled:opacity-50"
                disabled={!question.trim()}
              >
                <Send className="size-3.5" />
              </button>
            </form>
            <button
              type="button"
              onClick={() => openAssistantChat()}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-[12px] border border-sky-200/15 bg-sky-300/[0.08] text-[12px] font-extrabold text-sky-100 active:bg-sky-300/[0.12]"
            >
              进入完整对话
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </section>

        <div className="rounded-[15px] border border-amber-200/18 bg-amber-300/8 px-3 py-2 text-[10px] font-bold text-amber-200">
          <Sparkles className="mr-1 inline size-3" />
          提示：小镜会记住你们的对话
        </div>
      </div>
    </MobileSkyShell>
  );
}

function ConfigGroup({
  title,
  options,
  active,
  onChange,
}: {
  title: string;
  options: Array<string | { label: string; value: string }>;
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[9px] font-bold text-slate-500">{title}</div>
      <div className="flex min-w-0 flex-wrap gap-1">
        {options.map((option) => {
          const label = typeof option === 'string' ? option : option.label;
          const value = typeof option === 'string' ? option : option.value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              className={`rounded-[8px] px-1.5 py-1 text-[9px] font-extrabold ${
                value === active ? 'bg-violet-500 text-white' : 'bg-white/7 text-slate-400'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
