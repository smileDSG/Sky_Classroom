/**
 * Automatic Failover — Provider Failover Mechanism
 *
 * When a provider becomes unavailable (rate limit, outage, etc.),
 * automatically fall back to a pre-configured alternate provider.
 *
 * Usage:
 *   // Set up failover mapping
 *   registerFailover('openai', { fallbackProvider: 'anthropic', modelMap: { 'gpt-4o': 'claude-sonnet-4-6' } });
 *
 *   // On failure, get fallback config
 *   const fallback = getFailoverConfig('openai', { providerId: 'openai', modelId: 'gpt-4o', ... });
 */

import type { ProviderId, ModelConfig } from '@/lib/types/provider';
import { createLogger } from '@/lib/logger';

const log = createLogger('Failover');

export interface FailoverTarget {
  /** Provider to fall back to */
  fallbackProvider: ProviderId;
  /** Optional model ID mapping (source model → fallback model) */
  modelMap?: Record<string, string>;
  /** Fallback API key (if different from the original) */
  fallbackApiKey?: string;
  /** Fallback base URL (if different from the target provider's default) */
  fallbackBaseUrl?: string;
}

interface FailoverState {
  mapping: Map<ProviderId, FailoverTarget>;
  /** Count of consecutive failures per provider */
  failureCounts: Map<ProviderId, number>;
  /** Timestamp of last failure per provider */
  lastFailure: Map<ProviderId, number>;
  /** Providers that are currently in "cooldown" after too many failures */
  cooldownUntil: Map<ProviderId, number>;
}

const state: FailoverState = {
  mapping: new Map(),
  failureCounts: new Map(),
  lastFailure: new Map(),
  cooldownUntil: new Map(),
};

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const MAX_FAILURES_BEFORE_COOLDOWN = 3;

/**
 * Register a failover target for a provider.
 */
export function registerFailover(providerId: ProviderId, target: FailoverTarget): void {
  state.mapping.set(providerId, target);
  log.info(`Failover registered: ${providerId} → ${target.fallbackProvider}`);
}

/**
 * Unregister a failover mapping.
 */
export function unregisterFailover(providerId: ProviderId): void {
  state.mapping.delete(providerId);
}

/**
 * Get the failover target for a provider.
 */
export function getFailoverTarget(providerId: ProviderId): FailoverTarget | undefined {
  return state.mapping.get(providerId);
}

/**
 * Get a fallback ModelConfig when the primary provider fails.
 * Returns null if no failover is configured or the provider is in cooldown.
 */
export function getFailoverConfig(
  providerId: ProviderId,
  originalConfig: ModelConfig,
): ModelConfig | null {
  const target = state.mapping.get(providerId);
  if (!target) {
    log.debug(`No failover configured for ${providerId}`);
    return null;
  }

  if (isInCooldown(providerId)) {
    log.warn(`Provider ${providerId} is in cooldown, skipping failover`);
    return null;
  }

  const fallbackModelId = target.modelMap?.[originalConfig.modelId] ?? originalConfig.modelId;

  return {
    providerId: target.fallbackProvider,
    modelId: fallbackModelId,
    apiKey: target.fallbackApiKey ?? originalConfig.apiKey,
    baseUrl: target.fallbackBaseUrl ?? originalConfig.baseUrl,
    proxy: originalConfig.proxy,
    providerType: originalConfig.providerType,
  };
}

/**
 * Record a failure for a provider. If failures exceed the threshold,
 * the provider enters cooldown.
 */
export function recordFailure(providerId: ProviderId): void {
  const count = (state.failureCounts.get(providerId) ?? 0) + 1;
  state.failureCounts.set(providerId, count);
  state.lastFailure.set(providerId, Date.now());

  if (count >= MAX_FAILURES_BEFORE_COOLDOWN) {
    state.cooldownUntil.set(providerId, Date.now() + DEFAULT_COOLDOWN_MS);
    log.warn(`Provider ${providerId} entered cooldown after ${count} failures`);
  }
}

/**
 * Record a success for a provider. Resets failure count.
 */
export function recordSuccess(providerId: ProviderId): void {
  state.failureCounts.set(providerId, 0);
  state.cooldownUntil.delete(providerId);
}

/**
 * Check if a provider is in cooldown.
 */
function isInCooldown(providerId: ProviderId): boolean {
  const until = state.cooldownUntil.get(providerId);
  if (!until) return false;
  if (Date.now() > until) {
    state.cooldownUntil.delete(providerId);
    state.failureCounts.set(providerId, 0);
    return false;
  }
  return true;
}

/**
 * Reset failover state for a provider.
 */
export function resetFailoverState(providerId: ProviderId): void {
  state.failureCounts.delete(providerId);
  state.lastFailure.delete(providerId);
  state.cooldownUntil.delete(providerId);
}

/**
 * Clear all failover state and mappings.
 */
export function clearFailoverState(): void {
  state.mapping.clear();
  state.failureCounts.clear();
  state.lastFailure.clear();
  state.cooldownUntil.clear();
}

/**
 * Get failover statistics.
 */
export function getFailoverStats(): {
  registeredMappings: number;
  providersInCooldown: ProviderId[];
  failureCounts: Record<ProviderId, number>;
} {
  const failureCounts: Record<string, number> = {};
  for (const [id, count] of state.failureCounts) {
    failureCounts[id] = count;
  }

  return {
    registeredMappings: state.mapping.size,
    providersInCooldown: [...state.cooldownUntil.keys()].filter((id) => isInCooldown(id)),
    failureCounts: failureCounts as Record<ProviderId, number>,
  };
}
