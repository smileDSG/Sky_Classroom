/**
 * Health Check
 *
 * Verifies provider connectivity by making lightweight probe requests.
 * Results are cached briefly to avoid flooding providers on repeated calls.
 */
import { createLogger } from '@/lib/logger';
import {
  getServerProviders,
  getServerWebSearchProviders,
  getServerImageProviders,
  getServerVideoProviders,
  getServerTTSProviders,
} from '@/lib/server/provider-config';

const log = createLogger('HealthCheck');

// ==================== Types ====================

export type ProviderHealthStatus =
  | 'connected'
  | 'degraded'
  | 'unavailable'
  | 'not_configured';

export interface ProviderHealth {
  type: string;
  provider: string;
  status: ProviderHealthStatus;
  latencyMs?: number;
  error?: string;
}

export interface HealthSnapshot {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  providers: ProviderHealth[];
}

// ==================== Cache ====================

let cachedResult: HealthSnapshot | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

// ==================== Implementation ====================

async function probeEndpoint(
  baseUrl: string,
  timeoutMs = 5000,
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/models`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Math.round(performance.now() - start);

    // 200 or 401 (auth required but reachable) are both OK
    return { ok: response.ok || response.status === 401, latencyMs };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      ok: false,
      latencyMs,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function checkProviderHealth(): Promise<HealthSnapshot> {
  // Return cached result if fresh
  if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL_MS) {
    return cachedResult;
  }

  const providers: ProviderHealth[] = [];

  // Check LLM providers
  const llmProviders = getServerProviders() as Record<string, { baseUrl?: string; models?: string[] }>;
  for (const [id, config] of Object.entries(llmProviders)) {
    if (!config.baseUrl) {
      providers.push({
        type: 'llm',
        provider: id,
        status: 'not_configured',
      });
      continue;
    }

    try {
      const { ok, latencyMs } = await probeEndpoint(config.baseUrl);
      providers.push({
        type: 'llm',
        provider: id,
        status: ok ? 'connected' : 'unavailable',
        latencyMs,
      });
    } catch (err) {
      providers.push({
        type: 'llm',
        provider: id,
        status: 'unavailable',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Check non-LLM providers (lightweight: just report configured status)
  for (const [type, getter] of Object.entries({
    tts: getServerTTSProviders,
    websearch: getServerWebSearchProviders,
    image: getServerImageProviders,
    video: getServerVideoProviders,
  })) {
    const providerMap = getter();
    for (const [id] of Object.entries(providerMap)) {
      providers.push({
        type,
        provider: id,
        status: 'connected', // Non-LLM: assume OK if configured (no probe endpoint)
      });
    }
  }

  const hasUnavailable = providers.some((p) => p.status === 'unavailable');
  const hasDegraded = providers.some((p) => p.status === 'degraded');
  const hasConnected = providers.some((p) => p.status === 'connected');

  const snapshot: HealthSnapshot = {
    status: !hasConnected
      ? 'unhealthy'
      : hasUnavailable
        ? 'degraded'
        : 'healthy',
    timestamp: Date.now(),
    providers,
  };

  cachedResult = snapshot;
  return snapshot;
}

/**
 * Get a lightweight health summary without probing.
 * Suitable for frequent polling (e.g. load balancer health checks).
 */
export function getQuickHealth(): {
  status: 'ok' | 'degraded';
  uptime: number;
  providers: number;
} {
  const llmCount = Object.keys(getServerProviders()).length;
  const ttsCount = Object.keys(getServerTTSProviders()).length;
  const wsCount = Object.keys(getServerWebSearchProviders()).length;

  return {
    status: llmCount > 0 ? 'ok' : 'degraded',
    uptime: Math.round(process.uptime()),
    providers: llmCount + ttsCount + wsCount,
  };
}
