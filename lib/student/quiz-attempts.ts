import type { StorageProvider, StorageEntry } from '@/lib/storage/storage-types';
import type { Subject, Difficulty } from '@/lib/solve/agents/analyze-types';

const TABLE = 'quiz_attempts';

export interface QuizAttemptQuestion {
  question: string;
  options: string[];
  answer: number;
  userAnswer: number | null;
  isCorrect: boolean;
  explanation?: string;
  knowledgePoints: string[];
}

export interface QuizAttempt {
  id: string;
  userId: string;
  subject: Subject;
  difficulty: Difficulty;
  topic: string;
  source: 'ai' | 'bank';
  total: number;
  correct: number;
  accuracy: number;
  questions: QuizAttemptQuestion[];
  createdAt: number;
}

export interface QuizAttemptInput {
  userId?: string;
  subject: Subject;
  difficulty: Difficulty;
  topic?: string;
  source?: 'ai' | 'bank';
  questions: QuizAttemptQuestion[];
}

function genId(): string {
  return `quiz_attempt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createQuizAttemptDAO(storage: StorageProvider) {
  return {
    async add(input: QuizAttemptInput): Promise<QuizAttempt> {
      const now = Date.now();
      const total = input.questions.length;
      const correct = input.questions.filter((question) => question.isCorrect).length;
      const attempt: QuizAttempt = {
        id: genId(),
        userId: input.userId || 'default-user',
        subject: input.subject,
        difficulty: input.difficulty,
        topic: input.topic?.trim() || '',
        source: input.source || 'ai',
        total,
        correct,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
        questions: input.questions,
        createdAt: now,
      };

      const entry: StorageEntry<QuizAttempt> = {
        id: attempt.id,
        data: attempt,
        createdAt: now,
        updatedAt: now,
      };
      await storage.set(TABLE, entry);
      return attempt;
    },

    async list(options?: { userId?: string; recentDays?: number }): Promise<QuizAttempt[]> {
      const cutoff = options?.recentDays
        ? Date.now() - options.recentDays * 24 * 60 * 60 * 1000
        : 0;
      const entries = await storage.getAll<QuizAttempt>(TABLE, (entry) => {
        if (options?.userId && entry.data.userId !== options.userId) return false;
        return entry.data.createdAt >= cutoff;
      });
      return entries.map((entry) => entry.data).sort((a, b) => b.createdAt - a.createdAt);
    },
  };
}
