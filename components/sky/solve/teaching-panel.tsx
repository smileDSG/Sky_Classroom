'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Loader2, Sparkles, AlertCircle, RefreshCw, Send, X, Brain, CheckCircle2, ThumbsUp, ThumbsDown, MessageCircle, Star, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MathRenderer } from './math-renderer';
import { QuizInteraction } from './quiz-interaction';
import { TeachingChat } from './teaching-chat';
import { TTSButton } from './tts-button';
import { useTaskStore } from '@/lib/store/use-task-store';
import { useAuth } from '@/components/auth/auth-provider';
import { toast } from 'sonner';
import {
  submitTeachingJob,
  fetchTeachingJob,
  pollTeachingJob,
  cancelTeachingJob,
  retrySection,
  streamTeachingJob,
  toggleTeachingFavorite,
  shareTeachingJob,
  type TeachingJobState,
} from '@/lib/teaching/teaching-job-client';
import {
  addActiveTeachingJobEntry,
  removeActiveTeachingJobEntry,
  getActiveTeachingJobEntries,
} from '@/lib/teaching/teaching-session';
import type { LessonPlan, LessonSection } from '@/lib/teaching/lesson-types';
import type { ContentChunk } from '@/lib/teaching/content-types';
import { HOT_TOPICS, searchTopics } from '@/configs/teaching-topics';

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

interface SectionCardProps {
  section: LessonSection;
  chunks: ContentChunk[];
  index: number;
  jobId?: string;
  onRetry?: (sectionId: string) => void;
  onAskQuestion?: (sectionId: string, sectionTitle: string) => void;
}

const SectionCard = React.memo(function SectionCard({
  section,
  chunks,
  index,
  jobId,
  onRetry,
  onAskQuestion,
}: SectionCardProps) {
  const sortedChunks = [...chunks].sort((a, b) => a.order - b.order);
  const hasFailed = sortedChunks.some((c) => c.failed);
  const typeBadge = TYPE_BADGE[section.contentType] ?? TYPE_BADGE.explanation;

  const typeLabel: Record<string, string> = {
    text: '讲解',
    formula: '公式',
    example: '例题',
    quiz: '测验',
    diagram: '图表',
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry(section.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: 'easeOut' }}
      className="teaching-section-appear"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <Card className={cn(
        'bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-sky-200/50 dark:border-sky-800/30',
        hasFailed && 'border-red-200 dark:border-red-800/50',
      )}>
        <CardHeader className="pb-3">
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
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedChunks.map((chunk) => (
            <div
              key={chunk.order}
              className={cn(
                'rounded-lg p-4',
                chunk.type === 'formula' &&
                  'bg-sky-50/50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-800/30',
                chunk.type === 'example' &&
                  'bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30',
                chunk.type === 'quiz' &&
                  'bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30',
                chunk.type === 'diagram' &&
                  'bg-cyan-50/50 dark:bg-cyan-900/10 border border-cyan-100 dark:border-cyan-800/30',
                chunk.type === 'text' && 'bg-white/40 dark:bg-slate-700/20',
                chunk.failed && 'bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30',
              )}
            >
              {chunk.type === 'example' && (
                <Badge
                  variant="secondary"
                  className="mb-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                >
                  例题
                </Badge>
              )}
              {chunk.type === 'quiz' && (
                <Badge
                  variant="secondary"
                  className="mb-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                >
                  随堂测验
                </Badge>
              )}
              {chunk.type === 'formula' && (
                <Badge
                  variant="secondary"
                  className="mb-2 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400"
                >
                  核心公式
                </Badge>
              )}
              {chunk.failed && (
                <Badge
                  variant="secondary"
                  className="mb-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                >
                  生成失败
                </Badge>
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
              {chunk.type === 'quiz' && chunk.options && chunk.options.length > 0 ? (
                <QuizInteraction chunk={chunk} />
              ) : (
                <div className="text-sm leading-relaxed text-gray-800 dark:text-gray-100">
                  <MathRenderer content={chunk.content} />
                </div>
              )}
                </div>
                <TTSButton text={chunk.content} className="shrink-0 mt-1" />
              </div>
            </div>
          ))}
          {hasFailed && onRetry && (
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                重新生成
              </Button>
            </div>
          )}

          {/* Learning feedback buttons */}
          {!hasFailed && (
            <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-700">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAskQuestion?.(section.id, section.title)}
                className="text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800 hover:bg-sky-50 dark:hover:bg-sky-900/20"
              >
                <MessageCircle className="h-3 w-3 mr-1" />
                提问
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    toast.success('已标记为「已掌握」');
                    // TODO: Call feedback API
                  }}
                  className="text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20"
                >
                  <ThumbsUp className="h-3 w-3 mr-1" />
                  已掌握
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    toast.success('已标记为「需复习」');
                    // TODO: Call feedback API
                  }}
                  className="text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                >
                  <ThumbsDown className="h-3 w-3 mr-1" />
                  需复习
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
});

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
  const [recommendedTopics, setRecommendedTopics] = useState<string[]>([]);
  const [hasProfile, setHasProfile] = useState(false);
  const [chatSection, setChatSection] = useState<{ id: string; title: string } | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // ── Fetch recommended topics on mount ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/student/profile', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            const { weakPoints, hasProfile: profileExists } = data.data;
            setHasProfile(profileExists);

            if (profileExists && weakPoints.length > 0) {
              // Use weak points as recommendations
              setRecommendedTopics(weakPoints.slice(0, 5));
            } else {
              // Cold start: use hot topics from math
              const mathTopics = HOT_TOPICS.find((c) => c.subject === 'math');
              setRecommendedTopics(mathTopics?.topics.slice(0, 5) ?? []);
            }
          }
        }
      } catch {
        // Silently fail, use default topics
        const mathTopics = HOT_TOPICS.find((c) => c.subject === 'math');
        setRecommendedTopics(mathTopics?.topics.slice(0, 5) ?? []);
      }
    })();
  }, []);

  // ── Search suggestions ──
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleTopicChange = (value: string) => {
    setTopic(value);
    if (value.trim().length > 0) {
      const results = searchTopics(value.trim());
      setSuggestions(results.slice(0, 5));
      setShowSuggestions(results.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setTopic(suggestion);
    setShowSuggestions(false);
  };

  const handleSelectRecommended = (recommended: string) => {
    setTopic(recommended);
  };

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

  // ── Polling logic (SSE with fallback) ──
  const resumePolling = useCallback((jobId: string, jobTopic: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const result = await streamTeachingJob(
          jobId,
          (data) => {
            if (controller.signal.aborted) return;
            setPlan(data.plan ?? null);
            setSections(data.sections ?? []);
            setMessage(data.message || '');
          },
          (sectionIndex, section, chunks) => {
            if (controller.signal.aborted) return;
            // Update sections as they arrive via SSE
            setSections((prev) => {
              const updated = [...prev];
              updated[sectionIndex] = { section, chunks };
              return updated;
            });
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
        toast.error('登录已过期，请重新登录', {
          duration: 5000,
          action: {
            label: '稍后登录',
            onClick: () => {
              // Keep current content, don't redirect
            },
          },
        });
        // Delay redirect to allow user to see the toast
        setTimeout(() => {
          window.location.href = '/auth/login';
        }, 5000);
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

  // ── Retry Section ──
  const handleRetrySection = useCallback(async (sectionId: string) => {
    if (!currentJobId) return;

    try {
      toast.info('正在重新生成...');
      const result = await retrySection(currentJobId, sectionId);

      if (result) {
        // Update sections state
        setSections((prev) => {
          const idx = prev.findIndex((s) => s.section.id === sectionId);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = result;
            return updated;
          }
          return [...prev, result];
        });
        toast.success('重新生成完成');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '重新生成失败';
      toast.error(msg);
    }
  }, [currentJobId]);

  // ── Favorite ──
  const handleToggleFavorite = useCallback(async () => {
    if (!currentJobId) return;

    try {
      const result = await toggleTeachingFavorite(currentJobId);
      setIsFavorited(result);
      toast.success(result ? '已收藏' : '已取消收藏');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '操作失败';
      toast.error(msg);
    }
  }, [currentJobId]);

  // ── Share ──
  const handleShare = useCallback(async () => {
    if (!currentJobId) return;

    try {
      const result = await shareTeachingJob(currentJobId);
      setShareUrl(result.shareUrl);

      // Copy to clipboard
      await navigator.clipboard.writeText(result.shareUrl);
      toast.success('分享链接已复制到剪贴板');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '分享失败';
      toast.error(msg);
    }
  }, [currentJobId]);

  const progress = plan
    ? Math.round((sections.length / plan.sections.length) * 100)
    : 0;
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
            <div className="flex-1 relative">
              <Input
                value={topic}
                onChange={(e) => handleTopicChange(e.target.value)}
                placeholder="输入授课主题，例如：二次函数、牛顿定律..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) handleStart();
                }}
                disabled={loading}
                className="flex-1"
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                onBlur={() => {
                  // Delay hide to allow click on suggestion
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
              />
              {/* Search suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                      onMouseDown={() => handleSelectSuggestion(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
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

          {/* Recommended topics */}
          {recommendedTopics.length > 0 && !loading && !done && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-2">
                {hasProfile ? '根据你的学习情况推荐：' : '热门推荐：'}
              </p>
              <div className="flex flex-wrap gap-2">
                {recommendedTopics.map((t) => (
                  <Badge
                    key={t}
                    variant="outline"
                    className="cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                    onClick={() => handleSelectRecommended(t)}
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}

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

      {/* Generated Sections */}
      {sections.map((s, i) => (
        <SectionCard
          key={s.section.id}
          section={s.section}
          chunks={s.chunks}
          index={i}
          jobId={currentJobId ?? undefined}
          onRetry={handleRetrySection}
          onAskQuestion={(sectionId, sectionTitle) => setChatSection({ id: sectionId, title: sectionTitle })}
        />
      ))}

      {/* Done Banner */}
      {done && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200/50 dark:border-green-800/30">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="font-medium text-green-700 dark:text-green-300">
                  授课完成！共 {sections.length} 个章节，{plan?.estimatedDuration} 分钟
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleFavorite}
                  className={cn(
                    'border-green-200 dark:border-green-800',
                    isFavorited
                      ? 'text-amber-500 hover:text-amber-600'
                      : 'text-green-600 dark:text-green-400 hover:text-green-700',
                  )}
                >
                  <Star className={cn('h-3 w-3 mr-1', isFavorited && 'fill-current')} />
                  {isFavorited ? '已收藏' : '收藏'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  className="text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:text-green-700"
                >
                  <Share2 className="h-3 w-3 mr-1" />
                  分享
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

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

      {/* Teaching Chat */}
      {currentJobId && (
        <TeachingChat
          jobId={currentJobId}
          sectionId={chatSection?.id}
          sectionTitle={chatSection?.title}
        />
      )}
    </div>
  );
}
