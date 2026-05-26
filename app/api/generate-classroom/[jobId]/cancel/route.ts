import { type NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  isValidClassroomJobId,
  readClassroomGenerationJob,
  markClassroomGenerationJobCancelled,
} from '@/lib/server/classroom-job-store';
import { createLogger } from '@/lib/logger';

const log = createLogger('ClassroomCancel API');

export async function POST(req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  let resolvedJobId: string | undefined;
  try {
    const { jobId } = await context.params;
    resolvedJobId = jobId;

    if (!isValidClassroomJobId(jobId)) {
      return apiError('INVALID_REQUEST', 400, 'Invalid classroom generation job id');
    }

    const job = await readClassroomGenerationJob(jobId);
    if (!job) {
      return apiError('INVALID_REQUEST', 404, 'Classroom generation job not found');
    }

    if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') {
      return apiError('INVALID_REQUEST', 409, 'Job is already in a terminal state');
    }

    await markClassroomGenerationJobCancelled(jobId);

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
