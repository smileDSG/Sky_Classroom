/**
 * POST /api/sky/cloud-mind/quiz
 *
 * 智能出题 Agent API
 * 接收学科、难度、知识点，或基于学情自动推导，调用 DeepSeek 生成高质量选择题。
 */

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { generateQuiz } from '@/lib/agents/cloud-mind/quiz-agent';
import { buildStudentProfile } from '@/lib/student/profile-builder';
import { deriveQuizParamsFromProfile } from '@/lib/student/quiz-param-deriver';
import { getSubjectLabel } from '@/lib/mistakes/subject-inference';
import { verifyAccessToken } from '@/lib/server/auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:CloudMindQuiz');

export const maxDuration = 60;

const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

type QuizDifficulty = 'easy' | 'medium' | 'hard';

function normalizeDifficulty(value: string): QuizDifficulty {
  return DIFFICULTIES.has(value) ? (value as QuizDifficulty) : 'medium';
}

async function resolveUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token');
    if (!accessToken) return null;
    const payload = await verifyAccessToken(accessToken.value);
    return payload?.sub ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subject, difficulty, topic, count, auto } = body as {
      subject?: string;
      difficulty?: string;
      topic?: string;
      count?: number;
      auto?: boolean;
    };

    const userId = await resolveUserId();
    let profile = userId ? await buildStudentProfile(userId) : undefined;

    // Auto-derive missing parameters from the student profile
    let derived:
      | { subject: string; difficulty: string; topic: string; count: number }
      | undefined;
    if (auto || !subject || !difficulty || !topic) {
      if (!profile) {
        return Response.json(
          { success: false, error: '需要登录且存在学情数据才能自动出题' },
          { status: 400 },
        );
      }
      derived = deriveQuizParamsFromProfile(profile, {
        count: count ?? 5,
      });
    }

    const finalSubject = subject || derived?.subject || 'math';
    const finalDifficulty = normalizeDifficulty(
      difficulty || derived?.difficulty || 'medium',
    );
    const finalTopic = topic || derived?.topic || '';
    const questionCount = Math.min(
      Math.max(count || derived?.count || 5, 1),
      20,
    );

    const result = await generateQuiz(
      finalSubject,
      finalDifficulty,
      finalTopic,
      questionCount,
      profile,
    );

    log.info(
      `Quiz generated: ${result.questions.length} questions for ${finalSubject}`,
    );

    return Response.json({
      success: true,
      data: {
        ...result,
        subject: getSubjectLabel(finalSubject as any) || result.subject,
        difficulty: finalDifficulty,
      },
      meta: {
        profileInjected: Boolean(profile),
        derived: derived
          ? {
              subject: derived.subject,
              difficulty: derived.difficulty,
              topic: derived.topic,
              count: derived.count,
            }
          : undefined,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Quiz generation failed:', message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
