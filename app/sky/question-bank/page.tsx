'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createLogger } from '@/lib/logger';
import { useDebounce } from '@/lib/hooks/use-debounce';
import type { QuestionBankRow } from '@/lib/question-bank/types';
import { QuestionForm } from '@/components/sky/question-bank/question-form';
import { ConfirmDialog } from '@/components/sky/question-bank/confirm-dialog';
import { QuestionListSkeleton } from '@/components/sky/question-bank/question-skeleton';
import {
  getSubjectTheme,
  DIFFICULTY_STARS,
  DIFFICULTY_META,
} from '@/components/sky/question-bank/subject-theme';
import { CelestialCanvas } from '@/components/sky/slides/design-system/celestial-canvas';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Upload,
  Search,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Plus,
  Loader2,
  Library,
  FileQuestion,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  X,
} from 'lucide-react';

const log = createLogger('QB:Page');

const TYPE_LABELS: Record<string, string> = {
  choice: '选择',
  fill: '填空',
  solve: '解答',
  judge: '判断',
};

const COMMON_SUBJECTS = [
  '数学',
  '物理',
  '化学',
  '生物',
  '语文',
  '英语',
  '历史',
  '地理',
  '政治',
  '信息技术',
];
const COMMON_GRADES = [
  '一年级',
  '二年级',
  '三年级',
  '四年级',
  '五年级',
  '六年级',
  '初一',
  '初二',
  '初三',
  '高一',
  '高二',
  '高三',
];

export default function QuestionBankPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<QuestionBankRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);

  const [keywordInput, setKeywordInput] = useState('');
  const debouncedKeyword = useDebounce(keywordInput, 300);
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [questionType, setQuestionType] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

  // Expanded rows
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; content: string } | null>(null);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (debouncedKeyword) params.set('query', debouncedKeyword);
      if (subject) params.set('subject', subject);
      if (grade) params.set('grade', grade);
      if (difficulty) params.set('difficulty', difficulty);
      if (questionType) params.set('questionType', questionType);

      const res = await fetch(`/api/sky/question-bank?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setQuestions(data.questions);
        setTotal(data.total);
      } else {
        log.error('Fetch questions failed:', data.error || 'Unknown error');
      }
    } catch (err) {
      log.error('Fetch questions failed:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedKeyword, subject, grade, difficulty, questionType]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  useEffect(() => {
    setPage(1);
  }, [debouncedKeyword, subject, grade, difficulty, questionType]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async (data: Partial<QuestionBankRow>) => {
    setCreateLoading(true);
    try {
      const res = await fetch('/api/sky/question-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('题目创建成功');
        setCreateOpen(false);
        setPage(1);
        fetchQuestions();
      } else if (result.duplicated) {
        toast.warning('该题目已存在于题库中', {
          description: '系统检测到相同内容的题目，已跳过重复创建',
        });
      } else {
        toast.error('创建失败', { description: result.error || '请检查输入内容' });
      }
    } catch (err) {
      log.error('Create question failed:', err);
      toast.error('创建失败', { description: '网络错误，请稍后重试' });
    } finally {
      setCreateLoading(false);
    }
  };

  const promptDelete = (id: string, content: string) => {
    setConfirmTarget({ id, content });
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!confirmTarget) return;
    const { id } = confirmTarget;
    try {
      const res = await fetch(`/api/sky/question-bank?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('题目已删除');
        setQuestions((prev) => prev.filter((q) => q.id !== id));
        setTotal((t) => Math.max(0, t - 1));
      } else {
        toast.error('删除失败', { description: data.error || '请稍后重试' });
      }
    } catch (err) {
      log.error('Delete question failed:', err);
      toast.error('删除失败', { description: '网络错误，请稍后重试' });
    } finally {
      setConfirmTarget(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === questions.length && questions.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(questions.map((q) => q.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    try {
      const res = await fetch(`/api/sky/question-bank?ids=${ids.join(',')}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success(`已删除 ${data.deleted} 道题`);
        setQuestions((prev) => prev.filter((q) => !selectedIds.has(q.id)));
        setTotal((t) => Math.max(0, t - selectedIds.size));
        setSelectedIds(new Set());
      } else {
        toast.error('批量删除失败', { description: data.error || '请稍后重试' });
      }
    } catch (err) {
      log.error('Batch delete failed:', err);
      toast.error('批量删除失败', { description: '网络错误，请稍后重试' });
    } finally {
      setBatchDeleteOpen(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div
      className="relative min-h-screen"
      style={{ background: 'linear-gradient(180deg, #0B0D1A 0%, #121008 50%, #0B0D1A 100%)' }}
    >
      <div className="pointer-events-none fixed inset-0 z-0">
        <CelestialCanvas starCount={120} parallax={false} nebula grid={false} horizonGlow />
      </div>
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/3 h-[500px] w-[500px] rounded-full bg-amber-500/5 blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-sky-500/4 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 pt-6 pb-12 space-y-6 text-amber-50">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <Link
            href="/sky/cloud-mind/quiz"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-amber-200/60 transition-all hover:text-amber-300 hover:bg-amber-500/10"
          >
            <ArrowLeft className="h-4 w-4" />
            返回星际试炼场
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-slate-950/70 p-8 shadow-2xl shadow-amber-950/20 backdrop-blur-xl md:p-10"
        >
          <div className="absolute top-0 right-0 w-72 h-72 bg-amber-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-sky-400/10 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4" />

          <div className="relative z-10 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                  <Library className="h-5 w-5 text-amber-200" />
                </div>
                <span className="text-xs font-medium text-amber-200 tracking-wider uppercase">
                  知识之海
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">题库中心</h1>
              <p className="text-amber-100 text-base max-w-md leading-relaxed">
                汇聚各学科精选题目，支持批量导入与智能检索，为 AI 解题与课堂测验提供坚实数据基础。
              </p>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-sm text-amber-200">
                  <FileQuestion className="h-4 w-4" />
                  <span>{total} 道题</span>
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <Button
                variant="outline"
                className="border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20 hover:text-amber-50"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                新建题目
              </Button>
              <Link href="/sky/question-bank/import">
                <Button className="bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 hover:from-amber-300 hover:to-orange-400">
                  <Upload className="w-4 h-4 mr-2" />
                  批量导入
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        <div className="flex md:hidden items-center gap-2">
          <Button
            variant="outline"
            className="flex-1 border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20 hover:text-amber-50"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            新建
          </Button>
          <Link href="/sky/question-bank/import" className="flex-1">
            <Button className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 hover:from-amber-300 hover:to-orange-400">
              <Upload className="w-4 h-4 mr-2" />
              导入
            </Button>
          </Link>
        </div>

        <Card className="border-amber-500/20 bg-slate-950/70 text-amber-50 shadow-xl shadow-amber-950/10 backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs mb-1 block">搜索</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索题目内容..."
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    className="pl-9"
                  />
                  {debouncedKeyword !== keywordInput && (
                    <div className="absolute right-2.5 top-2.5">
                      <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              <div className="w-[160px]">
                <Label className="text-xs mb-1 block">学科</Label>
                <Select
                  value={subject || 'all'}
                  onValueChange={(v) => setSubject(v === 'all' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="全部学科" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {COMMON_SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-[120px]">
                <Label className="text-xs mb-1 block">年级</Label>
                <Select
                  value={grade || 'all'}
                  onValueChange={(v) => setGrade(v === 'all' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="全部年级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {COMMON_GRADES.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-[140px]">
                <Label className="text-xs mb-1 block">难度</Label>
                <Select
                  value={difficulty || 'all'}
                  onValueChange={(v) => setDifficulty(v === 'all' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="easy">简单</SelectItem>
                    <SelectItem value="medium">中等</SelectItem>
                    <SelectItem value="hard">困难</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-[140px]">
                <Label className="text-xs mb-1 block">题型</Label>
                <Select
                  value={questionType || 'all'}
                  onValueChange={(v) => setQuestionType(v === 'all' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="choice">选择</SelectItem>
                    <SelectItem value="fill">填空</SelectItem>
                    <SelectItem value="solve">解答</SelectItem>
                    <SelectItem value="judge">判断</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── List ── */}
        <Card className="border-amber-500/20 bg-slate-950/70 text-amber-50 shadow-xl shadow-amber-950/10 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                共 {total} 道题
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              </CardTitle>
              {selectedIds.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2"
                >
                  <span className="text-xs text-muted-foreground">已选 {selectedIds.size} 道</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    <X className="w-3 h-3 mr-1" />
                    取消
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setBatchDeleteOpen(true)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    删除
                  </Button>
                </motion.div>
              )}
            </div>
            {questions.length > 0 && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                <Checkbox
                  checked={selectedIds.size === questions.length && questions.length > 0}
                  onCheckedChange={toggleSelectAll}
                  className="ml-1"
                />
                <span className="text-xs text-muted-foreground">
                  {selectedIds.size === questions.length && questions.length > 0
                    ? '取消全选'
                    : '全选'}
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {loading && questions.length === 0 ? (
                    <QuestionListSkeleton count={5} />
                  ) : (
                    questions.map((q) => {
                      const theme = getSubjectTheme(q.subject);
                      const diffMeta = DIFFICULTY_META[q.difficulty] ?? DIFFICULTY_META.medium;
                      const isExpanded = expandedIds.has(q.id);
                      const isSelected = selectedIds.has(q.id);

                      return (
                        <motion.div
                          key={q.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className={`group relative overflow-hidden rounded-xl border border-amber-500/10 bg-slate-900/70 transition-all hover:border-amber-400/30 hover:bg-slate-900/90 hover:shadow-lg hover:shadow-amber-950/20 ${isSelected ? 'ring-1 ring-amber-300/60 bg-amber-500/10' : ''}`}
                        >
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${theme.bar}`} />

                          <div className="p-4 pl-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleSelect(q.id)}
                                  className="mt-0.5 shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <Badge
                                      className={`${theme.bg} ${theme.text} ${theme.border} border`}
                                    >
                                      {q.subject}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className="text-xs border-amber-500/20 text-amber-100/70"
                                    >
                                      {TYPE_LABELS[q.questionType]}
                                    </Badge>
                                    <span
                                      className={`text-xs px-2 py-0.5 rounded-full ${diffMeta.bg} ${diffMeta.color} font-medium`}
                                    >
                                      {DIFFICULTY_STARS[q.difficulty]} {diffMeta.label}
                                    </span>
                                    {q.grade && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs text-muted-foreground"
                                      >
                                        {q.grade}
                                      </Badge>
                                    )}
                                  </div>

                                  <div
                                    className="cursor-pointer"
                                    onClick={() => toggleExpand(q.id)}
                                  >
                                    <p
                                      className={`text-sm font-medium text-amber-50 ${isExpanded ? '' : 'line-clamp-2'}`}
                                    >
                                      {q.content}
                                    </p>
                                    {q.content.length > 120 && (
                                      <span className="mt-1 inline-flex items-center gap-0.5 text-xs text-amber-300 hover:underline">
                                        {isExpanded ? (
                                          <>
                                            <ChevronUp className="w-3 h-3" /> 收起
                                          </>
                                        ) : (
                                          <>
                                            <ChevronDown className="w-3 h-3" /> 展开
                                          </>
                                        )}
                                      </span>
                                    )}
                                  </div>

                                  {isExpanded && q.options && q.options.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      <p className="text-[11px] text-muted-foreground font-medium">
                                        选项：
                                      </p>
                                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                                        {q.options.map((opt, idx) => (
                                          <span key={idx} className="text-xs text-amber-50/80">
                                            <span className="font-medium text-muted-foreground">
                                              {String.fromCharCode(65 + idx)}.
                                            </span>{' '}
                                            {opt}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <p className="text-xs text-muted-foreground mt-1.5">
                                    答案:{' '}
                                    <span className="font-medium text-amber-100">{q.answer}</span>
                                  </p>

                                  {q.knowledgePoints && q.knowledgePoints.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {q.knowledgePoints.map((kp, idx) => (
                                        <span
                                          key={idx}
                                          className="inline-flex items-center rounded-full border border-amber-500/10 bg-slate-800/80 px-2 py-0.5 text-[11px] text-amber-100/60"
                                        >
                                          {kp}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-amber-100/70 hover:bg-amber-500/10 hover:text-amber-200"
                                  onClick={() => {
                                    const qp = new URLSearchParams();
                                    if (debouncedKeyword) qp.set('q', debouncedKeyword);
                                    if (subject) qp.set('subject', subject);
                                    if (grade) qp.set('grade', grade);
                                    if (difficulty) qp.set('difficulty', difficulty);
                                    if (questionType) qp.set('type', questionType);
                                    const qs = qp.toString();
                                    router.push(`/sky/question-bank/${q.id}${qs ? '?' + qs : ''}`);
                                  }}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-300/80 hover:bg-red-500/10 hover:text-red-200"
                                  onClick={() => promptDelete(q.id, q.content)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>

                {!loading && questions.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-16"
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
                        <BookOpen className="h-8 w-8 text-amber-300" />
                      </div>
                      <div>
                        <p className="text-base font-medium text-amber-50">题库空空如也</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          通过批量导入或手动创建，开始构建你的知识库
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="outline"
                          className="border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20 hover:text-amber-50"
                          onClick={() => setCreateOpen(true)}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          新建题目
                        </Button>
                        <Link href="/sky/question-bank/import">
                          <Button className="bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 hover:from-amber-300 hover:to-orange-400">
                            <Upload className="w-4 h-4 mr-2" />
                            批量导入
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </ScrollArea>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  第 {page} / {totalPages} 页
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新建题目</DialogTitle>
            </DialogHeader>
            <QuestionForm
              onSubmit={handleCreate}
              onCancel={() => setCreateOpen(false)}
              submitting={createLoading}
            />
          </DialogContent>
        </Dialog>

        {/* Delete Confirm */}
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="确认删除题目"
          description={
            confirmTarget
              ? `即将删除题目："${confirmTarget.content.slice(0, 60)}${confirmTarget.content.length > 60 ? '...' : ''}"，此操作不可撤销。`
              : '确定要删除这道题吗？此操作不可撤销。'
          }
          variant="destructive"
          confirmLabel="删除"
          onConfirm={handleDelete}
        />

        {/* Batch Delete Confirm */}
        <ConfirmDialog
          open={batchDeleteOpen}
          onOpenChange={setBatchDeleteOpen}
          title="确认批量删除"
          description={`即将删除 ${selectedIds.size} 道题目，此操作不可撤销。`}
          variant="destructive"
          confirmLabel="确认删除"
          onConfirm={handleBatchDelete}
        />
      </div>
    </div>
  );
}
