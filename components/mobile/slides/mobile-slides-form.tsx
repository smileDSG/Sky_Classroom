'use client';

import { useState } from 'react';
import { Sparkles, BookOpen } from 'lucide-react';

const DIFFICULTIES = [
  { value: 'senior', label: '高中' },
  { value: 'college', label: '大学' },
] as const;

interface MobileSlidesFormProps {
  topic: string;
  difficulty: 'junior' | 'senior' | 'college';
  generating: boolean;
  onTopicChange: (topic: string) => void;
  onDifficultyChange: (difficulty: 'junior' | 'senior' | 'college') => void;
  onGenerate: () => void;
}

export function MobileSlidesForm({
  topic,
  difficulty,
  generating,
  onTopicChange,
  onDifficultyChange,
  onGenerate,
}: MobileSlidesFormProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex min-h-full flex-col px-5 pt-6">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-sky-500/20 ring-1 ring-white/10">
            <BookOpen className="h-8 w-8 text-sky-300" />
          </div>
          <h1 className="text-2xl font-bold text-white">AI 课件生成</h1>
          <p className="mt-2 text-sm text-slate-400">输入主题，一键生成教学 PPT</p>
        </div>

        <div className="space-y-5">
          <div
            className={`
              rounded-[22px] border bg-[#0d1728] p-4 transition-all
              ${focused ? 'border-sky-500/50 ring-1 ring-sky-500/20' : 'border-white/10'}
            `}
          >
            <label className="block text-xs font-medium text-slate-400">课件主题</label>
            <textarea
              value={topic}
              onChange={(e) => onTopicChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="例如：中国非遗中的剪纸艺术"
              rows={3}
              className="mt-2 w-full resize-none bg-transparent text-base text-white placeholder:text-slate-600 focus:outline-none"
            />
          </div>

          <div className="rounded-[22px] border border-white/10 bg-[#0d1728] p-4">
            <label className="block text-xs font-medium text-slate-400">难度级别</label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => onDifficultyChange(d.value)}
                  className={`
                    rounded-xl px-3 py-2.5 text-sm font-medium transition-all
                    ${
                      difficulty === d.value
                        ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }
                  `}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onGenerate}
            disabled={generating || !topic.trim()}
            className={`
              flex w-full items-center justify-center gap-2 rounded-[22px] py-4 text-base font-bold text-white transition-all
              ${
                generating || !topic.trim()
                  ? 'cursor-not-allowed bg-slate-700 text-slate-400'
                  : 'bg-gradient-to-r from-violet-500 to-sky-500 shadow-lg shadow-violet-500/25 active:scale-[0.98]'
              }
            `}
          >
            <Sparkles className="h-5 w-5" />
            {generating ? '准备中…' : '生成课件'}
          </button>
        </div>
      </div>
    </div>
  );
}
