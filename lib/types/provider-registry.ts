/**
 * Provider Registry — Runtime Extensible ProviderId System
 *
 * Replaces the hard-coded BuiltInProviderId union type with a
 * runtime registration mechanism. Custom providers can be added
 * dynamically without modifying type definitions.
 *
 * Usage:
 *   registerProvider('custom-mycorp', { ... })
 *   getProviderConfig('custom-mycorp')
 *   listRegisteredProviders()
 */

import type { ProviderConfig, ProviderId, ProviderType } from './provider';

const registry = new Map<string, ProviderConfig>();

/**
 * Register a new provider at runtime.
 * Throws if a provider with the same ID already exists.
 */
export function registerProvider(config: ProviderConfig): void {
  if (registry.has(config.id)) {
    throw new Error(`Provider "${config.id}" is already registered. Unregister first.`);
  }
  registry.set(config.id, config);
}

/**
 * Unregister a provider by ID.
 * Returns true if the provider existed, false otherwise.
 */
export function unregisterProvider(id: ProviderId): boolean {
  return registry.delete(id);
}

/**
 * Get a registered provider configuration by ID.
 */
export function getProviderConfig(id: ProviderId): ProviderConfig | undefined {
  return registry.get(id);
}

/**
 * Check if a provider is registered.
 */
export function isProviderRegistered(id: ProviderId): boolean {
  return registry.has(id);
}

/**
 * List all registered provider IDs.
 */
export function listRegisteredProviderIds(): ProviderId[] {
  return Array.from(registry.keys()) as ProviderId[];
}

/**
 * Get all registered provider configurations.
 */
export function listRegisteredProviders(): ProviderConfig[] {
  return Array.from(registry.values());
}

/**
 * Get providers filtered by type (openai / anthropic / google).
 */
export function listProvidersByType(type: ProviderType): ProviderConfig[] {
  return Array.from(registry.values()).filter((p) => p.type === type);
}

/**
 * Register multiple providers at once.
 * Skips duplicates (does not throw) — useful for bulk initialization.
 */
export function registerProviders(configs: ProviderConfig[]): void {
  for (const config of configs) {
    if (!registry.has(config.id)) {
      registry.set(config.id, config);
    }
  }
}

/**
 * Clear all registered providers.
 * Useful for testing or hot-reload scenarios.
 */
export function clearProviderRegistry(): void {
  registry.clear();
}
