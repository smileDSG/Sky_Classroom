import { nanoid } from 'nanoid';
import { NextRequest } from 'next/server';

import { apiError, apiSuccess } from '@/lib/server/api-response';
import { getCurrentUser } from '@/lib/server/auth/helpers';
import {
  createResourceGenerationJobHybrid,
  listResourceGenerationJobsHybrid,
} from '@/lib/server/resource-generation-job-store';
import { runResourceGenerationJob } from '@/lib/server/resource-generation-runner';
import { isCourseResourceType } from '@/lib/software-cup/demo-service';
import { rateLimiters, rateLimitResponse, getClientIp } from '@/lib/api/middleware/rate-limiter';
import { requireQuota, recordUsage } from '@/lib/server/billing/require-quota';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  let quota: Awaited<ReturnType<typeof requireQuota>> | null = null;
  if (!user) {
    const rateLimitResult = rateLimiters.generate.consume(getClientIp(req));
    if (!rateLimitResult.allowed) return rateLimitResponse(rateLimitResult);
  } else {
    quota = await requireQuota('llmCalls');
    if ('error' in quota) return quota.error;
  }

  const body = (await req.json().catch(() => ({}))) as {
    input?: string;
    studentInput?: string;
    resourceTypes?: unknown;
    types?: unknown;
  };
  const input =
    [body.input, body.studentInput].find((value): value is string => typeof value === 'string') ??
    '';

  const requestedTypes = Array.isArray(body.resourceTypes)
    ? body.resourceTypes
    : Array.isArray(body.types)
      ? body.types
      : [];
  const resourceTypes = requestedTypes.map(String).filter(isCourseResourceType);
  const selectedResourceTypes = resourceTypes.length > 0 ? resourceTypes : undefined;
  if (!input.trim()) {
    return Response.json(
      { success: false, error: '缺少学习背景或学习目标，无法生成学习资料' },
      { status: 400 },
    );
  }
  if (input.length > 30000) {
    return Response.json(
      { success: false, error: '输入内容不能超过 30000 个字符' },
      { status: 400 },
    );
  }

  const jobId = `res_${nanoid(12)}`;
  await createResourceGenerationJobHybrid(jobId, input, user?.id, selectedResourceTypes);

  // Start generation immediately in the background. 一律走 LLM 生成「真货」，
  // 不再对匿名或未登录用户静默返回 demo 假料。
  runResourceGenerationJob(jobId, {
    enableLlm: true,
    resourceTypes: selectedResourceTypes,
  }).catch(() => {});

  if (quota && !('error' in quota)) {
    await recordUsage(quota.userId, quota.planType, 'llmCalls');
  }

  return apiSuccess(
    {
      jobId,
      status: 'initializing',
      step: 'initializing',
      message: '已将生成任务提交到后台，正在准备学习资料',
      pollIntervalMs: 2000,
    },
    202,
  );
}

interface ResourceJobListItem {
  jobId: string;
  status: string;
  step: string;
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  topic: string;
  resourceCount: number;
  error?: string;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError('UNAUTHORIZED', 401, 'Not authenticated');
  }

  const jobs = await listResourceGenerationJobsHybrid(user.id, { limit: 50 });
  const list: ResourceJobListItem[] = jobs.map((job) => ({
    jobId: job.id,
    status: job.status,
    step: job.step,
    progress: job.progress,
    message: job.message,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
    topic: job.result?.studentProfile?.dimensions?.learningGoal?.value ?? job.inputPreview,
    resourceCount: job.result?.resources?.length ?? 0,
    error: job.error,
  }));

  return apiSuccess({ jobs: list });
}
