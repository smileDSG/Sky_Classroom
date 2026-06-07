'use client';

import { motion } from 'motion/react';
import { Sparkles, BookOpen, GraduationCap, School } from 'lucide-react';
import { CelestialCanvas } from '../design-system/celestial-canvas';

interface EmptyStateProps {
  topic: string;
  difficulty: 'junior' | 'senior' | 'college';
  generating: boolean;
  onTopicChange: (t: string) => void;
  onDifficultyChange: (d: 'junior' | 'senior' | 'college') => void;
  onGenerate: () => void;
}

const DIFFICULTIES = [
  { value: 'junior' as const, label: '初中', icon: BookOpen },
  { value: 'senior' as const, label: '高中', icon: GraduationCap },
  { value: 'college' as const, label: '大学', icon: School },
];

export function EmptyState({
  topic,
  difficulty,
  generating,
  onTopicChange,
  onDifficultyChange,
  onGenerate,
}: EmptyStateProps) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-8 overflow-hidden">
      {/* Starfield background */}
      <CelestialCanvas starCount={100} parallax nebula grid horizonGlow />

      {/* Horizon light band */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-[35%] animate-horizon-glow"
        style={{
          background: 'linear-gradient(to top, rgba(255, 140, 105, 0.06), transparent)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="relative z-10 flex flex-col items-center gap-8 max-w-lg w-full px-6"
      >
        {/* Icon — Telescope aperture */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--celestial-starlight)]/10 bg-[var(--celestial-starlight)]/5 text-[var(--celestial-starlight)]">
          <Sparkles className="h-8 w-8" />
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-lg font-extrabold tracking-tight text-[var(--celestial-starlight)]">
            AI 智能课件生成
          </h2>
          <p className="mt-1.5 text-sm text-[var(--celestial-starlight)]/50">
            输入主题，AI 将自动规划大纲、设计排版并生成精美课件
          </p>
        </div>

        {/* Topic input — focus ring style */}
        <div className="w-full">
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--celestial-starlight)]/40">
            课件主题
          </label>
          <div className="group relative">
            <input
              type="text"
              value={topic}
              onChange={(e) => onTopicChange(e.target.value)}
              placeholder="例如：二次函数的图像与性质"
              className="w-full bg-transparent px-1 py-3 text-sm text-[var(--celestial-starlight)] placeholder:text-[var(--celestial-starlight)]/20 focus:outline-none"
            />
            {/* Bottom line */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-[var(--celestial-starlight)]/15 transition-colors duration-300 group-focus-within:bg-[var(--celestial-dawn)]/60" />
            {/* Glow on focus */}
            <div className="absolute bottom-0 left-1/2 h-px w-0 -translate-x-1/2 bg-[var(--celestial-dawn)] shadow-[0_0_20px_rgba(255,140,105,0.3)] transition-all duration-500 group-focus-within:w-full" />
            {/* Blinking cursor simulation via placeholder */}
            {!topic && (
              <div className="pointer-events-none absolute bottom-3.5 left-1 h-4 w-px bg-[var(--celestial-dawn)]/60 animate-pulse" />
            )}
          </div>
        </div>

        {/* Difficulty selector — observatory bands */}
        <div className="w-full">
          <label className="mb-3 block text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--celestial-starlight)]/40">
            观测波段 / 难度等级
          </label>
          <div className="flex items-center justify-center gap-10">
            {DIFFICULTIES.map((d) => {
              const Icon = d.icon;
              const isActive = difficulty === d.value;
              return (
                <button
                  key={d.value}
                  onClick={() => onDifficultyChange(d.value)}
                  className="group flex flex-col items-center gap-2.5"
                >
                  {/* Orb dot */}
                  <div className="relative flex h-5 w-5 items-center justify-center">
                    {isActive && (
                      <>
                        <span className="absolute inset-0 rounded-full bg-[var(--celestial-dawn)] animate-ping opacity-40" />
                        <span className="absolute inset-[-4px] rounded-full border border-[var(--celestial-dawn)]/30 animate-[ring-expand_2s_ease-out_infinite]" />
                      </>
                    )}
                    <div
                      className={`relative h-3 w-3 rounded-full transition-all duration-300 ${
                        isActive
                          ? 'bg-[var(--celestial-dawn)] shadow-[0_0_8px_rgba(255,140,105,0.5)]'
                          : 'border border-[var(--celestial-haze)] bg-transparent group-hover:border-[var(--celestial-starlight)]/30'
                      }`}
                    />
                  </div>
                  {/* Label */}
                  <div className="flex items-center gap-1.5">
                    <Icon className={`h-3.5 w-3.5 transition-colors duration-300 ${isActive ? 'text-[var(--celestial-dawn)]' : 'text-[var(--celestial-starlight)]/25 group-hover:text-[var(--celestial-starlight)]/50'}`} />
                    <span
                      className={`text-xs font-medium transition-colors duration-300 ${
                        isActive ? 'text-[var(--celestial-starlight)]' : 'text-[var(--celestial-starlight)]/30 group-hover:text-[var(--celestial-starlight)]/60'
                      }`}
                    >
                      {d.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Generate button */}
        <motion.button
          onClick={() => onGenerate()}
          disabled={generating || !topic.trim()}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="group relative w-full h-11 overflow-hidden rounded-xl border border-[var(--celestial-starlight)]/20 bg-transparent text-sm font-semibold text-[var(--celestial-starlight)] transition-all duration-300 hover:border-[var(--celestial-starlight)]/40 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-[var(--celestial-starlight)]/20"
        >
          {/* Sweep effect on hover */}
          <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-[var(--celestial-dawn)]/10 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />
          <span className="relative z-10 flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
            {generating ? '生成引擎启动中...' : '启动生成引擎'}
          </span>
        </motion.button>
      </motion.div>
    </div>
  );
}
