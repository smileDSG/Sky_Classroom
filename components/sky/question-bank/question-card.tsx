'use client';

import { motion } from 'motion/react';
import { CheckCircle2, Calendar, ChevronRight } from 'lucide-react';
import { InlineMath } from '@/components/ui/inline-math';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { QuestionBankRow } from '@/lib/question-bank/types';
import {
  difficultyBadgeClass,
  difficultyLabel,
  typeLabel,
  subjectOption,
} from './constants';

interface QuestionCardProps {
  question: QuestionBankRow;
  selected?: boolean;
  onSelectChange?: (checked: boolean) => void;
  onClick?: () => void;
  index?: number;
}

export function QuestionCard({
  question,
  selected,
  onSelectChange,
  onClick,
  index,
}: QuestionCardProps) {
  const subject = subjectOption(question.subject);
  const hasOptions = question.options && question.options.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      onClick={onClick}
      className={cn(
        'group relative rounded-2xl border bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm p-5 transition-all cursor-pointer',
        selected
          ? 'border-sky-400 shadow-md shadow-sky-500/10'
          : 'border-slate-200/50 dark:border-slate-700/30 hover:border-sky-300 dark:hover:border-sky-700/50 hover:shadow-md'
      )}
    >
      {/* Checkbox overlay for batch selection */}
      {onSelectChange !== undefined && (
        <div
          className="absolute top-4 left-4 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelectChange(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
          />
        </div>
      )}

      <div className={cn('flex flex-col gap-3', onSelectChange !== undefined && 'pl-7')}>
        {/* Header badges */}
        <div className="flex flex-wrap items-center gap-2">
          {subject?.id ? (
            <Badge
              className={cn(
                'text-[10px] font-medium border-0',
                subject.bg,
                subject.color
              )}
            >
              {subject.label}
            </Badge>
          ) : question.subject ? (
            <Badge variant="secondary" className="text-[10px]">
              {question.subject}
            </Badge>
          ) : null}

          <Badge className={cn('text-[10px] font-medium border-0', difficultyBadgeClass(question.difficulty))}>
            {difficultyLabel(question.difficulty)}
          </Badge>

          <Badge variant="outline" className="text-[10px]">
            {typeLabel(question.questionType)}
          </Badge>

          {question.verified && (
            <Badge className="ml-auto text-[10px] font-medium border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <CheckCircle2 className="mr-0.5 h-3 w-3" />
              已审核
            </Badge>
          )}
        </div>

        {/* Content */}
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-relaxed line-clamp-3">
            {index !== undefined && (
              <span className="text-slate-400 font-normal mr-1.5">{index + 1}.</span>
            )}
            <InlineMath text={question.content} />
          </p>

          {hasOptions && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
              {question.options!.slice(0, 4).map((opt, i) => (
                <span
                  key={i}
                  className="text-xs text-slate-500 dark:text-slate-400"
                >
                  <span className="font-semibold text-slate-400 mr-0.5">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  <InlineMath text={opt.length > 24 ? opt.slice(0, 24) + '…' : opt} />
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/30">
          {question.knowledgePoints.slice(0, 4).map((kp) => (
            <Badge
              key={kp}
              variant="outline"
              className="text-[10px] text-sky-600 border-sky-200 dark:border-sky-800 dark:text-sky-300"
            >
              {kp}
            </Badge>
          ))}
          {question.knowledgePoints.length > 4 && (
            <Badge variant="outline" className="text-[10px]">
              +{question.knowledgePoints.length - 4}
            </Badge>
          )}

          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-slate-400">
            <Calendar className="h-3 w-3" />
            {new Date(question.createdAt).toLocaleDateString('zh-CN')}
          </span>

          <span className="inline-flex items-center text-[10px] text-sky-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            查看详情
            <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </motion.div>
  );
}
