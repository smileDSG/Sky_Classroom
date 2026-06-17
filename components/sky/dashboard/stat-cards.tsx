// components/sky/dashboard/stat-cards.tsx
'use client';

import Link from 'next/link';
import type { MistakeRecord } from '@/lib/mistakes/types';
import { buildKnowledgeGraph, getMasterySummary } from '@/lib/knowledge-graph';
import { useAnimatedNumber } from '@/lib/hooks/use-animated-number';
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, BookOpen, BarChart3, Sparkles, Clock } from 'lucide-react';

// ── Cause label map ─────────────────────────────────────────────────

const causeLabels: Record<string, string> = {
  'concept-unclear': '概念不清',
  'calculation-error': '计算失误',
  misreading: '审题错误',
  'method-wrong': '方法错误',
  careless: '粗心',
  'format-error': '格式错误',
};

const causeColors: Record<string, string> = {
  'concept-unclear': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'calculation-error': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  misreading: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'method-wrong': 'bg-red-500/20 text-red-400 border-red-500/30',
  careless: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'format-error': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

// ── Relative time helper ────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 1000 / 60);
  const diffHour = Math.floor(diffMs / 1000 / 60 / 60);
  const diffDay = Math.floor(diffMs / 1000 / 60 / 60 / 24);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 30) return `${diffDay}天前`;
  return `${Math.floor(diffDay / 30)}个月前`;
}

// ── RingProgress SVG ────────────────────────────────────────────────

function RingProgress({
  percent,
  size = 48,
  color = '#8B5CF6',
}: {
  percent: number;
  size?: number;
  color?: string;
}) {
  const r = 18;
  const circumference = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        className="stroke-slate-300 dark:stroke-slate-600"
        strokeWidth={3}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference - (percent / 100) * circumference }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

// ── StatCards ───────────────────────────────────────────────────────

function isToday(date: Date): boolean {
  const d = new Date(date);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

interface StatCardsProps {
  mistakes: MistakeRecord[];
}

export function StatCards({ mistakes }: StatCardsProps) {
  const todayCount = mistakes.filter((m) => isToday(m.solvedAt)).length;
  const toReviewCount = mistakes.filter((m) => !m.reviewed).length;
  const reviewedCount = mistakes.filter((m) => m.reviewed).length;
  const masterySummary = useMemo(() => {
    if (mistakes.length === 0)
      return { overallMastery: 0, weakCount: 0, masteredCount: 0, totalCount: 0 };
    const graph = buildKnowledgeGraph(mistakes);
    return getMasterySummary(graph);
  }, [mistakes]);
  const masteryPercent = masterySummary.overallMastery;

  const animToday = useAnimatedNumber(todayCount, { duration: 1200 });
  const animReview = useAnimatedNumber(toReviewCount, { duration: 1200 });
  const animMastery = useAnimatedNumber(masteryPercent, { duration: 1500 });

  const cards = [
    {
      label: '今日搜题',
      value: Math.round(animToday.value),
      color: '#8B5CF6',
      gradient: 'from-violet-500/15 to-purple-500/15',
      icon: <Search className="w-4 h-4 text-violet-400" />,
      ringPercent: Math.min(todayCount, 100),
      pulse: todayCount > 0,
    },
    {
      label: '错题待复习',
      value: Math.round(animReview.value),
      color: '#F59E0B',
      gradient: 'from-amber-500/15 to-orange-500/15',
      icon: <BookOpen className="w-4 h-4 text-amber-400" />,
      barPercent: mistakes.length > 0 ? Math.round((toReviewCount / mistakes.length) * 100) : 0,
    },
    {
      label: '知识掌握度',
      value: Math.round(animMastery.value),
      suffix: '%',
      color: '#10B981',
      gradient: 'from-emerald-500/15 to-green-500/15',
      icon: <BarChart3 className="w-4 h-4 text-emerald-400" />,
      ringPercent: masteryPercent,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="grid grid-cols-3 gap-3"
    >
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.08 }}
          whileHover={{ scale: 1.015, y: -1 }}
          className="group relative overflow-hidden rounded-xl border border-slate-200/50 dark:border-slate-700/40 bg-white/60 dark:bg-slate-900/40 px-4 py-3.5 backdrop-blur-sm transition-shadow hover:shadow-md hover:shadow-violet-500/5"
        >
          {/* Glow on hover */}
          <div
            className="absolute inset-0 rounded-xl bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none"
            style={{ backgroundImage: `linear-gradient(135deg, ${card.color}12, transparent)` }}
          />

          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {card.value}
                {card.suffix || ''}
              </div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{card.label}</div>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              {card.pulse && (
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-violet-400"
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
              {card.ringPercent !== undefined && (
                <RingProgress percent={card.ringPercent} color={card.color} size={40} />
              )}
            </div>
          </div>

          {/* Progress bar for review card */}
          {'barPercent' in card && (
            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                initial={{ width: 0 }}
                animate={{ width: `${card.barPercent}%` }}
                transition={{ duration: 1, delay: 0.3 }}
              />
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}

// ── QuickActions ────────────────────────────────────────────────────

const actions = [
  {
    icon: Search,
    label: '拍照搜题',
    href: '/sky/solve',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 hover:bg-violet-500/20',
  },
  {
    icon: BookOpen,
    label: '幻灯片讲解',
    href: '/sky/slides',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10 hover:bg-cyan-500/20',
  },
  {
    icon: BarChart3,
    label: '学习数据',
    href: '/sky/learning',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
  },
  {
    icon: Sparkles,
    label: 'AI 助手',
    href: '/sky/assistant',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 hover:bg-amber-500/20',
  },
];

export function QuickActions() {
  return (
    <div className="flex gap-3">
      {actions.map((action, i) => (
        <motion.div
          key={action.label}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + i * 0.08 }}
        >
          <Link
            href={action.href}
            className={`flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700/50 px-4 py-3 ${action.bg} backdrop-blur-sm transition-all hover:scale-[1.03] hover:border-slate-300 dark:hover:border-slate-600/50`}
          >
            <action.icon className={`w-5 h-5 ${action.color}`} />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {action.label}
            </span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

// ── ActivityTimeline ────────────────────────────────────────────────

interface ActivityTimelineProps {
  mistakes: MistakeRecord[];
}

export function ActivityTimeline({ mistakes }: ActivityTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const recentMistakes = useMemo(() => {
    const seen = new Set<string>();
    return mistakes
      .filter((m) => {
        if (!m.id || seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      })
      .sort((a, b) => new Date(b.solvedAt).getTime() - new Date(a.solvedAt).getTime())
      .slice(0, 5);
  }, [mistakes]);

  if (recentMistakes.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center rounded-xl border border-slate-200/50 dark:border-slate-700/30 bg-white/50 dark:bg-slate-900/40 px-4 py-6 backdrop-blur-sm"
      >
        <Sparkles className="w-6 h-6 text-slate-400 mb-2" />
        <p className="text-slate-500 text-xs">还没有学习活动，去搜题页开始练习吧！</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="group relative overflow-hidden rounded-xl border border-slate-200/50 dark:border-slate-700/30 bg-white/50 dark:bg-slate-900/40 px-4 py-3.5 backdrop-blur-sm"
    >
      {/* Decorative gradient on hover */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-violet-400/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-violet-400/8 transition-colors duration-500" />

      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/10">
          <Clock className="w-3 h-3 text-violet-500" />
        </div>
        最近活动
        <span className="ml-auto text-[9px] font-normal text-slate-400 bg-slate-100/80 dark:bg-slate-800/60 px-1.5 py-0.5 rounded-full">
          最近 {recentMistakes.length} 条
        </span>
      </h3>
      <ul className="space-y-0.5">
        {recentMistakes.map((m, i) => {
          const isExpanded = expandedId === m.id;
          return (
            <li key={m.id || `timeline-${i}`}>
              <div
                className="flex items-center gap-2.5 text-xs cursor-pointer rounded-lg px-2 py-1.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : m.id)}
              >
                {/* Timeline dot + line */}
                <div className="relative flex flex-col items-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-violet-500 ring-3 ring-violet-500/15" />
                  {i < recentMistakes.length - 1 && (
                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-700/60" />
                  )}
                </div>

                <span className="shrink-0 w-14 text-right text-[10px] text-slate-400">
                  {formatRelativeTime(m.solvedAt)}
                </span>
                <span className="flex-1 truncate text-slate-600 dark:text-slate-300">
                  {m.problem.length > 50 ? m.problem.slice(0, 50) + '...' : m.problem}
                </span>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${causeColors[m.cause] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/25'}`}
                >
                  {causeLabels[m.cause] ?? m.cause}
                </span>
              </div>

              {/* Expanded details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden ml-8"
                  >
                    <div className="mt-1.5 mb-1 rounded-lg border border-slate-200/60 dark:border-slate-700/40 bg-slate-50/60 dark:bg-slate-800/40 p-2.5 text-[11px] space-y-1.5">
                      <div className="text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400">题目：</span>
                        {m.problem.length > 100 ? m.problem.slice(0, 100) + '...' : m.problem}
                      </div>
                      <div className="flex gap-3">
                        <div>
                          <span className="text-slate-400">我的答案：</span>
                          <span className="text-red-500 dark:text-red-400">{m.userAnswer || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">正确答案：</span>
                          <span className="text-emerald-600 dark:text-emerald-400">{m.correctAnswer || '—'}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-0.5">
                        <Link
                          href={`/sky/learning?tab=review&highlight=${m.id}`}
                          className="rounded-md bg-violet-500/8 hover:bg-violet-500/15 px-2.5 py-1 text-[10px] font-medium text-violet-700 dark:text-violet-400 transition-colors"
                        >
                          去复习
                        </Link>
                        <Link
                          href={`/sky/learning?tab=mistakes&highlight=${m.id}`}
                          className="rounded-md bg-slate-500/8 hover:bg-slate-500/15 px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-400 transition-colors"
                        >
                          查看详情
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}
