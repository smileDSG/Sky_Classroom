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
import type { AvatarConfig, AvatarSpeech, SlideGenerationOptions, SlideGenerationResult } from '@/lib/slides/types';
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
  solution: null,
  gradeResult: null,
  votingResults: [],
  fourPartOutput: null,
  fromQuestionBank: false,
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

  setSelectedAvatar: (id: string) => void;
  setAvatars: (avatars: AvatarConfig[]) => void;
  setCurrentSpeech: (speech: AvatarSpeech | null) => void;
  setGenerating: (generating: boolean) => void;
  setGenerationOptions: (options: SlideGenerationOptions) => void;
  setSlides: (slides: Slide[]) => void;
  setGenerationResult: (result: SlideGenerationResult | null) => void;
  setGenerationError: (error: string | null) => void;
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
  setSelectedAvatar: (id) => set({ selectedAvatarId: id }),
  setAvatars: (avatars) => set({ availableAvatars: avatars }),
  setCurrentSpeech: (speech) => set({ currentSpeech: speech }),
  setGenerating: (generating) => set({ isGenerating: generating }),
  setGenerationOptions: (options) => set({ generationOptions: options }),
  setSlides: (slides) => set({ slides }),
  setGenerationResult: (result) => set({ generationResult: result }),
  setGenerationError: (error) => set({ generationError: error }),
});

// ── Mistakes Slice ─────────────────────────────────────────────────

interface MistakesSlice {
  mistakes: MistakeRecord[];
  knowledgeGraph: KnowledgeGraph | null;
  activeFilter: MistakeFilter | null;

  addMistake: (mistake: MistakeRecord) => void;
  markReviewed: (id: string) => void;
  setFilter: (filter: MistakeFilter | null) => void;
  setKnowledgeGraph: (graph: KnowledgeGraph) => void;
  deleteMistake: (id: string) => void;
}

const createMistakesSlice = (set: SetFn<MistakesSlice>): MistakesSlice => ({
  mistakes: [],
  knowledgeGraph: null,
  activeFilter: null,
  addMistake: (m) => set((s) => ({ mistakes: [...s.mistakes, m] })),
  markReviewed: (id) => set((s) => ({ mistakes: s.mistakes.map((m) => m.id === id ? { ...m, reviewed: true, reviewCount: m.reviewCount + 1 } : m) })),
  setFilter: (filter) => set({ activeFilter: filter }),
  setKnowledgeGraph: (graph) => set({ knowledgeGraph: graph }),
  deleteMistake: (id) => set((s) => ({ mistakes: s.mistakes.filter((m) => m.id !== id) })),
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
      ...createMistakesSlice(set),
      // Assistant
      ...createAssistantSlice(set),
    }),
    {
      name: 'sky-classroom-storage',
      partialize: (state) => ({
        selectedAvatarId: state.selectedAvatarId,
        generationOptions: state.generationOptions,
        subject: state.subject,
        style: state.style,
        difficulty: state.difficulty,
        mistakes: state.mistakes,
      }),
    },
  ),
);
