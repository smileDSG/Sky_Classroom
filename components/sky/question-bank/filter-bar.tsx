'use client';

import { Search, Filter, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SUBJECTS, DIFFICULTIES, QUESTION_TYPES } from './constants';

export interface FilterValues {
  keyword: string;
  subject: string;
  difficulty: string;
  questionType: string;
  verified: boolean;
}

interface FilterBarProps {
  values: FilterValues;
  onChange: (values: Partial<FilterValues>) => void;
  onClear: () => void;
}

export function FilterBar({ values, onChange, onClear }: FilterBarProps) {
  const hasActiveFilters =
    values.keyword.trim() ||
    values.subject ||
    values.difficulty ||
    values.questionType ||
    values.verified;

  return (
    <div className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Filter className="h-4 w-4 text-slate-400" />
          筛选条件
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="xs" onClick={onClear}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            清除筛选
          </Button>
        )}
      </div>

      {/* Keyword + Type row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={values.keyword}
            onChange={(e) => onChange({ keyword: e.target.value })}
            placeholder="搜索题干、解析、知识点..."
            className="pl-9"
          />
          {values.keyword && (
            <button
              onClick={() => onChange({ keyword: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              清除
            </button>
          )}
        </div>

        <Select
          value={values.questionType || 'all'}
          onValueChange={(v) => onChange({ questionType: v === 'all' ? '' : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="全部题型" />
          </SelectTrigger>
          <SelectContent>
            {QUESTION_TYPES.map((t) => (
              <SelectItem key={t.id || 'all'} value={t.id || 'all'}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Subject chips */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">学科</span>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map((s) => {
            const active = values.subject === s.id;
            return (
              <button
                key={s.id || 'all'}
                onClick={() => onChange({ subject: active ? '' : s.id })}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ring-1',
                  active
                    ? cn(s.bg, s.color, s.ring, 'ring-offset-1 ring-offset-white dark:ring-offset-slate-800')
                    : 'bg-slate-100 text-slate-600 ring-transparent hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                )}
              >
                {s.id && <span className={cn('h-2 w-2 rounded-full', s.bg.replace('bg-', 'bg-').replace('100', '400'))} />}
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Difficulty + Verified row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">难度</span>
          <div className="flex flex-wrap gap-1.5">
            {DIFFICULTIES.map((d) => {
              const active = values.difficulty === d.id;
              return (
                <button
                  key={d.id || 'all'}
                  onClick={() => onChange({ difficulty: active ? '' : d.id })}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    active
                      ? d.badgeClass + ' ring-1 ring-offset-1 ring-offset-white dark:ring-offset-slate-800'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
          <Switch
            checked={values.verified}
            onCheckedChange={(checked) => onChange({ verified: checked })}
          />
          仅显示已审核题目
        </label>
      </div>
    </div>
  );
}
