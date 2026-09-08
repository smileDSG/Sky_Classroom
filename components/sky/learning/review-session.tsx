'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { ArrowRight, BrainCircuit, CheckCircle2, Loader2, TriangleAlert } from 'lucide-react';
import type { MistakeRecord, MistakeReviewResult } from '@/lib/mistakes/types';
import { ReviewCard, type ReviewPhase } from './review-card';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { EBBINGHAUS_INTERVALS } from '@/lib/storage/dao/mistakes';

// ── Types ─────────────────────────────────────────────────────────

interface ReviewSessionProps {
  items: MistakeRecord[];
  onClose: () => void;
}

interface ItemResult {
  id: string;
  correct: boolean;
  hintsUsed: number;
  syncState: 'pending' | 'done' | 'failed';
  reviewResult: MistakeReviewResult | null;
}

interface ReviewFeedback {
  id: string;
  syncState: ItemResult['syncState'];
  reviewResult: MistakeReviewResult | null;
}

// ── Helpers ───────────────────────────────────────────────────────

function formatNextReview(reviewCount: number, correct: boolean): string {
  if (!correct) return `明天 (${formatDate(Date.now() + 86400000)})`;
  const newCount = reviewCount + 1;
  if (newCount >= EBBINGHAUS_INTERVALS.length) return '已掌握！';
  const intervalIdx = Math.min(newCount, EBBINGHAUS_INTERVALS.length - 1);
  const days = EBBINGHAUS_INTERVALS[intervalIdx];
  return `${days}天后 (${formatDate(Date.now() + days * 86400000)})`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (minutes === 0) return `${seconds}秒`;
  return `${minutes}分${seconds}秒`;
}

function formatPercent(value: number | null): string {
  return value === null ? '暂无' : `${Math.round(value * 100)}%`;
}

function buildDecisionTarget(result: MistakeReviewResult): { href: string; label: string } {
  const decision = result.profileUpdate.learnerDecision;
  const topic = decision.topic ? `?topic=${encodeURIComponent(decision.topic)}` : '';
  if (decision.action === 'teach') {
    return { href: `/sky/cloud-mind/teaching${topic}`, label: '按最新学习情况补课' };
  }
  if (decision.action === 'review') {
    return { href: `/sky/cloud-mind/memory${topic}`, label: '进入下一轮复习' };
  }
  return {
    href: `/sky/cloud-mind/quiz${topic}`,
    label: decision.action === 'diagnostic' ? '做一道确认题' : '按最新学习情况练习',
  };
}

// ── Component ─────────────────────────────────────────────────────

export function ReviewSession({ items, onClose }: ReviewSessionProps) {
  const markReviewed = useSkyClassroomStore((s) => s.markReviewed);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<ReviewPhase>('recall');
  const [hintsUsed, setHintsUsed] = useState(0);
  const [results, setResults] = useState<ItemResult[]>([]);
  const [startTime] = useState(Date.now());
  const [showSummary, setShowSummary] = useState(false);
  const [lastResult, setLastResult] = useState<boolean | null>(null);
  const [lastReviewFeedback, setLastReviewFeedback] = useState<ReviewFeedback | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const currentItem = items[currentIndex];
  const progress = ((currentIndex + 1) / items.length) * 100;
  const isLast = currentIndex === items.length - 1;

  // ── Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (transitioning) return;
      if (e.key === 'Escape') {
        if (showSummary) onClose();
        else if (phase === 'recall') onClose();
        else if (phase === 'reveal') setPhase('recall');
      }
      if (phase === 'reveal') {
        if (e.key === '1') handleResult(true);
        if (e.key === '2') handleResult(false);
        if (e.key === '3') {
          setHintsUsed(0);
          setPhase('recall');
        }
      }
      if (phase === 'recall') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          setPhase('reveal');
        }
        if (e.key === 'h' || e.key === 'H') handleHint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // ── Handlers ────────────────────────────────────────────────────

  const handleHint = useCallback(() => {
    if (currentItem.hints && hintsUsed < currentItem.hints.length) {
      setHintsUsed((prev) => prev + 1);
    }
  }, [currentItem, hintsUsed]);

  const handleResult = useCallback(
    (correct: boolean) => {
      if (transitioning) return;
      setTransitioning(true);
      setLastResult(correct);
      setPhase('reflect');

      // Record result
      setResults((prev) => [
        ...prev,
        {
          id: currentItem.id,
          correct,
          hintsUsed,
          syncState: 'pending',
          reviewResult: null,
        },
      ]);
      setLastReviewFeedback({
        id: currentItem.id,
        syncState: 'pending',
        reviewResult: null,
      });

      // Update store
      void markReviewed(currentItem.id, correct).then((reviewResult) => {
        const syncState = reviewResult ? 'done' : 'failed';
        setResults((prev) => {
          const next = [...prev];
          const resultIndex = next.findLastIndex((item) => item.id === currentItem.id);
          if (resultIndex >= 0) {
            next[resultIndex] = {
              ...next[resultIndex],
              syncState,
              reviewResult,
            };
          }
          return next;
        });
        setLastReviewFeedback({ id: currentItem.id, syncState, reviewResult });
      });

      // Auto-advance after delay
      setTimeout(() => {
        if (isLast) {
          setShowSummary(true);
        } else {
          setCurrentIndex((prev) => prev + 1);
          setPhase('recall');
          setHintsUsed(0);
          setLastResult(null);
        }
        setTransitioning(false);
      }, 1800);
    },
    [currentItem, isLast, markReviewed, transitioning],
  );

  const handlePhaseChange = useCallback((newPhase: ReviewPhase) => {
    setPhase(newPhase);
  }, []);

  const handleRetryFromSummary = useCallback(() => {
    const wrongItems = items.filter((_, i) => {
      const r = results.find((r) => r.id === items[i].id);
      return r && !r.correct;
    });
    if (wrongItems.length > 0) {
      setCurrentIndex(0);
      setPhase('recall');
      setHintsUsed(0);
      setResults([]);
      setShowSummary(false);
      setLastResult(null);
      setLastReviewFeedback(null);
    }
  }, [items, results]);

  // ── Summary stats ───────────────────────────────────────────────

  const summaryStats = useMemo(() => {
    const correctCount = results.filter((r) => r.correct).length;
    const wrongCount = results.filter((r) => !r.correct).length;
    const duration = Date.now() - startTime;
    return { correctCount, wrongCount, duration };
  }, [results, startTime]);

  const profileSummary = useMemo(() => {
    const completed = results
      .map((result) => result.reviewResult)
      .filter((result): result is MistakeReviewResult => result !== null);
    const changesByPoint = new Map<
      string,
      MistakeReviewResult['profileUpdate']['changes'][number]
    >();
    for (const result of completed) {
      for (const change of result.profileUpdate.changes) {
        const previous = changesByPoint.get(change.knowledgePoint);
        changesByPoint.set(change.knowledgePoint, {
          ...change,
          masteryBefore: previous?.masteryBefore ?? change.masteryBefore,
          confidenceBefore: previous?.confidenceBefore ?? change.confidenceBefore,
          evidenceCountBefore: previous?.evidenceCountBefore ?? change.evidenceCountBefore,
        });
      }
    }
    return {
      changes: [...changesByPoint.values()],
      latestResult: completed.at(-1) ?? null,
      pendingCount: results.filter((result) => result.syncState === 'pending').length,
      failedCount: results.filter((result) => result.syncState === 'failed').length,
    };
  }, [results]);

  // ── Render: Summary ─────────────────────────────────────────────

  if (showSummary) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', damping: 12 }}
            className="text-6xl mb-4"
          >
            🌟
          </motion.div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            今日复习完成！
          </h2>

          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3">
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {items.length}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">总题数</p>
            </div>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {summaryStats.correctCount}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">已掌握</p>
            </div>
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3">
              <p className="text-2xl font-bold text-red-500 dark:text-red-400">
                {summaryStats.wrongCount}
              </p>
              <p className="text-xs text-red-500 dark:text-red-400">待巩固</p>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            用时 {formatDuration(summaryStats.duration)}
          </p>

          <div className="mt-5 rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-sky-50 to-indigo-50 p-4 text-left dark:border-cyan-200/15 dark:from-cyan-950/40 dark:via-sky-950/35 dark:to-indigo-950/35">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <BrainCircuit className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
              学习情况已处理本轮复习
            </div>

            {profileSummary.pendingCount > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-600" />
                还有 {profileSummary.pendingCount} 道题正在更新掌握情况…
              </div>
            )}

            {profileSummary.changes.length > 0 && (
              <div className="mt-3 space-y-2">
                {profileSummary.changes.slice(0, 4).map((change) => {
                  const improved =
                    (change.masteryAfter ?? 0) >=
                    (change.masteryBefore ?? change.masteryAfter ?? 0);
                  return (
                    <div
                      key={change.knowledgePoint}
                      className="rounded-xl border border-white/80 bg-white/75 px-3 py-2 dark:border-white/[0.07] dark:bg-white/[0.05]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {change.knowledgePoint}
                        </span>
                        <span
                          className={`shrink-0 text-xs font-bold ${
                            improved
                              ? 'text-emerald-600 dark:text-emerald-300'
                              : 'text-rose-600 dark:text-rose-300'
                          }`}
                        >
                          {formatPercent(change.masteryBefore)} →{' '}
                          {formatPercent(change.masteryAfter)}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                        记录数 {change.evidenceCountBefore} → {change.evidenceCountAfter} · 判断把握{' '}
                        {formatPercent(change.confidenceBefore)} →{' '}
                        {formatPercent(change.confidenceAfter)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {profileSummary.latestResult && (
              <div className="mt-3 rounded-xl bg-slate-950 px-3 py-3 text-white dark:bg-cyan-200 dark:text-slate-950">
                <div className="text-[10px] font-semibold opacity-65">重新计算后的下一步</div>
                <div className="mt-1 text-xs font-bold">
                  {profileSummary.latestResult.profileUpdate.learnerDecision.summary}
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="truncate text-[10px] opacity-70">
                    目标：
                    {profileSummary.latestResult.profileUpdate.learnerDecision.topic ??
                      '继续积累学习记录'}
                  </span>
                  <Link
                    href={buildDecisionTarget(profileSummary.latestResult).href}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1.5 text-[10px] font-semibold hover:bg-white/20 dark:bg-slate-950 dark:text-white"
                  >
                    {buildDecisionTarget(profileSummary.latestResult).label}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )}

            {profileSummary.failedCount > 0 && (
              <div className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {profileSummary.failedCount}{' '}
                道题的学习情况暂时没有更新；本地复习进度已保留，可稍后再复习同步。
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              返回复习计划
            </button>
            {summaryStats.wrongCount > 0 && (
              <button
                onClick={handleRetryFromSummary}
                className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-amber-500/25 transition-all hover:shadow-xl"
              >
                再刷错题 ({summaryStats.wrongCount})
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // ── Render: Session ─────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-900"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          ← 返回
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">复习模式</span>
          <span className="rounded-full bg-violet-100 dark:bg-violet-900/30 px-2.5 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">
            {currentIndex + 1}/{items.length}
          </span>
        </div>
        <div className="w-16" />
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-200 dark:bg-slate-700">
        <motion.div
          className="h-full bg-gradient-to-r from-violet-500 to-indigo-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-6">
          {/* Reflect overlay */}
          <AnimatePresence>
            {phase === 'reflect' && lastResult !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mb-4"
              >
                <div
                  className={`rounded-xl p-5 text-center ${
                    lastResult
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/30'
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30'
                  }`}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 12 }}
                    className="text-4xl mb-2"
                  >
                    {lastResult ? '🎉' : '💪'}
                  </motion.div>
                  <p
                    className={`text-lg font-bold ${
                      lastResult
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {lastResult ? '太棒了！' : '没关系，重新来过！'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {lastResult
                      ? `下次复习: ${formatNextReview(currentItem.reviewCount, true)}`
                      : `复习进度已重置 · 下次复习: ${formatNextReview(0, false)}`}
                  </p>
                  {lastReviewFeedback?.id === currentItem.id && (
                    <div className="mx-auto mt-3 max-w-sm rounded-xl border border-white/80 bg-white/75 px-3 py-2 text-left dark:border-white/10 dark:bg-white/[0.06]">
                      {lastReviewFeedback.syncState === 'pending' && (
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-600" />
                          正在保存这次复习结果…
                        </div>
                      )}
                      {lastReviewFeedback.syncState === 'done' &&
                        lastReviewFeedback.reviewResult && (
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                            <div>
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                学习情况已更新
                              </div>
                              {lastReviewFeedback.reviewResult.profileUpdate.changes[0] && (
                                <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                                  {
                                    lastReviewFeedback.reviewResult.profileUpdate.changes[0]
                                      .knowledgePoint
                                  }
                                  ：
                                  {formatPercent(
                                    lastReviewFeedback.reviewResult.profileUpdate.changes[0]
                                      .masteryBefore,
                                  )}{' '}
                                  →{' '}
                                  {formatPercent(
                                    lastReviewFeedback.reviewResult.profileUpdate.changes[0]
                                      .masteryAfter,
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      {lastReviewFeedback.syncState === 'failed' && (
                        <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          本地进度已更新，但学习情况暂时没有同步。
                        </div>
                      )}
                    </div>
                  )}
                  {!isLast && (
                    <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                      自动进入下一题...
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Review card */}
          {currentItem && (
            <ReviewCard
              key={currentItem.id}
              item={currentItem}
              phase={phase}
              onPhaseChange={handlePhaseChange}
              onResult={handleResult}
              onHint={handleHint}
              hintsUsed={hintsUsed}
            />
          )}
        </div>
      </div>

      {/* Footer: keyboard hints */}
      <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2">
        <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400 dark:text-slate-500">
          {phase === 'recall' && (
            <>
              <span>
                <kbd className="rounded bg-slate-100 dark:bg-slate-700 px-1 py-0.5">Space</kbd>{' '}
                查看答案
              </span>
              <span>
                <kbd className="rounded bg-slate-100 dark:bg-slate-700 px-1 py-0.5">H</kbd> 提示
              </span>
            </>
          )}
          {phase === 'reveal' && (
            <>
              <span>
                <kbd className="rounded bg-slate-100 dark:bg-slate-700 px-1 py-0.5">1</kbd> 掌握了
              </span>
              <span>
                <kbd className="rounded bg-slate-100 dark:bg-slate-700 px-1 py-0.5">2</kbd> 还是错
              </span>
              <span>
                <kbd className="rounded bg-slate-100 dark:bg-slate-700 px-1 py-0.5">3</kbd> 再想想
              </span>
            </>
          )}
          <span>
            <kbd className="rounded bg-slate-100 dark:bg-slate-700 px-1 py-0.5">Esc</kbd> 退出
          </span>
        </div>
      </div>
    </motion.div>
  );
}
