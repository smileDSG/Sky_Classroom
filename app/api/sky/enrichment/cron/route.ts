/**
 * GET /api/sky/enrichment/cron
 *
 * Vercel Cron endpoint — called on a schedule to run incremental enrichment.
 * Phase 2: configure vercel.json cron to hit this endpoint weekly.
 *
 * For now, returns a lightweight response. The actual cron schedule will be:
 *   0 3 * * 0  (Sunday 3am) — weekly enrichment run
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { runEnrichment, getEnrichmentStatus } from '@/lib/solve/enrichment/enrichment-pipeline';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:EnrichmentCron');

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return apiError(API_ERROR_CODES.UNAUTHORIZED, 401, 'Unauthorized');
    }

    const status = getEnrichmentStatus();
    if (status.isRunning) {
      log.info('[Cron] Enrichment already running, skipping');
      return apiSuccess({ message: 'Already running', job: status.currentJob });
    }

    // Run enrichment in background with limited scope for cron
    runEnrichment({
      gradeLevels: ['senior', 'college'],
      maxQuestions: 50, // Smaller batch for cron runs
    }).then((job) => {
      log.info(`[Cron] Job ${job.id} finished: ${job.stats.totalStored} stored`);
    }).catch((err) => {
      log.error(`[Cron] Job failed:`, err);
    });

    return apiSuccess({ message: 'Cron enrichment started' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('[Cron] Error:', msg);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '定时扩充失败');
  }
}
