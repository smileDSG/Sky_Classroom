/**
 * Sky Classroom Store
 *
 * Centralized Zustand store for all Sky Classroom modules.
 * Uses slice pattern: solve, slides, mistakes, assistant.
 * Persists user preferences to localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EBBINGHAUS_INTERVALS } from '@/lib/storage/dao/mistakes';
import type {
  SolveState,
  GradeResult,
  FourPartOutput,
  QuestionBankEntry,
  SolverAgentType,
} from '@/lib/solve/types';
import type {
  AvatarConfig,
  AvatarSpeech,
  SlideGenerationOptions,
  SlideGenerationResult,
} from '@/lib/slides/types';
import type {
  MistakeRecord,
  KnowledgeGraph,
  MistakeFilter,
  MistakeReviewResult,
} from '@/lib/mistakes/types';
import type { Slide } from '@/lib/types/slides';
import type { MemoryReviewRecord } from '@/lib/cloud-mind/types';
import type { StreakState, GrowthSnapshot } from '@/lib/retention/types';
import { recordLearningStreakClient } from '@/lib/retention/streak-client';
import { createLogger } from '@/lib/logger';
import { refreshLearningPlanAfterEvidence } from '@/lib/adaptive-learning/client/refresh-learning-plan';

const log = createLogger('SkyClassroomStore');

// ── Solve Slice ────────────────────────────────────────────────────

interface SolveSlice {
  currentSolveState: SolveState | null;
  solveHistory: SolveState[];
  isSolving: boolean;

  setSolveState: (state: SolveState) => void;
  addToHistory: (state: SolveState) => void;
  setSolving: (solving: boolean) => void;
  clearSolveHistory: () => void;
}

const getDefaultSolveState = (): SolveState => ({
  problemText: '',
  problemImage: null,
  problemSpec: null,
  userAnswer: null,
  agentId: 'universal',
  selectedAgentId: null,
  agentRoute: null,
  solution: null,
  gradeResult: null,
  votingResults: [],
  fourPartOutput: null,
  fromQuestionBank: false,
  fromSolveCache: false,
  error: null,
});

type SetFn<T> = (partial: Partial<T> | ((state: T) => Partial<T>)) => void;

const createSolveSlice = (set: SetFn<SolveSlice>): SolveSlice => ({
  currentSolveState: null,
  solveHistory: [],
  isSolving: false,
  setSolveState: (state) => set({ currentSolveState: state }),
  addToHistory: (state) => set((s) => ({ solveHistory: [...s.solveHistory, state] })),
  setSolving: (solving) => set({ isSolving: solving }),
  clearSolveHistory: () => set({ solveHistory: [] }),
});

// ── Slides Slice ───────────────────────────────────────────────────

interface SlidesSlice {
  selectedAvatarId: string;
  availableAvatars: AvatarConfig[];
  currentSpeech: AvatarSpeech | null;
  isGenerating: boolean;
  generationOptions: SlideGenerationOptions;
  slides: Slide[];
  generationResult: SlideGenerationResult | null;
  generationError: string | null;
  activeJobId: string | null;

  setSelectedAvatar: (id: string) => void;
  setAvatars: (avatars: AvatarConfig[]) => void;
  setCurrentSpeech: (speech: AvatarSpeech | null) => void;
  setGenerating: (generating: boolean) => void;
  setGenerationOptions: (options: SlideGenerationOptions) => void;
  setSlides: (slides: Slide[]) => void;
  setGenerationResult: (result: SlideGenerationResult | null) => void;
  setGenerationError: (error: string | null) => void;
  setActiveJobId: (jobId: string | null) => void;
}

const createSlidesSlice = (set: SetFn<SlidesSlice>): SlidesSlice => ({
  selectedAvatarId: 'professor',
  availableAvatars: [],
  currentSpeech: null,
  isGenerating: false,
  generationOptions: { topic: '', difficulty: 'senior' },
  slides: [],
  generationResult: null,
  generationError: null,
  activeJobId: null,
  setSelectedAvatar: (id) => set({ selectedAvatarId: id }),
  setAvatars: (avatars) => set({ availableAvatars: avatars }),
  setCurrentSpeech: (speech) => set({ currentSpeech: speech }),
  setGenerating: (generating) => set({ isGenerating: generating }),
  setGenerationOptions: (options) =>
    set({
      generationOptions: {
        topic: typeof options.topic === 'string' ? options.topic : '',
        difficulty: ['senior', 'college'].includes(options.difficulty as string)
          ? options.difficulty
          : 'senior',
      },
    }),
  setSlides: (slides) => set({ slides }),
  setGenerationResult: (result) => set({ generationResult: result }),
  setGenerationError: (error) => set({ generationError: error }),
  setActiveJobId: (jobId) => set({ activeJobId: jobId }),
});

// ── Mistakes Slice ─────────────────────────────────────────────────

/** Map client MistakeCause → server ErrorType */
function causeToErrorType(cause: MistakeRecord['cause']): string {
  const map: Record<string, string> = {
    'concept-unclear': 'concept',
    'calculation-error': 'calculation',
    misreading: 'reading',
    'method-wrong': 'reasoning',
    careless: 'careless',
    'format-error': 'careless',
  };
  return map[cause] ?? 'concept';
}

/** Fire-and-forget: POST mistake to server */
function syncAddToServer(m: MistakeRecord): void {
  fetch('/api/sky/mistakes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      problemText: m.problem,
      userAnswer: m.userAnswer,
      correctAnswer: m.correctAnswer,
      errorType: causeToErrorType(m.cause),
      knowledgePoints: m.knowledgePoints,
      source: m.source,
      sourceSessionId: m.sourceSessionId,
    }),
  }).catch(() => {
    /* ignore — local store is source of truth for UI */
  });
}

/** Optimistically update locally, then return the authoritative profile result. */
async function syncReviewToServer(
  id: string,
  correct: boolean,
): Promise<MistakeReviewResult | null> {
  try {
    const response = await fetch('/api/sky/mistakes', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, correct }),
    });
    const payload = (await response.json()) as Partial<MistakeReviewResult> & {
      success?: boolean;
    };
    if (!response.ok || payload.success !== true || !payload.profileUpdate) return null;
    void refreshLearningPlanAfterEvidence();
    return payload as MistakeReviewResult;
  } catch {
    return null;
  }
}

/** Fire-and-forget: DELETE mistake on server */
function syncDeleteToServer(id: string): void {
  fetch(`/api/sky/mistakes/${id}`, { method: 'DELETE' }).catch(() => {});
}

interface MistakesSlice {
  mistakes: MistakeRecord[];
  knowledgeGraph: KnowledgeGraph | null;
  activeFilter: MistakeFilter | null;

  addMistake: (mistake: MistakeRecord) => void;
  markReviewed: (id: string, correct?: boolean) => Promise<MistakeReviewResult | null>;
  setFilter: (filter: MistakeFilter | null) => void;
  setKnowledgeGraph: (graph: KnowledgeGraph) => void;
  deleteMistake: (id: string) => void;
  mergeMistakes: (serverMistakes: MistakeRecord[]) => void;
  /** Set nextReview=now for all mistakes matching the given knowledge points */
  prioritizeReview: (knowledgePoints: string[]) => void;
  /** Cache AI-generated solution data for a mistake */
  updateMistakeSolution: (
    id: string,
    data: { solutionSteps?: string[]; hints?: string[]; errorExplanation?: string },
  ) => void;
}

const createMistakesSlice = (
  set: SetFn<MistakesSlice>,
  get: () => SkyClassroomStore,
): MistakesSlice => ({
  mistakes: [],
  knowledgeGraph: null,
  activeFilter: null,
  addMistake: (m) => {
    set((s) => {
      if (s.mistakes.some((existing) => existing.id === m.id)) return s;
      return { mistakes: [...s.mistakes, m] };
    });
    syncAddToServer(m);
    // Q1: 做题产生错题即"当日完成 ≥1 知识点"的有效学习证据。
    void recordLearningStreakClient();
  },
  markReviewed: async (id, correct = true) => {
    const now = Date.now();
    set((s) => ({
      mistakes: s.mistakes.map((m) => {
        if (m.id !== id) return m;
        if (!correct) {
          return {
            ...m,
            reviewed: false,
            reviewCount: 0,
            masteryLevel: 0,
            lastReview: now,
            nextReview: now + 86400000,
          };
        }

        const reviewCount = m.reviewCount + 1;
        const mastered = reviewCount >= EBBINGHAUS_INTERVALS.length;
        const intervalIdx = Math.min(reviewCount, EBBINGHAUS_INTERVALS.length - 1);
        return {
          ...m,
          reviewed: mastered,
          reviewCount,
          masteryLevel: reviewCount,
          lastReview: now,
          nextReview: mastered
            ? Number.MAX_SAFE_INTEGER
            : now + EBBINGHAUS_INTERVALS[intervalIdx] * 86400000,
        };
      }),
    }));
    // Q1: 复习一道错题（无论对错）都是真实学习证据，计入当日活跃。
    void recordLearningStreakClient();
    return syncReviewToServer(id, correct);
  },
  setFilter: (filter) => set({ activeFilter: filter }),
  setKnowledgeGraph: (graph) => set({ knowledgeGraph: graph }),
  deleteMistake: (id) => {
    set((s) => ({ mistakes: s.mistakes.filter((m) => m.id !== id) }));
    syncDeleteToServer(id);
  },
  mergeMistakes: (serverMistakes) => {
    const local = get().mistakes;
    const seen = new Set<string>();
    const dedupedLocal = local.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
    const newFromServer = serverMistakes.filter((m) => !seen.has(m.id));
    if (newFromServer.length > 0 || dedupedLocal.length !== local.length) {
      set({ mistakes: [...dedupedLocal, ...newFromServer] });
    }
  },
  prioritizeReview: (knowledgePoints) => {
    const kpSet = new Set(knowledgePoints);
    set((s) => ({
      mistakes: s.mistakes.map((m) => {
        if (m.reviewed) return m;
        const matches = m.knowledgePoints.some((kp) => kpSet.has(kp));
        if (!matches) return m;
        return { ...m, nextReview: Date.now() };
      }),
    }));
  },
  updateMistakeSolution: (id, data) => {
    set((s) => ({
      mistakes: s.mistakes.map((m) => (m.id === id ? { ...m, ...data } : m)),
    }));
  },
});

// ── Assistant Slice ────────────────────────────────────────────────

/** 当前显示哪只宠物: 'theme'=随主题的白/黑猫, 'vrm'=VRM 人物。 */
export type PetKind = 'theme' | 'vrm';

interface AssistantSlice {
  isOpen: boolean;
  subject: string;
  style: string;
  difficulty: string;
  /** 当前宠物。持久化, 这样每个页面(不只主页)都知道该显示哪只。 */
  petKind: PetKind;
  /** 由 petKind + 当前主题解析出来的小镜头像(白猫/黑猫/VRM人物)。
   *  MascotSync 全局维护它 —— 猫随主题变, 人形与主题无关。 */
  mascotImage: string;

  toggleOpen: () => void;
  setSubject: (subject: string) => void;
  setStyle: (style: string) => void;
  setDifficulty: (difficulty: string) => void;
  setPetKind: (kind: PetKind) => void;
  setMascotImage: (src: string) => void;
}

const createAssistantSlice = (set: SetFn<AssistantSlice>): AssistantSlice => ({
  isOpen: false,
  subject: '',
  style: 'detailed',
  difficulty: 'high-school',
  petKind: 'theme',
  mascotImage: '',
  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  setSubject: (subject) => set({ subject }),
  setStyle: (style) => set({ style }),
  setDifficulty: (difficulty) => set({ difficulty }),
  setPetKind: (petKind) => set({ petKind }),
  setMascotImage: (src) => set({ mascotImage: src }),
});

// ── Memory Slice ──────────────────────────────────────────────────

interface MemorySlice {
  memoryProgress: {
    totalFlipped: number;
    topicCount: number;
    lastStudied: number | null;
  };
  memoryReviews: MemoryReviewRecord[];
  updateMemoryProgress: (data: Partial<MemorySlice['memoryProgress']>) => void;
  recordMemoryReview: (review: MemoryReviewRecord) => void;
  clearMemoryReviews: () => void;
}

const createMemorySlice = (set: SetFn<MemorySlice>): MemorySlice => ({
  memoryProgress: {
    totalFlipped: 0,
    topicCount: 0,
    lastStudied: null,
  },
  memoryReviews: [],
  updateMemoryProgress: (data) =>
    set((s) => ({
      memoryProgress: { ...s.memoryProgress, ...data },
    })),
  recordMemoryReview: (review) =>
    set((s) => {
      const existingIndex = s.memoryReviews.findIndex((item) => item.id === review.id);
      if (existingIndex < 0) {
        return { memoryReviews: [...s.memoryReviews, review] };
      }
      const next = [...s.memoryReviews];
      next[existingIndex] = review;
      return { memoryReviews: next };
    }),
  clearMemoryReviews: () => set({ memoryReviews: [] }),
});

// ── Retention Slice (P0: 界面克制 + 成长缓存) ─────────────────────

interface RetentionSlice {
  /** 简洁模式：隐藏动态背景与陪伴宠物（跨端同步）。 */
  simpleMode: boolean;
  /** 关闭右下角小镜助手浮钮（跨端同步）。 */
  kagamiClosed: boolean;
  /** 连续学习天数状态缓存（真实值，来自 /api/sky/learning-streak）。 */
  streakCache: StreakState | null;
  /** 成长历史（真实快照序列）缓存（来自 /api/sky/growth-history）。 */
  growthLocalCache: GrowthSnapshot[];

  setSimpleMode: (value: boolean) => void;
  setKagamiClosed: (value: boolean) => void;
}

const createRetentionSlice = (set: SetFn<RetentionSlice>): RetentionSlice => ({
  simpleMode: false,
  kagamiClosed: false,
  streakCache: null,
  growthLocalCache: [],
  setSimpleMode: (value) => set({ simpleMode: value }),
  setKagamiClosed: (value) => set({ kagamiClosed: value }),
});

// ── Combined Store ─────────────────────────────────────────────────

export type SkyClassroomStore = SolveSlice &
  SlidesSlice &
  MistakesSlice &
  AssistantSlice &
  MemorySlice &
  RetentionSlice;

export const useSkyClassroomStore = create<SkyClassroomStore>()(
  persist(
    (set, get) => ({
      // Solve
      ...createSolveSlice(set),
      // Slides
      ...createSlidesSlice(set),
      // Mistakes
      ...createMistakesSlice(set, get),
      // Assistant
      ...createAssistantSlice(set),
      // Memory
      ...createMemorySlice(set),
      // Retention
      ...createRetentionSlice(set),
    }),
    {
      name: 'sky-classroom-storage',
      version: 2,
      migrate: (persistedState: unknown) => {
        if (
          !persistedState ||
          typeof persistedState !== 'object' ||
          Array.isArray(persistedState)
        ) {
          return {} as unknown as SkyClassroomStore;
        }
        const s = persistedState as Record<string, unknown>;
        // Sanitize generationOptions if it exists with stale schema
        if (s?.generationOptions && typeof s.generationOptions === 'object') {
          const g = s.generationOptions as Record<string, unknown>;
          s.generationOptions = {
            topic: typeof g.topic === 'string' ? g.topic : '',
            difficulty: ['senior', 'college'].includes(g.difficulty as string)
              ? g.difficulty
              : 'senior',
          };
        }
        // Older assistant settings used junior/high-school aliases. Keep the
        // stored preference usable while moving the visible default forward.
        if (s.difficulty !== 'college') s.difficulty = 'senior';
        // Deduplicate mistakes with duplicate IDs (legacy data)
        if (Array.isArray(s.mistakes)) {
          const seen = new Set<string>();
          s.mistakes = (s.mistakes as { id: string }[]).filter((m) => {
            if (!m.id || seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          });
        }
        if (!Array.isArray(s.memoryReviews)) {
          s.memoryReviews = [];
        }
        if (!s.memoryProgress || typeof s.memoryProgress !== 'object') {
          s.memoryProgress = {
            totalFlipped: 0,
            topicCount: 0,
            lastStudied: null,
          };
        }
        return s as unknown as SkyClassroomStore;
      },
      partialize: (state) => ({
        selectedAvatarId: state.selectedAvatarId,
        generationOptions: state.generationOptions,
        slides: state.slides,
        subject: state.subject,
        style: state.style,
        difficulty: state.difficulty,
        petKind: state.petKind,
        mascotImage: state.mascotImage,
        mistakes: state.mistakes,
        memoryProgress: state.memoryProgress,
        memoryReviews: state.memoryReviews,
        simpleMode: state.simpleMode,
        kagamiClosed: state.kagamiClosed,
        streakCache: state.streakCache,
        growthLocalCache: state.growthLocalCache,
      }),
    },
  ),
);
