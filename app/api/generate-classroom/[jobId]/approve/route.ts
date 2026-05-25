import { after, type NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  isValidClassroomJobId,
  readClassroomGenerationJob,
} from '@/lib/server/classroom-job-store';
import { runClassroomContinueJob } from '@/lib/server/classroom-job-runner';
import { buildRequestOrigin } from '@/lib/server/classroom-storage';
import { createLogger } from '@/lib/logger';

const log = createLogger('ClassroomApprove API');

export const maxDuration = 30;

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

    if (job.status !== 'awaiting_review') {
      return apiError(
        'INVALID_REQUEST',
        409,
        `Job is in '${job.status}' state, expected 'awaiting_review'`,
      );
    }

    const baseUrl = buildRequestOrigin(req);

    after(() => runClassroomContinueJob(jobId, baseUrl));

    log.info(`Classroom continue job triggered: ${jobId}`);

    return apiSuccess({
      jobId,
      status: 'running',
      step: 'generating_scenes',
      message: '大纲已审阅，继续生成',
    }, 202);
  } catch (error) {
    log.error(`Classroom approve failed [jobId=${resolvedJobId ?? 'unknown'}]:`, error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to approve classroom outline',
      error instanceof Error ? error.message : String(error),
    );
  }
}
