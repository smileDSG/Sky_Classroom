'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Cloud,
  Feather,
  History,
  Loader2,
  MessageCircle,
  Palette,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Type,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { MobileSkyFrame } from '@/components/mobile/mobile-sky-frame';
import { MobileSkyShell } from '@/components/mobile/mobile-sky-shell';
import { MobileSkyShell as MobileNavShell } from '@/components/mobile/shell/mobile-sky-shell';
import { MobileQuickEntranceNav } from '@/components/mobile/mobile-quick-entrance-nav';
import {
  listConversations,
  deleteConversation,
} from '@/lib/storage/dao/assistant-conversation';

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
  const [subject] = useState('化学');
  const [style] = useState('detailed');
  const [difficulty] = useState('junior');
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

  if (view === 'settings') {
    return <MobileAssistantSettings />;
  }

  if (view === 'chat' || view === 'history') {
    const query = searchParams.toString();
    return <MobileSkyFrame src={`/sky/assistant${query ? `?${query}` : ''}`} />;
  }

  return (
    <MobileSkyShell fullBleed>
      <div className="relative flex flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-gradient-to-b from-sky-600/30 via-violet-600/15 to-transparent" />

        <section className="relative px-5 pb-6 pt-9">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Feather className="size-4 text-white" />
            </span>
            <span className="text-[12px] font-semibold tracking-[0.2em] text-white/90">
              AI 助教
            </span>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-[32px] font-extrabold leading-none text-white">云翼助手</h1>
              <p className="mt-3 max-w-[280px] text-[13px] leading-relaxed text-white/80">
                小镜随时待命，为你解答疑惑、梳理思路、陪伴学习。
              </p>
              <div className="mt-3 inline-flex items-center gap-3 rounded-full bg-white/15 px-3 py-1 text-[12px] text-white backdrop-blur-sm">
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

            <div className="flex shrink-0 items-center gap-2">
              <span className="flex size-12 items-center justify-center overflow-hidden rounded-full border border-white/12 bg-white/[0.06] shadow-lg shadow-slate-950/25 ring-4 ring-sky-300/8">
                <img
                  src="/avatars/kagami/chibi.png"
                  alt="小镜头像"
                  className="h-full w-full object-cover"
                />
              </span>
            </div>
          </div>
        </section>

        <div className="relative space-y-2.5 px-4 pb-24">
        <section aria-label="助手导航" className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
          {assistantNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-[13px] font-extrabold active:scale-[0.99] ${
                  item.active
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
                    : 'border border-white/8 bg-[#0d1728] text-slate-400'
                }`}
              >
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </section>

        <section className="rounded-[20px] border border-white/10 bg-[#0d1728] shadow-[0_16px_38px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.055)]">
          <div className="flex items-center justify-between gap-2 border-b border-white/8 px-3 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-extrabold text-white">小镜课堂</span>
              <span className="rounded-full bg-sky-400/14 px-2 py-0.5 text-[11px] font-bold text-sky-200">
                {subject}
              </span>
              <span className="rounded-full bg-white/7 px-2 py-0.5 text-[11px] font-bold text-slate-400">
                {difficultyLabel}
              </span>
              <span className="rounded-full bg-white/7 px-2 py-0.5 text-[11px] font-bold text-slate-400">
                {styleLabel}
              </span>
            </div>
            <Link
              href="/m/sky/assistant?view=settings"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/7 text-slate-400 active:bg-white/10"
            >
              <Settings className="size-4" />
            </Link>
          </div>

          <div className="flex min-h-[220px] flex-col items-center justify-center px-4 py-5 text-center">
            <div className="flex size-14 items-center justify-center overflow-hidden rounded-full border border-white/12 bg-white/[0.06] shadow-lg shadow-slate-950/25 ring-4 ring-sky-300/8">
              <img
                src="/avatars/kagami/chibi.png"
                alt="小镜头像"
                className="h-full w-full object-cover"
              />
            </div>
            <p className="mt-3 text-[13px] font-semibold text-slate-400">
              哈？遇到不会的题目了？告诉我吧。
            </p>
            <div className="mt-3 flex w-full max-w-[280px] flex-wrap justify-center gap-2">
              {quickPrompts.slice(0, 2).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setQuestion(prompt);
                    openAssistantChat(prompt);
                  }}
                  className="rounded-full border border-sky-200/15 bg-white/[0.035] px-3 py-1.5 text-[12px] font-semibold text-slate-300 active:bg-white/[0.06]"
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
              className="flex h-11 items-center gap-2 rounded-[13px] border border-white/10 bg-white/[0.055] px-3 text-[14px] font-semibold text-slate-400 focus-within:border-sky-300/35"
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
              className="flex h-10 w-full items-center justify-center gap-2 rounded-[12px] border border-sky-200/15 bg-sky-300/[0.08] text-[13px] font-extrabold text-sky-100 active:bg-sky-300/[0.12]"
            >
              进入完整对话
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </section>

        <div className="rounded-[15px] border border-amber-200/18 bg-amber-300/8 px-3 py-2 text-[12px] font-bold text-amber-200">
          <Sparkles className="mr-1 inline size-3" />
          小镜会记住你们的对话
        </div>
      </div>
      </div>
      <MobileQuickEntranceNav />
    </MobileSkyShell>
  );
}

const THEME_COLORS = [
  { id: 'sky', label: '天蓝', color: 'bg-sky-500', ring: 'ring-sky-500' },
  { id: 'violet', label: '紫罗兰', color: 'bg-violet-500', ring: 'ring-violet-500' },
  { id: 'emerald', label: '翡翠绿', color: 'bg-emerald-500', ring: 'ring-emerald-500' },
  { id: 'rose', label: '玫瑰红', color: 'bg-rose-500', ring: 'ring-rose-500' },
  { id: 'amber', label: '琥珀金', color: 'bg-amber-500', ring: 'ring-amber-500' },
];

const FONT_SIZES = [
  { id: 'sm', label: '小' },
  { id: 'base', label: '中' },
  { id: 'lg', label: '大' },
];

function MobileAssistantSettings() {
  const [mode, setMode] = useState<'anime' | 'normal'>(() => {
    try {
      const saved = localStorage.getItem('assistant-panel-mode');
      if (saved === 'normal' || saved === 'anime') return saved;
    } catch { /* ignore */ }
    return 'anime';
  });
  const [selectedTheme, setSelectedTheme] = useState(() => {
    try { return localStorage.getItem('assistant-theme') || 'sky'; } catch { return 'sky'; }
  });
  const [selectedFontSize, setSelectedFontSize] = useState(() => {
    try { return localStorage.getItem('assistant-font-size') || 'base'; } catch { return 'base'; }
  });
  const [clearingData, setClearingData] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleModeChange = (newMode: 'anime' | 'normal') => {
    setMode(newMode);
    try { localStorage.setItem('assistant-panel-mode', newMode); } catch { /* ignore */ }
  };

  const handleThemeChange = (themeId: string) => {
    setSelectedTheme(themeId);
    try { localStorage.setItem('assistant-theme', themeId); } catch { /* ignore */ }
  };

  const handleFontSizeChange = (sizeId: string) => {
    setSelectedFontSize(sizeId);
    try { localStorage.setItem('assistant-font-size', sizeId); } catch { /* ignore */ }
  };

  const handleClearAllData = async () => {
    setClearingData(true);
    try {
      const convs = await listConversations({ limit: 9999 });
      for (const conv of convs) {
        await deleteConversation(conv.id);
      }
      try {
        localStorage.removeItem('kagami-mode');
        localStorage.removeItem('assistant-theme');
        localStorage.removeItem('assistant-font-size');
      } catch { /* ignore */ }
      setCleared(true);
      setTimeout(() => {
        setCleared(false);
        setShowClearConfirm(false);
      }, 2000);
    } catch {
      // ignore
    } finally {
      setClearingData(false);
    }
  };

  return (
    <MobileNavShell backHref="/m/sky/assistant" title="助手设置">
      <div className="space-y-4 px-4 pb-24 pt-4">
        <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#0d1728] dark:shadow-[0_16px_38px_rgba(0,0,0,0.2)]">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-black text-slate-700 dark:text-slate-300">
            <Sparkles className="size-4 text-sky-500" />
            助手人格
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleModeChange('anime')}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                mode === 'anime'
                  ? 'border-sky-400 bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-100'
                  : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300'
              }`}
            >
              <span className="text-2xl">🌸</span>
              <div>
                <p className="text-[13px] font-extrabold">二次元模式</p>
                <p className="mt-0.5 text-[10px] font-bold text-slate-500">傲娇女高中生·柊镜</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('normal')}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                mode === 'normal'
                  ? 'border-sky-400 bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-100'
                  : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300'
              }`}
            >
              <span className="text-2xl">📖</span>
              <div>
                <p className="text-[13px] font-extrabold">常规模式</p>
                <p className="mt-0.5 text-[10px] font-bold text-slate-500">专业友善的 AI 助教</p>
              </div>
            </button>
          </div>
        </section>

        <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#0d1728] dark:shadow-[0_16px_38px_rgba(0,0,0,0.2)]">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-black text-slate-700 dark:text-slate-300">
            <Palette className="size-4 text-violet-500" />
            主题色
          </div>
          <div className="flex flex-wrap gap-4">
            {THEME_COLORS.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleThemeChange(theme.id)}
                className="group flex flex-col items-center gap-1.5"
                title={theme.label}
              >
                <div
                  className={`flex size-9 items-center justify-center rounded-full ${theme.color} transition-all ${
                    selectedTheme === theme.id
                      ? `ring-2 ${theme.ring} ring-offset-2 ring-offset-white scale-110 dark:ring-offset-[#0d1728]`
                      : 'hover:scale-110'
                  }`}
                >
                  {selectedTheme === theme.id && <Check className="size-4 text-white" />}
                </div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{theme.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#0d1728] dark:shadow-[0_16px_38px_rgba(0,0,0,0.2)]">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-black text-slate-700 dark:text-slate-300">
            <Type className="size-4 text-emerald-500" />
            对话字号
          </div>
          <div className="grid grid-cols-3 gap-2">
            {FONT_SIZES.map((size) => (
              <button
                key={size.id}
                type="button"
                onClick={() => handleFontSizeChange(size.id)}
                className={`rounded-xl border py-2.5 text-[13px] font-extrabold transition-all ${
                  selectedFontSize === size.id
                    ? 'border-sky-400 bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-100'
                    : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300'
                }`}
              >
                {size.label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#0d1728] dark:shadow-[0_16px_38px_rgba(0,0,0,0.2)]">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-black text-slate-700 dark:text-slate-300">
            <Trash2 className="size-4 text-rose-500" />
            数据管理
          </div>
          {!showClearConfirm ? (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="flex h-11 w-full items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-[13px] font-extrabold text-rose-700 transition-colors dark:border-rose-200/15 dark:bg-rose-500/10 dark:text-rose-100"
            >
              <Trash2 className="size-4" />
              清空所有对话数据
            </button>
          ) : (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-200/15 dark:bg-rose-500/10">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-500 dark:text-rose-400" />
                <div className="flex-1">
                  <p className="text-[13px] font-extrabold text-rose-700 dark:text-rose-100">确认清空数据？</p>
                  <p className="mt-1 text-[11px] font-semibold text-rose-600/80 dark:text-rose-200/70">
                    此操作将删除所有对话历史、记忆数据和个性化设置，且无法恢复。
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(false)}
                      className="h-9 rounded-lg border border-slate-200 bg-white text-[12px] font-extrabold text-slate-600 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleClearAllData()}
                      disabled={clearingData}
                      className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-rose-500 text-[12px] font-extrabold text-white disabled:opacity-50"
                    >
                      {clearingData ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : cleared ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                      {cleared ? '已清空' : '确认清空'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </MobileNavShell>
  );
}
