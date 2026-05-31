/**
 * POST /api/sky/enrichment/run
 *
 * Trigger a manual enrichment run. Supports:
 * - Full run (all subjects): POST {}
 * - Targeted run: POST { subjects: ["math"], gradeLevels: ["senior"] }
 *
 * Only one enrichment run can be active at a time.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { runEnrichment, getEnrichmentStatus } from '@/lib/solve/enrichment/enrichment-pipeline';
import { isSearchConfigured } from '@/lib/solve/enrichment/web-search';
import type { SubjectId, GradeLevel } from '@/lib/solve/enrichment/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:EnrichmentRun');

interface RunRequest {
  subjects?: SubjectId[];
  gradeLevels?: GradeLevel[];
  maxQuestions?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as RunRequest;

    // Validate subjects if provided
    const VALID_SUBJECTS = new Set<SubjectId>([
      'math', 'physics', 'chemistry', 'chinese', 'english',
      'biology', 'history', 'geography', 'politics',
    ]);
    const VALID_GRADES = new Set<GradeLevel>(['junior', 'senior', 'college']);

    if (body.subjects) {
      for (const s of body.subjects) {
        if (!VALID_SUBJECTS.has(s)) {
          return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, `Invalid subject: ${s}`);
        }
      }
    }

    if (body.gradeLevels) {
      for (const g of body.gradeLevels) {
        if (!VALID_GRADES.has(g)) {
          return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, `Invalid grade level: ${g}`);
        }
      }
    }

    // Check if already running
    const status = getEnrichmentStatus();
    if (status.isRunning) {
      return apiSuccess({
        message: 'Enrichment already running',
        job: status.currentJob,
      });
    }

    // Check Bing API configuration
    if (!isSearchConfigured()) {
      log.warn('[Enrichment] No search API configured — enrichment will have empty search results');
    }

    // Launch enrichment (runs in background, client polls /status)
    // Self-hosted Next.js keeps the process alive after response
    runEnrichment({
      subjects: body.subjects,
      gradeLevels: body.gradeLevels ?? ['senior', 'college'],
      maxQuestions: body.maxQuestions,
    }).then((job) => {
      log.info(`[Enrichment] Job ${job.id} finished: ${job.stats.totalStored} stored`);
    }).catch((err) => {
      log.error(`[Enrichment] Job failed:`, err);
    });

    // Return immediately — job runs in background
    return apiSuccess({
      message: 'Enrichment started',
      pollEndpoint: '/api/sky/enrichment/status',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('[Enrichment] Run error:', msg);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '启动扩充失败');
  }
}
