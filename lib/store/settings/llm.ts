/**
 * LLM Settings Slice
 *
 * Provider configuration, model selection, and thinking configuration.
 * Composed by the barrel store into a single Zustand store.
 */

import type { ProviderId } from '@/lib/ai/providers';
import type { ProvidersConfig } from '@/lib/types/settings';
import { PROVIDERS } from '@/lib/ai/providers';
import type { ThinkingConfig } from '@/lib/types/provider';
import { getThinkingConfigKey, supportsConfigurableThinking } from '@/lib/ai/thinking-config';

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

export interface LLMSettingsSlice {
  providerId: ProviderId;
  modelId: string;
  thinkingConfigs: Record<string, ThinkingConfig>;
  providersConfig: ProvidersConfig;

  // Actions
  setModel: (providerId: ProviderId, modelId: string) => void;
  setThinkingConfig: (
    providerId: ProviderId,
    modelId: string,
    config: ThinkingConfig | undefined,
  ) => void;
  setProviderConfig: (
    providerId: ProviderId,
    config: Partial<ProvidersConfig[ProviderId]>,
  ) => void;
  setProvidersConfig: (config: ProvidersConfig) => void;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Remove thinking config entries for models that no longer exist or no
 * longer support configurable thinking.
 */
export function pruneThinkingConfigs(
  thinkingConfigs: Record<string, ThinkingConfig> | undefined,
  providersConfig: ProvidersConfig | undefined,
): Record<string, ThinkingConfig> {
  if (!thinkingConfigs || !providersConfig) return {};

  const validKeys = new Set<string>();
  for (const [providerId, providerConfig] of Object.entries(providersConfig)) {
    for (const model of providerConfig.models) {
      if (supportsConfigurableThinking(model.capabilities?.thinking)) {
        validKeys.add(getThinkingConfigKey(providerId, model.id));
      }
    }
  }

  return Object.fromEntries(
    Object.entries(thinkingConfigs).filter(([key]) => validKeys.has(key)),
  ) as Record<string, ThinkingConfig>;
}

/**
 * Build the default providersConfig from the PROVIDERS registry.
 */
export function getDefaultProvidersConfig(): ProvidersConfig {
  const config: ProvidersConfig = {} as ProvidersConfig;
  Object.keys(PROVIDERS).forEach((pid) => {
    const provider = PROVIDERS[pid as ProviderId];
    config[pid as ProviderId] = {
      apiKey: '',
      baseUrl: '',
      models: provider.models,
      name: provider.name,
      type: provider.type,
      defaultBaseUrl: provider.defaultBaseUrl,
      icon: provider.icon,
      requiresApiKey: provider.requiresApiKey,
      isBuiltIn: true,
    };
  });
  return config;
}

/**
 * Ensure providersConfig includes all built-in providers and their latest
 * models. Called on every rehydrate so new providers added in code are
 * always picked up without clearing cache.
 */
export function ensureBuiltInProviders(state: Partial<LLMSettingsSlice>): void {
  if (!state.providersConfig) return;
  const defaultConfig = getDefaultProvidersConfig();
  Object.keys(PROVIDERS).forEach((pid) => {
    const providerId = pid as ProviderId;
    if (!state.providersConfig![providerId]) {
      // New provider: add with defaults
      state.providersConfig![providerId] = defaultConfig[providerId];
    } else {
      // Existing provider: refresh built-in models from the registry and
      // keep user-added models after the built-in list.
      const provider = PROVIDERS[providerId];
      const existing = state.providersConfig![providerId];

      const builtInModelIds = new Set(provider.models.map((m) => m.id));
      const customModels = (existing.models || []).filter((m) => !builtInModelIds.has(m.id));
      const mergedModels = [...provider.models, ...customModels];

      state.providersConfig![providerId] = {
        ...existing,
        models: mergedModels,
        name: existing.name || provider.name,
        type: existing.type || provider.type,
        defaultBaseUrl: existing.defaultBaseUrl || provider.defaultBaseUrl,
        icon: provider.icon || existing.icon,
        requiresApiKey: existing.requiresApiKey ?? provider.requiresApiKey,
        isBuiltIn: existing.isBuiltIn ?? true,
      };
    }
  });
}

/**
 * Custom providers created before #414 stored their actual endpoint in
 * defaultBaseUrl while leaving baseUrl empty. Promote that persisted value
 * during rehydrate so downstream request builders keep using baseUrl only.
 */
export function promoteLegacyCustomProviderBaseUrls(state: Partial<LLMSettingsSlice>): void {
  if (!state.providersConfig) return;

  Object.values(state.providersConfig).forEach((config) => {
    if (!config.isBuiltIn && !config.baseUrl && config.defaultBaseUrl) {
      config.baseUrl = config.defaultBaseUrl;
    }
  });
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export function getDefaultLLMSettings(): Omit<
  LLMSettingsSlice,
  'setModel' | 'setThinkingConfig' | 'setProviderConfig' | 'setProvidersConfig'
> {
  return {
    providerId: 'openai' as ProviderId,
    modelId: '',
    thinkingConfigs: {} as Record<string, ThinkingConfig>,
    providersConfig: getDefaultProvidersConfig(),
  };
}

// ---------------------------------------------------------------------------
// Action creators
// ---------------------------------------------------------------------------

export function createLLMSetters(
  set: (
    partial:
      | Partial<LLMSettingsSlice>
      | ((state: LLMSettingsSlice) => Partial<LLMSettingsSlice>),
  ) => void,
  _get: () => LLMSettingsSlice,
): Pick<
  LLMSettingsSlice,
  'setModel' | 'setThinkingConfig' | 'setProviderConfig' | 'setProvidersConfig'
> {
  return {
    setModel: (providerId, modelId) => set({ providerId, modelId }),

    setThinkingConfig: (providerId, modelId, config) =>
      set((state) => {
        const key = getThinkingConfigKey(providerId, modelId);
        const next = { ...state.thinkingConfigs };
        if (config) {
          next[key] = config;
        } else {
          delete next[key];
        }
        return { thinkingConfigs: next };
      }),

    setProviderConfig: (providerId, config) =>
      set((state) => {
        const providersConfig = {
          ...state.providersConfig,
          [providerId]: {
            ...state.providersConfig[providerId],
            ...config,
          },
        };
        return {
          providersConfig,
          thinkingConfigs: pruneThinkingConfigs(state.thinkingConfigs, providersConfig),
        };
      }),

    setProvidersConfig: (config) =>
      set((state) => ({
        providersConfig: config,
        thinkingConfigs: pruneThinkingConfigs(state.thinkingConfigs, config),
      })),
  };
}
