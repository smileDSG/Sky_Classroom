export type QuizGoal = 'practice' | 'diagnose' | 'mock';
export type QuizMode = 'ai' | 'bank';
export type QuizDifficulty = 'easy' | 'medium' | 'hard';
export type QuizQuestionType = 'choice' | 'fill' | 'judge';

export interface StoredQuizConfig {
  mode: QuizMode;
  subject: string;
  topic: string;
  difficulty: QuizDifficulty;
  count: number;
  questionType: QuizQuestionType;
  goal: QuizGoal;
}

export interface PreviewQuizConfig {
  subject: string;
  topic: string;
  difficulty: QuizDifficulty;
  questionType: QuizQuestionType;
  goal: QuizGoal;
}

export interface QuizPreset {
  id: 'foundation' | 'exam' | 'review' | 'challenge';
  label: string;
  description: string;
  difficulty: QuizDifficulty;
  count: number;
  questionType: QuizQuestionType;
  goal: QuizGoal;
}

const QUIZ_COUNTS = new Set([3, 5, 10, 15]);
const QUIZ_MODES = new Set<QuizMode>(['ai', 'bank']);
const QUIZ_DIFFICULTIES = new Set<QuizDifficulty>(['easy', 'medium', 'hard']);
const QUIZ_QUESTION_TYPES = new Set<QuizQuestionType>(['choice', 'fill', 'judge']);

export const QUIZ_CONFIG_STORAGE_KEY = 'sky-cloud-mind-quiz-config-v1';

export const QUIZ_PRESETS: readonly QuizPreset[] = [
  {
    id: 'foundation',
    label: '基础巩固',
    description: '夯实核心概念',
    difficulty: 'easy',
    count: 5,
    questionType: 'choice',
    goal: 'practice',
  },
  {
    id: 'exam',
    label: '考前速练',
    description: '快速检验考试状态',
    difficulty: 'medium',
    count: 10,
    questionType: 'choice',
    goal: 'mock',
  },
  {
    id: 'review',
    label: '错题复盘',
    description: '聚焦易错点与误区',
    difficulty: 'easy',
    count: 5,
    questionType: 'fill',
    goal: 'diagnose',
  },
  {
    id: 'challenge',
    label: '压轴挑战',
    description: '攻克综合难题',
    difficulty: 'hard',
    count: 5,
    questionType: 'choice',
    goal: 'diagnose',
  },
] as const;

export function normalizeQuizGoal(value: unknown): QuizGoal {
  return value === 'diagnose' || value === 'mock' ? value : 'practice';
}

export function parseStoredQuizConfig(value: string | null): StoredQuizConfig | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredQuizConfig>;
    if (
      !QUIZ_MODES.has(parsed.mode as QuizMode) ||
      typeof parsed.subject !== 'string' ||
      typeof parsed.topic !== 'string' ||
      !QUIZ_DIFFICULTIES.has(parsed.difficulty as QuizDifficulty) ||
      !QUIZ_COUNTS.has(parsed.count as number) ||
      !QUIZ_QUESTION_TYPES.has(parsed.questionType as QuizQuestionType) ||
      normalizeQuizGoal(parsed.goal) !== parsed.goal
    ) {
      return null;
    }
    return {
      mode: parsed.mode as QuizMode,
      subject: parsed.subject,
      topic: parsed.topic,
      difficulty: parsed.difficulty as QuizDifficulty,
      count: parsed.count as number,
      questionType: parsed.questionType as QuizQuestionType,
      goal: parsed.goal as QuizGoal,
    };
  } catch {
    return null;
  }
}

export function buildQuizConfigSignature(config: PreviewQuizConfig): string {
  return JSON.stringify({
    subject: config.subject.trim().toLocaleLowerCase(),
    topic: config.topic.trim().toLocaleLowerCase(),
    difficulty: config.difficulty,
    questionType: config.questionType,
    goal: config.goal,
  });
}

export function buildKnowledgeSuggestions({
  query,
  personalized,
  common,
  limit = 6,
}: {
  query: string;
  personalized: string[];
  common: string[];
  limit?: number;
}): string[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const seen = new Set<string>();
  const suggestions: string[] = [];
  for (const item of [...personalized, ...common]) {
    const trimmed = item.trim();
    const key = trimmed.toLocaleLowerCase();
    if (!trimmed || seen.has(key) || (normalizedQuery && !key.includes(normalizedQuery))) continue;
    seen.add(key);
    suggestions.push(trimmed);
    if (suggestions.length >= limit) break;
  }
  return suggestions;
}
