'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  CheckCircle2,
  CircleOff,
  Pencil,
  Trash2,
  BookOpen,
  Heart,
  Target,
  Save,
  RotateCcw,
  Tag,
  CheckIcon,
} from 'lucide-react';
import { InlineMath } from '@/components/ui/inline-math';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { QuestionBankRow, QuestionBankUpdate } from '@/lib/question-bank/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  difficultyBadgeClass,
  difficultyLabel,
  typeLabel,
  subjectOption,
  SUBJECTS,
  DIFFICULTIES,
  QUESTION_TYPES,
} from './constants';

interface QuestionDetailDrawerProps {
  question: QuestionBankRow | null;
  open: boolean;
  onClose: () => void;
  onUpdated?: (q: QuestionBankRow) => void;
  onDeleted?: (id: string) => void;
}

function isValidFullTextKeyword(keyword: string): boolean {
  if (!keyword || keyword.trim().length <= 2) return false;
  // MySQL BOOLEAN MODE 特殊字符检查：保留字母、数字、中文和空格
  return /^[一-龥a-zA-Z0-9\s]+$/.test(keyword.trim());
}

function OptionLabel({ index, text, isCorrect }: { index: number; text: string; isCorrect?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm',
        isCorrect
          ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-900/20'
          : 'border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/40'
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
          isCorrect
            ? 'bg-emerald-500 text-white'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
        )}
      >
        {String.fromCharCode(65 + index)}
      </span>
      <span className="text-slate-700 dark:text-slate-200 pt-0.5">
        <InlineMath text={text} />
      </span>
    </div>
  );
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

export function QuestionDetailDrawer({
  question,
  open,
  onClose,
  onUpdated,
  onDeleted,
}: QuestionDetailDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialEdit = useMemo<QuestionBankUpdate>(() => {
    if (!question) return {};
    const needsOptions = question.questionType === 'choice' || question.questionType === 'judge';
    const defaultOptions = question.questionType === 'judge' ? ['正确', '错误'] : ['', '', '', ''];
    return {
      subject: question.subject,
      grade: question.grade,
      difficulty: question.difficulty,
      questionType: question.questionType,
      content: question.content,
      answer: question.answer,
      explanation: question.explanation,
      knowledgePoints: [...question.knowledgePoints],
      tags: [...question.tags],
      options: needsOptions ? (question.options ? [...question.options] : defaultOptions) : undefined,
    };
  }, [question]);

  const [edit, setEdit] = useState<QuestionBankUpdate>(initialEdit);

  useEffect(() => {
    if (open) {
      setIsEditing(false);
      setEdit(initialEdit);
      setError(null);
    }
  }, [open, initialEdit]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  const subject = question ? subjectOption(question.subject) : undefined;

  const handleVerify = async (verified: boolean) => {
    if (!question) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sky/question-bank?id=${question.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '操作失败');
      onUpdated?.({ ...question, verified });
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!question) return;
    if (!window.confirm('确定要删除这道题吗？删除后不可恢复。')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/sky/question-bank?id=${question.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '删除失败');
      onDeleted?.(question.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!question) return;
    setSaving(true);
    try {
      const needsOptions = edit.questionType === 'choice' || edit.questionType === 'judge';
      const maxOpts = edit.questionType === 'judge' ? 2 : 4;
      const body: QuestionBankUpdate = {
        ...edit,
        options: needsOptions
          ? edit.options?.slice(0, maxOpts) ?? (edit.questionType === 'judge' ? ['正确', '错误'] : ['', '', '', ''])
          : undefined,
      };
      const res = await fetch(`/api/sky/question-bank?id=${question.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '保存失败');
      const updated: QuestionBankRow = { ...question, ...(body as any) };
      onUpdated?.(updated);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleQuizFromHere = () => {
    if (!question) return;
    window.location.href = `/sky/cloud-mind/quiz?mode=bank&startFrom=${encodeURIComponent(question.id)}`;
  };

  const needsOptionsInput = edit.questionType === 'choice' || edit.questionType === 'judge' || question?.questionType === 'choice' || question?.questionType === 'judge';

  return (
    <AnimatePresence>
      {open && question && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-xs"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700/50">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-400">{question.id}</span>
                {question.verified ? (
                  <Badge className="text-[10px] border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <CheckCircle2 className="mr-0.5 h-3 w-3" />
                    已审核
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    <CircleOff className="mr-0.5 h-3 w-3" />
                    未审核
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {!isEditing ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setIsEditing(true)}
                      aria-label="编辑"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleVerify(!question.verified)}
                      disabled={saving}
                      aria-label={question.verified ? '取消审核' : '审核通过'}
                    >
                      {question.verified ? (
                        <CircleOff className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                      aria-label="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        setEdit(initialEdit);
                        setIsEditing(false);
                      }}
                      aria-label="取消编辑"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="default"
                      size="xs"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      <Save className="mr-1 h-3.5 w-3.5" />
                      保存
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="关闭">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              {!isEditing ? (
                <>
                  {/* Meta badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    {subject?.id ? (
                      <Badge className={cn('text-[10px] border-0', subject.bg, subject.color)}>
                        {subject.label}
                      </Badge>
                    ) : question.subject ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {question.subject}
                      </Badge>
                    ) : null}
                    <Badge className={cn('text-[10px] border-0', difficultyBadgeClass(question.difficulty))}>
                      {difficultyLabel(question.difficulty)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {typeLabel(question.questionType)}
                    </Badge>
                    {question.grade && (
                      <Badge variant="ghost" className="text-[10px]">
                        {question.grade}
                      </Badge>
                    )}
                  </div>

                  {/* Content */}
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      题干
                    </h4>
                    <div className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
                      <InlineMath text={question.content} />
                    </div>
                  </div>

                  {/* Image */}
                  {question.image && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        配图
                      </h4>
                      <img
                        src={question.image}
                        alt="题目配图"
                        className="max-w-full rounded-xl border border-slate-200 dark:border-slate-700/50"
                      />
                    </div>
                  )}

                  {/* Options */}
                  {question.options && question.options.length > 0 ? (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        选项
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {question.options.map((opt, i) => {
                          const label = String.fromCharCode(65 + i);
                          const isCorrect = question.answer.trim().toUpperCase() === label;
                          return (
                            <OptionLabel
                              key={i}
                              index={i}
                              text={opt}
                              isCorrect={isCorrect}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ) : (question.questionType === 'choice' || question.questionType === 'judge') ? (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/20 px-4 py-3 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                        选项缺失
                      </div>
                      <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                        这是一道{typeLabel(question.questionType)}，但目前缺少选项数据。请补充选项后再使用。
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="xs"
                          className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900/40"
                          onClick={() => {
                            setIsEditing(true);
                            if (question.questionType === 'judge') {
                              setEdit((s) => ({ ...s, options: ['正确', '错误'] }));
                            } else {
                              setEdit((s) => ({ ...s, options: ['', '', '', ''] }));
                            }
                          }}
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          编辑补充选项
                        </Button>
                        {question.questionType === 'judge' && (
                          <Button
                            variant="outline"
                            size="xs"
                            className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900/40"
                            onClick={async () => {
                              const body: QuestionBankUpdate = {
                                options: ['正确', '错误'],
                              };
                              const res = await fetch(`/api/sky/question-bank?id=${question.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(body),
                              });
                              const json = await res.json();
                              if (!json.success) throw new Error(json.error || '保存失败');
                              onUpdated?.({ ...question, options: ['正确', '错误'] });
                            }}
                          >
                            <CheckIcon className="mr-1 h-3 w-3" />
                            一键填充正确/错误
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* Answer */}
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-900/20 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
                      <CheckIcon className="h-3.5 w-3.5" />
                      答案
                    </div>
                    <div className="text-sm text-emerald-800 dark:text-emerald-200">
                      <InlineMath text={question.answer} />
                    </div>
                  </div>

                  {/* Explanation */}
                  {question.explanation && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/20 px-4 py-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        解析
                      </div>
                      <div className="text-sm text-amber-900/80 dark:text-amber-200/90 leading-relaxed">
                        <InlineMath text={question.explanation} />
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5" />
                      知识点
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {question.knowledgePoints.length > 0 ? (
                        question.knowledgePoints.map((kp) => (
                          <Badge
                            key={kp}
                            variant="outline"
                            className="text-xs border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300"
                          >
                            {kp}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">暂无知识点标签</span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* Edit form */
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300">学科</label>
                      <Select
                        value={edit.subject || 'unknown'}
                        onValueChange={(v) => setEdit((s) => ({ ...s, subject: v === 'unknown' ? '' : v }))}
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
                        value={edit.grade || ''}
                        onChange={(e) => setEdit((s) => ({ ...s, grade: e.target.value }))}
                        placeholder="如：高一"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300">难度</label>
                      <Select
                        value={edit.difficulty || 'medium'}
                        onValueChange={(v) =>
                          setEdit((s) => ({ ...s, difficulty: v as QuestionBankUpdate['difficulty'] }))
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
                        value={edit.questionType || 'solve'}
                        onValueChange={(v) =>
                          setEdit((s) => {
                            const isChoice = v === 'choice';
                            const isJudge = v === 'judge';
                            const defaultOpts = isJudge ? ['正确', '错误'] : isChoice ? ['', '', '', ''] : undefined;
                            return {
                              ...s,
                              questionType: v as QuestionBankUpdate['questionType'],
                              options: defaultOpts,
                            };
                          })
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
                      value={edit.content || ''}
                      onChange={(e) => setEdit((s) => ({ ...s, content: e.target.value }))}
                      rows={4}
                    />
                  </div>

                  {needsOptionsInput && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300">选项</label>
                      <div className="grid grid-cols-1 gap-2">
                        {(edit.options || ['', '', '', '']).map((opt, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 w-5">
                              {String.fromCharCode(65 + i)}.
                            </span>
                            <Input
                              value={opt}
                              onChange={(e) => {
                                const next = [...(edit.options || ['', '', '', ''])];
                                next[i] = e.target.value;
                                setEdit((s) => ({ ...s, options: next }));
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
                      value={edit.answer || ''}
                      onChange={(e) => setEdit((s) => ({ ...s, answer: e.target.value }))}
                      placeholder={needsOptionsInput ? '如：A' : '输入答案'}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">解析</label>
                    <Textarea
                      value={edit.explanation || ''}
                      onChange={(e) => setEdit((s) => ({ ...s, explanation: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">知识点</label>
                    <TagInput
                      values={edit.knowledgePoints || []}
                      onChange={(v) => setEdit((s) => ({ ...s, knowledgePoints: v }))}
                      placeholder="输入知识点，按回车添加"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">标签</label>
                    <TagInput
                      values={edit.tags || []}
                      onChange={(v) => setEdit((s) => ({ ...s, tags: v }))}
                      placeholder="输入标签，按回车添加"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            {!isEditing && (
              <div className="border-t border-slate-200 dark:border-slate-700/50 px-6 py-4 flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Heart className="h-4 w-4" />
                  收藏
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <BookOpen className="h-4 w-4" />
                  加入错题本
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="ml-auto gap-1.5 bg-sky-500 hover:bg-sky-600"
                  onClick={handleQuizFromHere}
                >
                  <Target className="h-4 w-4" />
                  从本题开始测验
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
