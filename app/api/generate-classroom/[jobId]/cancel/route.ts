import { type NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  isValidClassroomJobId,
  readClassroomGenerationJobHybrid,
  markClassroomGenerationJobCancelledHybrid,
} from '@/lib/server/classroom-job-store-hybrid';
import { createLogger } from '@/lib/logger';
import { requireAuth } from '@/lib/server/auth/helpers';

const log = createLogger('ClassroomCancel API');

export async function POST(req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  let resolvedJobId: string | undefined;
  try {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const { jobId } = await context.params;
    resolvedJobId = jobId;

    if (!isValidClassroomJobId(jobId)) {
      return apiError('INVALID_REQUEST', 400, 'Invalid classroom generation job id');
    }

    const job = await readClassroomGenerationJobHybrid(jobId);
    if (!job) {
      return apiError('INVALID_REQUEST', 404, 'Classroom generation job not found');
    }
    if (job.userId !== auth.user.id) {
      return apiError('UNAUTHORIZED', 403, '无权操作此任务');
    }

    if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') {
      return apiError('INVALID_REQUEST', 409, 'Job is already in a terminal state');
    }

    await markClassroomGenerationJobCancelledHybrid(jobId);

    return apiSuccess({ jobId, status: 'cancelled' });
  } catch (error) {
    log.error(`Classroom job cancel failed [jobId=${resolvedJobId ?? 'unknown'}]:`, error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to cancel classroom generation job',
      error instanceof Error ? error.message : String(error),
    );
  }
}
