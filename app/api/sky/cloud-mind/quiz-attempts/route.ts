import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getServerStorage } from '@/lib/server/server-storage';
import { invalidateProfileCache } from '@/lib/student/profile-builder';
import { createQuizAttemptDAO } from '@/lib/student/quiz-attempts';
import type { QuizAttemptInput, QuizAttemptQuestion } from '@/lib/student/quiz-attempts';
import type { Difficulty, Subject } from '@/lib/solve/agents/analyze-types';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:QuizAttempts');

const SUBJECTS = new Set<Subject>([
  'math',
  'physics',
  'chemistry',
  'biology',
  'chinese',
  'english',
  'history',
  'geography',
  'politics',
  'unknown',
]);
const DIFFICULTIES = new Set<Difficulty>(['easy', 'medium', 'hard']);

function normalizeSubject(value: unknown): Subject {
  return typeof value === 'string' && SUBJECTS.has(value as Subject) ? value as Subject : 'unknown';
}

function normalizeDifficulty(value: unknown): Difficulty {
  return typeof value === 'string' && DIFFICULTIES.has(value as Difficulty) ? value as Difficulty : 'medium';
}

function normalizeQuestions(rawQuestions: unknown): QuizAttemptQuestion[] {
  if (!Array.isArray(rawQuestions)) return [];
  return rawQuestions
    .map((raw): QuizAttemptQuestion | null => {
      const item = raw as Partial<QuizAttemptQuestion>;
      const answer = typeof item.answer === 'number' ? item.answer : Number(item.answer);
      const userAnswer = item.userAnswer === null || item.userAnswer === undefined
        ? null
        : typeof item.userAnswer === 'number'
          ? item.userAnswer
          : Number(item.userAnswer);
      const options = Array.isArray(item.options) ? item.options.map(String) : [];
      const knowledgePoints = Array.isArray(item.knowledgePoints)
        ? item.knowledgePoints.map(String).filter(Boolean)
        : [];

      if (!item.question || options.length === 0 || !Number.isInteger(answer)) return null;

      return {
        question: String(item.question),
        options,
        answer,
        userAnswer: Number.isInteger(userAnswer) ? userAnswer : null,
        isCorrect: Boolean(item.isCorrect),
        explanation: item.explanation ? String(item.explanation) : undefined,
        knowledgePoints,
      };
    })
    .filter((question): question is QuizAttemptQuestion => question !== null);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const questions = normalizeQuestions(body.questions);
    if (questions.length === 0) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '缺少有效答题记录');
    }

    const input: QuizAttemptInput = {
      userId: typeof body.userId === 'string' ? body.userId : 'default-user',
      subject: normalizeSubject(body.subject),
      difficulty: normalizeDifficulty(body.difficulty),
      topic: typeof body.topic === 'string' ? body.topic : '',
      source: body.source === 'bank' ? 'bank' : 'ai',
      questions,
    };

    const storage = await getServerStorage();
    const dao = createQuizAttemptDAO(storage);
    const attempt = await dao.add(input);
    await invalidateProfileCache(input.userId || 'default-user');

    log.info(`Quiz attempt saved: ${attempt.id}, ${attempt.correct}/${attempt.total}`);
    return apiSuccess({ attempt });
  } catch (err) {
    log.error('Save quiz attempt failed:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '答题成绩保存失败');
  }
}
