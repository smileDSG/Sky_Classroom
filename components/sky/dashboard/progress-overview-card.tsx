'use client';

/**
 * 进度概览卡（T02 / FR-05 首屏核心区 2）。
 *
 * 一行连续天数 + 掌握度% + 错题趋势摘要。克制、信息密度低，仅回答"我进步了吗"。
 * 数据全部来自真实记录：连续天数取自 streak 缓存/接口，掌握度取自知识图谱，
 * 错题取自本地错题本（不膨胀、不奖励）。
 */

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Flame, TrendingUp, Sparkles } from 'lucide-react';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { buildKnowledgeGraph, getMasterySummary } from '@/lib/knowledge-graph';
import { fetchStreakStateClient } from '@/lib/retention/streak-client';

interface ProgressOverviewCardProps {
  /** 紧凑模式（用于更多折叠内或移动端）。 */
  compact?: boolean;
}

export function ProgressOverviewCard({ compact = false }: ProgressOverviewCardProps) {
  const mistakes = useSkyClassroomStore((s) => s.mistakes);
  const streakCache = useSkyClassroomStore((s) => s.streakCache);

  // 首屏挂载时拉取连续天数（失败则用缓存/占位）
  useEffect(() => {
    let active = true;
    if (!streakCache) {
      void fetchStreakStateClient().then((state) => {
        if (active && state) useSkyClassroomStore.setState({ streakCache: state });
      });
    }
    return () => {
      active = false;
    };
  }, [streakCache]);

  const { masteryPercent, resolvedCount, total } = useMemo(() => {
    const graph = mistakes.length > 0 ? buildKnowledgeGraph(mistakes) : null;
    const summary = graph ? getMasterySummary(graph) : null;
    return {
      masteryPercent: summary?.overallMastery ?? null,
      resolvedCount: mistakes.filter((m) => m.reviewed).length,
      total: mistakes.length,
    };
  }, [mistakes]);

  const streak = streakCache?.currentStreak ?? null;
  const peak = streakCache?.peakStreak ?? null;

  return (
    <section
      data-tour-step="progress-overview"
      className="rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#0a1524] sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Sparkles className="h-4 w-4 text-sky-600 dark:text-sky-300" />
          进度概览
        </div>
        <Link
          href="/sky/learning"
          className="text-xs font-medium text-sky-700 hover:underline dark:text-sky-200"
        >
          查看学习分析
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {/* 连续天数（一行，轻） */}
        <div className="rounded-lg bg-slate-50 px-3 py-3 text-center dark:bg-white/[0.04]">
          <div className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
            <Flame className="h-4 w-4 text-orange-500" />
            {streak !== null ? streak : '—'}
          </div>
          <div className="mt-1 text-[11px] leading-tight text-slate-500 dark:text-slate-400">
            连续学习天
          </div>
        </div>

        {/* 掌握度% */}
        <div className="rounded-lg bg-slate-50 px-3 py-3 text-center dark:bg-white/[0.04]">
          <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
            {masteryPercent !== null ? `${masteryPercent}%` : '—'}
          </div>
          <div className="mt-1 text-[11px] leading-tight text-slate-500 dark:text-slate-400">
            平均掌握度
          </div>
        </div>

        {/* 错题趋势摘要 */}
        <div className="rounded-lg bg-slate-50 px-3 py-3 text-center dark:bg-white/[0.04]">
          <div className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            {resolvedCount}
            <span className="text-xs font-normal text-slate-400">/{total}</span>
          </div>
          <div className="mt-1 text-[11px] leading-tight text-slate-500 dark:text-slate-400">
            已攻克错题
          </div>
        </div>
      </div>

      {!compact && (
        <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {streak !== null && streak > 0
            ? `已连续学习 ${streak} 天，保持节奏就好。`
            : '今天先完成一道题，连续学习就从这一刻开始。'}
          {peak !== null && peak > 0 && streak !== peak && ` 历史最长 ${peak} 天。`}
        </p>
      )}
    </section>
  );
}
