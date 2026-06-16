/**
 * POST /api/sky/cloud-mind/quiz
 *
 * 智能出题 Agent API
 * 接收学科、难度、知识点，调用 DeepSeek 生成高质量选择题。
 */

import { NextRequest } from 'next/server';
import { generateQuiz } from '@/lib/agents/cloud-mind/quiz-agent';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:CloudMindQuiz');

export const maxDuration = 60;

const SUBJECT_LABELS: Record<string, string> = {
  math: '数学',
  physics: '物理',
  chemistry: '化学',
  biology: '生物',
  chinese: '语文',
  english: '英语',
  history: '历史',
  politics: '政治',
  geography: '地理',
};

const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

type QuizDifficulty = 'easy' | 'medium' | 'hard';

function normalizeDifficulty(value: string): QuizDifficulty {
  return DIFFICULTIES.has(value) ? (value as QuizDifficulty) : 'medium';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subject, difficulty, topic, count } = body as {
      subject: string;
      difficulty: string;
      topic?: string;
      count?: number;
    };

    if (!subject || typeof subject !== 'string') {
      return Response.json({ success: false, error: '请选择学科' }, { status: 400 });
    }

    if (!difficulty || typeof difficulty !== 'string') {
      return Response.json({ success: false, error: '请选择难度' }, { status: 400 });
    }

    const questionCount = Math.min(Math.max(count || 5, 1), 20);
    const result = await generateQuiz(subject, difficulty, topic || '', questionCount);

    log.info(`Quiz generated: ${result.questions.length} questions for ${subject}`);

    return Response.json({
      success: true,
      data: {
        ...result,
        subject: SUBJECT_LABELS[subject] || result.subject,
        difficulty: normalizeDifficulty(difficulty),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Quiz generation failed:', message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
