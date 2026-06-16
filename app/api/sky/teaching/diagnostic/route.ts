/**
 * POST /api/sky/teaching/diagnostic
 *
 * 诊断式备课 API：根据授课主题生成前置知识检测题。
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth';
import { getServerStorage } from '@/lib/server/server-storage';
import { buildStudentProfile } from '@/lib/student/profile-builder';
import { extractPrerequisites } from '@/lib/teaching/diagnostic-generator';
import { search } from '@/lib/question-bank/dao';
import { generateQuiz } from '@/lib/agents/cloud-mind/quiz-agent';
import type { DiagnosticQuestion } from '@/lib/teaching/diagnostic-generator';

const log = createLogger('TeachingDiagnosticAPI');

const SESSION_TABLE = 'diagnostic_sessions';
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface DiagnosticSession {
  questions: DiagnosticQuestion[];
  topic: string;
  userId: string;
  createdAt: number;
}

/** Persist session to storage provider */
async function saveSession(sessionId: string, session: DiagnosticSession): Promise<void> {
  const storage = await getServerStorage();
  await storage.set(SESSION_TABLE, {
    id: sessionId,
    data: session,
    createdAt: session.createdAt,
    updatedAt: session.createdAt,
  });
}

/** Read session from storage provider */
export async function getSession(sessionId: string): Promise<DiagnosticSession | null> {
  const storage = await getServerStorage();
  const entry = await storage.get<DiagnosticSession>(SESSION_TABLE, sessionId);
  if (!entry) return null;
  if (Date.now() - entry.data.createdAt > SESSION_TTL_MS) {
    await storage.delete(SESSION_TABLE, sessionId);
    return null;
  }
  return entry.data;
}

/** Clean up expired sessions */
async function cleanupExpiredSessions(): Promise<void> {
  try {
    const storage = await getServerStorage();
    const entries = await storage.getAll<DiagnosticSession>(SESSION_TABLE, (entry) =>
      Date.now() - entry.data.createdAt > SESSION_TTL_MS,
    );
    for (const entry of entries) {
      await storage.delete(SESSION_TABLE, entry.id);
    }
  } catch {
    // ignore cleanup errors
  }
}

function normalizeOptionAnswer(answer: string, options: string[]): number {
  const trimmed = answer.trim().toUpperCase();
  if (/^[A-D]$/.test(trimmed)) {
    return trimmed.charCodeAt(0) - 65;
  }
  const num = Number(trimmed);
  if (!Number.isNaN(num) && num >= 0 && num < options.length) {
    return num;
  }
  return 0;
}

/** Generate diagnostic questions for given prerequisites. */
async function generateDiagnosticQuestions(
  prerequisites: string[],
  subject: string,
): Promise<DiagnosticQuestion[]> {
  const questions: DiagnosticQuestion[] = [];
  let id = 1;

  // Strategy 1: Search question bank
  for (const kp of prerequisites) {
    if (questions.length >= 5) break;
    try {
      const rows = await search({
        knowledgePoint: kp,
        difficulty: 'easy',
        questionType: 'choice',
        limit: 1,
      });
      if (rows.length > 0) {
        const row = rows[0];
        const opts = row.options ?? [];
        if (opts.length >= 2) {
          questions.push({
            id: id++,
            question: row.content,
            options: opts.slice(0, 4),
            answer: normalizeOptionAnswer(row.answer, opts.slice(0, 4)),
            explanation: row.explanation || '暂无解析',
            knowledgePoint: kp,
          });
        }
      }
    } catch (err) {
      log.warn(`Failed to search question bank for "${kp}":`, err);
    }
  }

  // Strategy 2: If not enough from bank, use AI quiz agent
  if (questions.length < prerequisites.length && questions.length < 5) {
    const remaining = prerequisites.slice(questions.length);
    const topicStr = remaining.join('、');
    try {
      const quiz = await generateQuiz(subject, 'easy', topicStr, Math.min(remaining.length, 5 - questions.length));
      for (const q of quiz.questions) {
        questions.push({
          id: id++,
          question: q.question,
          options: q.options.slice(0, 4),
          answer: q.answer,
          explanation: q.explanation,
          knowledgePoint: remaining[Math.min(id - 2, remaining.length - 1)] || topicStr,
        });
      }
    } catch (err) {
      log.warn('AI quiz generation failed for diagnostic:', err);
    }
  }

  return questions;
}

/** POST /api/sky/teaching/diagnostic — Generate diagnostic quiz */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, subject = 'math' } = body;

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ error: 'Missing topic' }, { status: 400 });
    }

    // Verify authentication
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token');
    let userId: string | null = null;

    if (accessToken) {
      const payload = await verifyAccessToken(accessToken.value);
      if (payload) userId = payload.sub;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Build profile and extract prerequisites
    const profile = await buildStudentProfile(userId);
    const prerequisites = extractPrerequisites(topic, profile);

    if (prerequisites.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          hasPrerequisites: false,
          message: '该主题暂无需要检测的前置知识，可以直接开始授课。',
        },
      });
    }

    // Generate diagnostic questions
    const questions = await generateDiagnosticQuestions(prerequisites, subject);

    if (questions.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          hasPrerequisites: false,
          message: '暂无前置知识检测题，可以直接开始授课。',
        },
      });
    }

    // Store session persistently
    const sessionId = `diag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await saveSession(sessionId, {
      questions,
      topic,
      userId,
      createdAt: Date.now(),
    });

    // Clean up expired sessions in background
    cleanupExpiredSessions().catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        topic,
        questions: questions.map((q) => ({
          id: q.id,
          question: q.question,
          options: q.options,
          knowledgePoint: q.knowledgePoint,
        })),
        totalQuestions: questions.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Diagnostic generation failed:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
