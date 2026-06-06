/**
 * POST /api/sky/slides/generate
 *
 * Phase 2: Accepts designDNA and kicks off the full PPT generation pipeline.
 * Returns 202 with jobId. Client polls GET /status for progress.
 */
import { NextRequest } from 'next/server';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';
import { nanoid } from 'nanoid';

export const maxDuration = 300;
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createJob, runPipeline, updateJob } from '@/lib/slides/agent/pipeline';
import { validateDesignDNA } from '@/lib/slides/agent/design-dna';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:Generate');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, difficulty, designDNA, minPages, maxPages } = body as {
      topic?: string;
      difficulty?: string;
      designDNA?: unknown;
      minPages?: number;
      maxPages?: number;
    };

    if (!topic?.trim()) return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing topic');
    if (topic.trim().length > 100) return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Topic too long (max 100 characters)');
    if (!designDNA) return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing designDNA');

    const dnaValidation = validateDesignDNA(designDNA);
    if (!dnaValidation.valid) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, `Invalid designDNA: ${dnaValidation.warnings.join('; ')}`);
    }
    const validatedDNA = dnaValidation.designDNA;

    const diff = difficulty || '高中';
    const minP = Math.max(1, Math.min(60, Number(minPages) || 15));
    const maxP = Math.max(1, Math.min(60, Number(maxPages) || 25));
    if (minP > maxP) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'minPages cannot exceed maxPages');
    }

    const { model: languageModel, modelString } = await resolveModelFromRequest(req, body);
    log.info(`Starting pipeline for "${topic}" [${diff}, ${minP}-${maxP}p, model=${modelString}]`);

    const jobId = nanoid(12);
    createJob(jobId);

    // Fire and forget — pipeline runs async, client polls status
    runPipeline({
      topic: topic.trim(),
      difficulty: diff,
      minPages: minP,
      maxPages: maxP,
      designDNA: validatedDNA,
      languageModel,
      jobId,
    }).catch((err) => {
      log.error(`Pipeline ${jobId} crashed:`, err);
      updateJob(jobId, { stage: 'done', error: String(err) });
    });

    return apiSuccess({ jobId, status: 'planning' }, 202);
  } catch (err) {
    log.error('Generate failed:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '课件生成失败');
  }
}
