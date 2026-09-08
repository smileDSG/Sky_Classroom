'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Sparkles,
  Atom,
  BookOpen,
  FlaskConical,
  Pi,
  Brain,
  Dna,
  Landmark,
  Globe,
  Cpu,
} from 'lucide-react';

const HOT_TOPICS = [
  {
    label: '牛顿运动定律',
    icon: Atom,
    color: 'from-blue-500/20 to-cyan-500/20',
    accent: '#3b82f6',
  },
  {
    label: '光合作用',
    icon: FlaskConical,
    color: 'from-emerald-500/20 to-teal-500/20',
    accent: '#10b981',
  },
  { label: '勾股定理', icon: Pi, color: 'from-violet-500/20 to-purple-500/20', accent: '#8b5cf6' },
  { label: 'DNA 结构', icon: Dna, color: 'from-rose-500/20 to-pink-500/20', accent: '#f43f5e' },
  {
    label: '中国近代史',
    icon: Landmark,
    color: 'from-amber-500/20 to-orange-500/20',
    accent: '#f59e0b',
  },
  { label: '计算机原理', icon: Cpu, color: 'from-sky-500/20 to-indigo-500/20', accent: '#0ea5e9' },
] as const;

interface RegeneratePromptProps {
  currentTopic?: string;
  onGenerate: (topic: string) => void;
  onClose: () => void;
}

export function RegeneratePrompt({ currentTopic, onGenerate, onClose }: RegeneratePromptProps) {
  const [customTopic, setCustomTopic] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const topic = customTopic.trim();
    if (topic) onGenerate(topic);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#0b0f19]/90 backdrop-blur-md" onClick={onClose} />

      {/* Card */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111827]/80 shadow-2xl"
      >
        {/* Top gradient line */}
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.08]">
              <Sparkles size={14} className="text-white/50" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white/80">生成新课件</h3>
              {currentTopic && <p className="text-[11px] text-white/30">当前：{currentTopic}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition-all hover:bg-white/[0.05] hover:text-white/60"
          >
            <X size={15} />
          </button>
        </div>

        {/* Hot topics grid */}
        <div className="px-6 pb-2">
          <p className="text-[11px] font-medium text-white/25 uppercase tracking-wider mb-2.5">
            热门主题
          </p>
          <div className="grid grid-cols-3 gap-2">
            {HOT_TOPICS.map((t, i) => {
              const Icon = t.icon;
              return (
                <motion.button
                  key={t.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => onGenerate(t.label)}
                  className="group relative flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.04] bg-white/[0.02] p-3 transition-all duration-300 hover:bg-white/[0.06] hover:border-white/[0.1] hover:scale-[1.02]"
                >
                  {/* Hover glow */}
                  <div
                    className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md"
                    style={{
                      background: `radial-gradient(circle at center, ${t.accent}15, transparent 70%)`,
                    }}
                  />
                  <div
                    className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br border border-white/[0.06]"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${t.accent}15, transparent)`,
                    }}
                  >
                    <Icon size={15} style={{ color: t.accent }} />
                  </div>
                  <span className="relative text-[11px] text-white/40 group-hover:text-white/60 transition-colors">
                    {t.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Custom input */}
        <form onSubmit={handleSubmit} className="px-6 pb-5 pt-3">
          <p className="text-[11px] font-medium text-white/25 uppercase tracking-wider mb-2">
            自定义主题
          </p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="输入任意教学主题…"
                className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3.5 py-2 text-sm text-white/70 placeholder:text-white/20 focus:outline-none focus:border-white/[0.15] focus:bg-white/[0.05] transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={!customTopic.trim()}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.08] border border-white/[0.1] px-4 text-[11px] font-medium text-white/70 transition-all hover:bg-white/[0.14] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Sparkles size={13} />
              生成
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
