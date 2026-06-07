'use client';

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import type { QuestionBankInsert } from '@/lib/question-bank/types';
import { SUBJECTS, DIFFICULTIES, QUESTION_TYPES } from './constants';

interface QuestionFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
}

function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const raw = input.trim();
    if (!raw) return;
    const parts = raw
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const next = Array.from(new Set([...values, ...parts]));
    onChange(next);
    setInput('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <Badge
            key={v}
            variant="outline"
            className="text-xs pr-1 gap-1 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300"
          >
            {v}
            <button
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="ml-0.5 rounded-full hover:bg-sky-100 dark:hover:bg-sky-900/40 px-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder || '输入后按回车添加'}
          className="h-8 text-xs"
        />
        <Button type="button" variant="outline" size="xs" onClick={add}>
          添加
        </Button>
      </div>
    </div>
  );
}

export function QuestionFormDialog({ open, onClose, onSaved }: QuestionFormDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<QuestionBankInsert>({
    subject: '数学',
    grade: '',
    difficulty: 'medium',
    questionType: 'choice',
    content: '',
    answer: '',
    explanation: '',
    knowledgePoints: [],
    tags: [],
    options: ['', '', '', ''],
    verified: true,
  });

  const isChoice = form.questionType === 'choice';

  const reset = () => {
    setForm({
      subject: '数学',
      grade: '',
      difficulty: 'medium',
      questionType: 'choice',
      content: '',
      answer: '',
      explanation: '',
      knowledgePoints: [],
      tags: [],
      options: ['', '', '', ''],
      verified: true,
    });
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!form.content.trim() || !form.answer.trim()) {
      setError('题干和答案不能为空');
      return;
    }
    if (isChoice && (form.options || []).some((o) => !o.trim())) {
      setError('选择题的 4 个选项不能为空');
      return;
    }

    setSaving(true);
    setError(null);

    const body: QuestionBankInsert = {
      ...form,
      options: isChoice ? form.options : undefined,
    };

    try {
      const res = await fetch('/api/sky/question-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '保存失败');
      onSaved(json.data.id as string);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新增题目</DialogTitle>
          <DialogDescription>手动录入一道新题目到题库中</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">学科</label>
              <Select
                value={form.subject || 'unknown'}
                onValueChange={(v) => setForm((s) => ({ ...s, subject: v === 'unknown' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择学科" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">未指定</SelectItem>
                  {SUBJECTS.filter((s) => s.id).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">年级</label>
              <Input
                value={form.grade || ''}
                onChange={(e) => setForm((s) => ({ ...s, grade: e.target.value }))}
                placeholder="如：高一"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">难度</label>
              <Select
                value={form.difficulty || 'medium'}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, difficulty: v as QuestionBankInsert['difficulty'] }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择难度" />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.filter((d) => d.id).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">题型</label>
              <Select
                value={form.questionType || 'solve'}
                onValueChange={(v) =>
                  setForm((s) => ({
                    ...s,
                    questionType: v as QuestionBankInsert['questionType'],
                    options: v === 'choice' ? s.options || ['', '', '', ''] : undefined,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择题型" />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.filter((t) => t.id).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">题干</label>
            <Textarea
              value={form.content}
              onChange={(e) => setForm((s) => ({ ...s, content: e.target.value }))}
              rows={4}
              placeholder="支持 LaTeX：$x^2 + y^2 = 1$"
            />
          </div>

          {isChoice && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">选项</label>
              <div className="grid grid-cols-1 gap-2">
                {(form.options || ['', '', '', '']).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 w-5">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const next = [...(form.options || ['', '', '', ''])];
                        next[i] = e.target.value;
                        setForm((s) => ({ ...s, options: next }));
                      }}
                      placeholder={`选项 ${String.fromCharCode(65 + i)}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">答案</label>
            <Input
              value={form.answer}
              onChange={(e) => setForm((s) => ({ ...s, answer: e.target.value }))}
              placeholder={isChoice ? '如：A' : '输入答案'}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">解析</label>
            <Textarea
              value={form.explanation || ''}
              onChange={(e) => setForm((s) => ({ ...s, explanation: e.target.value }))}
              rows={3}
              placeholder="输入答案解析"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">知识点</label>
            <TagInput
              values={form.knowledgePoints || []}
              onChange={(v) => setForm((s) => ({ ...s, knowledgePoints: v }))}
              placeholder="输入知识点，按回车添加"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">标签</label>
            <TagInput
              values={form.tags || []}
              onChange={(v) => setForm((s) => ({ ...s, tags: v }))}
              placeholder="输入标签，按回车添加"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存题目'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
