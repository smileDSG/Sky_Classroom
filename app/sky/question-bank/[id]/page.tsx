'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { createLogger } from '@/lib/logger';
import type { QuestionBankRow } from '@/lib/question-bank/types';
import { QuestionForm } from '@/components/sky/question-bank/question-form';
import { ConfirmDialog } from '@/components/sky/question-bank/confirm-dialog';
import { QuestionDetailSkeleton } from '@/components/sky/question-bank/question-skeleton';
import { getSubjectTheme, DIFFICULTY_STARS, DIFFICULTY_META } from '@/components/sky/question-bank/subject-theme';
import { ArrowLeft, Edit2, Trash2, CheckCircle, BookOpen, Tag, FileText, Lightbulb, Layers, ChevronLeft, ChevronRight, Link2 } from 'lucide-react';
import katex from 'katex';

const log = createLogger('QB:DetailPage');

const TYPE_LABELS: Record<string, string> = {
  choice: '选择题',
  fill: '填空题',
  solve: '解答题',
  judge: '判断题',
};

function renderLatex(text: string): string {
  if (!text) return '';
  try {
    return katex.renderToString(text, {
      throwOnError: false,
      displayMode: false,
    });
  } catch {
    return text;
  }
}

function LatexText({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = renderLatex(text);
    }
  }, [text]);
  return <span ref={ref} className={className} />;
}

export default function QuestionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [question, setQuestion] = useState<QuestionBankRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Adjacent navigation
  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);

  // Read list context from URL query params
  const getListContextQuery = () => {
    if (typeof window === 'undefined') return '';
    const qp = new URLSearchParams(window.location.search);
    const ctx = new URLSearchParams();
    if (qp.get('q')) ctx.set('query', qp.get('q')!);
    if (qp.get('subject')) ctx.set('subject', qp.get('subject')!);
    if (qp.get('grade')) ctx.set('grade', qp.get('grade')!);
    if (qp.get('difficulty')) ctx.set('difficulty', qp.get('difficulty')!);
    if (qp.get('type')) ctx.set('questionType', qp.get('type')!);
    if (qp.get('unverified') === '1') ctx.set('verified', 'false');
    return ctx.toString();
  };

  useEffect(() => {
    if (!id) return;
    fetchQuestion();
  }, [id]);

  const fetchQuestion = async () => {
    setLoading(true);
    try {
      const [detailRes, adjacentRes] = await Promise.all([
        fetch(`/api/sky/question-bank?id=${id}`),
        fetch(`/api/sky/question-bank?id=${id}&adjacent=true&${getListContextQuery()}`),
      ]);
      const detailData = await detailRes.json();
      const adjacentData = await adjacentRes.json();

      if (detailData.success && detailData.question) {
        setQuestion(detailData.question);
      } else {
        toast.error('题目不存在', { description: '该题目可能已被删除' });
      }

      if (adjacentData.success) {
        setPrevId(adjacentData.prevId);
        setNextId(adjacentData.nextId);
      }
    } catch (err: any) {
      log.error('Fetch question failed:', err);
      toast.error('加载失败', { description: '网络错误，请稍后重试' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: Partial<QuestionBankRow>) => {
    if (!id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sky/question-bank?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('保存成功');
        setEditing(false);
        fetchQuestion();
      } else {
        toast.error('保存失败', { description: result.error || '请检查输入内容' });
      }
    } catch (err: any) {
      log.error('Update question failed:', err);
      toast.error('保存失败', { description: '网络错误，请稍后重试' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/sky/question-bank?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('题目已删除');
        router.push('/sky/question-bank');
      } else {
        toast.error('删除失败', { description: data.error || '请稍后重试' });
      }
    } catch (err: any) {
      log.error('Delete question failed:', err);
      toast.error('删除失败', { description: '网络错误，请稍后重试' });
    } finally {
      setDeleteLoading(false);
      setDeleteOpen(false);
    }
  };

  const handleVerify = async () => {
    if (!id) return;
    try {
      const res = await fetch('/api/sky/question-bank/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('审核通过');
        fetchQuestion();
      } else {
        toast.error('审核失败', { description: data.error || '请稍后重试' });
      }
    } catch (err: any) {
      log.error('Verify question failed:', err);
      toast.error('审核失败', { description: '网络错误，请稍后重试' });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-3xl">
        <QuestionDetailSkeleton />
      </div>
    );
  }

  if (!question) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-3xl">
        <div className="text-center py-12">
          <div className="h-16 w-16 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="h-8 w-8 text-slate-400" />
          </div>
          <p className="text-muted-foreground text-lg mb-4">题目不存在或已被删除</p>
          <Link href="/sky/question-bank">
            <Button variant="link" className="px-0">返回题库</Button>
          </Link>
        </div>
      </div>
    );
  }

  const theme = getSubjectTheme(question.subject);
  const diffMeta = DIFFICULTY_META[question.difficulty] ?? DIFFICULTY_META.medium;

  return (
    <div className="container mx-auto py-6 px-4 max-w-3xl">
      {/* ── Hero Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`relative overflow-hidden rounded-2xl ${theme.bg} border ${theme.border} p-6 mb-6`}
      >
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${theme.bar} rounded-l-2xl`} />
        <div className="pl-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${theme.bg} ${theme.text} ${theme.border} border font-semibold`}>
                {question.subject}
              </Badge>
              <Badge variant="outline">{TYPE_LABELS[question.questionType]}</Badge>
              <span className={`text-xs px-2 py-0.5 rounded-full ${diffMeta.bg} ${diffMeta.color} font-medium`}>
                {DIFFICULTY_STARS[question.difficulty]} {diffMeta.label}
              </span>
              {question.grade && (
                <Badge variant="outline" className="text-muted-foreground">
                  {question.grade}
                </Badge>
              )}
              {!question.verified && (
                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                  待审核
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!question.verified && (
                <Button variant="outline" size="sm" onClick={handleVerify}>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  通过审核
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing((v) => !v)}>
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-red-50" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <h1 className="text-xl font-bold text-foreground leading-relaxed">
            <LatexText text={question.content} />
          </h1>
        </div>
      </motion.div>

      {/* Back link + Navigation */}
      <div className="mb-4 flex items-center justify-between">
        <Link href="/sky/question-bank">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回题库
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          {prevId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const qp = new URLSearchParams(window.location.search);
                router.push(`/sky/question-bank/${prevId}?${qp.toString()}`);
              }}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              上一题
            </Button>
          )}
          {nextId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const qp = new URLSearchParams(window.location.search);
                router.push(`/sky/question-bank/${nextId}?${qp.toString()}`);
              }}
            >
              下一题
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <QuestionForm
          initialData={question}
          onSubmit={handleSave}
          onCancel={() => setEditing(false)}
          submitting={saving}
        />
      ) : (
        <div className="space-y-4">
          {/* Options */}
          {question.options && question.options.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">选项</Label>
                  </div>
                  <div className="space-y-2">
                    {question.options.map((opt, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-800 text-xs font-medium border">
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="text-sm mt-0.5">
                          <LatexText text={opt} />
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Answer */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">答案</Label>
                </div>
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900">
                  <p className="text-base font-semibold text-green-800 dark:text-green-300">
                    <LatexText text={question.answer} />
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Explanation */}
          {question.explanation && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">解析</Label>
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    <LatexText text={question.explanation} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Knowledge Points */}
          {question.knowledgePoints && question.knowledgePoints.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">知识点</Label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {question.knowledgePoints.map((kp, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="text-xs px-3 py-1"
                      >
                        {kp}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Source */}
          {question.source && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">来源</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">{question.source}</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Related Questions */}
          <RelatedQuestions currentId={question.id} content={question.content} subject={question.subject} />
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="确认删除题目"
        description={`即将删除题目："${question.content.slice(0, 60)}${question.content.length > 60 ? '...' : ''}"，此操作不可撤销。`}
        variant="destructive"
        confirmLabel="删除"
        onConfirm={handleDelete}
      />
    </div>
  );
}

function RelatedQuestions({ currentId, content, subject }: { currentId: string; content: string; subject: string }) {
  const [related, setRelated] = useState<QuestionBankRow[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchRelated = async () => {
      setLoading(true);
      try {
        // Use first 60 chars of content as search query + same subject filter
        const query = content.slice(0, 60);
        const res = await fetch(`/api/sky/question-bank?query=${encodeURIComponent(query)}&subject=${encodeURIComponent(subject)}&limit=6`);
        const data = await res.json();
        if (data.success) {
          setRelated(data.questions.filter((q: QuestionBankRow) => q.id !== currentId).slice(0, 5));
        }
      } catch (err) {
        // Silently fail - related questions are non-critical
      } finally {
        setLoading(false);
      }
    };
    fetchRelated();
  }, [currentId, content, subject]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm font-medium">相关题目</Label>
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (related.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
    >
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm font-medium">相关题目</Label>
          </div>
          <div className="space-y-2">
            {related.map((q) => {
              const theme = getSubjectTheme(q.subject);
              return (
                <div
                  key={q.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/sky/question-bank/${q.id}`)}
                >
                  <div className={`w-1 h-8 rounded-full ${theme.bar}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{q.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`${theme.bg} ${theme.text} ${theme.border} border text-[10px]`}>
                        {q.subject}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {DIFFICULTY_STARS[q.difficulty]} {DIFFICULTY_META[q.difficulty]?.label}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
