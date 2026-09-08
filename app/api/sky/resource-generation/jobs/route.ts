import { NextRequest } from 'next/server';

import { runSoftwareCupGeneration } from '@/lib/software-cup/demo-service';
import { getCurrentUser } from '@/lib/server/auth/helpers';
import { rateLimiters, rateLimitResponse, getClientIp } from '@/lib/api/middleware/rate-limiter';
import { requireQuota, recordUsage } from '@/lib/server/billing/require-quota';

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
  };
  const input =
    [body.input, body.studentInput].find((value): value is string => typeof value === 'string') ??
    '';
  if (input.length > 30000) {
    return Response.json(
      { success: false, error: '输入内容不能超过 30000 个字符' },
      { status: 400 },
    );
  }

  const result = await runSoftwareCupGeneration(input, {
    userId: user?.id,
    enableLlm: Boolean(user),
  });

  if (quota && !('error' in quota)) {
    await recordUsage(quota.userId, quota.planType, 'llmCalls');
  }

  return Response.json({
    success: true,
    data: result,
  });
}
