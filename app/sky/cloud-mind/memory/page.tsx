'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { WorkspaceShell } from '@/components/sky/layout/workspace-shell';
import { PageTour } from '@/components/sky/tour/page-tour';
import { useTaskStore } from '@/lib/store/use-task-store';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { InlineMath } from '@/components/ui/inline-math';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  Sparkles,
  Loader2,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  CheckCircle2,
  BookOpen,
  Layers,
  AlertCircle,
  FileDown,
  X,
  CalendarClock,
  Clock3,
  Route,
  ShieldCheck,
  Target,
  TrendingUp,
} from 'lucide-react';
import type { MistakeCause } from '@/lib/solve/types';
import type { MistakeRecord } from '@/lib/mistakes/types';
import { useRouter } from 'next/navigation';
import type { MemoryCardDeck, MemoryCardsStreamEvent } from '@/lib/agents/cloud-mind/memory-cards-agent';
import { MEMORY_COUNT_OPTIONS } from '@/lib/student/profile-config';
import {
  buildMemoryCardId,
  buildMemoryDeckId,
  MEMORY_REVIEW_LABELS,
  scheduleMemoryReview,
} from '@/lib/cloud-mind/spaced-repetition';
import type {
  MemoryReviewRating,
  MemoryReviewRecord,
  PersonalizationContext,
} from '@/lib/cloud-mind/types';
import { completeLearningPlanTaskFromEvidence } from '@/lib/adaptive-learning/client/complete-learning-plan-task';
import { refreshLearningPlanAfterEvidence } from '@/lib/adaptive-learning/client/refresh-learning-plan';
import {
  createLearningDecision,
  reportLearningEvent,
  reportLearningOutcome,
  type LearningDecisionContext,
  type LearningDecisionPromise,
} from '@/lib/adaptive-learning/client/learning-session';

type CardReviewStatus = MemoryReviewRating;

type MemorySyncStatus = 'saving' | 'saved' | 'failed';

interface MemoryKnowledgeImpact {
  nodeId: string;
  displayName: string;
  masteryBefore: number | null;
  masteryAfter: number;
  confidenceBefore: number | null;
  confidenceAfter: number;
  retentionAfter: number;
  stabilityDaysAfter: number;
  evidenceAdded: number;
}

interface MemoryReviewFeedback {
  rating: MemoryReviewRating;
  masteryBefore: number;
  masteryAfter: number;
  nextReviewAt: string;
  syncStatus: MemorySyncStatus;
  profileImpact: MemoryKnowledgeImpact[];
  decision: PersonalizationContext['learnerDecision'] | null;
}

const MEMORY_ACTION_LABELS = {
  diagnostic: '补充诊断',
  teach: '先补概念',
  review: '继续复习',
  quiz: '进入练习',
} as const;

const MEMORY_REASON_LABELS: Record<string, string> = {
  'no-evidence': '当前证据不足，需要通过复习建立画像',
  'low-confidence': '画像置信度较低，需要更多主动回忆证据',
  'low-mastery': '当前知识点掌握度偏低',
  'repeated-errors': '同类错误重复出现',
  'low-retention': '记忆保持度下降，已进入复习窗口',
  'stable-mastery': '掌握稳定，用间隔复习防止遗忘',
};

export default function CloudMindMemoryPage() {
  return (
    <SkyAppShell section="resources" fullBleed>
      <Suspense fallback={<CloudMindMemoryFallback />}>
        <CloudMindMemoryContent />
      </Suspense>
    </SkyAppShell>
  );
}

function CloudMindMemoryFallback() {
  return (
    <div className="min-h-[calc(100dvh-4rem)] text-[var(--memory-text)]">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl items-center justify-center px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--memory-border)] bg-[var(--memory-surface)] px-5 py-4 text-sm text-[var(--memory-muted)]">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--memory-primary)]" />
          加载记忆卡...
        </div>
      </div>
    </div>
  );
}

function CloudMindMemoryContent() {
  const searchParams = useSearchParams();
  const queryContent = searchParams.get('content');
  const queryTopic = searchParams.get('topic');
  const [content, setContent] = useState('');
  const [topic, setTopic] = useState('');
  const [cardCount, setCardCount] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deck, setDeck] = useState<MemoryCardDeck | null>(null);
  const [currentCard, setCurrentCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [showMistakePicker, setShowMistakePicker] = useState(false);
  const [studiedCards, setStudiedCards] = useState<Set<number>>(new Set());
  const [cardReviewStatus, setCardReviewStatus] = useState<Record<number, CardReviewStatus>>({});
  const [recommendedWeakPoints, setRecommendedWeakPoints] = useState<string[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [personalizationNotice, setPersonalizationNotice] = useState<string | null>(null);
  const [personalizationContext, setPersonalizationContext] =
    useState<PersonalizationContext | null>(null);
  const [dueMemoryReviews, setDueMemoryReviews] = useState<MemoryReviewRecord[]>([]);
  const [dueReviewSourceByIndex, setDueReviewSourceByIndex] = useState<
    Record<number, MemoryReviewRecord>
  >({});
  const [reviewFeedbackByCard, setReviewFeedbackByCard] = useState<
    Record<number, MemoryReviewFeedback>
  >({});
  const [hasManualOverride, setHasManualOverride] = useState(false);
  const userEditedTopicRef = useRef(false);
  const userEditedContentRef = useRef(false);
  const learningDecisionRef = useRef<LearningDecisionContext | null>(null);
  const decisionPromiseRef = useRef<LearningDecisionPromise | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const outcomeReportedRef = useRef(false);
  const deckRef = useRef<MemoryCardDeck | null>(null);
  const studiedCardsRef = useRef<Set<number>>(new Set());
  const streamAbortRef = useRef<AbortController | null>(null);
  const router = useRouter();
  const startLearningSession = useCallback((sessionTopic: string) => {
    learningDecisionRef.current = null;
    decisionPromiseRef.current = null;
    sessionStartedAtRef.current = Date.now();
    outcomeReportedRef.current = false;
    const request = createLearningDecision({
      sessionId: `memory:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      action: 'review',
      topic: sessionTopic.trim() || null,
      source: 'cloud-mind-memory',
    });
    decisionPromiseRef.current = request.then((context) => {
      if (context) learningDecisionRef.current = context;
      return context;
    });
    return decisionPromiseRef.current;
  }, []);

  const reportMemoryExit = useCallback(async (reason: string) => {
    const startedAt = sessionStartedAtRef.current;
    const currentDeck = deckRef.current;
    const studiedCount = studiedCardsRef.current.size;
    const context = learningDecisionRef.current ?? (await decisionPromiseRef.current);
    if (
      !context ||
      !startedAt ||
      outcomeReportedRef.current ||
      !currentDeck ||
      studiedCount >= currentDeck.cards.length
    ) {
      return;
    }
    outcomeReportedRef.current = true;
    reportLearningEvent({
      type: 'session-exited',
      source: 'cloud-mind-memory',
      correlationId: context.correlationId,
      payload: {
        decisionId: context.decisionId,
        durationSeconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
        reason,
      },
    });
  }, []);

  // Pre-fill from URL query params
  useEffect(() => {
    if (queryContent) {
      userEditedContentRef.current = true;
      setContent(queryContent);
    }
    if (queryTopic) {
      userEditedTopicRef.current = true;
      setTopic(queryTopic);
    }
  }, [queryContent, queryTopic]);

  // Load CloudMind personalization context for weak-point recommendations.
  useEffect(() => {
    let cancelled = false;
    const hasUrlParams = queryContent || queryTopic;
    setContextLoading(true);
    fetch('/api/sky/cloud-mind/personalization-context')
      .then((res) => res.json())
      .then((json: { success?: boolean; data?: PersonalizationContext }) => {
        if (cancelled) return;
        const context = json.data;
        if (!json.success || !context) return;
        setPersonalizationContext(context);

        const weakPoints = context.weakPoints.map((item) => item.knowledgePoint);
        const memoryPolicy = context.toolPolicies?.memory;
        setRecommendedWeakPoints(weakPoints);
        if (hasUrlParams) return;

        const dueReview = context.dueReviews[0];
        const recommendedTopic =
          dueReview?.knowledgePoints[0] ??
          memoryPolicy?.targetTopic ??
          context.weakPoints[0]?.knowledgePoint ??
          context.learningPath?.next;
        if (memoryPolicy) {
          const preferredCount = Math.max(1, memoryPolicy.questionCount);
          const nearestCount = MEMORY_COUNT_OPTIONS.reduce((best, value) =>
            Math.abs(value - preferredCount) < Math.abs(best - preferredCount) ? value : best,
          );
          setCardCount(nearestCount);
        }
        if (recommendedTopic && !userEditedTopicRef.current) {
          setTopic(recommendedTopic);
        }
        if (!userEditedContentRef.current) {
          if (dueReview) {
            setContent(
              `到期复习：${dueReview.title}\n知识点：${dueReview.knowledgePoints.join('、') || recommendedTopic || '综合复习'}\n请生成概念卡、易错卡和例题卡。`,
            );
          } else if (recommendedTopic) {
            setContent(`围绕「${recommendedTopic}」生成概念卡、例题卡和易错卡。`);
          }
        }
        if (recommendedTopic) {
          setPersonalizationNotice(
            `已根据天梯工坊为你预设：${recommendedTopic} / ${
              dueReview ? '到期复习优先' : '薄弱点巩固'
            }`,
          );
        }
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => {
        if (!cancelled) setContextLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryContent, queryTopic]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/sky/cloud-mind/memory-reviews?due=true')
      .then((res) => res.json())
      .then((json: { success?: boolean; data?: MemoryReviewRecord[] }) => {
        if (cancelled || !json.success || !Array.isArray(json.data)) return;
        setDueMemoryReviews(json.data);
        const store = useSkyClassroomStore.getState();
        json.data.forEach((review) => store.recordMemoryReview(review));
      })
      .catch(() => {
        /* due reviews are optional; manual generation remains available */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const causeLabels: Record<MistakeCause, string> = {
    'concept-unclear': '概念不清',
    'calculation-error': '计算失误',
    misreading: '审题错误',
    'method-wrong': '方法错误',
    careless: '粗心',
    'format-error': '格式错误',
  };

  const handleImportFromMistakes = () => {
    const mistakes = useSkyClassroomStore.getState().mistakes;
    if (mistakes.length === 0) {
      setError('暂无错题记录，先去做些练习吧');
      return;
    }
    setShowMistakePicker(true);
  };

  const handleSelectMistake = (m: MistakeRecord) => {
    userEditedTopicRef.current = true;
    userEditedContentRef.current = true;
    setHasManualOverride(true);
    setTopic(m.knowledgePoints.join('、'));
    setContent(
      `【题目】${m.problem}\n\n【我的答案】${m.userAnswer}\n\n【正确答案】${m.correctAnswer}\n\n【错因】${causeLabels[m.cause]}\n\n【知识点】${m.knowledgePoints.join('、')}`,
    );
    setShowMistakePicker(false);
  };

  // Restore state from background task on mount
  useEffect(() => {
    const store = useTaskStore.getState();
    const tasks = Object.values(store.tasks).filter(
      (t) => t.type === 'memory' && t.status !== 'failed',
    );
    if (tasks.length === 0) return;
    const task = tasks[tasks.length - 1];
    setActiveTaskId(task.id);

    if (task.status === 'running') {
      setLoading(true);
    } else if (task.status === 'completed' && task.result) {
      const restoredDeck = task.result as MemoryCardDeck;
      setDeck(restoredDeck);
      deckRef.current = restoredDeck;
      setCurrentCard(0);
      setStudiedCards(new Set());
      studiedCardsRef.current = new Set();
      setCardReviewStatus({});
      setDueReviewSourceByIndex({});
      setReviewFeedbackByCard({});
      store.removeTask(task.id);
      setActiveTaskId(null);
      void startLearningSession(restoredDeck.topic);
    }
  }, [startLearningSession]);

  // Watch task for completion
  useEffect(() => {
    if (!activeTaskId) return;
    const unsub = useTaskStore.subscribe((state) => {
      const task = state.tasks[activeTaskId];
      if (!task) {
        setActiveTaskId(null);
        setLoading(false);
        return;
      }
      if (task.status === 'completed' && task.result) {
        const completedDeck = task.result as MemoryCardDeck;
        setDeck(completedDeck);
        deckRef.current = completedDeck;
        setCurrentCard(0);
        setStudiedCards(new Set());
        studiedCardsRef.current = new Set();
        setCardReviewStatus({});
        setDueReviewSourceByIndex({});
        setReviewFeedbackByCard({});
        setLoading(false);
        useTaskStore.getState().removeTask(task.id);
        setActiveTaskId(null);
        void startLearningSession(completedDeck.topic);
      } else if (task.status === 'failed') {
        setError(task.error || '生成失败，请重试');
        setLoading(false);
        useTaskStore.getState().removeTask(task.id);
        setActiveTaskId(null);
      }
    });
    return unsub;
  }, [activeTaskId, startLearningSession]);

  const startDueReview = () => {
    if (dueMemoryReviews.length === 0) return;
    const sourceByIndex: Record<number, MemoryReviewRecord> = {};
    const dueTopics = Array.from(
      new Set(dueMemoryReviews.flatMap((review) => review.tags ?? []).filter(Boolean)),
    );
    const dueDeck: MemoryCardDeck = {
      topic: dueTopics.slice(0, 3).join('、') || '到期记忆复习',
      description: `${dueMemoryReviews.length} 张卡片已进入复习窗口，按到期时间优先安排。`,
      cards: dueMemoryReviews.map((review, index) => {
        sourceByIndex[index] = review;
        return {
          index: index + 1,
          front: review.front || `回忆这张卡片的核心知识：${review.tags?.[0] ?? '学习内容'}`,
          back: review.back || '请根据上次学习内容主动回忆，再标记本次记忆状态。',
          relatedConcepts: review.tags ?? [],
          difficulty: review.mastery < 45 ? 'hard' : review.mastery < 75 ? 'medium' : 'easy',
          tags: review.tags ?? [],
        };
      }),
      studyTips: '先主动回忆，再翻面核对。系统会依据“记住 / 模糊 / 忘记”重新计算掌握度和下次复习时间。',
      reviewIntervals: [1, 3, 7, 15, 30],
    };

    setDeck(dueDeck);
    deckRef.current = dueDeck;
    setTopic(dueDeck.topic);
    setContent('');
    setDueReviewSourceByIndex(sourceByIndex);
    setReviewFeedbackByCard({});
    setCurrentCard(0);
    setFlipped(false);
    setStudiedCards(new Set());
    studiedCardsRef.current = new Set();
    setCardReviewStatus({});
    setStudyMode(true);
    setHasManualOverride(false);
    void startLearningSession(dueDeck.topic);
  };

  const handleGenerate = async (auto: boolean = false) => {
    const isAuto = auto === true;

    if (!isAuto && !content.trim()) {
      setError('请输入学习内容或知识点');
      return;
    }

    streamAbortRef.current?.abort();

    setLoading(true);
    setError(null);
    setDeck(null);
    deckRef.current = null;
    setFlipped(false);
    setStudiedCards(new Set());
    studiedCardsRef.current = new Set();
    setCardReviewStatus({});
    setDueReviewSourceByIndex({});
    setReviewFeedbackByCard({});

    const taskId = `memory_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setActiveTaskId(taskId);

    useTaskStore.getState().addTask({
      id: taskId,
      type: 'memory',
      label: isAuto ? '记忆卡片: 基于薄弱点生成' : `记忆卡片: ${topic || '未命名主题'}`,
      status: 'running',
      progress: 30,
      phase: '正在生成记忆卡…',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    try {
      const body = isAuto
        ? { auto: true }
        : { content: content.trim(), topic: topic || undefined, cardCount };
      const abortController = new AbortController();
      streamAbortRef.current = abortController;
      const res = await fetch('/api/sky/cloud-mind/memory-cards/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortController.signal,
      });
      const contentType = res.headers.get('content-type') ?? '';
      if (res.ok && contentType.includes('text/event-stream')) {
        await consumeMemoryCardsStream(res, taskId);
      } else {
        // 非流式回退（旧端点/代理）
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || '生成失败');
        }
        useTaskStore.getState().updateTask(taskId, {
          status: 'completed',
          progress: 100,
          phase: '收集完成',
          result: json.data,
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        useTaskStore.getState().removeTask(taskId);
        return;
      }
      const msg = err instanceof Error ? err.message : '生成失败，请重试';
      useTaskStore.getState().updateTask(taskId, {
        status: 'failed',
        progress: 0,
        phase: '生成失败',
        error: msg,
      });
    }
  };

  const consumeMemoryCardsStream = async (res: Response, taskId: string) => {
    const reader = res.body?.getReader();
    if (!reader) throw new Error('浏览器不支持流式响应');

    const decoder = new TextDecoder();
    let buffer = '';
    let accCards: MemoryCardDeck['cards'] = [];
    const partialTopic = topic.trim() || '记忆卡片';
    const taskStore = useTaskStore.getState();

    const applyPartial = (cards: MemoryCardDeck['cards']) => {
      accCards = [...accCards, ...cards];
      const partial: MemoryCardDeck = {
        topic: partialTopic,
        description: '',
        cards: accCards,
        studyTips: '',
        reviewIntervals: [],
      };
      setDeck(partial);
      deckRef.current = partial;
      taskStore.updateTask(taskId, {
        status: 'running',
        progress: Math.min(90, 40 + accCards.length * 5),
        phase: `已生成 ${accCards.length} 张，继续生成中…`,
        updatedAt: Date.now(),
      });
    };

    const completePartial = (event?: { message?: string }) => {
      const partial: MemoryCardDeck = {
        topic: partialTopic,
        description: '',
        cards: accCards,
        studyTips: '',
        reviewIntervals: [],
      };
      taskStore.updateTask(taskId, {
        status: 'completed',
        progress: 100,
        phase: `已生成 ${accCards.length} 张`,
        result: partial,
      });
      if (event?.message) setError(event.message);
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const event = JSON.parse(line.slice(6)) as MemoryCardsStreamEvent;
        if (event.type === 'cards') {
          applyPartial(event.cards);
        } else if (event.type === 'done') {
          taskStore.updateTask(taskId, {
            status: 'completed',
            progress: 100,
            phase: '收集完成',
            result: event.deck,
          });
          return;
        } else if (event.type === 'error') {
          if (accCards.length > 0) {
            completePartial({ message: event.message || '剩余卡片生成失败，可重新生成' });
          } else {
            throw new Error(event.message || '生成失败，请重试');
          }
          return;
        }
      }
    }

    // 流结束但无 done 事件（极端情况）：保留已出卡片
    if (accCards.length > 0) {
      completePartial();
    } else {
      throw new Error('生成未返回卡片，请重试');
    }
  };

  const nextCard = () => {
    if (!deck) return;
    setFlipped(false);
    setCurrentCard((prev) => (prev + 1) % deck.cards.length);
  };

  const trackFlip = () => {
    setFlipped(!flipped);
  };

  const confirmCardMastery = async (status: CardReviewStatus) => {
    if (!deck || studiedCards.has(currentCard)) return;

    const cardIndex = currentCard;
    const wasConfirmed = studiedCards.has(currentCard);
    const nextStudiedCards = new Set(studiedCards);
    nextStudiedCards.add(currentCard);

    setCardReviewStatus((prev) => ({ ...prev, [currentCard]: status }));
    setStudiedCards(nextStudiedCards);
    studiedCardsRef.current = nextStudiedCards;

    const card = deck.cards[currentCard];
    const dueSource = dueReviewSourceByIndex[currentCard];
    const deckId =
      dueSource?.deckId ?? buildMemoryDeckId(deck.topic || topic || 'memory', deck.cards.length);
    const cardId = dueSource?.cardId ?? buildMemoryCardId(deckId, currentCard, card.front);
    const store = useSkyClassroomStore.getState();
    const previousReview =
      store.memoryReviews.find((review) => review.cardId === cardId) ?? dueSource ?? null;
    const knowledgePoints = Array.from(
      new Set(
        [deck.topic, topic, ...card.relatedConcepts, ...card.tags]
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
    const review = scheduleMemoryReview({
      cardId,
      deckId,
      rating: status,
      previous: previousReview,
      sourceType: dueSource?.sourceType ?? (content.trim() ? 'manual' : 'memory'),
      sourceId: dueSource?.sourceId ?? activeTaskId ?? undefined,
      front: card.front,
      back: card.back,
      tags: knowledgePoints,
    });
    store.recordMemoryReview(review);
    setReviewFeedbackByCard((prev) => ({
      ...prev,
      [cardIndex]: {
        rating: status,
        masteryBefore: previousReview?.mastery ?? 35,
        masteryAfter: review.mastery,
        nextReviewAt: review.nextReviewAt,
        syncStatus: 'saving',
        profileImpact: [],
        decision: null,
      },
    }));

    try {
      const res = await fetch('/api/sky/cloud-mind/memory-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...review, knowledgePoints }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '复习反馈保存失败');
      setReviewFeedbackByCard((prev) => ({
        ...prev,
        [cardIndex]: {
          ...(prev[cardIndex] ?? {
            rating: status,
            masteryBefore: previousReview?.mastery ?? 35,
            masteryAfter: review.mastery,
            nextReviewAt: review.nextReviewAt,
          }),
          syncStatus: 'saved',
          profileImpact: Array.isArray(json.profileImpact) ? json.profileImpact : [],
          decision: json.decision ?? null,
        },
      }));
      void refreshLearningPlanAfterEvidence();
      if (nextStudiedCards.size === deck.cards.length) {
        void completeLearningPlanTaskFromEvidence(knowledgePoints, ['review']);
        const context = learningDecisionRef.current;
        const startedAt = sessionStartedAtRef.current;
        if (context && startedAt && !outcomeReportedRef.current) {
          outcomeReportedRef.current = true;
          void reportLearningOutcome({
            decisionId: context.decisionId,
            windowStart: new Date(startedAt).toISOString(),
            windowEnd: new Date().toISOString(),
            correctCount: rememberedCount + (status === 'remembered' ? 1 : 0),
            questionCount: deck.cards.length,
            durationSeconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
            completed: true,
            exited: false,
            errorTypes: ['fuzzy', 'forgotten'].filter(
              (rating) =>
                Object.values(cardReviewStatus).some((value) => value === rating) ||
                status === rating,
            ),
          });
        }
      }
    } catch {
      setReviewFeedbackByCard((prev) => ({
        ...prev,
        [cardIndex]: {
          ...(prev[cardIndex] ?? {
            rating: status,
            masteryBefore: previousReview?.mastery ?? 35,
            masteryAfter: review.mastery,
            nextReviewAt: review.nextReviewAt,
            profileImpact: [],
            decision: null,
          }),
          syncStatus: 'failed',
        },
      }));
    }

    setDueMemoryReviews((prev) => prev.filter((item) => item.cardId !== cardId));

    if (!wasConfirmed) {
      store.updateMemoryProgress({
        totalFlipped: store.memoryProgress.totalFlipped + 1,
        topicCount: nextStudiedCards.size,
        lastStudied: Date.now(),
      });
    }
  };
  useEffect(() => {
    return () => {
      void reportMemoryExit('page-unload');
    };
  }, [reportMemoryExit]);
  const prevCard = () => {
    if (!deck) return;
    setFlipped(false);
    setCurrentCard((prev) => (prev - 1 + deck.cards.length) % deck.cards.length);
  };

  // Star rarity colors for difficulty
  const difficultyStar: Record<string, string> = {
    easy: 'text-emerald-400',
    medium: 'text-amber-400',
    hard: 'text-rose-400',
  };
  const difficultyLabels = { easy: '简单', medium: '中等', hard: '困难' };
  const currentCardConfirmed = studiedCards.has(currentCard);
  const currentCardId = deck
    ? (dueReviewSourceByIndex[currentCard]?.cardId ??
      buildMemoryCardId(
        buildMemoryDeckId(deck.topic || topic || 'memory', deck.cards.length),
        currentCard,
        deck.cards[currentCard].front,
      ))
    : null;
  const currentStoredReview = currentCardId
    ? (useSkyClassroomStore
        .getState()
        .memoryReviews.find((review) => review.cardId === currentCardId) ??
      dueReviewSourceByIndex[currentCard] ??
      null)
    : null;
  const currentReviewFeedback = reviewFeedbackByCard[currentCard];
  const sessionFeedback = Object.values(reviewFeedbackByCard);
  const rememberedCount = sessionFeedback.filter((item) => item.rating === 'remembered').length;
  const fuzzyCount = sessionFeedback.filter((item) => item.rating === 'fuzzy').length;
  const forgottenCount = sessionFeedback.filter((item) => item.rating === 'forgotten').length;
  const averageMasteryDelta =
    sessionFeedback.length > 0
      ? Math.round(
          sessionFeedback.reduce(
            (sum, item) => sum + item.masteryAfter - item.masteryBefore,
            0,
          ) / sessionFeedback.length,
        )
      : 0;
  const latestDecision = [...sessionFeedback]
    .reverse()
    .find((item) => item.decision)?.decision;

  return (
    <WorkspaceShell
      title="记忆卡片"
      description="配置复习内容并生成闪卡，右侧会同步展示本次任务摘要。"
      mode="edit"
      panel={
        <div data-testid="memory-config-panel" className="space-y-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Brain className="h-4 w-4 text-[#5B8DEF]" /> 卡片参数设置
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>主题</span>
            <span className="max-w-[130px] truncate text-slate-700">{topic || '待填写'}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>卡片数量</span>
            <span className="text-slate-700">{deck?.cards.length ?? cardCount}</span>
          </div>
        </div>
      }
      main={
        <div data-testid="memory-main-workspace" className="min-w-0">
    <div className="min-h-[calc(100dvh-4rem)]">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6">
        {personalizationContext && (
          <MemoryPersonalizationPanel
            context={personalizationContext}
            topic={topic}
            cardCount={deck?.cards.length ?? cardCount}
            dueReviews={dueMemoryReviews}
            hasManualOverride={hasManualOverride}
            isReviewing={Boolean(deck)}
            onStartDueReview={startDueReview}
          />
        )}

        {/* Input Section — 收集任务台 */}
        {!deck && (
          <div data-tour-step="page-primary">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"
            style={{
              color: 'var(--memory-text)',
            }}
          >
            <div className="mb-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Topic input — bottom line style */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--memory-text)' }}
                >
                  学习主题
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => {
                    userEditedTopicRef.current = true;
                    setHasManualOverride(true);
                    setTopic(e.target.value);
                  }}
                  placeholder="例如：三角函数公式、化学元素周期表..."
                  className="w-full bg-transparent border-0 border-b px-0 py-2 text-sm outline-none transition-all"
                  style={{
                    borderColor: 'var(--memory-border)',
                    color: 'var(--memory-text)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--memory-primary)';
                    e.currentTarget.style.boxShadow =
                      '0 1px 0 0 var(--memory-primary), 0 4px 12px -4px var(--memory-glow)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--memory-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
              {/* Card count — star selector */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--memory-text)' }}
                >
                  卡片数量
                </label>
                <div className="flex items-center gap-2">
                  {MEMORY_COUNT_OPTIONS.map((count) => (
                    <button
                      key={count}
                      onClick={() => {
                        setHasManualOverride(true);
                        setCardCount(count);
                      }}
                      className="relative flex h-10 w-10 items-center justify-center rounded-full text-xs font-medium transition-all"
                      style={{
                        background:
                          cardCount === count ? 'var(--memory-glow-strong)' : 'transparent',
                        border: `1px solid ${cardCount === count ? 'var(--memory-primary)' : 'var(--memory-border)'}`,
                        color:
                          cardCount === count
                            ? 'var(--memory-primary-bright)'
                            : 'var(--memory-muted)',
                        boxShadow: cardCount === count ? '0 0 12px var(--memory-glow)' : 'none',
                      }}
                    >
                      {count}
                      {cardCount === count && (
                        <span
                          className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[var(--memory-primary)]"
                          style={{ boxShadow: '0 0 6px var(--memory-glow)' }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mb-5">
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--memory-text)' }}
              >
                学习内容 / 知识点
              </label>

              {/* Mistake import — starlight dashed channel */}
              {!personalizationContext && personalizationNotice && (
                <div
                  className="mb-4 rounded-xl px-4 py-3 text-sm"
                  style={{
                    background: 'rgba(52, 211, 153, 0.08)',
                    border: '1px solid rgba(52, 211, 153, 0.18)',
                    color: '#A7F3D0',
                  }}
                >
                  {personalizationNotice}
                </div>
              )}

              <button
                type="button"
                onClick={handleImportFromMistakes}
                className="w-full mb-4 flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all group"
                style={{
                  border: '1px dashed var(--memory-indigo)',
                  background: 'rgba(79, 70, 229, 0.05)',
                }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: 'var(--memory-indigo-glow)' }}
                >
                  <FileDown className="h-4.5 w-4.5 text-[var(--memory-indigo)]" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium" style={{ color: 'var(--memory-indigo)' }}>
                    从错题本导入
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--memory-muted)' }}>
                    选择错题后自动整理为记忆卡片
                  </div>
                </div>
              </button>

              {/* Auto-generate from weak points */}
              {recommendedWeakPoints.length > 0 && !content.trim() && (
                <button
                  onClick={() => handleGenerate(true)}
                  disabled={loading || contextLoading}
                  className="w-full mb-4 flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all group"
                  style={{
                    border: '1px dashed var(--memory-primary)',
                    background: 'rgba(251, 113, 133, 0.08)',
                  }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: 'rgba(251, 113, 133, 0.2)' }}
                  >
                    <Sparkles className="h-4.5 w-4.5 text-[var(--memory-primary)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium" style={{ color: 'var(--memory-primary)' }}>
                    根据薄弱点生成
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--memory-muted)' }}>
                      推荐：{recommendedWeakPoints.slice(0, 3).join('、')}
                    </div>
                  </div>
                </button>
              )}

              {/* Mistake Picker Panel */}
              {showMistakePicker && (
                <MistakePicker
                  onSelect={handleSelectMistake}
                  onClose={() => setShowMistakePicker(false)}
                />
              )}

              <textarea
                value={content}
                onChange={(e) => {
                  userEditedContentRef.current = true;
                  setHasManualOverride(true);
                  setContent(e.target.value);
                }}
                placeholder="粘贴需要复习的知识点、课文内容、公式定理等，AI 会自动整理成记忆卡。"
                rows={6}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all resize-y"
                style={{
                  background: 'var(--memory-surface-elevated)',
                  border: '1px solid var(--memory-border)',
                  color: 'var(--memory-text)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--memory-primary)';
                  e.currentTarget.style.boxShadow =
                    '0 0 0 1px var(--memory-primary), 0 4px 16px -4px var(--memory-glow)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--memory-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Generate cards */}
            <button
              onClick={() => handleGenerate()}
              disabled={loading || !content.trim()}
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-violet-500 dark:hover:bg-violet-400"
              style={{
                color: 'white',
              }}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loading ? '正在生成…' : '生成记忆卡'}
            </button>

            {error && (
              <div
                className="mt-4 rounded-xl px-4 py-3 text-sm"
                style={{
                  background: 'rgba(248, 113, 113, 0.1)',
                  border: '1px solid rgba(248, 113, 113, 0.2)',
                  color: '#F87171',
                }}
              >
                {error}
              </div>
            )}
            </motion.div>
          </div>
        )}

        {/* Study Mode */}
        <AnimatePresence>
          {deck && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Deck Info */}
              <div className="flex items-center justify-between">
                <div>
                  <h2
                    className="text-xl font-bold flex items-center gap-2 memory-glow-text"
                    style={{ color: 'var(--memory-text)' }}
                  >
                    <Brain className="h-5 w-5 text-[var(--memory-primary)]" />
                    {deck.topic}
                  </h2>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--memory-muted)' }}>
                    {deck.description}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      streamAbortRef.current?.abort();
                      setDeck(null);
                      setContent('');
                      setStudiedCards(new Set());
                      setCardReviewStatus({});
                      setDueReviewSourceByIndex({});
                      setReviewFeedbackByCard({});
                    }}
                    className="flex items-center gap-1.5 text-sm transition-colors"
                    style={{ color: 'var(--memory-muted)' }}
                  >
                    <RotateCcw className="h-4 w-4" />
                    新建卡片
                  </button>
                  <button
                    onClick={() => setStudyMode(!studyMode)}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all"
                    style={{
                      background: studyMode ? 'var(--memory-glow)' : 'transparent',
                      border: `1px solid ${studyMode ? 'var(--memory-primary)' : 'var(--memory-border)'}`,
                      color: studyMode ? 'var(--memory-primary-bright)' : 'var(--memory-muted)',
                    }}
                  >
                    <BookOpen className="h-4 w-4" />
                    {studyMode ? '查看卡片' : '开始复习'}
                  </button>
                </div>
              </div>

              {loading && !error && (
                <div
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm"
                  style={{
                    background: 'rgba(251, 113, 133, 0.06)',
                    border: '1px solid var(--memory-border)',
                    color: 'var(--memory-muted)',
                  }}
                >
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--memory-primary)' }} />
                  正在生成剩余卡片，已生成的卡片可立即开始复习…
                </div>
              )}

              {error && (
                <div
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm"
                  style={{
                    background: 'rgba(248, 113, 113, 0.1)',
                    border: '1px solid rgba(248, 113, 113, 0.2)',
                    color: '#F87171',
                  }}
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {studyMode ? (
                /* Flashcard study mode */
                <div className="flex flex-col items-center gap-4">
                  {/* Progress — constellation collection line */}
                  <div className="w-full flex items-center gap-3">
                    <div className="flex items-center gap-1 flex-1">
                      {deck.cards.map((_, i) => (
                        <div key={i} className="flex items-center">
                          <div
                            className="h-2 w-2 rounded-full transition-all duration-500"
                            style={{
                              background:
                                cardReviewStatus[i] === 'remembered'
                                  ? 'var(--memory-collected)'
                                  : cardReviewStatus[i] === 'fuzzy' ||
                                      cardReviewStatus[i] === 'forgotten'
                                    ? 'var(--memory-warm)'
                                    : i === currentCard
                                      ? 'var(--memory-primary)'
                                      : 'rgba(255,255,255,0.15)',
                              boxShadow:
                                i === currentCard
                                  ? '0 0 8px var(--memory-glow)'
                                  : cardReviewStatus[i]
                                    ? '0 0 4px var(--memory-glow)'
                                    : 'none',
                              transform: i === currentCard ? 'scale(1.5)' : 'scale(1)',
                            }}
                          />
                          {i < deck.cards.length - 1 && (
                            <div
                              className="h-px w-4 transition-all duration-500"
                              style={{
                                background: cardReviewStatus[i]
                                  ? 'var(--memory-primary)'
                                  : 'rgba(255,255,255,0.1)',
                                boxShadow: cardReviewStatus[i]
                                  ? '0 0 4px var(--memory-glow)'
                                  : 'none',
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <span
                      className="text-xs font-medium shrink-0"
                      style={{ color: 'var(--memory-muted)' }}
                    >
                      已完成 {studiedCards.size}/{deck.cards.length} 张
                    </span>
                  </div>

                  {/* Card — 3D flip */}
                  <div
                    onClick={trackFlip}
                    className="w-full max-w-3xl cursor-pointer"
                    style={{ perspective: '1000px' }}
                  >
                    <motion.div
                      data-testid="memory-card-shell"
                      animate={{ rotateY: flipped ? 180 : 0 }}
                      transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                      className="relative h-[360px] w-full sm:h-[400px]"
                      style={{
                        transformStyle: 'preserve-3d',
                      }}
                    >
                      {/* Front */}
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl p-6 sm:p-8"
                        style={{
                          background: 'var(--memory-surface-elevated)',
                          border: '1px solid var(--memory-border)',
                          backfaceVisibility: 'hidden',
                        }}
                      >
                        <div className="flex h-full w-full flex-col items-center justify-center overflow-y-auto text-center">
                          <div className="flex items-center justify-center gap-2 mb-4">
                            <span
                              className={`text-lg ${difficultyStar[deck.cards[currentCard].difficulty]}`}
                            >
                              ★
                            </span>
                            <span
                              className="text-xs font-medium"
                              style={{ color: 'var(--memory-muted)' }}
                            >
                              {difficultyLabels[deck.cards[currentCard].difficulty]}
                            </span>
                          </div>
                          <p
                            className="text-xl font-bold leading-relaxed whitespace-pre-wrap"
                            style={{ color: 'var(--memory-text)' }}
                          >
                            <InlineMath text={deck.cards[currentCard].front} />
                          </p>
                          <p className="text-xs mt-6" style={{ color: 'var(--memory-muted)' }}>
                            点击查看答案
                          </p>
                        </div>
                      </div>

                      {/* Back */}
                      <div
                        className="absolute inset-0 flex flex-col rounded-2xl p-6 sm:p-8"
                        style={{
                          background:
                            'linear-gradient(135deg, var(--memory-surface-elevated) 0%, rgba(251, 113, 133, 0.08) 100%)',
                          border: '1px solid var(--memory-border-strong)',
                          backfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)',
                        }}
                      >
                        <div className="flex h-full w-full flex-col overflow-hidden text-center">
                          <div
                            data-testid="memory-card-back-scroll"
                            className="min-h-0 flex-1 overflow-y-auto pr-1"
                          >
                            <p
                              className="text-lg leading-relaxed mb-4 whitespace-pre-wrap"
                              style={{ color: 'var(--memory-text)' }}
                            >
                              <InlineMath text={deck.cards[currentCard].back} />
                            </p>
                            {deck.cards[currentCard].mnemonic && (
                              <div
                                className="mt-3 rounded-xl p-3"
                                style={{
                                  background: 'rgba(251, 113, 133, 0.06)',
                                  border: '1px solid var(--memory-border)',
                                }}
                              >
                                <div
                                  className="flex items-center gap-1.5 text-xs mb-1"
                                  style={{ color: 'var(--memory-primary)' }}
                                >
                                  <Lightbulb className="h-3 w-3" />
                                  记忆提示
                                </div>
                                <p
                                  className="text-sm whitespace-pre-wrap"
                                  style={{ color: 'var(--memory-muted)' }}
                                >
                                  <InlineMath text={deck.cards[currentCard].mnemonic} />
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="mt-4 flex shrink-0 flex-wrap justify-center gap-1.5">
                            {deck.cards[currentCard].tags.map((tag, i) => (
                              <span
                                key={i}
                                className="text-xs rounded px-2 py-0.5"
                                style={{
                                  background: 'rgba(251, 113, 133, 0.08)',
                                  border: '1px solid var(--memory-border)',
                                  color: 'var(--memory-primary)',
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {flipped && (
                    <div className="w-full max-w-3xl">
                      {currentCardConfirmed && currentReviewFeedback ? (
                        <MemoryCardFeedbackPanel
                          feedback={currentReviewFeedback}
                          topic={deck.cards[currentCard].tags[0] ?? deck.topic}
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <p className="text-xs" style={{ color: 'var(--memory-muted)' }}>
                            根据真实记忆状态选择，画像会立即更新熟练度和下次复习时间
                          </p>
                          <div className="flex flex-wrap items-center justify-center gap-3">
                            {(['forgotten', 'fuzzy', 'remembered'] as const).map((rating) => {
                              const isPositive = rating === 'remembered';
                              const preview = scheduleMemoryReview({
                                cardId: currentCardId ?? 'memory-preview',
                                deckId: 'memory-preview',
                                rating,
                                previous: currentStoredReview,
                                now: Date.now(),
                              });
                              const masteryBefore = currentStoredReview?.mastery ?? 35;
                              const masteryDelta = preview.mastery - masteryBefore;
                              const intervalDays = Math.max(
                                1,
                                Math.round(
                                  (new Date(preview.nextReviewAt).getTime() - Date.now()) /
                                    (24 * 60 * 60 * 1000),
                                ),
                              );
                              return (
                                <button
                                  key={rating}
                                  type="button"
                                  aria-label={MEMORY_REVIEW_LABELS[rating]}
                                  onClick={() => void confirmCardMastery(rating)}
                                  className="flex min-w-28 flex-col items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
                                  style={{
                                    background: 'transparent',
                                    border: `1px solid ${
                                      isPositive
                                        ? 'var(--memory-collected)'
                                        : 'var(--memory-border)'
                                    }`,
                                    color: isPositive
                                      ? 'var(--memory-collected)'
                                      : 'var(--memory-muted)',
                                  }}
                                >
                                  <span className="flex items-center gap-1.5">
                                    {isPositive ? (
                                      <CheckCircle2 className="h-4 w-4" />
                                    ) : (
                                      <AlertCircle className="h-4 w-4" />
                                    )}
                                    {MEMORY_REVIEW_LABELS[rating]}
                                  </span>
                                  <span className="text-[10px] opacity-70">
                                    熟练度 {masteryDelta >= 0 ? '+' : ''}
                                    {masteryDelta} · {intervalDays} 天后复习
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Navigation / Completion */}
                  {studiedCards.size >= deck.cards.length ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center gap-4 py-6"
                    >
                      {/* Constellation completion */}
                      <div className="relative flex h-24 w-24 items-center justify-center">
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            background: 'var(--memory-collected-glow)',
                            filter: 'blur(20px)',
                          }}
                        />
                        <CheckCircle2
                          className="h-12 w-12 relative z-10"
                          style={{ color: 'var(--memory-collected)' }}
                        />
                      </div>
                      <div className="text-center">
                        <h3 className="text-lg font-bold" style={{ color: 'var(--memory-text)' }}>
                          本轮复习完成
                        </h3>
                        <p className="text-sm mt-1" style={{ color: 'var(--memory-muted)' }}>
                          已完成 {deck.cards.length}/{deck.cards.length} 张记忆卡
                        </p>
                      </div>
                      <MemorySessionSummary
                        total={deck.cards.length}
                        remembered={rememberedCount}
                        fuzzy={fuzzyCount}
                        forgotten={forgottenCount}
                        averageMasteryDelta={averageMasteryDelta}
                        decision={latestDecision ?? null}
                      />
                      <button
                        onClick={() => router.push('/sky/cloud-mind/memory')}
                        className="celestial-button flex items-center gap-2"
                        style={{
                          borderColor: 'var(--memory-collected)',
                          color: 'var(--memory-collected)',
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        回到记忆卡片
                      </button>
                    </motion.div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <button
                        onClick={prevCard}
                        className="flex h-10 w-10 items-center justify-center rounded-full transition-all"
                        style={{
                          background: 'var(--memory-surface)',
                          border: '1px solid var(--memory-border)',
                        }}
                      >
                        <ChevronLeft className="h-5 w-5" style={{ color: 'var(--memory-muted)' }} />
                      </button>
                      <button
                        onClick={nextCard}
                        disabled={!currentCardConfirmed}
                        className="flex h-10 w-10 items-center justify-center rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-40"
                        style={{
                          background: 'var(--memory-surface)',
                          border: '1px solid var(--memory-border)',
                        }}
                      >
                        <ChevronRight
                          className="h-5 w-5"
                          style={{ color: 'var(--memory-muted)' }}
                        />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Card list */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {deck.cards.map((card, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="cursor-pointer rounded-lg bg-white p-5 shadow-sm transition-all duration-200 dark:bg-slate-900"
                      style={{
                        background: 'var(--memory-surface)',
                        border: '1px solid var(--memory-border)',
                      }}
                      onClick={() => {
                        setCurrentCard(i);
                        setStudyMode(true);
                        setFlipped(false);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.borderColor = 'var(--memory-border-strong)';
                        e.currentTarget.style.boxShadow = '0 8px 18px -12px rgba(15, 23, 42, 0.35)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'var(--memory-border)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm ${difficultyStar[card.difficulty]}`}>★</span>
                          <span
                            className="text-[10px] font-medium"
                            style={{ color: 'var(--memory-muted)' }}
                          >
                            {difficultyLabels[card.difficulty]}
                          </span>
                        </div>
                        <span
                          className="text-xs font-mono"
                          style={{ color: 'var(--memory-muted)' }}
                        >
                          #{String(i + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <p
                        className="text-sm font-semibold mb-2 line-clamp-2"
                        style={{ color: 'var(--memory-text)' }}
                      >
                        <InlineMath text={card.front} />
                      </p>
                      <p className="text-xs line-clamp-2" style={{ color: 'var(--memory-muted)' }}>
                        <InlineMath text={card.back} />
                      </p>
                      <div className="flex flex-wrap gap-1 mt-3">
                        {card.tags.slice(0, 3).map((tag, j) => (
                          <span
                            key={j}
                            className="text-[10px] rounded px-1.5 py-0.5"
                            style={{
                              background: 'rgba(251, 113, 133, 0.06)',
                              border: '1px solid var(--memory-border)',
                              color: 'var(--memory-primary)',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                        {card.tags.length > 3 && (
                          <span className="text-[10px]" style={{ color: 'var(--memory-muted)' }}>
                            +{card.tags.length - 3}
                          </span>
                        )}
                      </div>
                      <div
                        className="mt-3 pt-3 flex items-center gap-1 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          borderTop: '1px solid var(--memory-border)',
                          color: 'var(--memory-primary)',
                        }}
                      >
                        <BookOpen className="h-3 w-3" />
                        开始复习
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Study tips */}
              {deck.studyTips && (
                <div
                  className="rounded-lg border p-4"
                  style={{
                    backgroundColor: 'var(--memory-tip-surface)',
                    borderColor: 'var(--memory-tip-border)',
                    color: 'var(--memory-text)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-amber-400" />
                    <span
                      className="text-sm font-semibold"
                      style={{ color: 'var(--memory-tip-title)' }}
                    >
                      学习建议
                    </span>
                  </div>
                  <p
                    className="text-sm whitespace-pre-wrap"
                    style={{ color: 'var(--memory-muted)' }}
                  >
                    <InlineMath text={deck.studyTips} />
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-amber-400/70" />
                    <span className="text-xs" style={{ color: 'var(--memory-muted)' }}>
                      推荐复习间隔：{deck.reviewIntervals?.join('、')} 天后
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <PageTour id="resources-memory" />
    </div>
        </div>
      }
      aside={
        <div data-testid="memory-ai-advice" className="space-y-4 text-sm">
          {!deck && (
            <MemorySetupPreview
              topic={topic}
              content={content}
              cardCount={cardCount}
              recommendedWeakPoints={recommendedWeakPoints}
              dueReviewCount={dueMemoryReviews.length}
            />
          )}
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Sparkles className="h-4 w-4 text-[#34C7B6]" /> AI 优化建议
          </div>
          <p className="text-xs leading-5 text-slate-500">
            根据主题和学习记录自动调整卡片数量、重点与复习间隔。
          </p>
          {personalizationNotice && (
            <div className="rounded-lg border border-[#E4EDF7] bg-[#F5F9FF] px-3 py-2 text-xs leading-5 text-slate-600">
              {personalizationNotice}
            </div>
          )}
        </div>
      }
    />
  );
}

function MemorySetupPreview({
  topic,
  content,
  cardCount,
  recommendedWeakPoints,
  dueReviewCount,
}: {
  topic: string;
  content: string;
  cardCount: number;
  recommendedWeakPoints: string[];
  dueReviewCount: number;
}) {
  const resolvedTopic = topic.trim() || recommendedWeakPoints[0] || '等待填写学习主题';
  const contentReady = content.trim().length > 0;

  return (
    <div className="sticky top-24 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/85 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Layers className="h-4 w-4 text-violet-600 dark:text-violet-300" />
          记忆任务预览
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          生成前确认主题、卡片数量和复习来源。
        </p>
      </div>

      <div className="space-y-4 p-5">
        <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-400/20 dark:bg-violet-400/[0.07]">
          <div className="text-xs font-medium text-violet-700 dark:text-violet-300">学习主题</div>
          <div className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            {resolvedTopic}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs text-violet-700 dark:border-violet-400/20 dark:bg-white/[0.04] dark:text-violet-300">
              {cardCount} 张卡片
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-white/[0.04] dark:text-slate-300">
              主动回忆
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/30">
            <div className="text-xs text-slate-500 dark:text-slate-400">学习内容</div>
            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {contentReady ? '已准备' : '等待输入'}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/30">
            <div className="text-xs text-slate-500 dark:text-slate-400">到期复习</div>
            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {dueReviewCount > 0 ? `${dueReviewCount} 张待复习` : '暂无到期卡片'}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/30">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <Route className="h-4 w-4 text-violet-600 dark:text-violet-300" />
            生成后的学习流程
          </div>
          <ol className="mt-3 space-y-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
            <li>1. 查看正面问题并主动回忆</li>
            <li>2. 翻面核对答案并评价掌握程度</li>
            <li>3. 系统安排下一次复习时间</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function MemoryPersonalizationPanel({
  context,
  topic,
  cardCount,
  dueReviews,
  hasManualOverride,
  isReviewing,
  onStartDueReview,
}: {
  context: PersonalizationContext;
  topic: string;
  cardCount: number;
  dueReviews: MemoryReviewRecord[];
  hasManualOverride: boolean;
  isReviewing: boolean;
  onStartDueReview: () => void;
}) {
  const policy = context.toolPolicies?.memory;
  const targetTopic =
    topic.trim() ||
    policy?.targetTopic ||
    context.weakPoints[0]?.knowledgePoint ||
    context.learningPath?.next ||
    '基础记忆诊断';
  const weakPoint = context.weakPoints.find(
    (item) => item.knowledgePoint.trim().toLocaleLowerCase() === targetTopic.toLocaleLowerCase(),
  );
  const mastery = weakPoint?.mastery ?? context.masteryByKnowledge[targetTopic];
  const duration = policy?.durationMinutes ?? Math.max(5, Math.ceil(cardCount * 1.2));
  const reasonCodes = policy?.reasonCodes ?? context.learnerDecision?.reasonCodes ?? [];
  const reasons = reasonCodes
    .filter((code) => !code?.startsWith('tool-'))
    .map((code) => MEMORY_REASON_LABELS[code] ?? code);
  const earliestDue = dueReviews[0]?.nextReviewAt;
  const [planOpen, setPlanOpen] = useState(false);
  const judgement =
    isReviewing
      ? `本轮 ${cardCount} 张卡片已经按画像排好，完成后会重新计算记忆状态。`
      : dueReviews.length > 0
      ? `${dueReviews.length} 张记忆卡已经到期，遗忘曲线要求优先主动回忆。`
      : context.learnerDecision?.summary ??
        context.recommendation?.reason ??
        '根据薄弱点和学习路径生成本次记忆任务。';

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div>
        {/* 折叠导航行：默认只占一行，避免挤占生成/复习主体 */}
        <button
          type="button"
          onClick={() => setPlanOpen((v) => !v)}
          aria-expanded={planOpen}
          className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left sm:px-5"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Brain className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              本次复习安排
            </span>
            <span className="hidden truncate text-xs text-[var(--memory-muted)] sm:inline">
              {dueReviews.length > 0 ? `${dueReviews.length} 张已到期 · ` : ''}
              已按画像预排 {cardCount} 张 · 约 {duration} 分钟
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {hasManualOverride && (
              <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-0.5 text-[11px] text-amber-200">
                已保留手动调整
              </span>
            )}
            {dueReviews.length > 0 && !isReviewing && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onStartDueReview();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    e.preventDefault();
                    onStartDueReview();
                  }
                }}
                className="inline-flex shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700"
              >
                <CalendarClock className="h-3.5 w-3.5" /> 立即复习 {dueReviews.length} 张
              </span>
            )}
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-[var(--memory-muted)] transition-transform ${planOpen ? 'rotate-180' : ''}`}
            />
          </span>
        </button>

        {planOpen && (
        <>
        <p className="border-b border-slate-100 px-4 pb-3 text-xs leading-5 text-[var(--memory-muted)] dark:border-slate-800 sm:px-5">
          当前判断：{judgement}
        </p>
        <div className="grid gap-3 px-4 pb-4 sm:px-5 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-center gap-2 text-xs font-semibold text-violet-700 dark:text-violet-300">
              <Target className="h-4 w-4" /> 当前复习主题
            </div>
            <div className="mt-2 text-lg font-semibold text-[var(--memory-text)]">{targetTopic}</div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-[var(--memory-muted)]">
                <span>当前掌握度</span>
                <span>{typeof mastery === 'number' ? `${Math.round(mastery)}%` : '待建立'}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{ width: `${Math.max(4, Math.min(100, mastery ?? 4))}%` }}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(reasons.length > 0 ? reasons : ['依据薄弱点、错题和复习时间']).map((reason) => (
                <span
                  key={reason}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-[var(--memory-muted)] dark:border-slate-700 dark:bg-slate-900"
                >
                  {reason}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                icon: CalendarClock,
                label: '复习依据',
                value: dueReviews.length > 0 ? `${dueReviews.length} 张到期` : '薄弱点巩固',
                detail: earliestDue
                  ? `原计划 ${new Date(earliestDue).toLocaleDateString('zh-CN')}`
                  : '依据画像动态安排',
              },
              {
                icon: Layers,
                label: '卡片数量',
                value: `${cardCount} 张`,
                detail: '概念、易错、例题混合',
              },
              {
                icon: Clock3,
                label: '预计时间',
                value: `${duration} 分钟`,
                detail: '主动回忆优先',
              },
              {
                icon: ShieldCheck,
                label: '完成结果',
                value: '更新全局画像',
                detail: '重算掌握与复习时间',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-[var(--memory-muted)]">
                    <Icon className="h-3.5 w-3.5 text-[var(--memory-primary)]" /> {item.label}
                  </div>
                  <div className="mt-1.5 text-sm font-semibold text-[var(--memory-text)]">
                    {item.value}
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--memory-muted)]">{item.detail}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-xs leading-5 text-[var(--memory-muted)]">
            <Route className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
            <span>完成后：记忆反馈 → 更新熟练度和全局知识状态 → 计算下次复习与下一工具。</span>
          </div>
        </div>
        </>)}
      </div>
    </motion.section>
  );
}

function MemoryCardFeedbackPanel({
  feedback,
  topic,
}: {
  feedback: MemoryReviewFeedback;
  topic: string;
}) {
  const primaryImpact = feedback.profileImpact[0];
  const syncLabel =
    feedback.syncStatus === 'saving'
      ? '正在写入画像'
      : feedback.syncStatus === 'saved'
        ? '全局画像已更新'
        : '全局画像同步失败';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--memory-surface)',
        borderColor: 'var(--memory-border-strong)',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <TrendingUp className="mt-0.5 h-4 w-4 text-violet-700 dark:text-violet-300" />
          <div>
            <div className="text-sm font-semibold text-[var(--memory-text)]">本张卡已进入画像</div>
            <div className="mt-1 text-xs text-[var(--memory-muted)]">
              {topic} · {MEMORY_REVIEW_LABELS[feedback.rating]}
            </div>
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] ${
            feedback.syncStatus === 'saved'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'
              : feedback.syncStatus === 'failed'
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300'
          }`}
        >
          {feedback.syncStatus === 'saving' && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}
          {syncLabel}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div
          className="rounded-md border px-3 py-3"
          style={{
            backgroundColor: 'var(--memory-surface-elevated)',
            borderColor: 'var(--memory-border)',
          }}
        >
          <div className="text-[10px] text-[var(--memory-muted)]">记忆熟练度</div>
          <div className="mt-1 text-sm font-semibold text-[var(--memory-text)]">
            {feedback.masteryBefore}% <span className="text-violet-600 dark:text-violet-300">→</span>{' '}
            {feedback.masteryAfter}%
          </div>
        </div>
        <div
          className="rounded-md border px-3 py-3"
          style={{
            backgroundColor: 'var(--memory-surface-elevated)',
            borderColor: 'var(--memory-border)',
          }}
        >
          <div className="text-[10px] text-[var(--memory-muted)]">下次复习</div>
          <div className="mt-1 text-sm font-semibold text-[var(--memory-text)]">
            {new Date(feedback.nextReviewAt).toLocaleDateString('zh-CN', {
              month: 'short',
              day: 'numeric',
            })}
          </div>
        </div>
        <div
          className="rounded-md border px-3 py-3"
          style={{
            backgroundColor: 'var(--memory-surface-elevated)',
            borderColor: 'var(--memory-border)',
          }}
        >
          <div className="text-[10px] text-[var(--memory-muted)]">全局知识掌握度</div>
          <div className="mt-1 text-sm font-semibold text-[var(--memory-text)]">
            {primaryImpact
              ? `${
                  primaryImpact.masteryBefore === null
                    ? '首次建立'
                    : `${Math.round(primaryImpact.masteryBefore * 100)}%`
                } → ${Math.round(primaryImpact.masteryAfter * 100)}%`
              : feedback.syncStatus === 'saving'
                ? '计算中…'
                : '暂无映射节点'}
          </div>
        </div>
      </div>

      {feedback.decision && (
        <div
          className="mt-3 flex items-start gap-2 rounded-md border px-3 py-2.5"
          style={{
            backgroundColor: 'var(--memory-tip-surface)',
            borderColor: 'var(--memory-tip-border)',
          }}
        >
          <Route className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <p className="text-xs leading-5 text-[var(--memory-muted)]">
            新判断：{feedback.decision.summary} 下一动作“
            {MEMORY_ACTION_LABELS[feedback.decision.action]}”。
          </p>
        </div>
      )}
    </motion.div>
  );
}

function MemorySessionSummary({
  total,
  remembered,
  fuzzy,
  forgotten,
  averageMasteryDelta,
  decision,
}: {
  total: number;
  remembered: number;
  fuzzy: number;
  forgotten: number;
  averageMasteryDelta: number;
  decision: PersonalizationContext['learnerDecision'] | null;
}) {
  return (
    <div className="w-full max-w-3xl rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-left dark:border-emerald-400/20 dark:bg-emerald-400/[0.06]">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
        <ShieldCheck className="h-4 w-4" /> 本轮画像更新结果
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: '复习证据', value: `${total} 条` },
          { label: '已掌握', value: `${remembered} 张` },
          { label: '仍需复习', value: `${fuzzy + forgotten} 张` },
          {
            label: '平均熟练度变化',
            value: `${averageMasteryDelta >= 0 ? '+' : ''}${averageMasteryDelta}`,
          },
        ].map((item) => (
          <div key={item.label} className="rounded-md border border-emerald-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="text-[10px] text-[var(--memory-muted)]">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-[var(--memory-text)]">{item.value}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--memory-muted)]">
        本轮结果：记住 {remembered} 张、模糊 {fuzzy} 张、忘记 {forgotten} 张。
        {decision
          ? ` 画像重新判断：${decision.summary} 下一步建议“${MEMORY_ACTION_LABELS[decision.action]}”。`
          : ' 全局画像正在汇总本轮复习证据。'}
      </p>
    </div>
  );
}

// ── Mistake Picker Panel — 异常信号归档 ──────────────────────────────

const causeColors: Record<MistakeCause, string> = {
  'concept-unclear': 'bg-purple-900/30 text-purple-300 border border-purple-500/20',
  'calculation-error': 'bg-orange-900/30 text-orange-300 border border-orange-500/20',
  misreading: 'bg-violet-900/30 text-violet-300 border border-violet-500/20',
  'method-wrong': 'bg-red-900/30 text-red-300 border border-red-500/20',
  careless: 'bg-yellow-900/30 text-yellow-300 border border-yellow-500/20',
  'format-error': 'bg-slate-700/30 text-slate-300 border border-slate-500/20',
};

const pickerCauseLabels: Record<MistakeCause, string> = {
  'concept-unclear': '概念不清',
  'calculation-error': '计算失误',
  misreading: '审题错误',
  'method-wrong': '方法错误',
  careless: '粗心',
  'format-error': '格式错误',
};

function MistakePicker({
  onSelect,
  onClose,
}: {
  onSelect: (m: MistakeRecord) => void;
  onClose: () => void;
}) {
  const mistakes = useSkyClassroomStore((s) => s.mistakes);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mb-4 rounded-2xl overflow-hidden"
      style={{ background: 'var(--memory-surface)', border: '1px solid var(--memory-border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--memory-border)' }}
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-[var(--memory-primary)]" />
          <span className="text-sm font-semibold" style={{ color: 'var(--memory-text)' }}>
            选择错题生成记忆卡
          </span>
          <span className="text-xs" style={{ color: 'var(--memory-muted)' }}>
            共 {mistakes.length} 条
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg transition-colors"
          style={{ color: 'var(--memory-muted)' }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* List */}
      <div className="max-h-72 overflow-y-auto">
        {mistakes.length === 0 ? (
          <div className="py-8 text-center text-sm" style={{ color: 'var(--memory-muted)' }}>
            暂无错题记录，先去做些练习吧
          </div>
        ) : (
          mistakes.map((m, i) => (
            <button
              key={`${m.id}-${i}`}
              onClick={() => onSelect(m)}
              className="w-full text-left px-4 py-3 transition-colors group"
              style={{ borderBottom: '1px solid var(--memory-border)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(251, 113, 133, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <p
                className="text-sm font-medium line-clamp-2 leading-relaxed"
                style={{ color: 'var(--memory-text)' }}
              >
                {m.problem}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="text-rose-400">我的答案：{m.userAnswer}</span>
                <span className="text-emerald-400">正确答案：{m.correctAnswer}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${causeColors[m.cause]}`}
                >
                  {pickerCauseLabels[m.cause]}
                </span>
                {m.knowledgePoints.map((kp) => (
                  <span
                    key={kp}
                    className="inline-block rounded px-2 py-0.5 text-[10px]"
                    style={{
                      background: 'rgba(251, 113, 133, 0.08)',
                      color: 'var(--memory-primary)',
                    }}
                  >
                    {kp}
                  </span>
                ))}
              </div>
              <div
                className="mt-1 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--memory-primary)' }}
              >
                点击选择此错题
              </div>
            </button>
          ))
        )}
      </div>
    </motion.div>
  );
}
