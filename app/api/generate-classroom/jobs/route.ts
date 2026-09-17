import { type NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { safeErrorMessage } from '@/lib/server/sanitize-error';
import { listClassroomGenerationJobsHybrid } from '@/lib/server/classroom-job-store-hybrid';
import { buildRequestOrigin } from '@/lib/server/classroom-storage';
import { createLogger } from '@/lib/logger';
import { requireAuth } from '@/lib/server/auth/helpers';

const log = createLogger('ClassroomJobs API');

export const dynamic = 'force-dynamic';

interface JobListItem {
  jobId: string;
  status: string;
  step: string;
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  topic: string;
  hasPdf: boolean;
  scenesGenerated: number;
  totalScenes?: number;
  result?: { classroomId: string; url: string; scenesCount: number };
  error?: string;
}

function toJobListItem(
  job: import('@/lib/server/classroom-job-store').ClassroomGenerationJob,
): JobListItem {
  return {
    jobId: job.id,
    status: job.status,
    step: job.step,
    progress: job.progress,
    message: job.message,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
    topic: job.inputSummary?.requirementPreview ?? '',
    hasPdf: !!job.inputSummary?.hasPdf,
    scenesGenerated: job.scenesGenerated,
    totalScenes: job.totalScenes,
    result: job.result,
    error: job.error,
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const jobs = await listClassroomGenerationJobsHybrid(auth.user.id, { limit: 50 });
    const baseUrl = buildRequestOrigin(req);

    // Lazily wake running/initializing jobs (e.g. after a dev-server restart
    // wiped the in-memory runner map). Non-blocking best effort.
    for (const job of jobs) {
      if (job.status === 'running' || job.status === 'initializing') {
        const { resumeClassroomGenerationJob } = await import('@/lib/server/classroom-job-runner');
        resumeClassroomGenerationJob(job.id, baseUrl).catch(() => {});
      }
    }

    return apiSuccess({ jobs: jobs.map(toJobListItem) });
  } catch (error) {
    log.error('Failed to list classroom generation jobs:', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to list classroom generation jobs',
      safeErrorMessage(error),
    );
  }
}
