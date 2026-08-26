import { after, type NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { type GenerateClassroomInput } from '@/lib/server/classroom-generation';
import { runClassroomGenerationJob } from '@/lib/server/classroom-job-runner';
import { createClassroomGenerationJobHybrid } from '@/lib/server/classroom-job-store-hybrid';
import { buildRequestOrigin } from '@/lib/server/classroom-storage';
import { createLogger } from '@/lib/logger';
import { requireQuota, recordUsage } from '@/lib/server/billing/require-quota';

const log = createLogger('GenerateClassroom API');

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let requirementSnippet: string | undefined;
  try {
    const rawBody = (await req.json()) as Partial<GenerateClassroomInput> & {
      modelString?: string;
      apiKey?: string;
      baseUrl?: string;
    };
    requirementSnippet = rawBody.requirement?.substring(0, 60);
    const body: GenerateClassroomInput = {
      requirement: rawBody.requirement || '',
      ...(rawBody.pdfContent ? { pdfContent: rawBody.pdfContent } : {}),

      ...(rawBody.enableWebSearch != null ? { enableWebSearch: rawBody.enableWebSearch } : {}),
      ...(rawBody.webSearchProviderId ? { webSearchProviderId: rawBody.webSearchProviderId } : {}),
      ...(rawBody.webSearchApiKey ? { webSearchApiKey: rawBody.webSearchApiKey } : {}),
      ...(rawBody.baiduSubSources ? { baiduSubSources: rawBody.baiduSubSources } : {}),
      ...(rawBody.enableImageGeneration != null
        ? { enableImageGeneration: rawBody.enableImageGeneration }
        : {}),
      ...(rawBody.enableVideoGeneration != null
        ? { enableVideoGeneration: rawBody.enableVideoGeneration }
        : {}),
      ...(rawBody.enableTTS != null ? { enableTTS: rawBody.enableTTS } : {}),
      ...(rawBody.agentMode ? { agentMode: rawBody.agentMode } : {}),
    };
    const { requirement } = body;

    if (!requirement) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing required field: requirement');
    }

    // Check billing quota before expensive work
    const quota = await requireQuota('generationCount');
    if ('error' in quota) return quota.error;

    const baseUrl = buildRequestOrigin(req);
    const jobId = nanoid(10);

    // Keep request-scoped credentials in memory only; the job store persists
    // modelString but must not write API keys or private base URLs to disk.
    const runtimeModelConfig = {
      modelString: rawBody.modelString as string | undefined,
      apiKey: rawBody.apiKey as string | undefined,
      baseUrl: rawBody.baseUrl as string | undefined,
    };
    const persistedModelConfig = runtimeModelConfig.modelString
      ? { modelString: runtimeModelConfig.modelString }
      : undefined;

    const job = await createClassroomGenerationJobHybrid(
      jobId,
      body,
      quota.userId,
      persistedModelConfig,
    );
    const pollUrl = `${baseUrl}/api/generate-classroom/${jobId}`;

    // Record generation usage
    await recordUsage(quota.userId, quota.planType, 'generationCount');

    // Start generation immediately. Do not rely solely on after() because
    // Turbopack/dev-mode may drop or delay after() callbacks, leaving the
    // job stuck at 1% indefinitely.
    runClassroomGenerationJob(jobId, body, baseUrl, runtimeModelConfig).catch((err) => {
      log.error(`runClassroomGenerationJob failed for ${jobId}:`, err);
    });

    after(async () => {
      // Best-effort: if the synchronous start above somehow did not claim the
      // runner (e.g. module was still loading), this wakes the job up.
      const { resumeClassroomGenerationJob } = await import('@/lib/server/classroom-job-runner');
      resumeClassroomGenerationJob(jobId, baseUrl).catch(() => {});
    });

    return apiSuccess(
      {
        jobId,
        status: job.status,
        step: job.step,
        message: job.message,
        pollUrl,
        pollIntervalMs: 5000,
      },
      202,
    );
  } catch (error) {
    log.error(
      `Classroom generation job creation failed [requirement="${requirementSnippet ?? 'unknown'}..."]:`,
      error,
    );
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to create classroom generation job',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}
