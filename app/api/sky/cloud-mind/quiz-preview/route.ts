import { NextRequest } from 'next/server';

import { generateQuiz, type QuizQuestionType } from '@/lib/agents/cloud-mind/quiz-agent';
import {
  buildQuizConfigSignature,
  normalizeQuizGoal,
  type QuizDifficulty,
} from '@/lib/cloud-mind/quiz-experience';
import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import { requireQuota, recordUsage } from '@/lib/server/billing/require-quota';
import { safeErrorMessage } from '@/lib/server/sanitize-error';

const DIFFICULTIES = new Set<QuizDifficulty>(['easy', 'medium', 'hard']);
const QUESTION_TYPES = new Set<QuizQuestionType>(['choice', 'fill', 'judge']);
const PREVIEW_CACHE_TTL_MS = 10 * 60 * 1000;

interface QuizPreviewQuestion {
  questionType: QuizQuestionType;
  question: string;
  options?: string[];
}

const globalForPreviewCache = globalThis as unknown as {
  _cloudMindQuizPreviewCache:
    | Map<string, { expiresAt: number; question: QuizPreviewQuestion }>
    | undefined;
};

const previewCache =
  globalForPreviewCache._cloudMindQuizPreviewCache ??
  (globalForPreviewCache._cloudMindQuizPreviewCache = new Map());

function normalizeDifficulty(value: unknown): QuizDifficulty {
  return DIFFICULTIES.has(value as QuizDifficulty) ? (value as QuizDifficulty) : 'medium';
}

function normalizeQuestionType(value: unknown): QuizQuestionType {
  return QUESTION_TYPES.has(value as QuizQuestionType) ? (value as QuizQuestionType) : 'choice';
}

export async function POST(req: NextRequest | Request) {
  try {
    const quota = await requireQuota('llmCalls');
    if ('error' in quota) return quota.error;

    const body = (await req.json()) as Record<string, unknown>;
    const subject = typeof body.subject === 'string' && body.subject.trim() ? body.subject : 'math';
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    const difficulty = normalizeDifficulty(body.difficulty);
    const questionType = normalizeQuestionType(body.questionType);
    const goal = normalizeQuizGoal(body.goal);
    const signature = buildQuizConfigSignature({ subject, topic, difficulty, questionType, goal });
    const cacheKey = `${quota.userId}:${signature}`;
    const cached = previewCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return apiSuccess({ signature, question: cached.question });
    }
    if (cached) previewCache.delete(cacheKey);

    const result = await generateQuiz(subject, difficulty, topic, 1, undefined, questionType, goal);
    const generated = result.questions[0];
    if (!generated) {
      return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '样题生成结果为空');
    }

    const question: QuizPreviewQuestion = {
      questionType: generated.questionType,
      question: generated.question,
      ...(generated.options.length > 0 ? { options: generated.options } : {}),
    };
    previewCache.set(cacheKey, {
      expiresAt: Date.now() + PREVIEW_CACHE_TTL_MS,
      question,
    });
    await recordUsage(quota.userId, quota.planType, 'llmCalls');

    return apiSuccess({ signature, question });
  } catch (error) {
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '生成样题预览失败',
      safeErrorMessage(error),
    );
  }
}
