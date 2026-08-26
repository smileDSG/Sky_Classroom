/**
 * /api/sky/cloud-mind/quiz
 *
 * POST: enqueue quiz generation as a background job.
 * GET: poll job status by jobId.
 */

import { after, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import { verifyAccessToken } from '@/lib/server/auth';
import { buildStudentProfile } from '@/lib/student/profile-builder';
import { deriveQuizParamsFromProfile } from '@/lib/student/quiz-param-deriver';
import { getSubjectLabelOrSelf } from '@/lib/mistakes/subject-inference';
import { createCloudMindQuizJob, getCloudMindQuizJob } from '@/lib/server/cloud-mind-quiz-job-store';
import { runCloudMindQuizJob } from '@/lib/server/cloud-mind-quiz-job-runner';
import { resolveLearnerDecisionForUser } from '@/lib/server/teaching-personalization';
import { requireAuth } from '@/lib/server/auth/helpers';
import { requireQuota, recordUsage } from '@/lib/server/billing/require-quota';

const log = createLogger('API:CloudMindQuiz');

export const maxDuration = 60;

const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
type QuizDifficulty = 'easy' | 'medium' | 'hard';

function normalizeDifficulty(value: string): QuizDifficulty {
  return DIFFICULTIES.has(value) ? (value as QuizDifficulty) : 'medium';
}

async function resolveUserId(): Promise<string | null> {
  try {
    const store = await cookies();
    const token = store.get('access_token');
    if (!token) return null;
    const payload = await verifyAccessToken(token.value);
    return payload?.sub ?? null;
  } catch {
    return null;
  }
}

async function resolveJobInput(body: unknown): Promise<{
  subject: string;
  difficulty: QuizDifficulty;
  topic: string;
  count: number;
  profile?: Awaited<ReturnType<typeof buildStudentProfile>>;
  profileInjected: boolean;
  derived?: { subject: string; difficulty: string; topic: string; count: number };
}> {
  const { subject, difficulty, topic, count, auto } = (body ?? {}) as {
    subject?: string;
    difficulty?: string;
    topic?: string;
    count?: number;
    auto?: boolean;
  };

  const userId = await resolveUserId();
  const profile = userId ? await buildStudentProfile(userId) : undefined;
  const decision = userId ? await resolveLearnerDecisionForUser(userId, topic) : undefined;

  let derived: { subject: string; difficulty: string; topic: string; count: number } | undefined;
  if (auto || !subject || !difficulty || !topic) {
    if (!profile) throw new Error('需要登录且存在学情数据才能自动出题');
    derived = decision
      ? {
          subject: 'math',
          difficulty: decision.difficulty,
          topic: decision.topic ?? '',
          count: decision.questionCount,
        }
      : deriveQuizParamsFromProfile(profile, { count: count ?? 5 });
  }

  const finalSubject = subject || derived?.subject || 'math';
  const finalDifficulty = normalizeDifficulty(difficulty || derived?.difficulty || 'medium');
  const finalTopic = topic || derived?.topic || '';
  const questionCount = Math.min(Math.max(count || derived?.count || 5, 1), 20);

  return {
    subject: finalSubject,
    difficulty: finalDifficulty,
    topic: finalTopic,
    count: questionCount,
    profile,
    profileInjected: Boolean(profile),
    derived,
  };
}

export async function POST(req: NextRequest) {
  try {
    const quota = await requireQuota('llmCalls');
    if ('error' in quota) return quota.error;
    const input = await resolveJobInput(await req.json());
    const jobId = nanoid(10);

    await createCloudMindQuizJob(jobId, {
      userId: quota.userId,
      subject: input.subject,
      difficulty: input.difficulty,
      topic: input.topic,
      count: input.count,
      profileInjected: input.profileInjected,
      derived: input.derived,
    });
    await recordUsage(quota.userId, quota.planType, 'llmCalls');

    after(() =>
      runCloudMindQuizJob(jobId, {
        subject: input.subject,
        difficulty: input.difficulty,
        topic: input.topic,
        count: input.count,
        profile: input.profile,
      }),
    );

    log.info(
      `Quiz job created: ${jobId} for ${getSubjectLabelOrSelf(input.subject)} / ${input.difficulty} / ${input.count}`,
    );

    return apiSuccess(
      {
        jobId,
        status: 'queued',
        phase: 'queued',
        progress: 0,
        pollUrl: `/api/sky/cloud-mind/quiz?jobId=${jobId}`,
        pollIntervalMs: 2000,
      },
      202,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Quiz generation enqueue failed:', message);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '创建智能出题任务失败', message);
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;
    const jobId = req.nextUrl.searchParams.get('jobId');
    if (!jobId) return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing jobId');
    if (jobId.length > 40) return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Invalid jobId');

    const job = getCloudMindQuizJob(jobId);
    if (!job) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 404, 'Job not found (expired or never existed)');
    }
    if (job.userId !== auth.user.id) {
      return apiError(API_ERROR_CODES.UNAUTHORIZED, 403, '无权访问此任务');
    }

    return apiSuccess({
      jobId: job.id,
      status: job.status,
      phase: job.phase,
      progress: job.progress,
      result: job.result,
      error: job.error,
      done: job.status === 'completed' || job.status === 'failed',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Quiz job poll failed:', message);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '获取智能出题状态失败', message);
  }
}
