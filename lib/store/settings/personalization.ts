/**
 * Personalization Settings Slice
 *
 * User personalization preferences for AI interactions.
 * Includes learning style, difficulty preference, AI personality, etc.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Learning style preference */
export type LearningStyle = 'visual' | 'auditory' | 'reading' | 'kinesthetic' | 'balanced';

/** Answer detail level */
export type DetailLevel = 'concise' | 'standard' | 'detailed' | 'comprehensive';

/** AI personality style */
export type AIPersonality = 'friendly' | 'professional' | 'encouraging' | 'strict' | 'humorous';

/** Education level */
export type EducationLevel = 'primary' | 'middle' | 'high' | 'undergraduate' | 'graduate' | 'other';

/** Subject preference */
export interface SubjectPreference {
  id: string;
  name: string;
  enabled: boolean;
}

/** User personalization state */
export interface PersonalizationSliceState {
  // Basic profile
  educationLevel: EducationLevel;
  grade: string;
  favoriteSubjects: SubjectPreference[];

  // Learning preferences
  learningStyle: LearningStyle;
  detailLevel: DetailLevel;
  preferredLanguage: string; // 'zh', 'en', etc.

  // AI personality
  aiPersonality: AIPersonality;
  aiName: string;
  customInstructions: string;

  // Feature preferences
  autoGenerateQuiz: boolean;
  showStepByStep: boolean;
  enableMemory: boolean;
  enableRAG: boolean;
}

export interface PersonalizationSliceActions {
  setEducationLevel: (level: EducationLevel) => void;
  setGrade: (grade: string) => void;
  setFavoriteSubjects: (subjects: SubjectPreference[]) => void;
  toggleSubject: (subjectId: string) => void;
  setLearningStyle: (style: LearningStyle) => void;
  setDetailLevel: (level: DetailLevel) => void;
  setPreferredLanguage: (lang: string) => void;
  setAIPersonality: (personality: AIPersonality) => void;
  setAIName: (name: string) => void;
  setCustomInstructions: (instructions: string) => void;
  setAutoGenerateQuiz: (enabled: boolean) => void;
  setShowStepByStep: (enabled: boolean) => void;
  setEnableMemory: (enabled: boolean) => void;
  setEnableRAG: (enabled: boolean) => void;
  resetPersonalization: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_SUBJECTS: SubjectPreference[] = [
  { id: 'math', name: '数学', enabled: true },
  { id: 'physics', name: '物理', enabled: true },
  { id: 'chemistry', name: '化学', enabled: true },
  { id: 'biology', name: '生物', enabled: true },
  { id: 'chinese', name: '语文', enabled: true },
  { id: 'english', name: '英语', enabled: true },
  { id: 'history', name: '历史', enabled: false },
  { id: 'geography', name: '地理', enabled: false },
  { id: 'politics', name: '政治', enabled: false },
  { id: 'computer', name: '计算机', enabled: false },
];

export const LEARNING_STYLE_LABELS: Record<LearningStyle, string> = {
  visual: '视觉型',
  auditory: '听觉型',
  reading: '阅读型',
  kinesthetic: '实践型',
  balanced: '平衡型',
};

export const DETAIL_LEVEL_LABELS: Record<DetailLevel, string> = {
  concise: '简洁',
  standard: '标准',
  detailed: '详细',
  comprehensive: '全面',
};

export const AI_PERSONALITY_LABELS: Record<AIPersonality, string> = {
  friendly: '友善亲切',
  professional: '专业严谨',
  encouraging: '鼓励引导',
  strict: '严格要求',
  humorous: '幽默风趣',
};

export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  primary: '小学',
  middle: '初中',
  high: '高中',
  undergraduate: '大学本科',
  graduate: '研究生',
  other: '其他',
};

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export function getDefaultPersonalizationState(): Omit<
  PersonalizationSliceState,
  keyof PersonalizationSliceActions
> {
  return {
    educationLevel: 'middle',
    grade: '',
    favoriteSubjects: DEFAULT_SUBJECTS,
    learningStyle: 'balanced',
    detailLevel: 'standard',
    preferredLanguage: 'zh',
    aiPersonality: 'friendly',
    aiName: '小智',
    customInstructions: '',
    autoGenerateQuiz: true,
    showStepByStep: true,
    enableMemory: true,
    enableRAG: true,
  };
}

// ---------------------------------------------------------------------------
// Action creators
// ---------------------------------------------------------------------------

export function createPersonalizationActions(
  set: (
    partial:
      | Partial<PersonalizationSliceState>
      | ((state: PersonalizationSliceState) => Partial<PersonalizationSliceState>),
  ) => void,
): PersonalizationSliceActions {
  return {
    setEducationLevel: (level) => set({ educationLevel: level }),
    setGrade: (grade) => set({ grade }),
    setFavoriteSubjects: (subjects) => set({ favoriteSubjects: subjects }),
    toggleSubject: (subjectId) =>
      set((state) => ({
        favoriteSubjects: state.favoriteSubjects.map((s) =>
          s.id === subjectId ? { ...s, enabled: !s.enabled } : s,
        ),
      })),
    setLearningStyle: (style) => set({ learningStyle: style }),
    setDetailLevel: (level) => set({ detailLevel: level }),
    setPreferredLanguage: (lang) => set({ preferredLanguage: lang }),
    setAIPersonality: (personality) => set({ aiPersonality: personality }),
    setAIName: (name) => set({ aiName: name }),
    setCustomInstructions: (instructions) => set({ customInstructions: instructions }),
    setAutoGenerateQuiz: (enabled) => set({ autoGenerateQuiz: enabled }),
    setShowStepByStep: (enabled) => set({ showStepByStep: enabled }),
    setEnableMemory: (enabled) => set({ enableMemory: enabled }),
    setEnableRAG: (enabled) => set({ enableRAG: enabled }),
    resetPersonalization: () => set(getDefaultPersonalizationState()),
  };
}
