'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Loader2, Sparkles, AlertCircle, RefreshCw, Send, X, Brain, CheckCircle2, ThumbsUp, ThumbsDown, MessageCircle, Star, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

const TYPE_ICONS: Record<string, React.ReactNode> = {
  explanation: <BookOpen className="h-4 w-4" />,
  example: <Sparkles className="h-4 w-4" />,
  diagram: <BookOpen className="h-4 w-4" />,
  quiz: <Send className="h-4 w-4" />,
};

const TYPE_COLORS: Record<string, string> = {
  explanation: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  example: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  diagram: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400',
  quiz: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
};

// ── Section Renderer ───────────────────────────────────────────────

interface SectionCardProps {
  section: LessonSection;
  chunks: ContentChunk[];
  jobId?: string;
  onRetry?: (sectionId: string) => void;
  onAskQuestion?: (sectionId: string, sectionTitle: string) => void;
}

const SectionCard = React.memo(function SectionCard({
  section,
  chunks,
  jobId,
  onRetry,
  onAskQuestion,
}: SectionCardProps) {
  const sortedChunks = [...chunks].sort((a, b) => a.order - b.order);
  const hasFailed = sortedChunks.some((c) => c.failed);

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        'bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-sky-200/50 dark:border-sky-800/30',
        hasFailed && 'border-red-200 dark:border-red-800/50',
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="secondary" className={cn(TYPE_COLORS[section.contentType])}>
                {TYPE_ICONS[section.contentType]}
                <span className="ml-1">
                  {section.contentType === 'quiz'
                    ? '随堂测验'
                    : section.contentType === 'example'
                      ? '例题讲解'
                      : '知识讲解'}
                </span>
              </Badge>
              {section.title}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {DEPTH_LABELS[section.depth]}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {section.estimatedDuration}分钟
              </span>
            </div>
          </div>
          {section.knowledgePoints.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {section.knowledgePoints.map((kp) => (
                <Badge
                  key={kp}
                  variant="outline"
                  className="text-[11px] border-sky-200/50 dark:border-sky-700/30 text-sky-700 dark:text-sky-300"
                >
                  {kp}
                </Badge>
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
    <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="flex gap-2">
            <div className="h-5 w-16 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-5 w-12 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
        <div className="flex gap-1.5 mt-2">
          <div className="h-5 w-20 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-5 w-16 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-24 rounded-lg bg-slate-200 dark:bg-slate-700" />
        <div className="h-16 rounded-lg bg-slate-200 dark:bg-slate-700" />
      </CardContent>
    </Card>
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
  const [sections, setSections] = useState<
    { section: LessonSection; chunks: ContentChunk[] }[]
  >([]);
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

    // Pick the most recent active job
    const entry = entries[entries.length - 1];

    (async () => {
      try {
        const data = await fetchTeachingJob(entry.jobId);
        if (!data || data.status === 'cancelled' || data.status === 'failed') {
          removeActiveTeachingJobEntry(entry.jobId);
          return;
        }

        if (data.done && data.status === 'succeeded') {
          // Job already completed
          setPlan(data.plan ?? null);
          setSections(data.sections ?? []);
          setDone(true);
          setTopic(entry.topic);
          removeActiveTeachingJobEntry(entry.jobId);
          return;
        }

        // Still running — resume polling
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

        // Done
        setPlan(result.plan ?? null);
        setSections(result.sections ?? []);
        setDone(true);
        setLoading(false);
        removeActiveTeachingJobEntry(jobId);

        // Update task store
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

      // Persist to sessionStorage
      addActiveTeachingJobEntry({ jobId, topic: topic.trim() });

      // Register in task store for global task bar
      // resultRoute = '/sky/teaching' so the notification is hidden on the teaching page itself
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

      // Start polling
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
      {/* Input Area */}
      <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-sky-200/50 dark:border-sky-800/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-sky-500" />
            智能授课
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            输入授课主题，AI 将根据你的学习情况自动生成个性化教案并流式推送
          </p>
        </CardHeader>
        <CardContent>
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
                className="min-w-[100px] border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
              >
                <X className="h-4 w-4 mr-2" />
                取消
              </Button>
            ) : (
              <Button
                onClick={handleStart}
                disabled={!canSubmit}
                className="min-w-[100px] bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                开始授课
              </Button>
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
            <p className="text-xs text-amber-500 mt-2">
              请先登录后再使用授课功能
            </p>
          )}
        </CardContent>
      </Card>

      {/* Progress Card */}
      {loading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="overflow-hidden border-sky-200/60 dark:border-sky-800/40 bg-gradient-to-br from-white via-sky-50/30 to-blue-50/20 dark:from-slate-900 dark:via-sky-950/20 dark:to-blue-950/10">
            <CardContent className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shadow-lg shadow-sky-500/25">
                    <Sparkles className="h-5 w-5 text-white animate-pulse" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-green-400 animate-ping" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {plan ? plan.title : '正在分析学情...'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {message || '正在准备...'}
                  </p>
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-sky-500 to-blue-600 bg-clip-text text-transparent">
                  {progress}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="relative">
                <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
                {/* Glow effect */}
                <motion.div
                  className="absolute top-0 h-2.5 rounded-full bg-gradient-to-r from-sky-400/40 via-blue-500/40 to-indigo-500/40 blur-sm"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>

              {/* Section Dots */}
              {plan && plan.sections.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {plan.sections.map((sec, i) => {
                    const isCompleted = i < sections.length;
                    const isCurrent = i === sections.length && loading;
                    return (
                      <div
                        key={sec.id}
                        className="group relative flex-1"
                        title={sec.title}
                      >
                        <div
                          className={cn(
                            'h-1.5 rounded-full transition-all duration-500',
                            isCompleted
                              ? 'bg-gradient-to-r from-sky-400 to-blue-500'
                              : isCurrent
                                ? 'bg-sky-200 dark:bg-sky-800 animate-pulse'
                                : 'bg-slate-200 dark:bg-slate-700',
                          )}
                        />
                        {/* Tooltip */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          <div className="px-2 py-1 rounded bg-slate-800 dark:bg-slate-700 text-[10px] text-white whitespace-nowrap">
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
                ].map((step, i) => {
                  const isActive = loading && (
                    (step.key === 'planning' && !plan) ||
                    (step.key === 'generating_content' && !!plan)
                  );
                  const isDone = step.key === 'planning' && !!plan;
                  return (
                    <div
                      key={step.key}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all',
                        isActive
                          ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 font-medium'
                          : isDone
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-muted-foreground',
                      )}
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
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Lesson Plan Summary */}
      {plan && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{plan.title}</CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>预计 {plan.estimatedDuration} 分钟</span>
                <span>{plan.sections.length} 个章节</span>
                {plan.focusPoints.length > 0 && (
                  <div className="flex gap-1.5">
                    <span>重点：</span>
                    {plan.focusPoints.map((fp) => (
                      <Badge key={fp} variant="outline" className="text-[11px]">
                        {fp}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>
        </motion.div>
      )}

      {/* Loading Skeletons */}
      {loading && sections.length < (plan?.sections.length ?? 0) && <SectionSkeleton />}

      {/* Generated Sections */}
      {sections.map((s) => (
        <SectionCard
          key={s.section.id}
          section={s.section}
          chunks={s.chunks}
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
      {error && (
        <Card className="bg-red-50 dark:bg-red-900/20 border-red-200/50 dark:border-red-800/30">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            <span className="text-sm text-red-600 dark:text-red-400 flex-1">
              {error}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleStart}
              className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              重试
            </Button>
          </CardContent>
        </Card>
      )}

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
