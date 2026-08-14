/**
 * POST /api/sky/teaching/generate-stream
 *
 * Submit a teaching job for background execution.
 * Requires authentication. Returns a jobId for polling.
 *
 * Request body:
 *   { topic: string }
 */

import { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { after } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireQuota, recordUsage } from '@/lib/server/billing/require-quota';
import { createTeachingJob } from '@/lib/server/teaching-job-store';
import { runTeachingJob } from '@/lib/server/teaching-job-runner';
import { createLogger } from '@/lib/logger';
import { teachingGenerationPolicySchema } from '@/lib/teaching/personalization-policy';

const log = createLogger('API:TeachingGenerate');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic } = body;

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return apiError('MISSING_REQUIRED_FIELD', 400, '缺少 topic 参数');
    }

    // Auth + quota check
    const quota = await requireQuota('generationCount');
    if ('error' in quota) return quota.error;

    const jobId = nanoid(10);
    const trimmedTopic = topic.trim();
    const parsedPolicy = body.personalizationPolicy
      ? teachingGenerationPolicySchema.safeParse(body.personalizationPolicy)
      : null;
    if (parsedPolicy && !parsedPolicy.success) {
      return apiError(
        'INVALID_REQUEST',
        400,
        '个性化授课参数无效',
        parsedPolicy.error.issues[0]?.message,
      );
    }
    const personalizationPolicy = parsedPolicy?.success ? parsedPolicy.data : undefined;

    // Create job record
    await createTeachingJob(jobId, quota.userId, trimmedTopic, personalizationPolicy);

    // Record usage
    await recordUsage(quota.userId, quota.planType, 'generationCount');

    // Start background generation
    after(() => runTeachingJob(jobId, trimmedTopic, quota.userId, personalizationPolicy));

    log.info(`Teaching job ${jobId} created for user ${quota.userId}, topic: ${trimmedTopic}`);

    return apiSuccess({ jobId, topic: trimmedTopic }, 202);
  } catch (err) {
    log.error('Teaching job creation failed:', err);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to create teaching job',
      err instanceof Error ? err.message : 'Unknown error',
    );
  }
}
