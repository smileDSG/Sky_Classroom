/**
 * GET /api/sky/enrichment/status
 *
 * Returns the current enrichment status: running job, last completed job, total stored count.
 */

import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/server/api-response';
import { getEnrichmentStatus } from '@/lib/solve/enrichment/enrichment-pipeline';

export async function GET(_req: NextRequest) {
  const status = getEnrichmentStatus();
  return apiSuccess(status);
}
