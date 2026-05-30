/**
 * POST /api/sky/slides/generate
 *
 * Phase 2: Accepts designDNA and kicks off the full PPT generation pipeline.
 * Returns 202 with jobId + pollUrl. Client polls GET /status for progress.
 *
 * Uses after() for reliable background execution (same pattern as classroom generation).
 */
import { after, type NextRequest } from 'next/server';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';
import { nanoid } from 'nanoid';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createSlidesJobHybrid } from '@/lib/slides/agent/slides-job-store-hybrid';
import { runSlidesGenerationJob } from '@/lib/slides/agent/slides-job-runner';
import { buildRequestOrigin } from '@/lib/server/classroom-storage';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:Generate');

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, difficulty, designDNA, minPages, maxPages, modelString, apiKey, baseUrl } = body as {
      topic?: string;
      difficulty?: string;
      designDNA?: unknown;
      minPages?: number;
      maxPages?: number;
      modelString?: string;
      apiKey?: string;
      baseUrl?: string;
    };

    if (!topic?.trim()) return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing topic');
    if (!designDNA) return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing designDNA');

    const diff = difficulty || '高中';
    const minP = minPages || 15;
    const maxP = maxPages || 25;

    const { model: languageModel, modelString: resolvedModelString } = await resolveModelFromRequest(req, body);
    log.info(`Starting pipeline for "${topic}" [${diff}, ${minP}-${maxP}p, model=${resolvedModelString}]`);

    const jobId = nanoid(12);
    const origin = buildRequestOrigin(req);
    const pollUrl = `${origin}/api/sky/slides/generate/status?jobId=${jobId}`;

    // Extract designDNA styleName for job summary
    const styleName = (designDNA as { styleName?: string })?.styleName || '未知风格';

    // Create job in hybrid store (persisted to disk)
    const modelConfig = {
      modelString: modelString as string | undefined,
      apiKey: apiKey as string | undefined,
      baseUrl: baseUrl as string | undefined,
    };
    await createSlidesJobHybrid(jobId, {
      topic: topic.trim(),
      difficulty: diff,
      styleName,
      minPages: minP,
      maxPages: maxP,
    }, modelConfig);

    // Use after() for reliable background execution
    after(() =>
      runSlidesGenerationJob(jobId, {
        topic: topic.trim(),
        difficulty: diff,
        minPages: minP,
        maxPages: maxP,
        designDNA: designDNA as never,
        languageModel,
      }, modelConfig)
    );

    return apiSuccess({
      jobId,
      status: 'queued',
      pollUrl,
      pollIntervalMs: 5000,
    }, 202);
  } catch (err) {
    log.error('Generate failed:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '课件生成失败');
  }
}
