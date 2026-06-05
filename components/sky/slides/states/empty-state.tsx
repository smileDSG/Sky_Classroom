'use client';

import { useState } from 'react';
import { Search, Wand2, Ruler, Leaf, FileText, Scroll, Sparkles } from 'lucide-react';
import { AmbientGlow } from '../design-system/ambient-glow';

const QUICK_TOPICS = [
  { label: '勾股定理', icon: Ruler },
  { label: '牛顿定律', icon: FileText },
  { label: '光合作用', icon: Leaf },
  { label: '唐诗宋词', icon: Scroll },
] as const;

const DIFFICULTIES = [
  { value: 'junior' as const, label: '初中' },
  { value: 'senior' as const, label: '高中' },
  { value: 'college' as const, label: '大学' },
] as const;

interface EmptyStateProps {
  topic: string;
  difficulty: 'junior' | 'senior' | 'college';
  generating: boolean;
  onTopicChange: (topic: string) => void;
  onDifficultyChange: (difficulty: 'junior' | 'senior' | 'college') => void;
  onGenerate: () => void;
}

export function EmptyState({
  topic,
  difficulty,
  generating,
  onTopicChange,
  onDifficultyChange,
  onGenerate,
}: EmptyStateProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-8 px-6 overflow-hidden">
      {/* Ambient glow background — upgraded with mesh, noise, and depth */}
      <AmbientGlow color="#722ed1" accentColor="#0ea5e9" intensity="medium" />

      {/* Floating decorative elements — refined with more layers */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* Floating orbs */}
        <div className="absolute top-[15%] left-[15%] h-2 w-2 rounded-full bg-primary/20 animate-floaty" style={{ animationDelay: '0s' }} />
        <div className="absolute top-[25%] right-[20%] h-1.5 w-1.5 rounded-full bg-primary/15 animate-floaty" style={{ animationDelay: '0.7s' }} />
        <div className="absolute bottom-[20%] left-[25%] h-1 w-1 rounded-full bg-sky-400/20 animate-floaty" style={{ animationDelay: '1.4s' }} />
        <div className="absolute bottom-[30%] right-[15%] h-2 w-2 rounded-full bg-primary/10 animate-floaty" style={{ animationDelay: '2.1s' }} />
        <div className="absolute top-[40%] left-[10%] h-1 w-1 rounded-full bg-sky-400/15 animate-floaty" style={{ animationDelay: '2.8s' }} />
        {/* Geometric accent lines */}
        <div className="absolute top-[10%] right-[30%] h-20 w-px bg-gradient-to-b from-primary/10 to-transparent rotate-12" />
        <div className="absolute bottom-[15%] left-[20%] h-16 w-px bg-gradient-to-t from-primary/10 to-transparent -rotate-6" />
        <div className="absolute top-[55%] right-[12%] h-12 w-px bg-gradient-to-b from-sky-400/10 to-transparent rotate-45" />
      </div>

      {/* Title */}
      <div className="relative flex flex-col items-center gap-3 text-center animate-slide-up-fade">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 shadow-sm">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            AI 课件生成
          </h1>
          <p className="mt-1.5 text-sm text-slate-400 dark:text-slate-500">
            输入教学主题，一键生成精美幻灯片
          </p>
        </div>
      </div>

      {/* Single-line integrated input */}
      <div
        className="relative w-full max-w-xl animate-slide-up-fade"
        style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
      >
        <div
          className={`flex items-center gap-2 rounded-2xl border bg-white dark:bg-slate-800 shadow-xl transition-all duration-300 px-2 py-2 ${
            focused
              ? 'border-primary/40 shadow-primary/10 shadow-2xl ring-2 ring-primary/10'
              : 'border-slate-200 dark:border-slate-700'
          }`}
        >
          {/* Difficulty segment */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-700/60 rounded-xl p-0.5 flex-shrink-0">
            {DIFFICULTIES.map((d) => {
              const isActive = d.value === difficulty;
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => onDifficultyChange(d.value)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 flex-shrink-0" />

          {/* Search icon */}
          <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />

          {/* Input */}
          <input
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onGenerate()}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="输入课件主题"
            className="flex-1 min-w-0 bg-transparent text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none"
            autoFocus
          />

          {/* Generate button */}
          <button
            onClick={() => onGenerate()}
            disabled={generating || !topic.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-px active:translate-y-0 flex-shrink-0"
          >
            {generating ? (
              <Wand2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            生成
          </button>
        </div>
      </div>

      {/* Quick topics */}
      <div
        className="relative flex flex-wrap items-center justify-center gap-2 animate-slide-up-fade"
        style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
      >
        <span className="text-xs text-slate-400 dark:text-slate-500">试试：</span>
        {QUICK_TOPICS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => {
                onTopicChange(item.label);
                setTimeout(() => onGenerate(), 50);
              }}
              className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:border-primary/40 hover:text-primary dark:hover:text-primary hover:bg-primary/[0.03] transition-all duration-200 hover:-translate-y-px hover:shadow-sm"
              style={{
                animation: `fade-in-up 0.4s ease-out ${0.25 + idx * 0.06}s both`,
              }}
            >
              <Icon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
