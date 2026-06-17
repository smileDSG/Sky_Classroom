/**
 * POST /api/sky/teaching/[jobId]/to-classroom
 *
 * Convert a completed TeachingJob into a Classroom Stage and persist it.
 * Response: { stageId, sceneCount, redirectUrl }
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { readTeachingJob } from '@/lib/server/teaching-job-store';
import { convertTeachingJobToStage } from '@/lib/teaching/to-classroom';
import { persistClassroom } from '@/lib/server/classroom-storage';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:TeachingToClassroom');

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing jobId');
    }

    const job = await readTeachingJob(jobId);
    if (!job) {
      return apiError('NOT_FOUND', 404, '教案不存在');
    }

    if (job.status !== 'succeeded') {
      return apiError('INVALID_REQUEST', 409, '教案尚未生成完成，无法转换');
    }

    // Convert teaching job to classroom stage
    const { stage, scenes } = convertTeachingJobToStage(job);

    // Persist the classroom
    const baseUrl = req.headers.get('origin') || req.nextUrl.origin || 'http://localhost:3000';
    await persistClassroom({ id: stage.id, stage, scenes }, baseUrl);

    log.info(`Teaching job ${jobId} converted to classroom ${stage.id} with ${scenes.length} scenes`);

    return apiSuccess({
      stageId: stage.id,
      sceneCount: scenes.length,
      redirectUrl: `/classroom/${stage.id}`,
    }, 201);
  } catch (err) {
    log.error('Teaching to classroom conversion failed:', err);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to convert teaching job to classroom',
      err instanceof Error ? err.message : 'Unknown error',
    );
  }
}
