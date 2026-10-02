/**
 * POST /api/sky/teaching/[jobId]/to-classroom
 *
 * Convert a completed TeachingJob into a Classroom Stage and persist it.
 * Response: { stageId, sceneCount, redirectUrl }
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { readTeachingJob, updateTeachingJob } from '@/lib/server/teaching-job-store';
import { convertTeachingJobToStage } from '@/lib/teaching/to-classroom';
import { persistClassroom, readClassroom } from '@/lib/server/classroom-storage';
import { createLogger } from '@/lib/logger';
import { requireQuota } from '@/lib/server/billing/require-quota';
import { safeErrorMessage } from '@/lib/server/sanitize-error';

const log = createLogger('API:TeachingToClassroom');

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing jobId');
    }

    const job = await readTeachingJob(jobId);
    if (!job) {
      return apiError('NOT_FOUND', 404, '教案不存在');
    }

    // Auth check happens after quota so unauthorized users never consume quota.
    const quota = await requireQuota('generationCount');
    if ('error' in quota) return quota.error;

    if (job.userId !== quota.userId) {
      return apiError('UNAUTHORIZED', 403, '无权访问此教案');
    }

    if (job.status !== 'succeeded') {
      return apiError('INVALID_REQUEST', 409, '教案尚未生成完成，无法转换');
    }

    // Idempotent replay: if this teaching job was already converted and the
    // resulting classroom still exists, reuse it without generating a new stage
    // or persisting a duplicate classroom.
    if (job.classroomStageId) {
      const existing = await readClassroom(job.classroomStageId);
      if (existing) {
        log.info(
          `Teaching job ${jobId} already converted to classroom ${job.classroomStageId}; replaying`,
        );
        return apiSuccess(
          {
            data: {
              stageId: job.classroomStageId,
              sceneCount: existing.scenes?.length ?? 0,
              redirectUrl: `/classroom/${job.classroomStageId}`,
            },
          },
          200,
        );
      }
      log.warn(
        `Teaching job ${jobId} references classroom ${job.classroomStageId} but it is missing; regenerating`,
      );
    }

    // Convert teaching job to classroom stage
    const { stage, scenes } = await convertTeachingJobToStage(job);

    // Persist the classroom
    const baseUrl = req.headers.get('origin') || req.nextUrl.origin || 'http://localhost:3000';
    await persistClassroom({ id: stage.id, stage, scenes }, baseUrl);

    // Record the conversion for idempotent replays. If this update fails, the
    // conversion itself still succeeded, so the failure is non-fatal.
    try {
      await updateTeachingJob(jobId, { classroomStageId: stage.id });
    } catch (err) {
      log.warn(`Teaching job ${jobId} converted but failed to persist marker:`, err);
    }

    log.info(
      `Teaching job ${jobId} converted to classroom ${stage.id} with ${scenes.length} scenes`,
    );

    return apiSuccess(
      {
        data: {
          stageId: stage.id,
          sceneCount: scenes.length,
          redirectUrl: `/classroom/${stage.id}`,
        },
      },
      201,
    );
  } catch (err) {
    log.error('Teaching to classroom conversion failed:', err);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to convert teaching job to classroom',
      safeErrorMessage(err),
    );
  }
}
