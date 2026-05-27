/**
 * Settings store migration.
 *
 * Extracted from the monolithic settings.ts to keep the barrel file lean.
 * Handles localStorage version upgrades, provider validation, and the
 * Zustand persist middleware's migrate / merge callbacks.
 */

import { createLogger } from '@/lib/logger';
import type { ProviderId } from '@/lib/ai/providers';
import {
  ensureBuiltInProviders,
  promoteLegacyCustomProviderBaseUrls,
  pruneThinkingConfigs,
  getDefaultProvidersConfig,
} from './llm';
import type { LLMSettingsSlice } from './llm';
import {
  ensureBuiltInAudioProviders,
  ensureBuiltInWebSearchProviders,
  ensureValidAudioProviders,
  getDefaultAudioConfig,
  getDefaultPDFConfig,
  getDefaultWebSearchConfig,
} from './audio';
import type { AudioSettingsSlice } from './audio';
import {
  ensureBuiltInImageProviders,
  ensureBuiltInVideoProviders,
  getDefaultImageConfig,
  getDefaultVideoConfig,
} from './media';
import type { MediaSliceState } from './media';
import { IMAGE_PROVIDERS } from '@/lib/media/image-providers';
import { VIDEO_PROVIDERS } from '@/lib/media/video-providers';
import { WEB_SEARCH_PROVIDERS } from '@/lib/web-search/constants';
import type { WebSearchProviderId, BaiduSubSources } from '@/lib/web-search/types';
import type { ImageProviderId, VideoProviderId } from '@/lib/media/types';

const log = createLogger('SettingsMigration');

// ---------------------------------------------------------------------------
// Loose state type used inside migration helpers (avoids circular imports
// from the barrel that would pull in the composed SettingsState).
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MigratableState = Partial<LLMSettingsSlice & AudioSettingsSlice & MediaSliceState> & Record<string, any>;

// ---------------------------------------------------------------------------
// ensureValidProviderSelections
// ---------------------------------------------------------------------------

/**
 * Validate all persisted provider IDs against their registries.
 * Reset any stale / removed ID back to its default value.
 * Called during both migrate and merge to cover all rehydration paths.
 */
export function ensureValidProviderSelections(state: MigratableState): void {
  // Delegate audio, PDF, web-search validation
  ensureValidAudioProviders(state as Partial<AudioSettingsSlice>);

  // Validate image provider
  const defaultImageConfig = getDefaultImageConfig();
  if (
    state.imageProviderId &&
    !(state.imageProviderId in IMAGE_PROVIDERS)
  ) {
    state.imageProviderId = defaultImageConfig.imageProviderId;
  }

  // Validate video provider
  const defaultVideoConfig = getDefaultVideoConfig();
  if (
    state.videoProviderId &&
    !(state.videoProviderId in VIDEO_PROVIDERS)
  ) {
    state.videoProviderId = defaultVideoConfig.videoProviderId;
  }
}

// ---------------------------------------------------------------------------
// migrateFromOldStorage
// ---------------------------------------------------------------------------

/**
 * Read old localStorage keys (pre-settings-storage) and return an object
 * that can seed the new store's initial state.
 * Returns null when no legacy data is found OR when the new storage key
 * already exists.
 */
export function migrateFromOldStorage(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;

  // Check if new storage already exists
  const newStorage = localStorage.getItem('settings-storage');
  if (newStorage) return null; // Already migrated or new install

  // Read old localStorage keys
  const oldLlmModel = localStorage.getItem('llmModel');
  const oldProvidersConfig = localStorage.getItem('providersConfig');
  const oldTtsModel = localStorage.getItem('ttsModel');
  const oldSelectedAgents = localStorage.getItem('selectedAgentIds');
  const oldMaxTurns = localStorage.getItem('maxTurns');

  if (!oldLlmModel && !oldProvidersConfig) return null; // No old data

  // Parse model selection
  let providerId: ProviderId = 'openai';
  let modelId = 'gpt-5.4-mini';
  if (oldLlmModel) {
    const [pid, mid] = oldLlmModel.split(':');
    if (pid && mid) {
      providerId = pid as ProviderId;
      modelId = mid;
    }
  }

  // Parse providers config
  let providersConfig = getDefaultProvidersConfig();
  if (oldProvidersConfig) {
    try {
      const parsed = JSON.parse(oldProvidersConfig);
      providersConfig = { ...providersConfig, ...parsed };
    } catch (e) {
      log.error('Failed to parse old providersConfig:', e);
    }
  }

  // Parse other settings
  let ttsModel = 'openai-tts';
  if (oldTtsModel) ttsModel = oldTtsModel;

  let selectedAgentIds: string[] = ['default-1', 'default-2', 'default-3'];
  if (oldSelectedAgents) {
    try {
      const parsed = JSON.parse(oldSelectedAgents);
      if (Array.isArray(parsed) && parsed.length > 0) {
        selectedAgentIds = parsed;
      }
    } catch (e) {
      log.error('Failed to parse old selectedAgentIds:', e);
    }
  }

  let maxTurns = '10';
  if (oldMaxTurns) maxTurns = oldMaxTurns;

  return {
    providerId,
    modelId,
    thinkingConfigs: {},
    providersConfig,
    ttsModel,
    selectedAgentIds,
    maxTurns,
  };
}

// ---------------------------------------------------------------------------
// migrateSettings — Zustand persist.migrate callback
// ---------------------------------------------------------------------------

/**
 * Migrate persisted state between storage versions.
 *
 * Called by zustand/persist every time the stored version is less than the
 * current `version` declared on the persist options.
 */
export function migrateSettings(
  persistedState: unknown,
  version: number,
): MigratableState {
  const state = persistedState as MigratableState;

  // v0 → v1: clear hardcoded default model so user must actively select
  if (version === 0) {
    if (state.providerId === 'openai' && state.modelId === 'gpt-4o-mini') {
      state.modelId = '';
    }
  }

  // v2 → v3: open ChatArea by default (new left-side layout)
  if (version < 3) {
    state.chatAreaCollapsed = false;
  }

  // v3 → v4: rename sidebarCollapsed to timelineCollapsed
  if (version < 4) {
    const legacy = (state as Record<string, unknown>);
    if (typeof legacy.sidebarCollapsed === 'boolean') {
      (state as Record<string, unknown>).timelineCollapsed = legacy.sidebarCollapsed;
      delete legacy.sidebarCollapsed;
    }
  }

  // Ensure providersConfig has all built-in providers (also in merge below)
  ensureBuiltInProviders(state as Partial<LLMSettingsSlice>);
  promoteLegacyCustomProviderBaseUrls(state as Partial<LLMSettingsSlice>);

  // Ensure image/video configs have all built-in providers
  ensureBuiltInImageProviders(state as Partial<MediaSliceState>);
  ensureBuiltInVideoProviders(state as Partial<MediaSliceState>);

  // Migrate from old ttsModel to new ttsProviderId
  if (state.ttsModel && !state.ttsProviderId) {
    // Map old ttsModel values to new ttsProviderId
    if (state.ttsModel === 'openai-tts') {
      state.ttsProviderId = 'openai-tts';
    } else if (state.ttsModel === 'azure-tts') {
      state.ttsProviderId = 'azure-tts';
    } else {
      // Default to OpenAI
      state.ttsProviderId = 'openai-tts';
    }
  }

  // Add default audio config if missing
  if (!state.ttsProvidersConfig || !state.asrProvidersConfig) {
    const defaultAudioConfig = getDefaultAudioConfig();
    Object.assign(state, defaultAudioConfig);
  }
  ensureBuiltInAudioProviders(state as Partial<AudioSettingsSlice>);
  ensureBuiltInWebSearchProviders(state as Partial<AudioSettingsSlice>);

  // Migrate global ttsModelId to per-provider
  if (state.ttsModelId) {
    const pid = state.ttsProviderId;
    if (pid && state.ttsProvidersConfig?.[pid]) {
      state.ttsProvidersConfig[pid].modelId = state.ttsModelId as string;
    }
    delete state.ttsModelId;
  }
  // Same for asrModelId
  if (state.asrModelId) {
    const pid = state.asrProviderId;
    if (pid && state.asrProvidersConfig?.[pid]) {
      state.asrProvidersConfig[pid].modelId = state.asrModelId as string;
    }
    delete state.asrModelId;
  }
  // Migrate MiniMax's model field to modelId
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const [, cfg] of Object.entries(
    (state.ttsProvidersConfig as unknown as Record<string, Record<string, unknown>>) || {},
  )) {
    if (cfg.model && !cfg.modelId) {
      cfg.modelId = cfg.model;
      delete cfg.model;
    }
  }

  // Add default PDF config if missing
  if (!state.pdfProvidersConfig) {
    const defaultPDFConfig = getDefaultPDFConfig();
    Object.assign(state, defaultPDFConfig);
  }

  // Add default Image config if missing
  if (!state.imageProvidersConfig) {
    const defaultImageConfig = getDefaultImageConfig();
    Object.assign(state, defaultImageConfig);
  }

  // Add default Video config if missing
  if (!state.videoProvidersConfig) {
    const defaultVideoConfig = getDefaultVideoConfig();
    Object.assign(state, defaultVideoConfig);
  }

  // v1 → v2: Replace deep research with web search
  if (version < 2) {
    delete state.deepResearchProviderId;
    delete state.deepResearchProvidersConfig;
  }

  // Add default media generation toggles if missing
  if (state.imageGenerationEnabled === undefined) {
    state.imageGenerationEnabled = false;
  }
  if (state.videoGenerationEnabled === undefined) {
    state.videoGenerationEnabled = false;
  }
  if (state.reviewOutlineEnabled === undefined) {
    state.reviewOutlineEnabled = false;
  }

  // Add default audio toggles if missing
  if (state.ttsEnabled === undefined) {
    state.ttsEnabled = true;
  }
  if (state.asrEnabled === undefined) {
    state.asrEnabled = true;
  }

  // Existing users already have their config set up — mark auto-config as done
  if (state.autoConfigApplied === undefined) {
    state.autoConfigApplied = true;
  }

  if (state.agentMode === undefined) {
    state.agentMode = 'preset';
  }
  if (state.autoAgentCount === undefined) {
    state.autoAgentCount = 3;
  }

  if (state.thinkingConfigs === undefined) {
    state.thinkingConfigs = {};
  }

  // Migrate Web Search: old flat fields → new provider-based config
  if (!state.webSearchProvidersConfig) {
    const oldApiKey = (state.webSearchApiKey as string) || '';
    const oldIsServerConfigured =
      (state.webSearchIsServerConfigured as boolean) || false;
    state.webSearchProviderId = 'tavily' as WebSearchProviderId;
    state.webSearchProvidersConfig = {
      tavily: {
        apiKey: oldApiKey,
        baseUrl: '',
        enabled: true,
        requiresApiKey: true,
        isServerConfigured: oldIsServerConfigured,
      },
      bocha: {
        apiKey: '',
        baseUrl: '',
        enabled: true,
        requiresApiKey: true,
      },
      brave: {
        apiKey: '',
        baseUrl: WEB_SEARCH_PROVIDERS.brave.defaultBaseUrl || '',
        enabled: true,
        requiresApiKey: false,
      },
      baidu: {
        apiKey: '',
        baseUrl: '',
        enabled: true,
        requiresApiKey: true,
      },
    } as MigratableState['webSearchProvidersConfig'];
    delete state.webSearchApiKey;
    delete state.webSearchIsServerConfigured;
  }

  ensureValidProviderSelections(state);
  ensureBuiltInAudioProviders(state as Partial<AudioSettingsSlice>);
  ensureBuiltInWebSearchProviders(state as Partial<AudioSettingsSlice>);
  state.thinkingConfigs = pruneThinkingConfigs(
    state.thinkingConfigs,
    state.providersConfig,
  );

  return state;
}

// ---------------------------------------------------------------------------
// mergeSettings — Zustand persist.merge callback
// ---------------------------------------------------------------------------

/**
 * Custom merge: always sync built-in providers on every rehydrate,
 * so newly added providers/models appear without clearing cache.
 *
 * `persistedState` is what was in localStorage.
 * `currentState` is the "initial" state from the store creator (before persist middleware hydrates).
 *
 * Returns the final state that will be used by the store.
 */
export function mergeSettings(
  persistedState: unknown,
  currentState: Record<string, unknown>,
): Record<string, unknown> {
  // Start with currentState (has actions) and overlay persisted data (JSON, no functions)
  const merged = { ...currentState };
  if (persistedState && typeof persistedState === 'object') {
    for (const [key, value] of Object.entries(persistedState as Record<string, unknown>)) {
      // Only overwrite with non-function values from persisted JSON
      if (typeof value !== 'function') {
        merged[key] = value;
      }
    }
  }

  // Migrate old sidebarCollapsed to timelineCollapsed on every hydrate
  if (
    typeof (merged as Record<string, unknown>).sidebarCollapsed === 'boolean' &&
    typeof (merged as Record<string, unknown>).timelineCollapsed === 'undefined'
  ) {
    (merged as Record<string, unknown>).timelineCollapsed = (
      merged as Record<string, unknown>
    ).sidebarCollapsed;
    delete (merged as Record<string, unknown>).sidebarCollapsed;
  }

  ensureBuiltInProviders(merged as Partial<LLMSettingsSlice>);
  promoteLegacyCustomProviderBaseUrls(merged as Partial<LLMSettingsSlice>);
  ensureBuiltInAudioProviders(merged as Partial<AudioSettingsSlice>);
  ensureBuiltInImageProviders(merged as Partial<MediaSliceState>);
  ensureBuiltInVideoProviders(merged as Partial<MediaSliceState>);
  ensureBuiltInWebSearchProviders(merged as Partial<AudioSettingsSlice>);
  ensureValidProviderSelections(merged as MigratableState);
  const typedMerged = merged as MigratableState;
  typedMerged.thinkingConfigs = pruneThinkingConfigs(
    typedMerged.thinkingConfigs,
    typedMerged.providersConfig,
  );

  return merged;
}
