'use client';

import { useMemo } from 'react';
import type { MistakeCause } from '@/lib/solve/types';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import {
  buildKnowledgeGraph,
  getMasterySummary,
} from '@/lib/mistakes/knowledge-graph';

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

// ── Component ─────────────────────────────────────────────────────────

export function LearningStats() {
  const { mistakes } = useSkyClassroomStore();

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

  // ── Empty state ─────────────────────────────────────────────────────

  if (mistakes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg bg-white p-12 shadow-sm">
        <div className="text-6xl">📊</div>
        <h3 className="mt-4 text-lg font-semibold text-gray-700">
          还没有学习数据
        </h3>
        <p className="mt-2 text-sm text-gray-400">
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
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="text-3xl font-bold text-[#EF4444]">
            {stats.totalCount}
          </div>
          <div className="mt-1 text-sm text-gray-500">总错题数</div>
        </div>

        {/* Reviewed + review rate + progress bar */}
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="text-3xl font-bold text-[#10B981]">
            {stats.reviewedCount}
            <span className="ml-1 text-lg font-normal text-gray-400">
              / {stats.totalCount}
            </span>
          </div>
          <div className="mt-1 text-sm text-gray-500">
            已复习 · 复习率 {stats.reviewRate}%
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-[#10B981] transition-all duration-500"
              style={{ width: `${stats.reviewRate}%` }}
            />
          </div>
        </div>

        {/* Weak points count */}
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="text-3xl font-bold text-[#F59E0B]">
            {stats.weakPointsCount}
          </div>
          <div className="mt-1 text-sm text-gray-500">薄弱知识点</div>
        </div>
      </div>

      {/* ── Cause distribution bar chart (pure CSS) ── */}
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">错因分布</h3>
        <div className="space-y-2.5">
          {allCauses.map((cause) => {
            const count = stats.causeDist[cause] ?? 0;
            const pct =
              stats.maxCause > 0 ? (count / stats.maxCause) * 100 : 0;

            return (
              <div key={cause} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-right text-xs text-gray-500">
                  {causeLabels[cause]}
                </span>
                <div className="flex-1">
                  <div className="h-5 overflow-hidden rounded bg-gray-100">
                    <div
                      className={`h-full rounded transition-all duration-500 ${causeBarColors[cause]}`}
                      style={{
                        width: `${pct}%`,
                        minWidth: count > 0 ? '4px' : '0',
                      }}
                    />
                  </div>
                </div>
                <span className="w-8 shrink-0 text-xs font-medium text-gray-600">
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
