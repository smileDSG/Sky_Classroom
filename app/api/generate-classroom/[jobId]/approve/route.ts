import { type NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  isValidClassroomJobId,
  markClassroomGenerationJobResumedHybrid,
  readClassroomGenerationJobHybrid,
  updateClassroomGenerationJobHybrid,
} from '@/lib/server/classroom-job-store-hybrid';
import { runClassroomContinueJob } from '@/lib/server/classroom-job-runner';
import { buildRequestOrigin } from '@/lib/server/classroom-storage';
import { createLogger } from '@/lib/logger';
import type { SceneOutline } from '@/lib/types/generation';

const log = createLogger('ClassroomApprove API');

export const maxDuration = 30;

type RuntimeModelConfig = {
  modelString?: string;
  apiKey?: string;
  baseUrl?: string;
};

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function buildRuntimeModelConfig(body: Record<string, unknown>): RuntimeModelConfig | undefined {
  const runtimeModelConfig = {
    modelString: readOptionalString(body.modelString),
    apiKey: readOptionalString(body.apiKey),
    baseUrl: readOptionalString(body.baseUrl),
  };
  return runtimeModelConfig.modelString || runtimeModelConfig.apiKey || runtimeModelConfig.baseUrl
    ? runtimeModelConfig
    : undefined;
}

export async function POST(req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  let resolvedJobId: string | undefined;
  try {
    const { jobId } = await context.params;
    resolvedJobId = jobId;

    if (!isValidClassroomJobId(jobId)) {
      return apiError('INVALID_REQUEST', 400, 'Invalid classroom generation job id');
    }

    const job = await readClassroomGenerationJobHybrid(jobId);
    if (!job) {
      return apiError('INVALID_REQUEST', 404, 'Classroom generation job not found');
    }

    if (job.status === 'running' && job.step === 'generating_scenes') {
      return apiSuccess(
        {
          jobId,
          status: 'running',
          step: 'generating_scenes',
          message: 'Outline already approved, generation is continuing',
        },
        202,
      );
    }

    if (job.status === 'succeeded' && job.result) {
      return apiSuccess(
        {
          jobId,
          status: 'succeeded',
          step: 'completed',
          result: job.result,
          message: 'Classroom generation already completed',
        },
        200,
      );
    }

    if (job.status !== 'awaiting_review') {
      return apiError(
        'INVALID_REQUEST',
        409,
        `Job is in '${job.status}' state, expected 'awaiting_review'`,
      );
    }

    // Accept user-edited outlines from request body
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.outlines && Array.isArray(body.outlines) && body.outlines.length > 0) {
      const userOutlines = body.outlines as SceneOutline[];
      if (job.phaseOneResult) {
        await updateClassroomGenerationJobHybrid(jobId, {
          phaseOneResult: { ...job.phaseOneResult, outlines: userOutlines },
          outlines: userOutlines,
          outlinesMeta: job.outlinesMeta
            ? { ...job.outlinesMeta, totalScenes: userOutlines.length }
            : undefined,
        });
      }
      log.info(`Applied user-edited outlines (${userOutlines.length} scenes) for job ${jobId}`);
    }

    const baseUrl = buildRequestOrigin(req);

    await markClassroomGenerationJobResumedHybrid(jobId);

    // Start immediately; don't rely on after() in dev/Turbopack.
    runClassroomContinueJob(jobId, baseUrl, buildRuntimeModelConfig(body)).catch((err) => {
      log.error(`Classroom continue job failed for ${jobId}:`, err);
    });

    log.info(`Classroom continue job triggered: ${jobId}`);

    return apiSuccess(
      {
        jobId,
        status: 'running',
        step: 'generating_scenes',
        message: '大纲已审阅，继续生成',
      },
      202,
    );
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
