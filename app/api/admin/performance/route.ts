/**
 * GET /api/admin/performance
 * Return aggregated performance data for dashboard.
 */

import { apiError, apiSuccess } from '@/lib/server/api-response';
import { getPerfMonitor } from '@/lib/monitoring/performance';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const range = url.searchParams.get('range') || '24h';

  try {
    // Return health + monitoring data from existing endpoints
    const healthRes = await fetch(new URL('/api/health?detailed=true', request.url).toString());
    const healthData = healthRes.ok ? await healthRes.json() : null;

    return apiSuccess({
      range,
      health: healthData,
      performance: getPerfMonitor().export(),
      timestamp: Date.now(),
    });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, 'Failed to fetch performance data');
  }
}
