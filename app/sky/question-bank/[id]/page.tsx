'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { DIFFICULTY_STARS, DIFFICULTY_META } from '@/components/sky/question-bank/subject-theme';
import { CelestialCanvas } from '@/components/sky/slides/design-system/celestial-canvas';
import { ArrowLeft, Edit2, Trash2, BookOpen, Tag, FileText, Lightbulb, Layers, ChevronLeft, ChevronRight, Link2 } from 'lucide-react';
import katex from 'katex';

const log = createLogger('QB:DetailPage');

const TYPE_LABELS: Record<string, string> = {
  choice: '选择题',
  fill: '填空题',
  solve: '解答题',
  judge: '判断题',
};

const DETAIL_CARD_CLASS = 'border-amber-500/20 bg-slate-950/70 text-amber-50 shadow-xl shadow-amber-950/10 backdrop-blur-xl';
const DETAIL_LABEL_CLASS = 'text-sm font-medium text-amber-100';

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
    return ctx.toString();
  };

  const fetchQuestion = useCallback(async () => {
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
    } catch (err: unknown) {
      log.error('Fetch question failed:', err);
      toast.error('加载失败', { description: '网络错误，请稍后重试' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchQuestion();
  }, [fetchQuestion, id]);

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
    } catch (err: unknown) {
      log.error('Update question failed:', err);
      toast.error('保存失败', { description: '网络错误，请稍后重试' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/sky/question-bank?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('题目已删除');
        router.push('/sky/question-bank');
      } else {
        toast.error('删除失败', { description: data.error || '请稍后重试' });
      }
    } catch (err: unknown) {
      log.error('Delete question failed:', err);
      toast.error('删除失败', { description: '网络错误，请稍后重试' });
    } finally {
      setDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="relative min-h-screen" style={{ background: 'linear-gradient(180deg, #0B0D1A 0%, #121008 50%, #0B0D1A 100%)' }}>
        <div className="pointer-events-none fixed inset-0 z-0">
          <CelestialCanvas starCount={120} parallax={false} nebula grid={false} horizonGlow />
        </div>
        <div className="relative z-10 mx-auto max-w-3xl px-4 py-6 text-amber-50">
          <QuestionDetailSkeleton />
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="relative min-h-screen" style={{ background: 'linear-gradient(180deg, #0B0D1A 0%, #121008 50%, #0B0D1A 100%)' }}>
        <div className="pointer-events-none fixed inset-0 z-0">
          <CelestialCanvas starCount={120} parallax={false} nebula grid={false} horizonGlow />
        </div>
        <div className="relative z-10 mx-auto max-w-3xl px-4 py-6 text-amber-50">
          <div className="rounded-3xl border border-amber-500/20 bg-slate-950/70 py-12 text-center shadow-2xl shadow-amber-950/20 backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
              <BookOpen className="h-8 w-8 text-amber-300" />
            </div>
            <p className="mb-4 text-lg text-amber-100/70">题目不存在或已被删除</p>
            <Link href="/sky/question-bank">
              <Button variant="ghost" className="text-amber-200/70 hover:bg-amber-500/10 hover:text-amber-300">返回题库</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const diffMeta = DIFFICULTY_META[question.difficulty] ?? DIFFICULTY_META.medium;

  return (
    <div className="relative min-h-screen" style={{ background: 'linear-gradient(180deg, #0B0D1A 0%, #121008 50%, #0B0D1A 100%)' }}>
      <div className="pointer-events-none fixed inset-0 z-0">
        <CelestialCanvas starCount={120} parallax={false} nebula grid={false} horizonGlow />
      </div>
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/3 h-[500px] w-[500px] rounded-full bg-amber-500/5 blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-sky-500/4 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-6 text-amber-50">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link href="/sky/question-bank">
            <Button variant="ghost" size="sm" className="text-amber-200/60 hover:bg-amber-500/10 hover:text-amber-300">
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回题库
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            {prevId && (
              <Button
                variant="outline"
                size="sm"
                className="border-amber-500/20 bg-slate-950/40 text-amber-200/70 hover:border-amber-400/40 hover:bg-amber-500/10 hover:text-amber-300"
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
                className="border-amber-500/20 bg-slate-950/40 text-amber-200/70 hover:border-amber-400/40 hover:bg-amber-500/10 hover:text-amber-300"
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative mb-6 overflow-hidden rounded-3xl border border-amber-500/20 bg-slate-950/70 p-6 shadow-2xl shadow-amber-950/20 backdrop-blur-xl"
        >
          <div className="absolute top-0 right-0 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-3xl bg-gradient-to-b from-amber-300 via-amber-500 to-sky-400" />
          <div className="relative z-10 pl-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border border-amber-400/30 bg-amber-500/10 text-amber-100">
                  {question.subject}
                </Badge>
                <Badge variant="outline" className="border-amber-500/20 text-amber-100/70">
                  {TYPE_LABELS[question.questionType]}
                </Badge>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${diffMeta.bg} ${diffMeta.color}`}>
                  {DIFFICULTY_STARS[question.difficulty]} {diffMeta.label}
                </span>
                {question.grade && (
                  <Badge variant="outline" className="border-amber-500/20 text-amber-100/60">
                    {question.grade}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-100/70 hover:bg-amber-500/10 hover:text-amber-200" onClick={() => setEditing((v) => !v)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-300/80 hover:bg-red-500/10 hover:text-red-200" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <h1 className="text-xl font-bold leading-relaxed text-amber-50">
              <LatexText text={question.content} />
            </h1>
          </div>
        </motion.div>

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
              <Card className={DETAIL_CARD_CLASS}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-amber-300/80" />
                    <Label className={DETAIL_LABEL_CLASS}>选项</Label>
                  </div>
                  <div className="space-y-2">
                    {question.options.map((opt, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 rounded-xl border border-amber-500/10 bg-amber-500/5 p-3"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-400/30 bg-slate-950/80 text-xs font-medium text-amber-200">
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="mt-0.5 text-sm text-amber-50/90">
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
            <Card className={DETAIL_CARD_CLASS}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-amber-300/80" />
                  <Label className={DETAIL_LABEL_CLASS}>答案</Label>
                </div>
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                  <p className="text-base font-semibold text-emerald-200">
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
              <Card className={DETAIL_CARD_CLASS}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-amber-300/80" />
                    <Label className={DETAIL_LABEL_CLASS}>解析</Label>
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-amber-100/70">
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
              <Card className={DETAIL_CARD_CLASS}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-4 h-4 text-amber-300/80" />
                    <Label className={DETAIL_LABEL_CLASS}>知识点</Label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {question.knowledgePoints.map((kp, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-100/80"
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
              <Card className={DETAIL_CARD_CLASS}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-4 h-4 text-amber-300/80" />
                    <Label className={DETAIL_LABEL_CLASS}>来源</Label>
                  </div>
                  <p className="text-sm text-amber-100/60">{question.source}</p>
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
      } catch {
        // Silently fail - related questions are non-critical
      } finally {
        setLoading(false);
      }
    };
    fetchRelated();
  }, [currentId, content, subject]);

  if (loading) {
    return (
      <Card className={DETAIL_CARD_CLASS}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-4 h-4 text-amber-300/80" />
            <Label className={DETAIL_LABEL_CLASS}>相关题目</Label>
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-amber-500/10" />
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
      <Card className={DETAIL_CARD_CLASS}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-4 h-4 text-amber-300/80" />
            <Label className={DETAIL_LABEL_CLASS}>相关题目</Label>
          </div>
          <div className="space-y-2">
            {related.map((q) => (
              <div
                key={q.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-amber-500/10 bg-amber-500/5 p-3 transition-colors hover:border-amber-400/30 hover:bg-amber-500/10"
                onClick={() => router.push(`/sky/question-bank/${q.id}`)}
              >
                <div className="h-8 w-1 rounded-full bg-gradient-to-b from-amber-300 to-sky-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-amber-50/90">{q.content}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge className="border border-amber-400/30 bg-amber-500/10 text-[10px] text-amber-100">
                      {q.subject}
                    </Badge>
                    <span className="text-[10px] text-amber-100/50">
                      {DIFFICULTY_STARS[q.difficulty]} {DIFFICULTY_META[q.difficulty]?.label}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0 text-amber-200/50" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
