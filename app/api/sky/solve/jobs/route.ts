/**
 * POST /api/sky/solve/jobs
 * Submit a solve job for background execution. Returns a jobId immediately.
 */
import { after } from 'next/server';
import { nanoid } from 'nanoid';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createSolveJob } from '@/lib/server/solve-job-store';
import { runSolveJob } from '@/lib/server/solve-job-runner';
import { createLogger } from '@/lib/logger';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth';
import { resolveLearnerDecisionForUser } from '@/lib/server/teaching-personalization';
import type { LearnerDecision } from '@/lib/adaptive-learning/decision/learner-decision';
import { requireAuth } from '@/lib/server/auth/helpers';

const log = createLogger('API:SolveJobs');

function buildAdaptiveGuidance(decision: LearnerDecision): string {
  const actionGuidance = {
    diagnostic: '先确认前置知识和题意理解，只讲最小必要步骤，并指出需要继续诊断的位置。',
    teach: '把概念拆成小步，先解释为什么，再完成计算；不要直接跳到最终技巧。',
    review: '先唤醒相关公式和旧方法，再对比易错步骤，突出记忆恢复。',
    quiz: '保持讲解精炼，补充迁移思路和一处挑战性变式。',
  }[decision.action];
  const formatGuidance = {
    'worked-example': '使用完整例题式分步拆解。',
    diagram: '优先用关系、结构或图示语言解释关键变量。',
    interactive: '在关键步骤加入可让学生先判断的检查点。',
  }[decision.format];

  return [
    '本次解题必须执行学习画像策略。',
    `画像判断：${decision.summary}`,
    `内容难度：${decision.difficulty}。`,
    `教学动作：${decision.action}。${actionGuidance}`,
    `讲解形式：${decision.format}。${formatGuidance}`,
    `反馈模式：${decision.explanationMode}；建议时长约 ${decision.durationMinutes} 分钟。`,
    decision.topic ? `重点关注知识点：${decision.topic}。` : '',
    decision.reasonCodes.length > 0 ? `画像原因代码：${decision.reasonCodes.join(', ')}。` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const body = await req.json();
    const { problem, problemImage, problemSpec, userAnswer } = body;

    if (!problem) {
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, '缺少必填字段: problem');
    }

    const jobId = nanoid(10);
    const job = createSolveJob(jobId, problem, auth.user.id);

    let adaptiveGuidance: string | null = null;
    try {
      const decision = await resolveLearnerDecisionForUser(auth.user.id, problem);
      if (decision) {
        adaptiveGuidance = buildAdaptiveGuidance(decision);
      }
    } catch {
      // Personalization is optional; solve remains available.
    }

    after(() =>
      runSolveJob(
        jobId,
        problem,
        problemImage ?? null,
        userAnswer ?? null,
        problemSpec ?? null,
        adaptiveGuidance,
      ),
    );

    log.info(`Solve job created: ${jobId} (${problem.slice(0, 40)}...)`);

    return apiSuccess(
      {
        jobId: job.id,
        status: job.status,
        phase: job.phase,
        progress: job.progress,
        pollUrl: `/api/sky/solve/jobs/${jobId}`,
        pollIntervalMs: 2000,
      },
      202,
    );
  } catch (err) {
    log.error('Solve job creation failed:', err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '创建解题作业失败',
      err instanceof Error ? err.message : undefined,
    );
  }
}
