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
import { isGenerationQueueFull } from '@/lib/server/generation-gate';
import { validateDesignDNA } from '@/lib/slides/agent/design-dna';
import { createLogger } from '@/lib/logger';
import { verifyAccessToken } from '@/lib/server/auth/jwt';
import { rateLimiters, rateLimitResponse, getClientIp } from '@/lib/api/middleware/rate-limiter';
import { resolveLearnerDecisionForUser } from '@/lib/server/teaching-personalization';
import { buildSlidesAdaptivePolicyFromDecision } from '@/lib/slides/personalization';
import { requireQuota, recordUsage } from '@/lib/server/billing/require-quota';

const log = createLogger('API:Generate');

export async function POST(req: NextRequest) {
  try {
    // ── Auth check ──
    const accessToken = req.cookies.get('access_token');
    if (!accessToken) {
      return apiError(API_ERROR_CODES.UNAUTHORIZED, 401, 'Authentication required');
    }
    const payload = await verifyAccessToken(accessToken.value);
    if (!payload) {
      return apiError(API_ERROR_CODES.UNAUTHORIZED, 401, 'Invalid or expired token');
    }

    const quota = await requireQuota('generationCount');
    if ('error' in quota) return quota.error;

    // ── Rate limit ──
    const clientIp = getClientIp(req);
    const rateLimitResult = rateLimiters.generate.consume(clientIp);
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult);
    }

    // ── Concurrency gate ──
    // Excess generations are queued FIFO inside runPipeline (see
    // generation-gate.ts); we only reject when the wait-list is already full.
    if (isGenerationQueueFull()) {
      return apiError(API_ERROR_CODES.RATE_LIMITED, 429, '服务器繁忙，请稍后再试');
    }

    const body = await req.json();
    const { topic, difficulty, designDNA, minPages, maxPages } = body as {
      topic?: string;
      difficulty?: string;
      designDNA?: unknown;
      minPages?: number;
      maxPages?: number;
    };

    if (!topic?.trim())
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing topic');
    if (topic.trim().length > 100)
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Topic too long (max 100 characters)');
    if (!designDNA)
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing designDNA');

    const dnaValidation = validateDesignDNA(designDNA);
    if (!dnaValidation.valid) {
      return apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        400,
        `Invalid designDNA: ${dnaValidation.warnings.join('; ')}`,
      );
    }
    const validatedDNA = dnaValidation.designDNA;

    const diff = difficulty || '高中';
    const learnerDecision = await resolveLearnerDecisionForUser(payload.sub, topic.trim());
    const personalization = buildSlidesAdaptivePolicyFromDecision(learnerDecision);
    const requestedMinPages = Number(minPages);
    const requestedMaxPages = Number(maxPages);
    const minP = Math.max(
      1,
      Math.min(
        60,
        Number.isFinite(requestedMinPages) && requestedMinPages > 0
          ? requestedMinPages
          : (personalization?.minPages ?? 15),
      ),
    );
    const maxP = Math.max(
      1,
      Math.min(
        60,
        Number.isFinite(requestedMaxPages) && requestedMaxPages > 0
          ? requestedMaxPages
          : (personalization?.maxPages ?? 25),
      ),
    );
    if (minP > maxP) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'minPages cannot exceed maxPages');
    }

    const { model: languageModel, modelString } = await resolveModelFromRequest(req, body);
    log.info(`Starting pipeline for "${topic}" [${diff}, ${minP}-${maxP}p, model=${modelString}]`);

    const jobId = nanoid(12);
    createJob(jobId, undefined, payload.sub);
    await recordUsage(quota.userId, quota.planType, 'generationCount');

    // Fire and forget — pipeline runs async, client polls status
    runPipeline({
      topic: topic.trim(),
      difficulty: diff,
      minPages: minP,
      maxPages: maxP,
      designDNA: validatedDNA,
      languageModel,
      jobId,
      personalization: personalization ?? undefined,
    }).catch((err) => {
      log.error(`Pipeline ${jobId} crashed:`, err);
      updateJob(jobId, { stage: 'done', error: String(err) });
    });

    return apiSuccess(
      {
        jobId,
        status: 'planning',
        personalization: personalization
          ? {
              action: personalization.action,
              difficulty: personalization.difficulty,
              format: personalization.format,
              pacing: personalization.pacing,
              durationMinutes: personalization.durationMinutes,
              minPages: personalization.minPages,
              maxPages: personalization.maxPages,
              summary: personalization.summary,
            }
          : null,
      },
      202,
    );
  } catch (err) {
    log.error('Generate failed:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '课件生成失败');
  }
}
