'use client';

import { useMemo, useState, useEffect } from 'react';
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
  const [memoryProgress, setMemoryProgress] = useState<{ totalFlipped: number; topicCount: number; lastStudied: number | null }>({ totalFlipped: 0, topicCount: 0, lastStudied: null });

  useEffect(() => {
    try {
      const raw = localStorage.getItem('memory-progress');
      if (raw) {
        const data = JSON.parse(raw);
        setMemoryProgress({
          totalFlipped: data.totalFlipped || 0,
          topicCount: data.topics ? Object.keys(data.topics).length : 0,
          lastStudied: data.lastStudied || null,
        });
      }
    } catch { /* ignore */ }
  }, []);

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
