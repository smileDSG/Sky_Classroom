/**
 * POST /api/sky/teaching/mistake-review
 *
 * Create a personalized teaching job based on selected mistakes.
 * Request body: { mistakeIds: string[] }
 * Response: { jobId: string, topic: string, weakPoints: string[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { after } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireQuota, recordUsage } from '@/lib/server/billing/require-quota';
import { createTeachingJob } from '@/lib/server/teaching-job-store';
import { runTeachingJob } from '@/lib/server/teaching-job-runner';
import { resolveTeachingPersonalizationPolicy } from '@/lib/server/teaching-personalization';
import { getServerStorage } from '@/lib/server/server-storage';
import { safeErrorMessage } from '@/lib/server/sanitize-error';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import {
  planMistakeReview,
  buildTeachingTopicFromReview,
} from '@/lib/teaching/mistake-review-planner';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:MistakeReview');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mistakeIds } = body;

    if (!Array.isArray(mistakeIds) || mistakeIds.length === 0) {
      return apiError('MISSING_REQUIRED_FIELD', 400, '缺少 mistakeIds 参数');
    }

    // Auth + quota check
    const quota = await requireQuota('generationCount');
    if ('error' in quota) return quota.error;
    const userId = quota.userId;

    // Fetch mistakes from storage
    const storage = await getServerStorage();
    const dao = createMistakeBookDAO(storage);

    const mistakes: NonNullable<Awaited<ReturnType<typeof dao.get>>>[] = [];
    for (const id of mistakeIds) {
      const entry = await dao.get(userId, id);
      if (entry) mistakes.push(entry);
    }

    if (mistakes.length === 0) {
      return apiError('NOT_FOUND', 404, '未找到指定的错题记录');
    }

    // Analyze mistakes and build review plan
    const reviewPlan = planMistakeReview(mistakes);
    const teachingTopic = buildTeachingTopicFromReview(reviewPlan);
    const personalizationPolicy = await resolveTeachingPersonalizationPolicy(
      quota.userId,
      teachingTopic,
    );

    const jobId = nanoid(10);

    // Create job record
    await createTeachingJob(jobId, quota.userId, teachingTopic, personalizationPolicy);

    // Record usage
    await recordUsage(quota.userId, quota.planType, 'generationCount');

    // Start background generation
    after(() => runTeachingJob(jobId, teachingTopic, quota.userId, personalizationPolicy));

    log.info(
      `Mistake review job ${jobId} created for user ${quota.userId}, topic: ${teachingTopic}`,
    );

    return apiSuccess(
      {
        jobId,
        topic: teachingTopic,
        title: reviewPlan.title,
        weakPoints: reviewPlan.weakPoints,
        errorPatterns: reviewPlan.errorPatterns,
      },
      202,
    );
  } catch (err) {
    log.error('Mistake review creation failed:', err);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to create mistake review job',
      safeErrorMessage(err),
    );
  }
}
