'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { ArrowRight, BrainCircuit, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MathRenderer } from './math-renderer';
import type { ContentChunk } from '@/lib/teaching/content-types';
import { refreshLearningPlanAfterEvidence } from '@/lib/adaptive-learning/client/refresh-learning-plan';
import {
  getTeachingDecisionTarget,
  type TeachingProfileUpdate,
} from '@/lib/teaching/profile-impact';

interface QuizInteractionProps {
  chunk: ContentChunk;
  jobId?: string;
  knowledgePoints?: string[];
  onAnswer?: (correct: boolean) => void;
}

export function QuizInteraction({
  chunk,
  jobId,
  knowledgePoints = [],
  onAnswer,
}: QuizInteractionProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [profileUpdate, setProfileUpdate] = useState<TeachingProfileUpdate | null>(null);

  const options = chunk.options || [];
  const question = chunk.question || chunk.content;
  const hasStructuredOptions = options.length > 0;

  const handleSelectOption = (index: number) => {
    if (showAnswer) return;
    setSelectedOption(index);
  };

  const handleSubmit = async () => {
    if (selectedOption === null) return;

    // Verify answer via API for server-side tracking
    try {
      const response = await fetch('/api/sky/teaching/quiz-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: chunk.sectionId,
          chunkOrder: chunk.order,
          selectedOption,
          correctAnswer: chunk.correctAnswer,
          jobId,
          knowledgePoints,
        }),
      });
      const result = await response.json();
      const correct = result.data?.correct ?? selectedOption === (chunk.correctAnswer ?? 0);
      setIsCorrect(correct);
      setProfileUpdate(result.data?.profileUpdate ?? null);
      void refreshLearningPlanAfterEvidence();
      onAnswer?.(correct);
    } catch {
      // Fallback to client-side verification
      const correct = selectedOption === (chunk.correctAnswer ?? 0);
      setIsCorrect(correct);
      onAnswer?.(correct);
    }

    setShowAnswer(true);
  };

  const handleShowAnswer = () => {
    setShowAnswer(true);
  };

  // If no structured options, fall back to simple display
  if (!hasStructuredOptions) {
    return (
      <div className="space-y-3">
        <div className="text-sm leading-relaxed text-gray-800 dark:text-gray-100">
          <MathRenderer content={chunk.content} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Question */}
      <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
        <MathRenderer content={question} />
      </div>

      {/* Options */}
      <div className="space-y-2">
        {options.map((option, index) => {
          const isSelected = selectedOption === index;
          const isCorrectOption = index === (chunk.correctAnswer ?? 0);
          const showResult = showAnswer;

          return (
            <motion.button
              key={index}
              whileHover={{ scale: showAnswer ? 1 : 1.02 }}
              whileTap={{ scale: showAnswer ? 1 : 0.98 }}
              onClick={() => handleSelectOption(index)}
              disabled={showAnswer}
              className={cn(
                'w-full text-left p-3 rounded-lg border transition-all',
                'flex items-center gap-3',
                !showAnswer &&
                  !isSelected &&
                  'border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-700 bg-white dark:bg-slate-800',
                !showAnswer && isSelected && 'border-sky-500 bg-sky-50 dark:bg-sky-900/20',
                showAnswer &&
                  isCorrectOption &&
                  'border-green-500 bg-green-50 dark:bg-green-900/20',
                showAnswer &&
                  isSelected &&
                  !isCorrectOption &&
                  'border-red-500 bg-red-50 dark:bg-red-900/20',
                showAnswer &&
                  !isSelected &&
                  !isCorrectOption &&
                  'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 opacity-60',
              )}
            >
              {/* Option indicator */}
              <div
                className={cn(
                  'flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-medium',
                  !showAnswer &&
                    !isSelected &&
                    'border-slate-300 dark:border-slate-600 text-slate-500',
                  !showAnswer && isSelected && 'border-sky-500 text-sky-500',
                  showAnswer && isCorrectOption && 'border-green-500 text-green-500',
                  showAnswer && isSelected && !isCorrectOption && 'border-red-500 text-red-500',
                )}
              >
                {showAnswer && isCorrectOption ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : showAnswer && isSelected && !isCorrectOption ? (
                  <XCircle className="w-4 h-4" />
                ) : (
                  String.fromCharCode(65 + index) // A, B, C, D
                )}
              </div>

              {/* Option text */}
              <div className="flex-1 text-sm">
                <MathRenderer content={option} />
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Actions */}
      {!showAnswer && (
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={selectedOption === null}
            className="bg-sky-500 hover:bg-sky-600"
          >
            提交答案
          </Button>
          <Button variant="outline" onClick={handleShowAnswer}>
            <HelpCircle className="w-4 h-4 mr-1" />
            查看答案
          </Button>
        </div>
      )}

      {/* Result */}
      {showAnswer && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'p-4 rounded-lg border',
            isCorrect === true &&
              'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
            isCorrect === false &&
              'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
            isCorrect === null &&
              'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/20',
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            {isCorrect === true ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="font-medium text-green-700 dark:text-green-300">回答正确！</span>
              </>
            ) : isCorrect === false ? (
              <>
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="font-medium text-red-700 dark:text-red-300">回答错误</span>
              </>
            ) : (
              <span className="font-medium text-slate-700 dark:text-slate-300">参考答案</span>
            )}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <MathRenderer content={chunk.content} />
          </div>
        </motion.div>
      )}

      {profileUpdate && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-indigo-50 p-3 dark:border-cyan-200/15 dark:from-cyan-950/35 dark:to-indigo-950/30"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
            <BrainCircuit className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
            随堂答案已记录到学习情况
          </div>
          <div className="mt-2 space-y-1.5">
            {profileUpdate.changes.map((change) => (
              <div
                key={change.knowledgePoint}
                className="flex items-center justify-between gap-3 rounded-lg bg-white/75 px-2.5 py-2 text-[11px] dark:bg-white/[0.06]"
              >
                <span className="truncate font-semibold text-slate-700 dark:text-slate-200">
                  {change.knowledgePoint}
                </span>
                <span
                  className={cn(
                    'shrink-0 font-bold',
                    isCorrect
                      ? 'text-emerald-600 dark:text-emerald-300'
                      : 'text-rose-600 dark:text-rose-300',
                  )}
                >
                  {change.masteryBefore === null
                    ? '暂无'
                    : `${Math.round(change.masteryBefore * 100)}%`}{' '}
                  →{' '}
                  {change.masteryAfter === null
                    ? '暂无'
                    : `${Math.round(change.masteryAfter * 100)}%`}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-slate-950 px-2.5 py-2 text-white dark:bg-cyan-200 dark:text-slate-950">
            <span className="line-clamp-2 text-[10px] leading-relaxed">
              {profileUpdate.learnerDecision.summary}
            </span>
            <Link
              href={getTeachingDecisionTarget(profileUpdate.learnerDecision).href}
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/15 px-2 py-1 text-[10px] font-semibold dark:bg-slate-950 dark:text-white"
            >
              {getTeachingDecisionTarget(profileUpdate.learnerDecision).label}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
