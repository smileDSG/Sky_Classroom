/**
 * Health check endpoint
 *
 * GET /api/health
 * Returns server status, version, provider capabilities, and optionally
 * detailed provider health when ?detailed=true is passed.
 */
import { apiSuccess } from '@/lib/server/api-response';
import {
  getServerWebSearchProviders,
  getServerImageProviders,
  getServerVideoProviders,
  getServerTTSProviders,
  getServerProviders,
} from '@/lib/server/provider-config';
import { validateEnvironment } from '@/lib/monitoring/env-validator';
import { getPerfMonitor } from '@/lib/monitoring/performance';
import { getErrorTracker } from '@/lib/monitoring/error-tracker';
import { getQuickHealth, checkProviderHealth } from '@/lib/monitoring/health-check';

const version = process.env.npm_package_version || '0.2.1';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const detailed = url.searchParams.get('detailed') === 'true';

  // Base response
  const providers = getServerProviders();
  const response: Record<string, unknown> = {
    status: 'ok',
    version,
    capabilities: {
      llm: Object.keys(providers).length,
      webSearch: Object.keys(getServerWebSearchProviders()).length > 0,
      imageGeneration: Object.keys(getServerImageProviders()).length > 0,
      videoGeneration: Object.keys(getServerVideoProviders()).length > 0,
      tts: Object.keys(getServerTTSProviders()).length > 0,
    },
  };

  if (detailed) {
    // Environment validation
    response.env = validateEnvironment();

    // Performance snapshot
    response.performance = getPerfMonitor().export();

    // Error snapshot
    response.errors = getErrorTracker().export();

    // Provider health (async probe, may add latency)
    try {
      response.providerHealth = await checkProviderHealth();
    } catch {
      response.providerHealth = getQuickHealth();
    }
  }

  return apiSuccess(response);
}
