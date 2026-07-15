'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import type { MistakeCause } from '@/lib/solve/types';
import type { MistakeRecord } from '@/lib/mistakes/types';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { useTaskStore } from '@/lib/store/use-task-store';
import { addActiveTeachingJobEntry } from '@/lib/teaching/teaching-session';
import { ReviewSession } from './review-session';

/** Must match the Ebbinghaus intervals in storage/dao/mistakes.ts */
const EBBINGHAUS_INTERVALS_LENGTH = 6;

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
  'concept-unclear': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'calculation-error': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'misreading': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'method-wrong': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'careless': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  'format-error': 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300',
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
  const router = useRouter();
  const { mistakes, markReviewed, setFilter, deleteMistake } =
    useSkyClassroomStore();
  const [sessionItems, setSessionItems] = useState<MistakeRecord[] | null>(null);

  // Compound local filter state (store only holds a single union filter)
  const [causeFilter, setCauseFilter] = useState<MistakeCause | null>(null);
  const [reviewedFilter, setReviewedFilter] = useState<
    'all' | 'reviewed' | 'unreviewed'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Multi-select for mistake review teaching
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isTeachingLoading, setIsTeachingLoading] = useState(false);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  );

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  const hasActiveFilters =
    causeFilter !== null || reviewedFilter !== 'all' || searchQuery.trim() !== '';

  // ── Filter handlers (sync to store) ─────────────────────────────────

  const handleCauseChange = (cause: MistakeCause | null) => {
    setCauseFilter(cause);
    setPage(1);
    setFilter(cause ? { type: 'cause', value: cause } : null);
  };

  const handleReviewedChange = (value: 'all' | 'reviewed' | 'unreviewed') => {
    setReviewedFilter(value);
    setPage(1);
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
    setPage(1);
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

  // ── Multi-select handlers ───────────────────────────────────────────

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === paged.length && paged.length > 0) return new Set();
      return new Set(paged.map((m) => m.id));
    });
  }, [paged]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleMistakeReviewTeaching = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error('请至少选择一道错题');
      return;
    }
    setIsTeachingLoading(true);
    try {
      const res = await fetch('/api/sky/teaching/mistake-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mistakeIds: ids }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || '创建错题回溯授课失败');
        return;
      }
      const { jobId, topic, title } = data;
      addActiveTeachingJobEntry({ jobId, topic: title || topic });
      useTaskStore.getState().addTask({
        id: jobId,
        type: 'teaching',
        label: `错题回溯: ${(title || topic).slice(0, 20)}`,
        status: 'running',
        progress: 0,
        phase: '正在分析错题并生成教案...',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        jobId,
        resultRoute: '/sky/teaching',
      });
      toast.success('错题回溯授课已启动，即将跳转...');
      clearSelection();
      router.push('/sky/teaching');
    } catch {
      toast.error('网络错误，请稍后重试');
    } finally {
      setIsTeachingLoading(false);
    }
  }, [selectedIds, clearSelection, router]);

  // ── Session management ──────────────────────────────────────────────

  const closeSession = useCallback(() => {
    setSessionItems(null);
  }, []);

  // ── Empty state ─────────────────────────────────────────────────────

  if (mistakes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg bg-white p-12 shadow-sm dark:bg-slate-800">
        <div className="text-6xl">📖</div>
        <h3 className="mt-4 text-lg font-semibold text-gray-700 dark:text-slate-200">
          还没有错题记录
        </h3>
        <p className="mt-2 text-sm text-gray-400 dark:text-slate-400">
          去搜题页练习一下吧！
        </p>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Immersive Review Session */}
      {sessionItems && (
        <ReviewSession items={sessionItems} onClose={closeSession} />
      )}
      {/* ── Filter bar ── */}
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          {/* Cause filter chips */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleCauseChange(null)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !causeFilter
                  ? 'bg-[#4A90D9] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
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
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                }`}
              >
                {causeLabels[cause]}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-gray-200 dark:bg-slate-700" />

          {/* Review status filter */}
          <div className="flex gap-1.5">
            {(['all', 'unreviewed', 'reviewed'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => handleReviewedChange(opt)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  reviewedFilter === opt
                    ? 'bg-[#4A90D9] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                }`}
              >
                {opt === 'all' ? '全部' : opt === 'unreviewed' ? '未复习' : '已复习'}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-gray-200 dark:bg-slate-700" />

          {/* Knowledge-point search input */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜索知识点..."
            className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 px-3 py-1 text-xs text-gray-700 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 outline-none transition-colors focus:border-[#4A90D9]"
          />

          {/* Clear filters button */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="rounded-full px-3 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              清除筛选
            </button>
          )}

          {/* Result count */}
          <span className="ml-auto text-xs text-gray-400 dark:text-slate-400">
            {filtered.length} / {mistakes.length} 条
          </span>

          {/* Batch review button */}
          {filtered.filter((m) => !m.reviewed).length > 0 && (
            <button
              onClick={() => setSessionItems(filtered.filter((m) => !m.reviewed))}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              全部沉浸复习
            </button>
          )}
        </div>
      </div>

      {/* ── Batch action bar (multi-select) ── */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-3 shadow-sm dark:bg-slate-800">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 transition-colors hover:text-[#4A90D9] dark:text-slate-300 dark:hover:text-blue-300"
          >
            {selectedIds.size === paged.length && paged.length > 0 ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            全选
          </button>

          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-gray-500 dark:text-slate-400">
                已选 {selectedIds.size} 道
              </span>
              <button
                onClick={clearSelection}
                className="text-xs text-red-500 transition-colors hover:text-red-600 dark:text-red-400"
              >
                取消选择
              </button>
              <button
                onClick={handleMistakeReviewTeaching}
                disabled={isTeachingLoading}
                className="ml-auto flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#4A90D9] to-blue-600 px-4 py-2 text-xs font-medium text-white shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                <GraduationCap className="h-4 w-4" />
                {isTeachingLoading ? '生成中...' : '错题回溯授课'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Mistake list ── */}
      {filtered.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center shadow-sm dark:bg-slate-800">
          <p className="text-gray-400 dark:text-slate-400">当前筛选条件下没有错题</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paged.map((m, i) => (
            <div
              key={`${m.id}-${i}`}
              className={`rounded-lg bg-white p-4 shadow-sm transition-opacity dark:bg-slate-800 ${
                m.reviewed ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Checkbox */}
                <button
                  onClick={() => toggleSelect(m.id)}
                  className="mt-0.5 shrink-0 text-gray-400 transition-colors hover:text-[#4A90D9] dark:text-slate-500 dark:hover:text-blue-300"
                  aria-label={selectedIds.has(m.id) ? '取消选择' : '选择'}
                >
                  {selectedIds.has(m.id) ? (
                    <CheckSquare className="h-5 w-5 text-[#4A90D9] dark:text-blue-400" />
                  ) : (
                    <Square className="h-5 w-5" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  {/* Problem — 2-line clamp */}
                  <p className="line-clamp-2 text-sm font-medium text-gray-800 dark:text-slate-100">
                    {m.problem}
                  </p>

                  {/* User answer (red) + correct answer (green) */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="text-red-500 dark:text-red-400">
                      我的答案：{m.userAnswer}
                    </span>
                    <span className="text-[#10B981] dark:text-emerald-400">
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
                    {m.knowledgePoints.map((kp, ki) => (
                      <span
                        key={`${m.id}-kp-${ki}`}
                        className="inline-block rounded bg-[#E8F4FD] px-2 py-0.5 text-xs text-[#4A90D9] dark:bg-blue-900/30 dark:text-blue-300"
                      >
                        {kp}
                      </span>
                    ))}
                    <span className="text-xs text-gray-400 dark:text-slate-400">
                      {formatDate(m.solvedAt)}
                    </span>
                    {m.reviewed && (
                      <span className="inline-block rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600 dark:bg-green-900/30 dark:text-green-400">
                        已复习 ×{m.reviewCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex shrink-0 flex-col gap-2">
                  {!m.reviewed && (
                    <>
                      <button
                        onClick={() => markReviewed(m.id)}
                        className="whitespace-nowrap rounded-lg bg-[#10B981] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-600"
                      >
                        快速复习 {m.reviewCount}/{EBBINGHAUS_INTERVALS_LENGTH}
                      </button>
                      <button
                        onClick={() => setSessionItems([m])}
                        className="whitespace-nowrap rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:from-violet-700 hover:to-indigo-700"
                      >
                        沉浸复习
                      </button>
                    </>
                  )}
                  {m.reviewed && (
                    <span className="whitespace-nowrap rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-600 dark:bg-green-900/30 dark:text-green-400">
                      已掌握
                    </span>
                  )}
                  <button
                    onClick={() => deleteMistake(m.id)}
                    className="whitespace-nowrap rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3 shadow-sm dark:bg-slate-800">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
            <span>每页</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="rounded border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-xs text-gray-700 dark:text-slate-200 outline-none"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>{size} 条</option>
              ))}
            </select>
            <span>
              第 {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} 条，共 {filtered.length} 条
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={safePage <= 1}
              className="rounded px-2 py-1 text-xs text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              首页
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded px-2 py-1 text-xs text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              上一页
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => {
                if (totalPages <= 7) return true;
                if (p === 1 || p === totalPages) return true;
                if (Math.abs(p - safePage) <= 1) return true;
                return false;
              })
              .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis');
                acc.push(p);
                return acc;
              }, [])
              .map((item, i) =>
                item === 'ellipsis' ? (
                  <span key={`e${i}`} className="px-1 text-xs text-gray-400 dark:text-slate-500">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item as number)}
                    className={`min-w-[28px] rounded px-2 py-1 text-xs font-medium transition-colors ${
                      safePage === item
                        ? 'bg-[#4A90D9] text-white'
                        : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded px-2 py-1 text-xs text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              下一页
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={safePage >= totalPages}
              className="rounded px-2 py-1 text-xs text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              末页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
