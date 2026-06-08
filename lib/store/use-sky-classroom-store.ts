/**
 * Sky Classroom Store
 *
 * Centralized Zustand store for all Sky Classroom modules.
 * Uses slice pattern: solve, slides, mistakes, assistant.
 * Persists user preferences to localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
import type { MistakeRecord, KnowledgeGraph, MistakeFilter } from '@/lib/mistakes/types';
import type { Slide } from '@/lib/types/slides';
import { createLogger } from '@/lib/logger';

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
        difficulty: ['junior', 'senior', 'college'].includes(options.difficulty as string)
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
    }),
  }).catch(() => {
    /* ignore — local store is source of truth for UI */
  });
}

/** Fire-and-forget: PATCH mistake review on server */
function syncReviewToServer(id: string): void {
  fetch('/api/sky/mistakes', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  }).catch(() => {});
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
  markReviewed: (id: string) => void;
  setFilter: (filter: MistakeFilter | null) => void;
  setKnowledgeGraph: (graph: KnowledgeGraph) => void;
  deleteMistake: (id: string) => void;
  mergeMistakes: (serverMistakes: MistakeRecord[]) => void;
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
  },
  markReviewed: (id) => {
    set((s) => ({
      mistakes: s.mistakes.map((m) =>
        m.id === id ? { ...m, reviewed: true, reviewCount: m.reviewCount + 1 } : m,
      ),
    }));
    syncReviewToServer(id);
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
});

// ── Assistant Slice ────────────────────────────────────────────────

interface AssistantSlice {
  isOpen: boolean;
  subject: string;
  style: string;
  difficulty: string;

  toggleOpen: () => void;
  setSubject: (subject: string) => void;
  setStyle: (style: string) => void;
  setDifficulty: (difficulty: string) => void;
}

const createAssistantSlice = (set: SetFn<AssistantSlice>): AssistantSlice => ({
  isOpen: false,
  subject: '',
  style: 'detailed',
  difficulty: 'high-school',
  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  setSubject: (subject) => set({ subject }),
  setStyle: (style) => set({ style }),
  setDifficulty: (difficulty) => set({ difficulty }),
});

// ── Combined Store ─────────────────────────────────────────────────

export type SkyClassroomStore = SolveSlice & SlidesSlice & MistakesSlice & AssistantSlice;

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
            difficulty: ['junior', 'senior', 'college'].includes(g.difficulty as string)
              ? g.difficulty
              : 'senior',
          };
        }
        // Deduplicate mistakes with duplicate IDs (legacy data)
        if (Array.isArray(s.mistakes)) {
          const seen = new Set<string>();
          s.mistakes = (s.mistakes as { id: string }[]).filter((m) => {
            if (!m.id || seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          });
        }
        return s as unknown as SkyClassroomStore;
      },
      onError: (error: unknown) => {
        console.error('[SkyClassroom] Hydration failed — clearing corrupted cache:', error);
        try {
          localStorage.removeItem('sky-classroom-storage');
        } catch {
          /* ignore */
        }
      },
      partialize: (state) => ({
        selectedAvatarId: state.selectedAvatarId,
        generationOptions: state.generationOptions,
        slides: state.slides,
        subject: state.subject,
        style: state.style,
        difficulty: state.difficulty,
        mistakes: state.mistakes,
      }),
    },
  ),
);
