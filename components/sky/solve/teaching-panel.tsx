'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Star,
  Pencil,
  FileText,
  Presentation,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MathRenderer } from './math-renderer';
import { QuizInteraction } from './quiz-interaction';
import { TeachingChat } from './teaching-chat';
import { StudyGroupPanel } from './study-group-panel';
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
  type TeachingJobState,
} from '@/lib/teaching/teaching-job-client';
import {
  addActiveTeachingJobEntry,
  removeActiveTeachingJobEntry,
  getActiveTeachingJobEntries,
} from '@/lib/teaching/teaching-session';
import type { LessonPlan, LessonSection } from '@/lib/teaching/lesson-types';
import type { ContentChunk } from '@/lib/teaching/content-types';
import { analyzeHighlights } from '@/lib/teaching/personalized-highlighter';
import type { StudentProfile } from '@/lib/student/profile-types';
import type { LearningPath } from '@/lib/teaching/learning-path-types';
import { inferSubject } from '@/lib/mistakes/subject-inference';
import type { Subject } from '@/lib/solve/agents/analyze-types';
import { HOT_TOPICS, searchTopics } from '@/configs/teaching-topics';

// ── Types ─────────────────────────────────────────────────────────

const DEPTH_LABELS: Record<string, string> = {
  basic: '基础讲解',
  intermediate: '重点强化',
  advanced: '拓展提升',
};

const DEPTH_STAR_COLORS: Record<string, string> = {
  basic: 'text-emerald-500',
  intermediate: 'text-indigo-500',
  advanced: 'text-rose-500',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  explanation: <BookOpen className="h-3.5 w-3.5" />,
  example: <Sparkles className="h-3.5 w-3.5" />,
  diagram: <BookOpen className="h-3.5 w-3.5" />,
  quiz: <Send className="h-3.5 w-3.5" />,
};

/** Infer a subject to use for cold-start topic recommendations. */
function resolveColdStartSubject(masteryByKnowledge?: Record<string, number>): Subject {
  if (!masteryByKnowledge) return 'math';
  const subjects = Object.entries(masteryByKnowledge)
    .filter(([, m]) => m > 0)
    .map(([kp, m]) => ({ subject: inferSubject(kp), mastery: m as number }))
    .filter((s) => s.subject !== 'unknown');
  if (subjects.length === 0) return 'math';
  // Pick the subject with the lowest average mastery
  const subjectStats = new Map<Subject, { sum: number; count: number }>();
  for (const { subject, mastery } of subjects) {
    const stat = subjectStats.get(subject) ?? { sum: 0, count: 0 };
    stat.sum += mastery;
    stat.count += 1;
    subjectStats.set(subject, stat);
  }
  const weakest = Array.from(subjectStats.entries()).sort(
    (a, b) => a[1].sum / a[1].count - b[1].sum / b[1].count,
  )[0]?.[0];
  return weakest ?? 'math';
}

/* 投射类型 — 星际色彩 */
const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  explanation: {
    label: '讲解',
    cls: 'bg-indigo-900/20 text-indigo-300 border border-indigo-500/20',
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
    cls: 'bg-amber-900/20 text-amber-300 border border-amber-500/20',
  },
};

// ── Section Renderer ───────────────────────────────────────────────

interface SectionCardProps {
  section: LessonSection;
  chunks: ContentChunk[];
  index: number;
  jobId?: string;
  profile?: StudentProfile | null;
  onRetry?: (sectionId: string) => void;
  onAskQuestion?: (sectionId: string, sectionTitle: string) => void;
  onFeedback?: (type: 'mastered' | 'needs_review') => void;
}

const SectionCard = React.memo(function SectionCard({
  section,
  chunks,
  index,
  jobId,
  profile,
  onRetry,
  onAskQuestion,
  onFeedback,
}: SectionCardProps) {
  const sortedChunks = [...chunks].sort((a, b) => a.order - b.order);
  const hasFailed = sortedChunks.some((c) => c.failed);
  const typeBadge = TYPE_BADGE[section.contentType] ?? TYPE_BADGE.explanation;

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
      <Card
        className={cn(
          'rounded-2xl border bg-[var(--teaching-surface)]/60 dark:bg-[var(--teaching-surface)]/60 backdrop-blur-sm shadow-sm overflow-hidden',
          hasFailed && 'border-red-200 dark:border-red-800/50',
        )}
        style={{ borderColor: hasFailed ? undefined : 'var(--teaching-border)' }}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Badge variant="secondary" className={cn('text-[11px] gap-1', typeBadge.cls)}>
                {TYPE_ICONS[section.contentType]}
                {typeBadge.label}
              </Badge>
              <h3 className="text-base font-semibold text-[var(--teaching-text)] truncate">
                {section.title}
              </h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant="outline"
                className={cn(
                  'text-[11px] gap-1 border-[var(--teaching-border)]',
                  DEPTH_STAR_COLORS[section.depth],
                )}
              >
                <Star className="h-3 w-3 fill-current" />
                {DEPTH_LABELS[section.depth]}
              </Badge>
              <span className="text-xs text-[var(--teaching-muted)]">
                {section.estimatedDuration}分钟
              </span>
            </div>
          </div>
          {section.knowledgePoints.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {section.knowledgePoints.map((kp) => (
                <span
                  key={kp}
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium text-[var(--teaching-primary)] bg-[var(--teaching-primary)]/8 border border-[var(--teaching-primary)]/15"
                >
                  {kp}
                </span>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {sortedChunks.map((chunk) => (
            <div
              key={chunk.order}
              className={cn(
                'rounded-xl p-4 border-l-2 transition-colors',
                chunk.type === 'formula' &&
                  'bg-indigo-50/50 dark:bg-indigo-950/20 border-l-indigo-400 border-indigo-100/60 dark:border-indigo-800/30',
                chunk.type === 'example' &&
                  'bg-violet-50/50 dark:bg-violet-950/20 border-l-violet-400 border-violet-100/60 dark:border-violet-800/30',
                chunk.type === 'quiz' &&
                  'bg-amber-50/50 dark:bg-amber-950/20 border-l-amber-400 border-amber-100/60 dark:border-amber-800/30',
                chunk.type === 'diagram' &&
                  'bg-sky-50/50 dark:bg-sky-950/20 border-l-sky-400 border-sky-100/60 dark:border-sky-800/30',
                chunk.type === 'text' &&
                  'bg-slate-50/70 dark:bg-slate-800/30 border-l-slate-300 dark:border-l-slate-600 border-slate-100/60 dark:border-slate-700/30',
                chunk.failed &&
                  'bg-red-50/50 dark:bg-red-950/20 border-l-red-400 border-red-100/60 dark:border-red-800/30',
                chunk.isFollowUp &&
                  'ml-4 border-l-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/10',
              )}
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {chunk.type === 'example' && (
                  <Badge
                    variant="secondary"
                    className="bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
                  >
                    例题
                  </Badge>
                )}
                {chunk.type === 'quiz' && (
                  <Badge
                    variant="secondary"
                    className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                  >
                    随堂测验
                  </Badge>
                )}
                {chunk.type === 'formula' && (
                  <Badge
                    variant="secondary"
                    className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                  >
                    核心公式
                  </Badge>
                )}
                {chunk.failed && (
                  <Badge
                    variant="secondary"
                    className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                  >
                    生成失败
                  </Badge>
                )}
                {chunk.isFollowUp && (
                  <Badge
                    variant="secondary"
                    className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                  >
                    追问补充
                  </Badge>
                )}
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className={cn('flex-1 min-w-0', chunk.type === 'formula' && 'text-center')}>
                  {chunk.type === 'quiz' && chunk.options && chunk.options.length > 0 ? (
                    <QuizInteraction chunk={chunk} jobId={jobId} />
                  ) : (
                    <div
                      className={cn(
                        'text-sm leading-relaxed text-slate-800 dark:text-slate-100',
                        chunk.type === 'formula' && 'text-base',
                      )}
                    >
                      <MathRenderer
                        content={chunk.content}
                        displayMode={chunk.type === 'formula'}
                        highlights={
                          chunk.type !== 'formula' && profile
                            ? analyzeHighlights(chunk.content, profile)
                            : undefined
                        }
                      />
                    </div>
                  )}
                </div>
                <TTSButton text={chunk.content} className="shrink-0 mt-0.5" />
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
            <div className="flex justify-between items-center pt-3 border-t border-[var(--teaching-border)]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAskQuestion?.(section.id, section.title)}
                className="text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
              >
                <MessageCircle className="h-3 w-3 mr-1" />
                提问
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (jobId) {
                      try {
                        await fetch('/api/sky/teaching/feedback', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            jobId,
                            sectionId: section.id,
                            feedbackType: 'mastered',
                          }),
                        });
                      } catch {
                        // ignore network errors
                      }
                    }
                    toast.success('已标记为「已掌握」');
                    onFeedback?.('mastered');
                  }}
                  className="text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                >
                  <ThumbsUp className="h-3 w-3 mr-1" />
                  已掌握
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (jobId) {
                      try {
                        await fetch('/api/sky/teaching/feedback', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            jobId,
                            sectionId: section.id,
                            feedbackType: 'needs_review',
                          }),
                        });
                      } catch {
                        // ignore network errors
                      }
                    }
                    toast.success('已标记为「需复习」');
                    onFeedback?.('needs_review');
                  }}
                  className="text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
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
      className="rounded-2xl border p-5 animate-pulse bg-[var(--teaching-surface)]"
      style={{ borderColor: 'var(--teaching-border)' }}
    >
      <div className="flex items-center justify-between">
        <div
          className="h-6 w-36 rounded-lg"
          style={{ background: 'color-mix(in srgb, var(--teaching-primary) 8%, transparent)' }}
        />
        <div className="flex gap-2">
          <div
            className="h-5 w-16 rounded-md"
            style={{ background: 'color-mix(in srgb, var(--teaching-primary) 6%, transparent)' }}
          />
          <div
            className="h-5 w-12 rounded-md"
            style={{ background: 'color-mix(in srgb, var(--teaching-primary) 6%, transparent)' }}
          />
        </div>
      </div>
      <div className="flex gap-1.5 mt-3">
        <div
          className="h-5 w-20 rounded-full"
          style={{ background: 'color-mix(in srgb, var(--teaching-primary) 6%, transparent)' }}
        />
        <div
          className="h-5 w-16 rounded-full"
          style={{ background: 'color-mix(in srgb, var(--teaching-primary) 6%, transparent)' }}
        />
      </div>
      <div className="space-y-3 mt-4">
        <div
          className="h-24 rounded-xl"
          style={{ background: 'color-mix(in srgb, var(--teaching-primary) 4%, transparent)' }}
        />
        <div
          className="h-16 rounded-xl"
          style={{ background: 'color-mix(in srgb, var(--teaching-primary) 4%, transparent)' }}
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
    isFavorited?: boolean;
  } | null;
  /** Job id of the history item being viewed, used for homework/favorite */
  viewHistoryJobId?: string;
  onViewedHistory?: () => void;
  initialTopic?: string;
  personalizationNotice?: string | null;
}

export function TeachingPanel({
  viewHistoryItem,
  viewHistoryJobId,
  onViewedHistory,
  initialTopic,
  personalizationNotice,
}: TeachingPanelProps) {
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
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [chatSection, setChatSection] = useState<{ id: string; title: string } | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);

  // Homework state
  const [homework, setHomework] = useState<{
    title: string;
    description: string;
    questions: Array<{
      id: number;
      question: string;
      options: string[];
      answer: number;
      explanation: string;
      knowledgePoint: string;
      source: string;
    }>;
    weakKnowledgePoints: string[];
    estimatedDuration: number;
  } | null>(null);
  const [homeworkLoading, setHomeworkLoading] = useState(false);
  const [showHomework, setShowHomework] = useState(false);
  const [toClassroomLoading, setToClassroomLoading] = useState(false);
  const [learningPath, setLearningPath] = useState<LearningPath | null>(null);
  const [showStudyGroup, setShowStudyGroup] = useState(false);

  // Chapter-by-chapter reading state (-1 = not started)
  const [displayIndex, setDisplayIndex] = useState(-1);

  // Learning progress tracking
  const [feedbackStats, setFeedbackStats] = useState<{ mastered: number; needsReview: number }>({
    mastered: 0,
    needsReview: 0,
  });

  // Diagnostic state
  const [diagnosticStep, setDiagnosticStep] = useState<'idle' | 'loading' | 'ready' | 'done'>(
    'idle',
  );
  const [diagnosticSessionId, setDiagnosticSessionId] = useState<string | null>(null);
  const [diagnosticQuestions, setDiagnosticQuestions] = useState<
    Array<{
      id: number;
      question: string;
      options: string[];
      knowledgePoint: string;
    }>
  >([]);
  const [diagnosticAnswers, setDiagnosticAnswers] = useState<Record<number, number>>({});
  const [diagnosticResult, setDiagnosticResult] = useState<{
    accuracy: number;
    weakPrerequisites: string[];
    recommendedDepth: string;
    canProceed: boolean;
  } | null>(null);

  // Server-pushed progress (0-100). 优先于本地 sections 比例计算，使进度条紧跟
  // 后端实际生成/重试进度，避免 Phase 2.5 重试期间卡在 100%。
  const [serverProgress, setServerProgress] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const userEditedTopicRef = useRef(false);

  useEffect(() => {
    if (!initialTopic || userEditedTopicRef.current || topic.trim() || loading || done) return;
    setTopic(initialTopic);
  }, [done, initialTopic, loading, topic]);

  // ── Fetch recommended topics on mount ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/student/profile', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            const {
              weakPoints,
              hasProfile: profileExists,
              masteryByKnowledge,
              errorPatterns,
            } = data.data;
            setHasProfile(profileExists);

            if (profileExists && masteryByKnowledge) {
              setProfile({
                userId: user?.id || 'default-user',
                masteryBySubject: {} as Record<string, number>,
                masteryByKnowledge: masteryByKnowledge || {},
                weakPoints: weakPoints || [],
                strongPoints: Object.entries(masteryByKnowledge || {})
                  .filter(([, m]) => (m as number) > 80)
                  .map(([k]) => k),
                errorPatterns: errorPatterns || [],
                totalQuestions: 0,
                totalCorrect: 0,
                lastUpdated: new Date(),
              });
            }

            if (profileExists && weakPoints.length > 0) {
              // Use weak points as recommendations
              setRecommendedTopics(weakPoints.slice(0, 5));
            } else {
              // Cold start: infer weakest subject from knowledge graph and use its hot topics
              const coldStartSubject = resolveColdStartSubject(masteryByKnowledge);
              const subjectTopics = HOT_TOPICS.find((c) => c.subject === coldStartSubject);
              setRecommendedTopics(subjectTopics?.topics.slice(0, 5) ?? []);
            }
          }
        }
      } catch {
        // Silently fail, use default topics
        const subjectTopics = HOT_TOPICS.find((c) => c.subject === 'math');
        setRecommendedTopics(subjectTopics?.topics.slice(0, 5) ?? []);
      }
    })();
  }, []);

  // ── Search suggestions ──
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleTopicChange = (value: string) => {
    userEditedTopicRef.current = true;
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
    userEditedTopicRef.current = true;
    setTopic(suggestion);
    setShowSuggestions(false);
  };

  const handleSelectRecommended = (recommended: string) => {
    userEditedTopicRef.current = true;
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
      setDisplayIndex(0);
      setIsFavorited(viewHistoryItem.isFavorited ?? false);
    } else {
      // Cleared history view: reset to the empty teaching interface
      setPlan(null);
      setSections([]);
      setDone(false);
      setLoading(false);
      setError(null);
      setTopic('');
      setDisplayIndex(-1);
      setIsFavorited(false);
      setHomework(null);
      setShowHomework(false);
      setLearningPath(null);
      setShowStudyGroup(false);
      setServerProgress(null);
      setMessage('');
    }
  }, [viewHistoryItem]);

  // ── Auto-show first section when it arrives ──
  useEffect(() => {
    if (sections.length > 0 && displayIndex === -1) {
      setDisplayIndex(0);
    }
  }, [sections.length, displayIndex]);

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
        setServerProgress(typeof data.progress === 'number' ? data.progress : null);
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
            if (data.sections !== undefined) {
              setSections(data.sections);
            }
            if (typeof data.progress === 'number') {
              setServerProgress(data.progress);
            }
            setMessage(data.message || '');
          },
          {
            onSectionDone: (sectionIndex, section, chunks) => {
              if (controller.signal.aborted) return;
              setSections((prev) => {
                const updated = [...prev];
                updated[sectionIndex] = { section, chunks };
                return updated;
              });
            },
            onPlanAdjusted: (adjustedPlan, reason) => {
              if (controller.signal.aborted) return;
              setPlan(adjustedPlan);
              setMessage(reason);
              toast.info(reason, { duration: 5000 });
            },
            onSupplementSection: (_sectionIndex, section, chunks, _reason) => {
              if (controller.signal.aborted) return;
              setSections((prev) => [...prev, { section, chunks }]);
              toast.success(`已补充强化内容：${section.title}`, { duration: 4000 });
            },
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
          toast.error('登录已过期，请重新登录', {
            duration: 5000,
            action: {
              label: '稍后登录',
              onClick: () => {
                // Keep current content, don't redirect
              },
            },
          });
          setTimeout(() => {
            window.location.href = '/auth/login';
          }, 5000);
          return;
        }
        setError(msg);
        setLoading(false);
        removeActiveTeachingJobEntry(jobId);
        useTaskStore.getState().removeTask(jobId);
      }
    })();
  }, []);

  // ── Fetch learning path when job completes ──
  useEffect(() => {
    if (!done) return;
    (async () => {
      try {
        const res = await fetch('/api/sky/learning-path', { credentials: 'include' });
        const data = await res.json();
        if (data.success && data.data.path) {
          setLearningPath(data.data.path);
        }
      } catch {
        // Non-fatal: learning path is optional
      }
    })();
  }, [done]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ── Actually start the teaching job (after diagnostic if any) ──
  const startTeachingJob = useCallback(
    async (overrideTopic?: string) => {
      const t = overrideTopic || topic;
      if (!t.trim()) return;

      setLoading(true);
      setError(null);
      setPlan(null);
      setSections([]);
      setDone(false);
      setServerProgress(null);
      setMessage('正在提交...');
      setDiagnosticStep('idle');
      setDiagnosticSessionId(null);
      setFeedbackStats({ mastered: 0, needsReview: 0 });
      setLearningPath(null);
      setDisplayIndex(-1);
      setIsFavorited(false);
      setHomework(null);
      setShowHomework(false);

      try {
        const jobId = await submitTeachingJob(t.trim());

        setCurrentJobId(jobId);

        addActiveTeachingJobEntry({ jobId, topic: t.trim() });

        useTaskStore.getState().addTask({
          id: jobId,
          type: 'teaching',
          label: `授课: ${t.trim().length > 20 ? t.trim().slice(0, 17) + '...' : t.trim()}`,
          status: 'running',
          progress: 0,
          phase: '正在提交...',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          jobId,
          resultRoute: '/sky/teaching',
        });

        resumePolling(jobId, t.trim());
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
    },
    [topic, resumePolling],
  );

  // ── Start with diagnostic ──
  const handleStart = useCallback(async () => {
    if (!topic.trim()) return;

    // Skip diagnostic if no profile
    if (!hasProfile) {
      await startTeachingJob();
      return;
    }

    setDiagnosticStep('loading');
    setDiagnosticSessionId(null);
    setDiagnosticAnswers({});
    setDiagnosticResult(null);

    // Resolve subject from topic + profile knowledge graph
    const resolvePanelSubject = (): Subject => {
      const fromTopic = inferSubject(topic.trim());
      if (fromTopic !== 'unknown') return fromTopic;
      if (profile?.masteryByKnowledge) {
        const weakestKp = Object.entries(profile.masteryByKnowledge)
          .filter(([, m]) => m > 0)
          .sort((a, b) => a[1] - b[1])[0]?.[0];
        if (weakestKp) {
          const fromKp = inferSubject(weakestKp);
          if (fromKp !== 'unknown') return fromKp;
        }
      }
      return 'math';
    };

    try {
      const res = await fetch('/api/sky/teaching/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), subject: resolvePanelSubject() }),
      });
      const data = await res.json();

      if (!data.success) {
        toast.error(data.error || '诊断生成失败');
        setDiagnosticStep('idle');
        setDiagnosticSessionId(null);
        return;
      }

      if (data.data.hasPrerequisites === false) {
        // No prerequisites to test, start directly
        await startTeachingJob();
        return;
      }

      setDiagnosticSessionId(data.data.sessionId);
      setDiagnosticQuestions(data.data.questions);
      setDiagnosticStep('ready');
    } catch {
      toast.error('诊断生成失败，直接开始授课');
      await startTeachingJob();
    }
  }, [topic, hasProfile, startTeachingJob]);

  // ── Submit diagnostic answers ──
  const submitDiagnostic = useCallback(async () => {
    if (!diagnosticSessionId) {
      toast.error('诊断会话已过期，请重新开始');
      setDiagnosticStep('idle');
      return;
    }

    const answers = diagnosticQuestions.map((q) => ({
      questionId: q.id,
      selectedOption: diagnosticAnswers[q.id] ?? -1,
    }));

    try {
      const res = await fetch('/api/sky/teaching/diagnostic/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: diagnosticSessionId, answers, topic: topic.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        setDiagnosticResult(data.data);
        setDiagnosticStep('done');
      } else {
        toast.error(data.error || '提交失败');
      }
    } catch {
      toast.error('提交失败');
    }
  }, [diagnosticQuestions, diagnosticAnswers, topic, diagnosticSessionId]);

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
  const handleRetrySection = useCallback(
    async (sectionId: string) => {
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
    },
    [currentJobId],
  );

  // ── Favorite ──
  const effectiveJobId = currentJobId ?? viewHistoryJobId;

  const handleToggleFavorite = useCallback(async () => {
    if (!effectiveJobId) return;

    try {
      const result = await toggleTeachingFavorite(effectiveJobId);
      setIsFavorited(result);
      toast.success(result ? '已收藏' : '已取消收藏');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '操作失败';
      toast.error(msg);
    }
  }, [effectiveJobId]);

  // ── Convert to Classroom ──
  const handleToClassroom = useCallback(async () => {
    if (!currentJobId) return;
    setToClassroomLoading(true);
    try {
      const res = await fetch(`/api/sky/teaching/${currentJobId}/to-classroom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('已转换为课堂模式');
        window.open(data.data.redirectUrl, '_blank');
      } else {
        toast.error(data.error || '转换失败');
      }
    } catch {
      toast.error('转换失败');
    } finally {
      setToClassroomLoading(false);
    }
  }, [currentJobId]);

  // ── Next Lesson from Learning Path ──
  const handleNextLesson = useCallback(() => {
    const next = learningPath?.nodes.find(
      (n) => n.status === 'pending' || n.status === 'in_progress',
    );
    if (!next) {
      toast.info('学习路径已全部完成');
      return;
    }
    setTopic(next.topic);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    startTeachingJob(next.topic);
  }, [learningPath, startTeachingJob]);

  // ── Homework ──
  const handleFetchHomework = useCallback(async () => {
    if (!effectiveJobId) {
      toast.error('请先完成或选择一份教案');
      return;
    }

    if (homework) {
      setShowHomework((prev) => !prev);
      return;
    }

    setHomeworkLoading(true);
    try {
      const res = await fetch(`/api/sky/teaching/${effectiveJobId}/homework`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setHomework(data.data);
        setShowHomework(true);
        toast.success('个性化作业已生成');
      } else {
        toast.error(data.error || '作业生成失败');
      }
    } catch {
      toast.error('作业生成失败');
    } finally {
      setHomeworkLoading(false);
    }
  }, [effectiveJobId, homework]);

  // 优先使用服务端推送的进度（紧跟实际生成/重试进度，避免重试期间卡在 100%）；
  // 服务端未推送时回退到本地 sections 完成比例。
  const sectionsRatio = plan ? Math.round((sections.length / plan.sections.length) * 100) : 0;
  const progress = serverProgress ?? sectionsRatio;
  const canSubmit = !loading && topic.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* ═══ 教学指令台 ═══ */}
      <div
        className="rounded-2xl border bg-[var(--teaching-surface)] backdrop-blur-sm overflow-hidden shadow-sm"
        style={{ borderColor: 'var(--teaching-border)' }}
      >
        <div
          className="px-5 pt-5 pb-4"
          style={{
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--teaching-primary) 6%, transparent) 0%, transparent 100%)',
            borderBottom: '1px solid var(--teaching-border)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--teaching-primary)]/10 border border-[var(--teaching-primary)]/20">
              <Sparkles className="h-4 w-4 text-[var(--teaching-primary)]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--teaching-text)]">教学指令台</h3>
              <p className="text-sm text-[var(--teaching-muted)]">
                输入授课主题，AI 导师将根据你的学习情况生成个性化教案
              </p>
            </div>
          </div>
        </div>
        <div className="px-5 py-5">
          {personalizationNotice && !done && (
            <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-200">
              {personalizationNotice}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Input
                value={topic}
                onChange={(e) => handleTopicChange(e.target.value)}
                placeholder="输入授课主题，例如：二次函数、牛顿定律..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) handleStart();
                }}
                disabled={loading}
                className="h-12 rounded-xl border-[var(--teaching-border)] bg-white/70 dark:bg-slate-900/50 px-4 text-[var(--teaching-text)] placeholder:text-[var(--teaching-muted)] focus:border-[var(--teaching-primary)] focus:ring-[var(--teaching-primary)]/20"
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
                <div className="absolute z-10 top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="w-full text-left px-4 py-2.5 text-sm text-[var(--teaching-text)] hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
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
                className="min-w-[120px] h-12 rounded-xl border-red-500/30 text-red-400 hover:bg-red-900/20 hover:border-red-500/50"
              >
                <X className="h-4 w-4 mr-2" />
                取消
              </Button>
            ) : (
              <button
                onClick={handleStart}
                disabled={!canSubmit}
                className="teaching-button-primary teaching-button-sweep min-w-[140px] h-12 rounded-xl px-5 text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-[var(--teaching-text)]"
              >
                <Sparkles className="h-4 w-4 text-[var(--teaching-primary)]" />
                启动授课
              </button>
            )}
          </div>

          {/* Recommended topics */}
          {recommendedTopics.length > 0 && !loading && !done && (
            <div className="mt-4">
              <p className="text-xs font-medium text-[var(--teaching-muted)] mb-2">
                {hasProfile ? '根据你的学习情况推荐：' : '热门推荐：'}
              </p>
              <div className="flex flex-wrap gap-2">
                {recommendedTopics.map((t) => (
                  <Badge
                    key={t}
                    variant="outline"
                    className="cursor-pointer rounded-full px-3 py-1 text-xs font-medium border-[var(--teaching-border)] text-[var(--teaching-text)] hover:border-[var(--teaching-border-strong)] hover:bg-[var(--teaching-primary)]/8 transition-colors"
                    onClick={() => handleSelectRecommended(t)}
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {!user && (
            <p className="text-xs mt-3 text-[var(--teaching-warm)]">请先登录后再使用授课功能</p>
          )}
        </div>
      </div>

      {/* ═══ 备课进度 ═══ */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div
              className="rounded-2xl border bg-[var(--teaching-surface)] backdrop-blur-sm overflow-hidden shadow-sm"
              style={{ borderColor: 'var(--teaching-border)' }}
            >
              <div className="p-5 space-y-5">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <div
                      className="h-11 w-11 rounded-2xl flex items-center justify-center"
                      style={{
                        background:
                          'linear-gradient(135deg, color-mix(in srgb, var(--teaching-primary) 25%, transparent), color-mix(in srgb, var(--teaching-accent) 15%, transparent))',
                        border: '1px solid var(--teaching-border-strong)',
                        boxShadow: '0 0 16px var(--teaching-glow)',
                      }}
                    >
                      <Sparkles className="h-5 w-5 text-[var(--teaching-primary)] animate-pulse" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[var(--teaching-surface)] flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-[var(--teaching-text)]">
                      {plan ? plan.title : '正在分析学情...'}
                    </p>
                    <p className="text-xs mt-0.5 truncate text-[var(--teaching-muted)]">
                      {message || '正在准备...'}
                    </p>
                  </div>
                  <span className="text-xl font-bold font-mono text-[var(--teaching-primary)]">
                    {progress}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="relative">
                  <div
                    className="h-2.5 rounded-full overflow-hidden relative"
                    style={{
                      background: 'color-mix(in srgb, var(--teaching-primary) 8%, transparent)',
                    }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background:
                          'linear-gradient(90deg, color-mix(in srgb, var(--teaching-primary) 60%, transparent), var(--teaching-primary))',
                        boxShadow: '0 0 10px var(--teaching-glow)',
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none teaching-project-scan" />
                </div>

                {/* Section Nodes */}
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
                              isCompleted ? '' : isCurrent ? 'teaching-primary-breathe' : '',
                            )}
                            style={{
                              background: isCompleted
                                ? 'linear-gradient(90deg, color-mix(in srgb, var(--teaching-primary) 70%, transparent), var(--teaching-primary))'
                                : isCurrent
                                  ? 'color-mix(in srgb, var(--teaching-primary) 30%, transparent)'
                                  : 'color-mix(in srgb, var(--teaching-primary) 8%, transparent)',
                              boxShadow: isCompleted ? '0 0 6px var(--teaching-glow)' : 'none',
                            }}
                          />
                          {/* Tooltip */}
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            <div
                              className="px-2 py-1 rounded-md text-[10px] whitespace-nowrap shadow-sm"
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
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all',
                          isActive ? 'font-medium' : '',
                        )}
                        style={{
                          background: isActive
                            ? 'color-mix(in srgb, var(--teaching-primary) 12%, transparent)'
                            : 'transparent',
                          color: isDone
                            ? 'var(--teaching-success)'
                            : isActive
                              ? 'var(--teaching-primary)'
                              : 'var(--teaching-muted)',
                          border: isActive
                            ? '1px solid var(--teaching-border-strong)'
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

      {/* ═══ 教案摘要 ═══ */}
      <AnimatePresence>
        {plan && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div
              className="rounded-2xl border bg-[var(--teaching-holo)] backdrop-blur-sm overflow-hidden shadow-sm"
              style={{ borderColor: 'var(--teaching-border-strong)' }}
            >
              <div className="px-5 py-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-[var(--teaching-primary)]">
                      {plan.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mt-1.5 text-[var(--teaching-muted)]">
                      <span>预计 {plan.estimatedDuration} 分钟</span>
                      <span>{plan.sections.length} 个章节</span>
                    </div>
                  </div>
                  {!currentJobId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPlan(null);
                        setSections([]);
                        setDone(false);
                        setTopic('');
                        setDisplayIndex(-1);
                        setError(null);
                        setHomework(null);
                        setShowHomework(false);
                        setLearningPath(null);
                        setShowStudyGroup(false);
                        onViewedHistory?.();
                      }}
                      className="text-[var(--teaching-muted)] hover:text-[var(--teaching-primary)] hover:bg-[var(--teaching-primary)]/10 shrink-0"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      返回
                    </Button>
                  )}
                </div>
                {plan.focusPoints.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-[var(--teaching-muted)]">重点：</span>
                    {plan.focusPoints.map((fp) => (
                      <span
                        key={fp}
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium text-[var(--teaching-primary)] bg-[var(--teaching-primary)]/8 border border-[var(--teaching-primary)]/15"
                      >
                        {fp}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Diagnostic Quiz Modal */}
      {diagnosticStep !== 'idle' && diagnosticStep !== 'done' && (
        <Card
          className="rounded-2xl border bg-[var(--teaching-surface)] overflow-hidden shadow-sm"
          style={{ borderColor: 'var(--teaching-border)' }}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--teaching-primary)]/10 border border-[var(--teaching-primary)]/20">
                <Brain className="h-5 w-5 text-[var(--teaching-primary)]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--teaching-text)]">
                  星际课前诊断
                </h3>
                <p className="text-sm text-[var(--teaching-muted)]">
                  {diagnosticStep === 'loading'
                    ? '正在生成前置知识检测题...'
                    : '请完成以下前置知识检测，我们将根据结果调整授课重点'}
                </p>
              </div>
            </div>
            {diagnosticStep === 'ready' && diagnosticQuestions.length > 0 && (
              <div className="mt-3 h-1.5 rounded-full bg-[var(--teaching-primary)]/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--teaching-primary)] transition-all duration-300"
                  style={{
                    width: `${(Object.keys(diagnosticAnswers).length / diagnosticQuestions.length) * 100}%`,
                  }}
                />
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {diagnosticStep === 'loading' && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-7 w-7 animate-spin text-[var(--teaching-primary)]" />
              </div>
            )}
            {diagnosticStep === 'ready' &&
              diagnosticQuestions.map((q, idx) => (
                <div key={q.id} className="space-y-3">
                  <div className="text-base font-semibold leading-relaxed text-[var(--teaching-text)]">
                    <span className="text-[var(--teaching-primary)] mr-1">{idx + 1}.</span>
                    <MathRenderer content={q.question} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {q.options.map((opt, optIdx) => {
                      const selected = diagnosticAnswers[q.id] === optIdx;
                      return (
                        <button
                          key={optIdx}
                          onClick={() =>
                            setDiagnosticAnswers((prev) => ({ ...prev, [q.id]: optIdx }))
                          }
                          className={cn(
                            'flex items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition-all',
                            selected
                              ? 'border-[var(--teaching-border-strong)] bg-[var(--teaching-primary)]/10 text-[var(--teaching-text)]'
                              : 'border-[var(--teaching-border)] bg-white/50 dark:bg-slate-900/30 text-[var(--teaching-text)] hover:border-[var(--teaching-border-strong)] hover:bg-[var(--teaching-primary)]/5',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-semibold mt-0.5',
                              selected
                                ? 'bg-[var(--teaching-primary)] text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
                            )}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <MathRenderer content={opt} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            {diagnosticStep === 'ready' && diagnosticQuestions.length > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <Button
                  onClick={submitDiagnostic}
                  className="h-11 rounded-xl px-6 bg-[var(--teaching-primary)] hover:bg-[var(--teaching-primary-bright)] text-white"
                >
                  提交诊断
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDiagnosticStep('idle');
                    setDiagnosticSessionId(null);
                    startTeachingJob();
                  }}
                  className="h-11 rounded-xl border-[var(--teaching-border)] text-[var(--teaching-muted)] hover:text-[var(--teaching-text)] hover:bg-[var(--teaching-primary)]/5"
                >
                  跳过诊断，直接授课
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Diagnostic Result */}
      {diagnosticStep === 'done' && diagnosticResult && (
        <Card
          className={cn(
            'rounded-2xl border overflow-hidden shadow-sm',
            diagnosticResult.accuracy >= 80
              ? 'border-emerald-200/60 bg-emerald-50/40 dark:bg-emerald-950/15'
              : diagnosticResult.accuracy >= 50
                ? 'border-[var(--teaching-border)] bg-[var(--teaching-surface)]'
                : 'border-red-200/60 bg-red-50/40 dark:bg-red-950/15',
          )}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border',
                  diagnosticResult.accuracy >= 80
                    ? 'bg-emerald-100/70 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/30'
                    : diagnosticResult.accuracy >= 50
                      ? 'bg-[var(--teaching-primary)]/10 border-[var(--teaching-primary)]/20'
                      : 'bg-red-100/70 dark:bg-red-900/30 border-red-200 dark:border-red-800/30',
                )}
              >
                {diagnosticResult.accuracy >= 80 ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                ) : diagnosticResult.accuracy >= 50 ? (
                  <Brain className="h-6 w-6 text-[var(--teaching-primary)]" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-red-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-[var(--teaching-text)]">诊断报告</h3>
                <p className="text-sm text-[var(--teaching-muted)] mt-0.5">
                  {diagnosticResult.accuracy >= 80
                    ? '前置知识掌握良好，可以进入正式授课'
                    : diagnosticResult.accuracy >= 50
                      ? '前置知识基本掌握，建议关注薄弱点'
                      : '前置知识存在明显薄弱，需要重点补充'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={cn(
                    'text-3xl font-bold',
                    diagnosticResult.accuracy >= 80
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : diagnosticResult.accuracy >= 50
                        ? 'text-[var(--teaching-primary)]'
                        : 'text-red-500',
                  )}
                >
                  {diagnosticResult.accuracy}%
                </p>
                <p className="text-xs text-[var(--teaching-muted)]">正确率</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {diagnosticResult.weakPrerequisites.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[var(--teaching-muted)] mb-2">
                  薄弱前置知识点：
                </p>
                <div className="flex flex-wrap gap-2">
                  {diagnosticResult.weakPrerequisites.map((wp) => (
                    <Badge
                      key={wp}
                      variant="outline"
                      className="text-xs rounded-full px-2.5 py-1 border-[var(--teaching-border)] text-[var(--teaching-text)] bg-[var(--teaching-primary)]/5"
                    >
                      {wp}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <Button
                onClick={() => {
                  setDiagnosticStep('idle');
                  setDiagnosticSessionId(null);
                  startTeachingJob();
                }}
                className={cn(
                  'h-11 rounded-xl px-6 text-white',
                  diagnosticResult.accuracy >= 50
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-[var(--teaching-primary)] hover:bg-[var(--teaching-primary-bright)]',
                )}
              >
                {diagnosticResult.canProceed ? '开始授课' : '先开始授课，注意薄弱环节'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading Skeletons */}
      {loading && sections.length < (plan?.sections.length ?? 0) && <SectionSkeleton />}

      {/* Generated Sections — show one at a time */}
      {sections[displayIndex] && (
        <SectionCard
          key={sections[displayIndex].section.id}
          section={sections[displayIndex].section}
          chunks={sections[displayIndex].chunks}
          index={displayIndex}
          jobId={currentJobId ?? undefined}
          profile={profile}
          onRetry={handleRetrySection}
          onAskQuestion={(sectionId, sectionTitle) =>
            setChatSection({ id: sectionId, title: sectionTitle })
          }
          onFeedback={(type) =>
            setFeedbackStats((prev) => ({
              ...prev,
              mastered: type === 'mastered' ? prev.mastered + 1 : prev.mastered,
              needsReview: type === 'needs_review' ? prev.needsReview + 1 : prev.needsReview,
            }))
          }
        />
      )}

      {/* Chapter Navigation */}
      {displayIndex >= 0 && sections.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDisplayIndex((i) => {
                const next = Math.max(0, i - 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return next;
              });
            }}
            disabled={displayIndex <= 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            上一章
          </Button>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {displayIndex + 1} / {plan?.sections.length ?? sections.length}
          </span>
          {displayIndex < sections.length - 1 ? (
            <Button
              size="sm"
              onClick={() => {
                setDisplayIndex((i) => {
                  const next = i + 1;
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  return next;
                });
              }}
            >
              下一章
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : loading ? (
            <Button size="sm" disabled>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              正在生成下一章...
            </Button>
          ) : done ? null : (
            <Button size="sm" disabled>
              <ChevronRight className="h-4 w-4 ml-1" />
              下一章
            </Button>
          )}
        </motion.div>
      )}

      {/* Done Banner */}
      {done && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card
            className="rounded-2xl border bg-gradient-to-br from-emerald-50/80 to-indigo-50/60 dark:from-emerald-950/20 dark:to-indigo-950/15 shadow-sm"
            style={{ borderColor: 'var(--teaching-border)' }}
          >
            <CardContent className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/30">
                  <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="font-semibold text-[var(--teaching-text)]">
                  授课完成！共 {sections.length} 个章节，{plan?.estimatedDuration} 分钟
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToClassroom}
                  disabled={toClassroomLoading}
                  className="rounded-lg border-[var(--teaching-border)] text-[var(--teaching-text)] hover:bg-[var(--teaching-primary)]/10 hover:text-[var(--teaching-primary)]"
                >
                  {toClassroomLoading ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Presentation className="h-3.5 w-3.5 mr-1.5 text-[var(--teaching-accent)]" />
                  )}
                  转为课堂模式
                </Button>
                {learningPath?.nodes.some(
                  (n) => n.status === 'pending' || n.status === 'in_progress',
                ) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextLesson}
                    disabled={loading}
                    className="rounded-lg border-[var(--teaching-border)] text-[var(--teaching-text)] hover:bg-[var(--teaching-primary)]/10 hover:text-[var(--teaching-primary)]"
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <BookOpen className="h-3.5 w-3.5 mr-1.5 text-[var(--teaching-primary)]" />
                    )}
                    下一课
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStudyGroup((prev) => !prev)}
                  className="rounded-lg border-[var(--teaching-border)] text-[var(--teaching-text)] hover:bg-[var(--teaching-primary)]/10 hover:text-[var(--teaching-primary)]"
                >
                  <Users className="h-3.5 w-3.5 mr-1.5 text-[var(--teaching-primary)]" />
                  {showStudyGroup ? '收起学习小组' : 'AI 学习小组'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFetchHomework}
                  disabled={homeworkLoading}
                  className="rounded-lg border-[var(--teaching-border)] text-[var(--teaching-text)] hover:bg-[var(--teaching-primary)]/10 hover:text-[var(--teaching-primary)]"
                >
                  {homeworkLoading ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Pencil className="h-3.5 w-3.5 mr-1.5 text-[var(--teaching-primary)]" />
                  )}
                  {homework ? (showHomework ? '收起作业' : '查看作业') : '个性化作业'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleFavorite}
                  className={cn(
                    'rounded-lg border-[var(--teaching-border)]',
                    isFavorited
                      ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                      : 'text-[var(--teaching-text)] hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20',
                  )}
                >
                  <Star className={cn('h-3.5 w-3.5 mr-1.5', isFavorited && 'fill-current')} />
                  {isFavorited ? '已收藏' : '收藏'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Learning Summary */}
      {done && (feedbackStats.mastered > 0 || feedbackStats.needsReview > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card
            className="rounded-2xl border bg-[var(--teaching-surface)] shadow-sm"
            style={{ borderColor: 'var(--teaching-border)' }}
          >
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-5">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-[var(--teaching-primary)]" />
                  <span className="text-sm text-[var(--teaching-text)]">
                    已完成 <strong>{sections.length}</strong> 节
                  </span>
                </div>
                {feedbackStats.mastered > 0 && (
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-[var(--teaching-text)]">
                      标记掌握 <strong>{feedbackStats.mastered}</strong> 个知识点
                    </span>
                  </div>
                )}
                {feedbackStats.needsReview > 0 && (
                  <div className="flex items-center gap-2">
                    <ThumbsDown className="h-4 w-4 text-[var(--teaching-accent)]" />
                    <span className="text-sm text-[var(--teaching-text)]">
                      建议复习 <strong>{feedbackStats.needsReview}</strong> 个知识点
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Homework Card */}
      <AnimatePresence>
        {showHomework && homework && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <Card
              className="rounded-2xl border bg-[var(--teaching-surface)] shadow-sm overflow-hidden"
              style={{ borderColor: 'var(--teaching-border)' }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--teaching-primary)]/10 border border-[var(--teaching-primary)]/20">
                    <FileText className="h-5 w-5 text-[var(--teaching-primary)]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-[var(--teaching-text)]">
                      {homework.title}
                    </h3>
                    <p className="text-sm text-[var(--teaching-muted)]">{homework.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--teaching-muted)] mt-2">
                  <span>预计 {homework.estimatedDuration} 分钟</span>
                  <span>·</span>
                  <span>{homework.questions.length} 道题</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {homework.questions.map((q, idx) => (
                  <div key={q.id} className="space-y-2.5">
                    <div className="flex items-start gap-2">
                      <span className="text-sm font-semibold text-[var(--teaching-primary)] shrink-0">
                        {idx + 1}.
                      </span>
                      <div className="text-sm leading-relaxed text-[var(--teaching-text)]">
                        <MathRenderer content={q.question} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-5">
                      {q.options.map((opt, optIdx) => (
                        <div
                          key={optIdx}
                          className="text-sm px-3 py-2.5 rounded-xl border border-[var(--teaching-border)] bg-white/70 dark:bg-slate-900/40 text-[var(--teaching-text)]"
                        >
                          <span className="font-medium text-[var(--teaching-muted)] mr-1">
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          <MathRenderer content={opt} />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pl-5">
                      <Badge
                        variant="outline"
                        className="text-[11px] rounded-full px-2.5 py-0.5 border-[var(--teaching-border)] text-[var(--teaching-text)]"
                      >
                        {q.knowledgePoint}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[11px] rounded-full px-2.5 py-0.5',
                          q.source === 'question-bank'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
                        )}
                      >
                        {q.source === 'question-bank' ? '题库' : 'AI生成'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
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
            <div className="rounded-2xl border border-red-200/60 dark:border-red-800/40 bg-red-50/50 dark:bg-red-950/15 flex items-center gap-3 px-5 py-4">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
              <span className="text-sm text-red-700 dark:text-red-300 flex-1">{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStart}
                className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
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
          onReply={async () => {
            // Refresh job data to show newly appended follow-up chunks
            try {
              const data = await fetchTeachingJob(currentJobId);
              if (data && data.sections) {
                setSections(data.sections);
              }
            } catch {
              // ignore refresh errors
            }
          }}
        />
      )}

      {/* Study Group */}
      {showStudyGroup && effectiveJobId && <StudyGroupPanel jobId={effectiveJobId} />}
    </div>
  );
}
