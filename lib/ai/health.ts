/**
 * Provider Health Check — Health Dashboard API
 *
 * Tests each registered provider's connectivity and responsiveness
 * by making a lightweight API call. Returns status per provider.
 *
 * Usage:
 *   const results = await checkAllProvidersHealth(modelConfig);
 *   // { openai: { healthy: true, latencyMs: 234 }, anthropic: { healthy: false, error: '...' } }
 */

import type { ProviderId, ModelConfig } from '@/lib/types/provider';
import { PROVIDERS } from './providers';
import { createLogger } from '@/lib/logger';

const log = createLogger('HealthCheck');

export interface ProviderHealthResult {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  status?: number;
}

export type HealthReport = Record<ProviderId, ProviderHealthResult>;

/**
 * Check a single provider's health by making a test API call.
 * Uses a minimal prompt to keep cost low.
 */
export async function checkProviderHealth(
  config: ModelConfig,
  timeoutMs = 10000,
): Promise<ProviderHealthResult> {
  const start = Date.now();

  try {
    const { getModel } = await import('./providers');
    const { generateText } = await import('ai');

    const { model } = getModel(config);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      await generateText({
        model,
        prompt: '.',
        maxOutputTokens: 1,
        abortSignal: controller.signal,
      });

      const latency = Date.now() - start;
      return { healthy: true, latencyMs: latency };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const latency = Date.now() - start;
    const message = error instanceof Error ? error.message : String(error);

    log.warn(`Health check failed for ${config.providerId}: ${message}`);

    return {
      healthy: false,
      latencyMs: latency,
      error: message,
    };
  }
}

/**
 * Check all registered providers' health in parallel.
 * Only checks providers that have a valid API key in the provided config map.
 */
export async function checkAllProvidersHealth(
  configs: Partial<Record<ProviderId, ModelConfig>>,
  timeoutMs = 10000,
): Promise<HealthReport> {
  const entries = Object.entries(configs) as [ProviderId, ModelConfig][];

  const results = await Promise.allSettled(
    entries.map(async ([id, config]) => {
      const result = await checkProviderHealth(config, timeoutMs);
      return [id, result] as [ProviderId, ProviderHealthResult];
    }),
  );

  const report: Partial<HealthReport> = {};
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const [id, health] = result.value;
      report[id] = health;
    }
  }

  return report as HealthReport;
}

/**
 * Get a summary of overall system health.
 */
export function summarizeHealth(report: HealthReport): {
  total: number;
  healthy: number;
  unhealthy: number;
  avgLatencyMs: number;
} {
  const entries = Object.values(report);
  const healthy = entries.filter((r) => r.healthy);
  const latencies = entries.filter((r) => r.latencyMs !== undefined).map((r) => r.latencyMs!);

  return {
    total: entries.length,
    healthy: healthy.length,
    unhealthy: entries.length - healthy.length,
    avgLatencyMs:
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0,
  };
}
