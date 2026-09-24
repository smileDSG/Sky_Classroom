'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  CheckSquare,
  GraduationCap,
  Square,
  Target,
} from 'lucide-react';
import { toast } from 'sonner';
import type { MistakeCause } from '@/lib/solve/types';
import type { MistakeRecord, MistakeReviewResult } from '@/lib/mistakes/types';
import type { PersonalizationContext } from '@/lib/cloud-mind/types';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { useTaskStore } from '@/lib/store/use-task-store';
import { addActiveTeachingJobEntry } from '@/lib/teaching/teaching-session';
import { MathRenderer } from '@/components/sky/solve/math-renderer';
import { ReviewSession } from './review-session';
import {
  BookDoodle,
  GraphPaperBg,
  PencilDoodle,
  SunDoodle,
} from '@/components/sky/pattern/sky-doodles';

/** Must match the Ebbinghaus intervals in storage/dao/mistakes.ts */
const EBBINGHAUS_INTERVALS_LENGTH = 6;

// ── Cause label & colour maps ────────────────────────────────────────

const causeLabels: Record<MistakeCause, string> = {
  'concept-unclear': '概念不清',
  'calculation-error': '计算失误',
  misreading: '审题错误',
  'method-wrong': '方法错误',
  careless: '粗心',
  'format-error': '格式错误',
};

const causeBadgeColors: Record<MistakeCause, string> = {
  'concept-unclear': 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  'calculation-error': 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  misreading: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'method-wrong': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  careless: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
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

function getProfilePriority(
  mistake: MistakeRecord,
  targetTopic?: string,
): { label: string; reason: string; className: string } {
  if (mistake.reviewed) {
    return {
      label: '已完成',
      reason: '这道题已完成当前复习轮次',
      className: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    };
  }
  const matchesTarget = Boolean(
    targetTopic && mistake.knowledgePoints.some((point) => point === targetTopic),
  );
  if (matchesTarget || mistake.reviewCount >= 2) {
    return {
      label: '高优先级',
      reason: matchesTarget ? `命中当前薄弱点「${targetTopic}」` : '重复出现，需要优先回看',
      className: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    };
  }
  return {
    label: '待处理',
    reason: '尚未完成复习，建议今天处理',
    className: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  };
}

function formatMastery(value: number | null): string {
  return value === null ? '暂无' : `${Math.round(value * 100)}%`;
}

function getReviewNextTarget(result: MistakeReviewResult): { href: string; label: string } {
  const decision = result.profileUpdate.learnerDecision;
  const topic = decision.topic ? `?topic=${encodeURIComponent(decision.topic)}` : '';
  if (decision.action === 'teach') {
    return { href: `/sky/cloud-mind/teaching${topic}`, label: '按最新学习情况补课' };
  }
  if (decision.action === 'review') {
    return { href: `/sky/cloud-mind/memory${topic}`, label: '继续个性化复习' };
  }
  return {
    href: `/sky/cloud-mind/quiz${topic}`,
    label: decision.action === 'diagnostic' ? '做一道确认题' : '进入针对练习',
  };
}

// ── Component ─────────────────────────────────────────────────────────

export function MistakeBook() {
  const router = useRouter();
  const { mistakes, markReviewed, setFilter, deleteMistake } = useSkyClassroomStore();
  const [sessionItems, setSessionItems] = useState<MistakeRecord[] | null>(null);
  const [personalization, setPersonalization] = useState<PersonalizationContext | null>(null);
  const [quickReviewResult, setQuickReviewResult] = useState<MistakeReviewResult | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // Compound local filter state (store only holds a single union filter)
  const [causeFilter, setCauseFilter] = useState<MistakeCause | null>(null);
  const [reviewedFilter, setReviewedFilter] = useState<'all' | 'reviewed' | 'unreviewed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Multi-select for mistake review teaching
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isTeachingLoading, setIsTeachingLoading] = useState(false);

  const targetTopic =
    personalization?.toolPolicies?.learningPath.targetTopic ??
    personalization?.learnerDecision?.topic ??
    personalization?.tutoringPolicy?.targetTopic ??
    personalization?.weakPoints[0]?.knowledgePoint;

  const refreshPersonalization = useCallback(() => {
    return fetch('/api/sky/cloud-mind/personalization-context', {
      credentials: 'include',
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.data) setPersonalization(data.data as PersonalizationContext);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    void refreshPersonalization();
  }, [refreshPersonalization]);

  const handleQuickReview = useCallback(
    async (mistake: MistakeRecord) => {
      setReviewingId(mistake.id);
      const result = await markReviewed(mistake.id, true);
      setReviewingId(null);
      if (!result) {
        toast.warning('本地复习进度已更新，但学习情况同步失败');
        return;
      }
      setQuickReviewResult(result);
      await refreshPersonalization();
      toast.success('复习结果已记录到学习情况');
    },
    [markReviewed, refreshPersonalization],
  );

  // ── Apply filters locally ──────────────────────────────────────────

  const filtered = useMemo(() => {
    return mistakes.filter((m) => {
      if (causeFilter && m.cause !== causeFilter) return false;
      if (reviewedFilter === 'reviewed' && !m.reviewed) return false;
      if (reviewedFilter === 'unreviewed' && m.reviewed) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesProblem = m.problem.toLowerCase().includes(q);
        const matchesKP = m.knowledgePoints.some((kp) => kp.toLowerCase().includes(q));
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
    setFilter(query.trim() ? { type: 'knowledgePoint', value: query.trim() } : null);
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

  // Auto-scroll to the review session when it's triggered
  useEffect(() => {
    if (sessionItems) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [sessionItems]);

  // ── Empty state ─────────────────────────────────────────────────────

  if (mistakes.length === 0) {
    return (
      <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-lg bg-white p-12 shadow-sm dark:bg-slate-800">
        <GraphPaperBg className="opacity-50" />
        <div className="pointer-events-none absolute bottom-4 right-7 hidden select-none text-sky-500/35 dark:text-sky-200/25 md:flex md:items-end md:gap-2" aria-hidden="true">
          <PencilDoodle className="h-9 w-9 -rotate-6" />
          <BookDoodle className="h-10 w-12 translate-y-1" />
        </div>
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10">
          <BookOpen className="h-8 w-8 text-sky-500" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-700 dark:text-slate-200">
          还没有错题记录
        </h3>
        <p className="mt-2 text-sm text-gray-400 dark:text-slate-400">去搜题页练习一下吧！</p>
        <div className="pointer-events-none absolute left-8 top-5 hidden select-none text-sky-500/30 dark:text-sky-200/20 md:block" aria-hidden="true">
          <SunDoodle className="h-8 w-8 rotate-6" />
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 dark:border-sky-900/60 dark:bg-sky-950/25 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <Brain className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" />
          <div>
            <p className="text-xs font-bold text-sky-800 dark:text-sky-200">
              正在按你的情况筛选错题
            </p>
            <p className="mt-0.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
              {targetTopic
                ? `当前薄弱点：${targetTopic}。命中它的错题会标为高优先级。`
                : '完成练习后，系统会按掌握情况和重复错误自动排序。'}
            </p>
          </div>
        </div>
        <Link
          href={
            targetTopic
              ? `/sky/cloud-mind/quiz?topic=${encodeURIComponent(targetTopic)}`
              : '/sky/cloud-mind/quiz?mode=diagnostic'
          }
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-sky-500"
        >
          <Target className="h-3.5 w-3.5" />
          {targetTopic ? '针对薄弱点出题' : '先做入门练习'}
        </Link>
      </div>

      {quickReviewResult && (
        <div className="rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 via-sky-50 to-sky-50 p-4 shadow-sm dark:border-sky-200/15 dark:from-sky-950/35 dark:via-sky-950/30 dark:to-sky-950/30 dark:shadow-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white shadow-lg shadow-sky-500/20">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  快速复习已记录到学习情况
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {quickReviewResult.profileUpdate.learnerDecision.summary}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setQuickReviewResult(null)}
              className="self-start text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              收起
            </button>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {quickReviewResult.profileUpdate.changes.slice(0, 4).map((change) => (
              <div
                key={change.knowledgePoint}
                className="rounded-xl border border-white/80 bg-white/75 px-3 py-2 dark:border-white/[0.07] dark:bg-white/[0.05]"
              >
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  {change.knowledgePoint}
                </div>
                <div className="mt-1 text-sm font-bold text-sky-600 dark:text-sky-300">
                  掌握情况 {formatMastery(change.masteryBefore)} →{' '}
                  {formatMastery(change.masteryAfter)}
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                  记录数 {change.evidenceCountBefore} → {change.evidenceCountAfter}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-white dark:bg-sky-200 dark:text-slate-950">
            <span className="text-xs font-semibold">
              新目标：{quickReviewResult.profileUpdate.learnerDecision.topic ?? '继续积累学习记录'}
            </span>
            <Link
              href={getReviewNextTarget(quickReviewResult).href}
              className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1.5 text-[10px] font-semibold hover:bg-white/20 dark:bg-slate-950 dark:text-white"
            >
              {getReviewNextTarget(quickReviewResult).label}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
      {/* Immersive Review Session */}
      {sessionItems && <ReviewSession items={sessionItems} onClose={closeSession} />}
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
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-md transition-all hover:from-sky-600 hover:to-blue-700 hover:shadow-lg hover:-translate-y-0.5"
            >
              全部沉浸复习
            </button>
          )}
        </div>
      </div>

      {/* ── Batch action bar (appears once something is selected) ── */}
      {selectedIds.size > 0 && (
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
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-xs font-medium text-white shadow-md transition-all hover:from-sky-600 hover:to-blue-700 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <GraduationCap className="h-4 w-4" />
            {isTeachingLoading ? '生成中...' : '错题回溯授课'}
          </button>
        </div>
      )}

      {/* ── Mistake list ── */}
      {filtered.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center shadow-sm dark:bg-slate-800">
          <p className="text-gray-400 dark:text-slate-400">当前筛选条件下没有错题</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paged.map((m, i) => {
            const priority = getProfilePriority(m, targetTopic);
            const accent =
              m.reviewed
                ? 'border-l-sky-400'
                : priority.label === '高优先级'
                  ? 'border-l-rose-400'
                  : 'border-l-blue-400';
            return (
              <div
                key={`${m.id}-${i}`}
                title={priority.reason}
                className={`rounded-xl border border-l-4 bg-white p-4 shadow-sm transition-opacity dark:bg-slate-800 ${accent} ${
                  m.reviewed ? 'opacity-70' : ''
                }`}
              >
                {/* Meta row: select · priority · cause · date */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => toggleSelect(m.id)}
                    className="shrink-0 rounded-md text-gray-400 transition-colors hover:text-[#4A90D9] dark:text-slate-500 dark:hover:text-blue-300"
                    aria-label={selectedIds.has(m.id) ? '取消选择' : '选择'}
                  >
                    {selectedIds.has(m.id) ? (
                      <CheckSquare className="h-5 w-5 text-[#4A90D9] dark:text-blue-400" />
                    ) : (
                      <Square className="h-5 w-5" />
                    )}
                  </button>
                  <span
                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold ${priority.className}`}
                  >
                    {priority.label}
                  </span>
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${causeBadgeColors[m.cause]}`}
                  >
                    {causeLabels[m.cause]}
                  </span>
                  {m.reviewed && (
                    <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      已复习 ×{m.reviewCount}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-gray-400 dark:text-slate-500">
                    {formatDate(m.solvedAt)}
                  </span>
                </div>

                {/* Problem — 2-line clamp */}
                <div className="mt-3 line-clamp-2 text-[15px] font-semibold leading-relaxed text-gray-800 dark:text-slate-100">
                  <MathRenderer content={m.problem} />
                </div>

                {/* My / correct answer — labeled split blocks */}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-6">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-bold text-red-500 dark:bg-red-900/30">
                      我的
                    </span>
                    <span className="text-sm text-red-500 dark:text-red-400">
                      <MathRenderer content={m.userAnswer} />
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-bold text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
                      正确
                    </span>
                    <span className="text-sm font-medium text-sky-600 dark:text-sky-400">
                      <MathRenderer content={m.correctAnswer} />
                    </span>
                  </div>
                </div>

                {/* Knowledge points */}
                {m.knowledgePoints.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {m.knowledgePoints.map((kp, ki) => (
                      <span
                        key={`${m.id}-kp-${ki}`}
                        className="inline-block rounded bg-[#E8F4FD] px-2 py-0.5 text-xs text-[#4A90D9] dark:bg-blue-900/30 dark:text-blue-300"
                      >
                        {kp}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer actions */}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-700/60">
                  {!m.reviewed ? (
                    <>
                      <button
                        onClick={() => void handleQuickReview(m)}
                        disabled={reviewingId === m.id}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-[#0EA5E9] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sky-600 disabled:cursor-wait disabled:opacity-60"
                      >
                        {reviewingId === m.id ? (
                          '正在更新学习情况…'
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            快速复习 {m.reviewCount}/{EBBINGHAUS_INTERVALS_LENGTH}
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setSessionItems([m])}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:from-sky-600 hover:to-blue-700"
                      >
                        沉浸复习
                      </button>
                      <Link
                        href={`/sky/cloud-mind/memory?topic=${encodeURIComponent(m.knowledgePoints[0] ?? '')}`}
                        className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300 dark:hover:bg-sky-900/40"
                      >
                        <Brain className="h-3.5 w-3.5" />
                        生成记忆卡
                      </Link>
                    </>
                  ) : (
                    <span className="whitespace-nowrap rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
                      已掌握
                    </span>
                  )}
                  <button
                    onClick={() => deleteMistake(m.id)}
                    className="ml-auto whitespace-nowrap rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })}
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
                <option key={size} value={size}>
                  {size} 条
                </option>
              ))}
            </select>
            <span>
              第 {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)}{' '}
              条，共 {filtered.length} 条
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
                  <span key={`e${i}`} className="px-1 text-xs text-gray-400 dark:text-slate-500">
                    …
                  </span>
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
