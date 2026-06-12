'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  Loader2,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Send,
  X,
  Brain,
  CheckCircle2,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MathRenderer } from './math-renderer';
import { useTaskStore } from '@/lib/store/use-task-store';
import { useAuth } from '@/components/auth/auth-provider';
import { toast } from 'sonner';
import {
  submitTeachingJob,
  fetchTeachingJob,
  pollTeachingJob,
  cancelTeachingJob,
} from '@/lib/teaching/teaching-job-client';
import {
  addActiveTeachingJobEntry,
  removeActiveTeachingJobEntry,
  getActiveTeachingJobEntries,
} from '@/lib/teaching/teaching-session';
import type { LessonPlan, LessonSection } from '@/lib/teaching/lesson-types';
import type { ContentChunk } from '@/lib/teaching/content-types';

// ── Types ─────────────────────────────────────────────────────────

const DEPTH_LABELS: Record<string, string> = {
  basic: '基础讲解',
  intermediate: '重点强化',
  advanced: '拓展提升',
};

const DEPTH_STAR_COLORS: Record<string, string> = {
  basic: 'text-emerald-400',
  intermediate: 'text-amber-400',
  advanced: 'text-rose-400',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  explanation: <BookOpen className="h-3.5 w-3.5" />,
  example: <Sparkles className="h-3.5 w-3.5" />,
  diagram: <BookOpen className="h-3.5 w-3.5" />,
  quiz: <Send className="h-3.5 w-3.5" />,
};

/* 投射类型 — 星际色彩 */
const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  explanation: {
    label: '讲解',
    cls: 'bg-sky-900/20 text-sky-300 border border-sky-500/20',
  },
  example: {
    label: '例题',
    cls: 'bg-emerald-900/20 text-emerald-300 border border-emerald-500/20',
  },
  diagram: {
    label: '图表',
    cls: 'bg-violet-900/20 text-violet-300 border border-violet-500/20',
  },
  quiz: {
    label: '测验',
    cls: 'bg-orange-900/20 text-orange-300 border border-orange-500/20',
  },
};

/* 内容块左边框色 */
const CHUNK_BORDER: Record<string, string> = {
  formula: 'border-l-2 border-l-amber-400/60',
  example: 'border-l-2 border-l-emerald-400/60',
  quiz: 'border-l-2 border-l-orange-400/60',
  diagram: 'border-l-2 border-l-violet-400/60',
  text: '',
};

const CHUNK_BADGE: Record<string, { label: string; cls: string } | null> = {
  formula: {
    label: '核心公式',
    cls: 'bg-amber-900/30 text-amber-300 border border-amber-500/20',
  },
  example: {
    label: '例题',
    cls: 'bg-emerald-900/30 text-emerald-300 border border-emerald-500/20',
  },
  quiz: {
    label: '随堂测验',
    cls: 'bg-orange-900/30 text-orange-300 border border-orange-500/20',
  },
  diagram: null,
  text: null,
};

// ── Section Renderer ───────────────────────────────────────────────

function SectionCard({
  section,
  chunks,
  index,
}: {
  section: LessonSection;
  chunks: ContentChunk[];
  index: number;
}) {
  const sortedChunks = [...chunks].sort((a, b) => a.order - b.order);
  const typeBadge = TYPE_BADGE[section.contentType] ?? TYPE_BADGE.explanation;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: 'easeOut' }}
      className="teaching-section-appear"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div
        className="rounded-xl border backdrop-blur-sm overflow-hidden"
        style={{
          background: 'var(--teaching-surface)',
          borderColor: 'var(--teaching-border)',
          boxShadow: '0 0 20px -6px rgba(251, 191, 36, 0.08)',
        }}
      >
        {/* Header */}
        <div
          className="px-5 pt-4 pb-3"
          style={{
            background:
              'linear-gradient(135deg, rgba(251, 191, 36, 0.06) 0%, transparent 100%)',
            borderBottom: '1px solid var(--teaching-border)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Badge variant="secondary" className={cn('text-[11px]', typeBadge.cls)}>
                {TYPE_ICONS[section.contentType]}
                <span className="ml-1">{typeBadge.label}</span>
              </Badge>
              <h3
                className="text-sm font-semibold"
                style={{ color: 'var(--teaching-text)' }}
              >
                {section.title}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  'text-[11px] border-[var(--teaching-border)]',
                  DEPTH_STAR_COLORS[section.depth],
                )}
              >
                <Star className="h-3 w-3 mr-0.5 fill-current" />
                {DEPTH_LABELS[section.depth]}
              </Badge>
              <span className="text-xs" style={{ color: 'var(--teaching-muted)' }}>
                {section.estimatedDuration}分钟
              </span>
            </div>
          </div>
          {section.knowledgePoints.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {section.knowledgePoints.map((kp) => (
                <span
                  key={kp}
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px]"
                  style={{
                    background: 'rgba(251, 191, 36, 0.08)',
                    border: '1px solid rgba(251, 191, 36, 0.2)',
                    color: 'var(--teaching-primary)',
                  }}
                >
                  {kp}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Content chunks */}
        <div className="px-5 py-4 space-y-3">
          {sortedChunks.map((chunk) => {
            const badge = CHUNK_BADGE[chunk.type];
            return (
              <div
                key={chunk.order}
                className={cn(
                  'rounded-lg p-4',
                  CHUNK_BORDER[chunk.type],
                )}
                style={{
                  background:
                    chunk.type === 'text'
                      ? 'rgba(251, 191, 36, 0.03)'
                      : 'rgba(11, 16, 33, 0.5)',
                }}
              >
                {badge && (
                  <Badge
                    variant="secondary"
                    className={cn('mb-2 text-[11px]', badge.cls)}
                  >
                    {badge.label}
                  </Badge>
                )}
                <div
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--teaching-text)' }}
                >
                  <MathRenderer content={chunk.content} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ── Loading Skeleton ───────────────────────────────────────────────

function SectionSkeleton() {
  return (
    <div
      className="rounded-xl border p-5 animate-pulse"
      style={{
        background: 'var(--teaching-surface)',
        borderColor: 'var(--teaching-border)',
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="h-6 w-36 rounded"
          style={{ background: 'rgba(251, 191, 36, 0.08)' }}
        />
        <div className="flex gap-2">
          <div
            className="h-5 w-16 rounded"
            style={{ background: 'rgba(251, 191, 36, 0.06)' }}
          />
          <div
            className="h-5 w-12 rounded"
            style={{ background: 'rgba(251, 191, 36, 0.06)' }}
          />
        </div>
      </div>
      <div className="flex gap-1.5 mt-3">
        <div
          className="h-5 w-20 rounded-full"
          style={{ background: 'rgba(251, 191, 36, 0.06)' }}
        />
        <div
          className="h-5 w-16 rounded-full"
          style={{ background: 'rgba(251, 191, 36, 0.06)' }}
        />
      </div>
      <div className="space-y-3 mt-4">
        <div
          className="h-24 rounded-lg"
          style={{ background: 'rgba(251, 191, 36, 0.04)' }}
        />
        <div
          className="h-16 rounded-lg"
          style={{ background: 'rgba(251, 191, 36, 0.04)' }}
        />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────

interface TeachingPanelProps {
  /** When set, display a previously completed teaching job */
  viewHistoryItem?: {
    topic: string;
    plan?: LessonPlan;
    sections?: { section: LessonSection; chunks: ContentChunk[] }[];
  } | null;
  onViewedHistory?: () => void;
}

export function TeachingPanel({ viewHistoryItem, onViewedHistory }: TeachingPanelProps) {
  const { user } = useAuth();
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [sections, setSections] = useState<{ section: LessonSection; chunks: ContentChunk[] }[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');

  const abortRef = useRef<AbortController | null>(null);

  // ── View history item ──
  useEffect(() => {
    if (viewHistoryItem) {
      setPlan(viewHistoryItem.plan ?? null);
      setSections(viewHistoryItem.sections ?? []);
      setDone(true);
      setLoading(false);
      setError(null);
      setTopic(viewHistoryItem.topic);
      onViewedHistory?.();
    }
  }, [viewHistoryItem, onViewedHistory]);

  // ── Restore active job from sessionStorage on mount ──
  useEffect(() => {
    const entries = getActiveTeachingJobEntries();
    if (entries.length === 0) return;

    const entry = entries[entries.length - 1];

    (async () => {
      try {
        const data = await fetchTeachingJob(entry.jobId);
        if (!data || data.status === 'cancelled' || data.status === 'failed') {
          removeActiveTeachingJobEntry(entry.jobId);
          return;
        }

        if (data.done && data.status === 'succeeded') {
          setPlan(data.plan ?? null);
          setSections(data.sections ?? []);
          setDone(true);
          setTopic(entry.topic);
          removeActiveTeachingJobEntry(entry.jobId);
          return;
        }

        setTopic(entry.topic);
        setCurrentJobId(entry.jobId);
        setLoading(true);
        setPlan(data.plan ?? null);
        setSections(data.sections ?? []);
        setMessage(data.message || '');

        resumePolling(entry.jobId, entry.topic);
      } catch {
        removeActiveTeachingJobEntry(entry.jobId);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Polling logic ──
  const resumePolling = useCallback((jobId: string, jobTopic: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const result = await pollTeachingJob(
          jobId,
          (data) => {
            if (controller.signal.aborted) return;
            setPlan(data.plan ?? null);
            setSections(data.sections ?? []);
            setMessage(data.message || '');
          },
          controller.signal,
        );

        if (controller.signal.aborted) return;

        setPlan(result.plan ?? null);
        setSections(result.sections ?? []);
        setDone(true);
        setLoading(false);
        removeActiveTeachingJobEntry(jobId);

        useTaskStore.getState().updateTask(jobId, {
          status: 'completed',
          progress: 100,
          phase: '教案生成完成',
        });

        toast.success(`教案"${result.plan?.title || jobTopic}"生成完成`);
      } catch (err) {
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : '教案生成失败';
        if (msg === 'User not found' || msg.includes('Not authenticated')) {
          toast.error('登录已过期，请重新登录');
          return;
        }
        setError(msg);
        setLoading(false);
        removeActiveTeachingJobEntry(jobId);
        useTaskStore.getState().removeTask(jobId);
      }
    })();
  }, []);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ── Submit new teaching job ──
  const handleStart = useCallback(async () => {
    if (!topic.trim()) return;

    setLoading(true);
    setError(null);
    setPlan(null);
    setSections([]);
    setDone(false);
    setMessage('正在提交...');

    try {
      const jobId = await submitTeachingJob(topic.trim());

      setCurrentJobId(jobId);

      addActiveTeachingJobEntry({ jobId, topic: topic.trim() });

      useTaskStore.getState().addTask({
        id: jobId,
        type: 'teaching',
        label: `授课: ${topic.trim().length > 20 ? topic.trim().slice(0, 17) + '...' : topic.trim()}`,
        status: 'running',
        progress: 0,
        phase: '正在提交...',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        jobId,
        resultRoute: '/sky/teaching',
      });

      resumePolling(jobId, topic.trim());
    } catch (err) {
      const msg = err instanceof Error ? err.message : '教案生成失败';
      if (msg === 'User not found' || msg.includes('Not authenticated')) {
        toast.error('登录已过期，请重新登录');
        window.location.href = '/auth/login';
        return;
      }
      setError(msg);
      setLoading(false);
    }
  }, [topic, resumePolling]);

  // ── Cancel ──
  const handleCancel = useCallback(async () => {
    if (!currentJobId) return;
    try {
      await cancelTeachingJob(currentJobId);
    } catch {
      // ignore
    }
    abortRef.current?.abort();
    removeActiveTeachingJobEntry(currentJobId);
    useTaskStore.getState().removeTask(currentJobId);
    setCurrentJobId(null);
    setLoading(false);
    setDone(false);
    setPlan(null);
    setSections([]);
    setMessage('');
    setError(null);
  }, [currentJobId]);

  const progress = plan ? Math.round((sections.length / plan.sections.length) * 100) : 0;
  const canSubmit = !loading && topic.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* ═══ 教学指令台 ═══ */}
      <div
        className="rounded-xl border backdrop-blur-sm overflow-hidden"
        style={{
          background: 'var(--teaching-surface)',
          borderColor: 'var(--teaching-border)',
          boxShadow: '0 0 24px -6px rgba(251, 191, 36, 0.08)',
        }}
      >
        <div
          className="px-5 pt-4 pb-3"
          style={{
            background:
              'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, transparent 100%)',
            borderBottom: '1px solid var(--teaching-border)',
          }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--teaching-primary)]" />
            <h3
              className="text-base font-semibold"
              style={{ color: 'var(--teaching-text)' }}
            >
              教学指令台
            </h3>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--teaching-muted)' }}>
            输入授课主题，AI 导师将根据你的学习情况生成个性化教案并流式推送
          </p>
        </div>
        <div className="px-5 py-4">
          <div className="flex gap-3">
            {/* 底部线输入框 + 琥珀辉光 */}
            <div className="flex-1 teaching-input-glow">
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="输入授课主题，例如：二次函数、牛顿定律..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) handleStart();
                }}
                disabled={loading}
                className="h-10 bg-transparent border-b border-[var(--teaching-border)] rounded-t-lg rounded-b-none border-t-0 border-l-0 border-r-0 focus:border-[var(--teaching-primary)] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-[var(--teaching-muted)]/50"
                style={{ color: 'var(--teaching-text)' }}
              />
            </div>
            {loading ? (
              <Button
                onClick={handleCancel}
                variant="outline"
                className="min-w-[100px] h-10 border-red-500/30 text-red-400 hover:bg-red-900/20 hover:border-red-500/50"
              >
                <X className="h-4 w-4 mr-2" />
                取消
              </Button>
            ) : (
              <button
                onClick={handleStart}
                disabled={!canSubmit}
                className="teaching-button-primary teaching-button-sweep min-w-[120px] h-10 rounded-lg px-4 text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Sparkles className="h-4 w-4" />
                启动授课
              </button>
            )}
          </div>
          {!user && (
            <p className="text-xs mt-2" style={{ color: 'var(--teaching-warm)' }}>
              请先登录后再使用授课功能
            </p>
          )}
        </div>
      </div>

      {/* ═══ 全息教案投射 — 备课进度 ═══ */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div
              className="rounded-xl border backdrop-blur-sm overflow-hidden"
              style={{
                background: 'var(--teaching-surface)',
                borderColor: 'var(--teaching-border)',
              }}
            >
              <div className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(251, 191, 36, 0.25), rgba(245, 158, 11, 0.15))',
                        border: '1px solid rgba(251, 191, 36, 0.3)',
                        boxShadow: '0 0 12px rgba(251, 191, 36, 0.2)',
                      }}
                    >
                      <Sparkles className="h-5 w-5 text-[var(--teaching-primary)] animate-pulse" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[var(--teaching-surface)] flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: 'var(--teaching-text)' }}
                    >
                      {plan ? plan.title : '正在分析学情...'}
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--teaching-muted)' }}>
                      {message || '正在准备...'}
                    </p>
                  </div>
                  <span
                    className="text-lg font-bold font-mono teaching-glow-text"
                    style={{ color: 'var(--teaching-primary)' }}
                  >
                    {progress}%
                  </span>
                </div>

                {/* Progress Bar with scan effect */}
                <div className="relative">
                  <div
                    className="h-2.5 rounded-full overflow-hidden relative"
                    style={{ background: 'rgba(251, 191, 36, 0.08)' }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background:
                          'linear-gradient(90deg, rgba(251, 191, 36, 0.6), rgba(245, 158, 11, 0.9))',
                        boxShadow: '0 0 8px rgba(251, 191, 36, 0.4)',
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  {/* Scanning light overlay */}
                  <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none teaching-project-scan" />
                  {/* Glow */}
                  <motion.div
                    className="absolute top-0 h-2.5 rounded-full blur-sm pointer-events-none"
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(251, 191, 36, 0.3), rgba(245, 158, 11, 0.5))',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>

                {/* Section Nodes — 星座连线风格 */}
                {plan && plan.sections.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {plan.sections.map((sec, i) => {
                      const isCompleted = i < sections.length;
                      const isCurrent = i === sections.length && loading;
                      return (
                        <div key={sec.id} className="group relative flex-1" title={sec.title}>
                          <div
                            className={cn(
                              'h-1.5 rounded-full transition-all duration-500',
                              isCompleted
                                ? ''
                                : isCurrent
                                  ? 'teaching-amber-breathe'
                                  : '',
                            )}
                            style={{
                              background: isCompleted
                                ? 'linear-gradient(90deg, rgba(251, 191, 36, 0.7), rgba(245, 158, 11, 0.9))'
                                : isCurrent
                                  ? 'rgba(251, 191, 36, 0.3)'
                                  : 'rgba(251, 191, 36, 0.08)',
                              boxShadow: isCompleted
                                ? '0 0 6px rgba(251, 191, 36, 0.3)'
                                : 'none',
                            }}
                          />
                          {/* Tooltip */}
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            <div
                              className="px-2 py-1 rounded text-[10px] whitespace-nowrap"
                              style={{
                                background: 'var(--teaching-surface-elevated)',
                                color: 'var(--teaching-text)',
                                border: '1px solid var(--teaching-border)',
                              }}
                            >
                              {sec.title}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Phase Steps */}
                <div className="flex items-center gap-2 text-xs">
                  {[
                    { key: 'planning', label: '分析学情', icon: Brain },
                    { key: 'generating_content', label: '生成教案', icon: BookOpen },
                  ].map((step) => {
                    const isActive =
                      loading &&
                      ((step.key === 'planning' && !plan) ||
                        (step.key === 'generating_content' && !!plan));
                    const isDone = step.key === 'planning' && !!plan;
                    return (
                      <div
                        key={step.key}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all',
                          isActive
                            ? 'font-medium'
                            : '',
                        )}
                        style={{
                          background: isActive
                            ? 'rgba(251, 191, 36, 0.12)'
                            : 'transparent',
                          color: isDone
                            ? 'var(--teaching-success)'
                            : isActive
                              ? 'var(--teaching-primary)'
                              : 'var(--teaching-muted)',
                          border: isActive
                            ? '1px solid rgba(251, 191, 36, 0.25)'
                            : '1px solid transparent',
                        }}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : isActive ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <step.icon className="h-3.5 w-3.5" />
                        )}
                        <span>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ 全息投影卡 — 教案摘要 ═══ */}
      <AnimatePresence>
        {plan && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div
              className="rounded-xl border backdrop-blur-sm overflow-hidden teaching-holo-flicker"
              style={{
                background: 'rgba(251, 191, 36, 0.04)',
                borderColor: 'rgba(251, 191, 36, 0.25)',
                boxShadow: '0 0 20px -4px rgba(251, 191, 36, 0.12)',
              }}
            >
              <div className="px-5 py-4">
                <h3
                  className="text-lg font-bold teaching-glow-text mb-2"
                  style={{ color: 'var(--teaching-primary)' }}
                >
                  {plan.title}
                </h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <span style={{ color: 'var(--teaching-muted)' }}>
                    预计 {plan.estimatedDuration} 分钟
                  </span>
                  <span style={{ color: 'var(--teaching-muted)' }}>
                    {plan.sections.length} 个章节
                  </span>
                  {plan.focusPoints.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span style={{ color: 'var(--teaching-muted)' }}>重点：</span>
                      {plan.focusPoints.map((fp) => (
                        <span
                          key={fp}
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px]"
                          style={{
                            background: 'rgba(251, 191, 36, 0.08)',
                            border: '1px solid rgba(251, 191, 36, 0.2)',
                            color: 'var(--teaching-primary)',
                          }}
                        >
                          {fp}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Skeletons */}
      {loading && sections.length < (plan?.sections.length ?? 0) && <SectionSkeleton />}

      {/* ═══ 讲义投射 — 章节卡片 ═══ */}
      {sections.map((s, i) => (
        <SectionCard key={s.section.id} section={s.section} chunks={s.chunks} index={i} />
      ))}

      {/* ═══ 授课完成横幅 ═══ */}
      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div
              className="rounded-xl border flex items-center gap-3 px-5 py-4"
              style={{
                background:
                  'linear-gradient(135deg, rgba(52, 211, 153, 0.08), rgba(16, 185, 129, 0.04))',
                borderColor: 'rgba(52, 211, 153, 0.25)',
                boxShadow: '0 0 16px -4px rgba(52, 211, 153, 0.12)',
              }}
            >
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{
                  background: 'rgba(52, 211, 153, 0.15)',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                }}
              >
                <Sparkles className="h-4 w-4 text-emerald-400" />
              </div>
              <span className="font-medium text-emerald-300">
                ✦ 授课完成！全部 {sections.length} 个章节已讲授，共 {plan?.estimatedDuration} 分钟
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="rounded-xl border flex items-center gap-3 px-5 py-4"
              style={{
                background: 'rgba(239, 68, 68, 0.06)',
                borderColor: 'rgba(239, 68, 68, 0.2)',
              }}
            >
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
              <span className="text-sm text-red-300 flex-1">{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStart}
                className="text-red-400 border-red-500/30 hover:bg-red-900/20 hover:border-red-500/50"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                重试
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
