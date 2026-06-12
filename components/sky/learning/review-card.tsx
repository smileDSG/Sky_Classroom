'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { MistakeRecord } from '@/lib/mistakes/types';
import { EBBINGHAUS_INTERVALS } from '@/lib/storage/dao/mistakes';

// ── Types ─────────────────────────────────────────────────────────

export type ReviewPhase = 'recall' | 'reveal' | 'reflect';

export interface ReviewCardProps {
  item: MistakeRecord;
  phase: ReviewPhase;
  onPhaseChange: (phase: ReviewPhase) => void;
  onResult: (correct: boolean) => void;
  onHint?: () => void;
  hintsUsed: number;
}

// ── Cause labels ──────────────────────────────────────────────────

const CAUSE_LABELS: Record<string, string> = {
  'concept-unclear': '概念不清',
  'calculation-error': '计算失误',
  misreading: '审题错误',
  'method-wrong': '方法错误',
  careless: '粗心',
  'format-error': '格式错误',
};

// ── Component ─────────────────────────────────────────────────────

export function ReviewCard({
  item,
  phase,
  onPhaseChange,
  onResult,
  onHint,
  hintsUsed,
}: ReviewCardProps) {
  const [showSolution, setShowSolution] = useState(false);
  const [animDirection, setAnimDirection] = useState(1);

  const handleReveal = useCallback(() => {
    setAnimDirection(1);
    onPhaseChange('reveal');
  }, [onPhaseChange]);

  const handleShowSolution = useCallback(() => {
    setShowSolution((prev) => !prev);
  }, []);

  const handleResult = useCallback(
    (correct: boolean) => {
      setAnimDirection(1);
      onPhaseChange('reflect');
      onResult(correct);
    },
    [onPhaseChange, onResult],
  );

  const handleRetry = useCallback(() => {
    setAnimDirection(-1);
    setShowSolution(false);
    onPhaseChange('recall');
  }, [onPhaseChange]);

  const currentHint = item.hints?.[hintsUsed];

  return (
    <AnimatePresence mode="wait" custom={animDirection}>
      {phase === 'recall' && (
        <motion.div
          key="recall"
          custom={animDirection}
          initial={{ opacity: 0, x: animDirection * 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="space-y-5"
        >
          {/* Problem */}
          <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/15 text-xs font-bold text-violet-500">Q</span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">题目</span>
            </div>
            <p className="text-base leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-wrap">
              {item.problem}
            </p>
          </div>

          {/* Blurred answer area */}
          <div className="relative rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-5 overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/15 text-xs">🔒</span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">答案区域</span>
            </div>
            <div className="blur-md select-none pointer-events-none text-slate-400 dark:text-slate-500 text-sm space-y-1">
              <p>正确答案: {item.correctAnswer}</p>
              <p>解题过程将在此展示...</p>
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-white/30 dark:bg-slate-900/30 backdrop-blur-sm">
              <div className="text-center">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  请先自己思考
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  回忆解题思路后再查看答案
                </p>
              </div>
            </div>
          </div>

          {/* Hint bubble */}
          {currentHint && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="rounded-xl border border-amber-200/60 dark:border-amber-700/30 bg-amber-50/80 dark:bg-amber-900/20 p-4"
            >
              <div className="flex items-start gap-2">
                <span className="text-sm mt-0.5">💡</span>
                <div>
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">
                    提示 {hintsUsed}/{item.hints?.length ?? 0}
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {currentHint}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Knowledge points */}
          {item.knowledgePoints.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.knowledgePoints.map((kp, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/30 px-2.5 py-0.5 text-xs text-blue-600 dark:text-blue-400"
                >
                  {kp}
                </span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {item.hints && item.hints.length > 0 && hintsUsed < item.hints.length && (
              <button
                onClick={onHint}
                className="flex items-center gap-1.5 rounded-xl border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-300 transition-all hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:-translate-y-0.5"
              >
                💡 提示
              </button>
            )}
            <button
              onClick={handleReveal}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:-translate-y-0.5"
            >
              👁 查看答案
            </button>
          </div>
        </motion.div>
      )}

      {phase === 'reveal' && (
        <motion.div
          key="reveal"
          custom={1}
          initial={{ opacity: 0, rotateY: 90 }}
          animate={{ opacity: 1, rotateY: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className="space-y-4"
        >
          {/* Problem (compact) */}
          <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4">
            <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-3 whitespace-pre-wrap">
              {item.problem}
            </p>
          </div>

          {/* Answer comparison */}
          <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-xs">❌</span>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">我的原答案</p>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                  {item.userAnswer}
                </p>
              </div>
            </div>
            <div className="h-px bg-slate-100 dark:bg-slate-700" />
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-xs">✅</span>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">正确答案</p>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {item.correctAnswer}
                </p>
              </div>
            </div>
          </div>

          {/* Solution steps (collapsible) */}
          {item.solutionSteps && item.solutionSteps.length > 0 && (
            <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden">
              <button
                onClick={handleShowSolution}
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">📖</span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">解题过程</span>
                  <span className="rounded-full bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 text-[10px] text-blue-600 dark:text-blue-400">
                    {item.solutionSteps.length} 步
                  </span>
                </div>
                <motion.span
                  animate={{ rotate: showSolution ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-slate-400"
                >
                  ▼
                </motion.span>
              </button>
              <AnimatePresence>
                {showSolution && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-slate-100 dark:border-slate-700 p-4 space-y-3">
                      {item.solutionSteps.map((step, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex gap-3"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[10px] font-bold text-blue-500 mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                            {step}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Error explanation */}
          {(item.errorExplanation || CAUSE_LABELS[item.cause]) && (
            <div className="rounded-xl border border-orange-200/60 dark:border-orange-700/30 bg-orange-50/80 dark:bg-orange-900/15 p-4">
              <div className="flex items-start gap-2">
                <span className="text-sm mt-0.5">⚠️</span>
                <div>
                  <p className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-1">
                    错因分析
                  </p>
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    {item.errorExplanation || CAUSE_LABELS[item.cause]}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Knowledge points */}
          {item.knowledgePoints.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.knowledgePoints.map((kp, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/30 px-2.5 py-0.5 text-xs text-blue-600 dark:text-blue-400"
                >
                  🔗 {kp}
                </span>
              ))}
            </div>
          )}

          {/* Self-assessment buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => handleResult(true)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98]"
            >
              ✅ 掌握了
            </button>
            <button
              onClick={() => handleResult(false)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-red-500/25 transition-all hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98]"
            >
              ❌ 还是错
            </button>
            <button
              onClick={handleRetry}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-50 dark:hover:bg-slate-700 hover:-translate-y-0.5"
            >
              🔄 再想想
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
