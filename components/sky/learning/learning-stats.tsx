'use client';

import { useMemo } from 'react';
import type { MistakeCause } from '@/lib/solve/types';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import {
  buildKnowledgeGraph,
  getMasterySummary,
} from '@/lib/knowledge-graph';
import { inferSubject, getSubjectLabel } from '@/lib/mistakes/subject-inference';
import type { Subject } from '@/lib/mistakes/subject-inference';

// ── Cause label & colour maps ────────────────────────────────────────

const causeLabels: Record<MistakeCause, string> = {
  'concept-unclear': '概念不清',
  'calculation-error': '计算失误',
  'misreading': '审题错误',
  'method-wrong': '方法错误',
  'careless': '粗心',
  'format-error': '格式错误',
};

const causeBarColors: Record<MistakeCause, string> = {
  'concept-unclear': 'bg-purple-500',
  'calculation-error': 'bg-orange-500',
  'misreading': 'bg-blue-500',
  'method-wrong': 'bg-red-500',
  'careless': 'bg-yellow-500',
  'format-error': 'bg-gray-500',
};

const allCauses: MistakeCause[] = [
  'concept-unclear',
  'calculation-error',
  'misreading',
  'method-wrong',
  'careless',
  'format-error',
];

// ── SVG text styles (Tailwind doesn't work inside SVG) ──────────────
const SVG_TEXT_SM = { fontSize: '9px', fontFamily: 'system-ui, sans-serif' };
const SVG_TEXT_XS = { fontSize: '8px', fontFamily: 'system-ui, sans-serif' };

// ── Component ─────────────────────────────────────────────────────────

export function LearningStats() {
  const { mistakes } = useSkyClassroomStore();
  const memoryProgress = useSkyClassroomStore((s) => s.memoryProgress);

  // ── Compute stats from mistakes ─────────────────────────────────────

  const stats = useMemo(() => {
    const totalCount = mistakes.length;
    const reviewedCount = mistakes.filter((m) => m.reviewed).length;
    const reviewRate =
      totalCount > 0 ? Math.round((reviewedCount / totalCount) * 100) : 0;

    // Cause distribution
    const causeDist: Record<string, number> = {};
    for (const cause of allCauses) {
      causeDist[cause] = 0;
    }
    for (const m of mistakes) {
      causeDist[m.cause] = (causeDist[m.cause] ?? 0) + 1;
    }
    const maxCause = Math.max(...Object.values(causeDist), 1);

    // Weak-point count from knowledge graph
    let weakPointsCount = 0;
    if (mistakes.length > 0) {
      const graph = buildKnowledgeGraph(mistakes);
      const summary = getMasterySummary(graph);
      weakPointsCount = summary.weakCount;
    }

    return {
      totalCount,
      reviewedCount,
      reviewRate,
      causeDist,
      maxCause,
      weakPointsCount,
    };
  }, [mistakes]);

  // ── Time trend data (last 14 days) ──────────────────────────────
  const trendData = useMemo(() => {
    const now = new Date();
    const days: { date: string; total: number; reviewed: number }[] = [];

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;

      const dayMistakes = mistakes.filter((m) => {
        const t = new Date(m.solvedAt).getTime();
        return t >= dayStart && t < dayEnd;
      });

      days.push({
        date: dateStr,
        total: dayMistakes.length,
        reviewed: dayMistakes.filter((m) => m.reviewed).length,
      });
    }
    return days;
  }, [mistakes]);

  const trendMax = Math.max(...trendData.map((d) => d.total), 1);

  // ── Subject dimension stats ─────────────────────────────────────
  const subjectStats = useMemo(() => {
    const map = new Map<Subject, { total: number; reviewed: number }>();
    for (const m of mistakes) {
      for (const kp of m.knowledgePoints) {
        const subj = inferSubject(kp);
        const entry = map.get(subj) ?? { total: 0, reviewed: 0 };
        entry.total++;
        if (m.reviewed) entry.reviewed++;
        map.set(subj, entry);
      }
    }
    return [...map.entries()]
      .filter(([s]) => s !== 'unknown')
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([subject, data]) => ({
        subject,
        label: getSubjectLabel(subject),
        ...data,
        rate: data.total > 0 ? Math.round((data.reviewed / data.total) * 100) : 0,
      }));
  }, [mistakes]);

  const subjectMaxTotal = Math.max(...subjectStats.map((s) => s.total), 1);

  // ── Empty state ─────────────────────────────────────────────────────

  if (mistakes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg bg-white p-12 shadow-sm dark:bg-slate-800">
        <div className="text-6xl">📊</div>
        <h3 className="mt-4 text-lg font-semibold text-gray-700 dark:text-slate-200">
          还没有学习数据
        </h3>
        <p className="mt-2 text-sm text-gray-400 dark:text-slate-400">
          完成一些搜题练习后，这里会展示你的学习统计
        </p>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Stat cards (3-column grid) ── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Total mistakes */}
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800">
          <div className="text-3xl font-bold text-[#EF4444]">
            {stats.totalCount}
          </div>
          <div className="mt-1 text-sm text-gray-500 dark:text-slate-400">总错题数</div>
        </div>

        {/* Reviewed + review rate + progress bar */}
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800">
          <div className="text-3xl font-bold text-[#10B981]">
            {stats.reviewedCount}
            <span className="ml-1 text-lg font-normal text-gray-400">
              / {stats.totalCount}
            </span>
          </div>
          <div className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            已复习 · 复习率 {stats.reviewRate}%
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-[#10B981] transition-all duration-500"
              style={{ width: `${stats.reviewRate}%` }}
            />
          </div>
        </div>

        {/* Weak points count */}
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800">
          <div className="text-3xl font-bold text-[#F59E0B]">
            {stats.weakPointsCount}
          </div>
          <div className="mt-1 text-sm text-gray-500 dark:text-slate-400">薄弱知识点</div>
        </div>
      </div>

      {/* ── 14-day trend chart ── */}
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-200">
          最近 14 天错题趋势
        </h3>
        <svg viewBox="0 0 360 180" className="w-full" style={{ maxHeight: 180 }}>
          {/* Y-axis grid + labels */}
          {[0, Math.ceil(trendMax / 2), trendMax].map((pct) => {
            const y = 150 - (pct / trendMax) * 130;
            return (
              <g key={`y-${pct}`}>
                <line x1={36} y1={y} x2={346} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />
                <text x={30} y={y + 3} textAnchor="end" {...SVG_TEXT_XS} fill="#9ca3af">{pct}</text>
              </g>
            );
          })}
          {/* Axes */}
          <line x1={36} y1={20} x2={36} y2={150} stroke="#d1d5db" strokeWidth="1" />
          <line x1={36} y1={150} x2={346} y2={150} stroke="#d1d5db" strokeWidth="1" />

          {/* X-axis labels (every other day) */}
          {trendData.map((d, i) => {
            if (i % 2 !== 0 && i !== trendData.length - 1) return null;
            const x = 36 + (i / 13) * 310;
            return <text key={`x-${i}`} x={x} y={168} textAnchor="middle" {...SVG_TEXT_XS} fill="#6b7280">{d.date}</text>;
          })}

          {/* Total line (red) */}
          <polyline
            fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            points={trendData.map((d, i) => {
              const x = 36 + (i / 13) * 310;
              const y = 150 - (d.total / trendMax) * 130;
              return `${x},${y}`;
            }).join(' ')}
          />
          {/* Reviewed line (green) */}
          <polyline
            fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            points={trendData.map((d, i) => {
              const x = 36 + (i / 13) * 310;
              const y = 150 - (d.reviewed / trendMax) * 130;
              return `${x},${y}`;
            }).join(' ')}
          />

          {/* Data points */}
          {trendData.map((d, i) => {
            const x = 36 + (i / 13) * 310;
            return (
              <g key={`pt-${i}`}>
                {d.total > 0 && (
                  <circle cx={x} cy={150 - (d.total / trendMax) * 130} r="3" fill="#EF4444" stroke="#fff" strokeWidth="1" />
                )}
                {d.reviewed > 0 && (
                  <circle cx={x} cy={150 - (d.reviewed / trendMax) * 130} r="3" fill="#10B981" stroke="#fff" strokeWidth="1" />
                )}
              </g>
            );
          })}

          {/* Axis title */}
          <text x={191} y={178} textAnchor="middle" {...SVG_TEXT_XS} fill="#9ca3af">日期 →</text>
        </svg>

        {/* Legend */}
        <div className="mt-2 flex justify-center gap-4 text-xs text-gray-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[#EF4444]" />
            总错题
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[#10B981]" />
            已复习
          </span>
        </div>
      </div>

      {/* ── Subject dimension bar chart ── */}
      {subjectStats.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800">
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-200">
            学科错题分布
          </h3>
          <div className="space-y-2.5">
            {subjectStats.map((s) => {
              const pct = (s.total / subjectMaxTotal) * 100;
              return (
                <div key={s.subject} className="flex items-center gap-3">
                  <span className="w-10 shrink-0 text-right text-xs font-medium text-gray-600 dark:text-slate-300">
                    {s.label}
                  </span>
                  <div className="flex-1">
                    <div className="h-5 overflow-hidden rounded bg-gray-100 dark:bg-slate-700">
                      <div
                        className="h-full rounded bg-[#4A90D9] transition-all duration-500"
                        style={{ width: `${pct}%`, minWidth: s.total > 0 ? '4px' : '0' }}
                      />
                    </div>
                  </div>
                  <span className="w-12 shrink-0 text-xs font-medium text-gray-600 dark:text-slate-300">
                    {s.total}题
                  </span>
                  <span className="w-12 shrink-0 text-xs text-gray-400 dark:text-slate-500">
                    复习{s.rate}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Memory card progress */}
      {memoryProgress.totalFlipped > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🧠</span>
            <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">记忆卡片学习</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-[#EC4899]">{memoryProgress.totalFlipped}</div>
              <div className="text-xs text-gray-400">翻牌次数</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#8B5CF6]">{memoryProgress.topicCount}</div>
              <div className="text-xs text-gray-400">学习主题</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#06B6D4]">
                {memoryProgress.lastStudied ? new Date(memoryProgress.lastStudied).toLocaleDateString() : '-'}
              </div>
              <div className="text-xs text-gray-400">最近学习</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Cause distribution bar chart (pure CSS) ── */}
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800">
        <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-slate-200">错因分布</h3>
        <div className="space-y-2.5">
          {allCauses.map((cause) => {
            const count = stats.causeDist[cause] ?? 0;
            const pct =
              stats.maxCause > 0 ? (count / stats.maxCause) * 100 : 0;

            return (
              <div key={cause} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-right text-xs text-gray-500 dark:text-slate-400">
                  {causeLabels[cause]}
                </span>
                <div className="flex-1">
                  <div className="h-5 overflow-hidden rounded bg-gray-100 dark:bg-slate-700">
                    <div
                      className={`h-full rounded transition-all duration-500 ${causeBarColors[cause]}`}
                      style={{
                        width: `${pct}%`,
                        minWidth: count > 0 ? '4px' : '0',
                      }}
                    />
                  </div>
                </div>
                <span className="w-8 shrink-0 text-xs font-medium text-gray-600 dark:text-slate-300">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
