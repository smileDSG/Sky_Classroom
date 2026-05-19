'use client';

import { useState, useMemo } from 'react';
import type { MistakeCause } from '@/lib/solve/types';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';

// ── Cause label & colour maps ────────────────────────────────────────

const causeLabels: Record<MistakeCause, string> = {
  'concept-unclear': '概念不清',
  'calculation-error': '计算失误',
  'misreading': '审题错误',
  'method-wrong': '方法错误',
  'careless': '粗心',
  'format-error': '格式错误',
};

const causeBadgeColors: Record<MistakeCause, string> = {
  'concept-unclear': 'bg-purple-100 text-purple-700',
  'calculation-error': 'bg-orange-100 text-orange-700',
  'misreading': 'bg-blue-100 text-blue-700',
  'method-wrong': 'bg-red-100 text-red-700',
  'careless': 'bg-yellow-100 text-yellow-700',
  'format-error': 'bg-gray-100 text-gray-700',
};

const allCauses: MistakeCause[] = [
  'concept-unclear',
  'calculation-error',
  'misreading',
  'method-wrong',
  'careless',
  'format-error',
];

// ── Helpers ───────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  const d = new Date(date);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// ── Component ─────────────────────────────────────────────────────────

export function MistakeBook() {
  const { mistakes, markReviewed, setFilter, deleteMistake } =
    useSkyClassroomStore();

  // Compound local filter state (store only holds a single union filter)
  const [causeFilter, setCauseFilter] = useState<MistakeCause | null>(null);
  const [reviewedFilter, setReviewedFilter] = useState<
    'all' | 'reviewed' | 'unreviewed'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Apply filters locally ──────────────────────────────────────────

  const filtered = useMemo(() => {
    return mistakes.filter((m) => {
      if (causeFilter && m.cause !== causeFilter) return false;
      if (reviewedFilter === 'reviewed' && !m.reviewed) return false;
      if (reviewedFilter === 'unreviewed' && m.reviewed) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesProblem = m.problem.toLowerCase().includes(q);
        const matchesKP = m.knowledgePoints.some((kp) =>
          kp.toLowerCase().includes(q),
        );
        if (!matchesProblem && !matchesKP) return false;
      }
      return true;
    });
  }, [mistakes, causeFilter, reviewedFilter, searchQuery]);

  const hasActiveFilters =
    causeFilter !== null || reviewedFilter !== 'all' || searchQuery.trim() !== '';

  // ── Filter handlers (sync to store) ─────────────────────────────────

  const handleCauseChange = (cause: MistakeCause | null) => {
    setCauseFilter(cause);
    setFilter(cause ? { type: 'cause', value: cause } : null);
  };

  const handleReviewedChange = (value: 'all' | 'reviewed' | 'unreviewed') => {
    setReviewedFilter(value);
    if (value === 'reviewed') {
      setFilter({ type: 'reviewed', value: true });
    } else if (value === 'unreviewed') {
      setFilter({ type: 'reviewed', value: false });
    } else {
      setFilter(null);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setFilter(
      query.trim() ? { type: 'knowledgePoint', value: query.trim() } : null,
    );
  };

  const handleClearFilters = () => {
    setCauseFilter(null);
    setReviewedFilter('all');
    setSearchQuery('');
    setFilter(null);
  };

  // ── Empty state ─────────────────────────────────────────────────────

  if (mistakes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg bg-white p-12 shadow-sm">
        <div className="text-6xl">📖</div>
        <h3 className="mt-4 text-lg font-semibold text-gray-700">
          还没有错题记录
        </h3>
        <p className="mt-2 text-sm text-gray-400">
          去搜题页练习一下吧！
        </p>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Filter bar ── */}
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Cause filter chips */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleCauseChange(null)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !causeFilter
                  ? 'bg-[#4A90D9] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              全部错因
            </button>
            {allCauses.map((cause) => (
              <button
                key={cause}
                onClick={() => handleCauseChange(cause)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  causeFilter === cause
                    ? 'bg-[#4A90D9] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {causeLabels[cause]}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-gray-200" />

          {/* Review status filter */}
          <div className="flex gap-1.5">
            {(['all', 'unreviewed', 'reviewed'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => handleReviewedChange(opt)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  reviewedFilter === opt
                    ? 'bg-[#4A90D9] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt === 'all' ? '全部' : opt === 'unreviewed' ? '未复习' : '已复习'}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-gray-200" />

          {/* Knowledge-point search input */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜索知识点..."
            className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-700 placeholder-gray-400 outline-none transition-colors focus:border-[#4A90D9]"
          />

          {/* Clear filters button */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="rounded-full px-3 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50"
            >
              清除筛选
            </button>
          )}

          {/* Result count */}
          <span className="ml-auto text-xs text-gray-400">
            {filtered.length} / {mistakes.length} 条
          </span>
        </div>
      </div>

      {/* ── Mistake list ── */}
      {filtered.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <p className="text-gray-400">当前筛选条件下没有错题</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <div
              key={m.id}
              className={`rounded-lg bg-white p-4 shadow-sm transition-opacity ${
                m.reviewed ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {/* Problem — 2-line clamp */}
                  <p className="line-clamp-2 text-sm font-medium text-gray-800">
                    {m.problem}
                  </p>

                  {/* User answer (red) + correct answer (green) */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="text-red-500">
                      我的答案：{m.userAnswer}
                    </span>
                    <span className="text-[#10B981]">
                      正确答案：{m.correctAnswer}
                    </span>
                  </div>

                  {/* Badges row */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${causeBadgeColors[m.cause]}`}
                    >
                      {causeLabels[m.cause]}
                    </span>
                    {m.knowledgePoints.map((kp) => (
                      <span
                        key={kp}
                        className="inline-block rounded bg-[#E8F4FD] px-2 py-0.5 text-xs text-[#4A90D9]"
                      >
                        {kp}
                      </span>
                    ))}
                    <span className="text-xs text-gray-400">
                      {formatDate(m.solvedAt)}
                    </span>
                    {m.reviewed && (
                      <span className="inline-block rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">
                        已复习 ×{m.reviewCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex shrink-0 flex-col gap-2">
                  {!m.reviewed && (
                    <button
                      onClick={() => markReviewed(m.id)}
                      className="whitespace-nowrap rounded-lg bg-[#10B981] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-600"
                    >
                      已掌握
                    </button>
                  )}
                  <button
                    onClick={() => deleteMistake(m.id)}
                    className="whitespace-nowrap rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-100"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
