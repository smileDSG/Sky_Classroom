/**
 * Settings Store — barrel file
 *
 * Composes slice state + actions into a single Zustand store with
 * localStorage persistence.  Re-exports the full API surface for
 * backward compatibility.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProviderId } from '@/lib/ai/providers';
import { PROVIDERS } from '@/lib/ai/providers';
import type { ThinkingConfig } from '@/lib/types/provider';
import type { TTSProviderId, ASRProviderId, BuiltInTTSProviderId } from '@/lib/audio/types';
import { DEFAULT_TTS_VOICES } from '@/lib/audio/constants';
import type { PDFProviderId } from '@/lib/pdf/types';
import type { ImageProviderId, VideoProviderId } from '@/lib/media/types';
import { IMAGE_PROVIDERS } from '@/lib/media/image-providers';
import { VIDEO_PROVIDERS } from '@/lib/media/video-providers';
import type { WebSearchProviderId } from '@/lib/web-search/types';
import { createLogger } from '@/lib/logger';
import { validateProvider, validateModel } from '@/lib/store/settings-validation';

// ── Slice imports ──────────────────────────────────────────────────

import {
  type LLMSettingsSlice,
  getDefaultLLMSettings,
  createLLMSetters,
  pruneThinkingConfigs,
} from './settings/llm';

import {
  type AudioSettingsSlice,
  getDefaultAudioSettings,
  createAudioSetters,
} from './settings/audio';

import {
  type MediaSliceState,
  type MediaSliceActions,
  getDefaultMediaState,
  createMediaActions,
} from './settings/media';

import {
  type LayoutSliceState,
  type LayoutSliceActions,
  getDefaultLayoutState,
  createLayoutActions,
} from './settings/layout';

import {
  type AgentsSliceState,
  type AgentsSliceActions,
  getDefaultAgentsState,
  createAgentsActions,
} from './settings/agents';

// ── Migration ──────────────────────────────────────────────────────

import {
  migrateSettings,
  mergeSettings,
  migrateFromOldStorage,
} from './settings/migration';

// ── Presets ────────────────────────────────────────────────────────

import {
  type SettingsPreset,
  EDUCATION_PRESET,
  DEMO_PRESET,
  DEVELOPMENT_PRESET,
  ALL_PRESETS,
} from './settings/presets';

// Re-export presets
export {
  type SettingsPreset,
  EDUCATION_PRESET,
  DEMO_PRESET,
  DEVELOPMENT_PRESET,
  ALL_PRESETS,
};

// ── Backward-compatible aliases ────────────────────────────────────

export const DEFAULT_PRESET = EDUCATION_PRESET;
export const COLLAB_PRESET = DEVELOPMENT_PRESET;

// ── Re-exports from slices ─────────────────────────────────────────

export { PLAYBACK_SPEEDS } from './settings/audio';
export type { PlaybackSpeed } from './settings/audio';
export { promoteLegacyCustomProviderBaseUrls } from './settings/llm';

// ── Logger ─────────────────────────────────────────────────────────

const log = createLogger('Settings');

// ── Composed State type ────────────────────────────────────────────

export interface SettingsState
  extends LLMSettingsSlice,
    AudioSettingsSlice,
    MediaSliceState,
    MediaSliceActions,
    LayoutSliceState,
    LayoutSliceActions,
    AgentsSliceState,
    AgentsSliceActions {
  // Cross-cutting action touching all domains
  fetchServerProviders: () => Promise<void>;
}

// ── Store ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useSettingsStore = create<SettingsState>()(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  persist(
    (set: any, get: any) => {
      const setAny = set;
      const getAny = get;

      // Try to migrate from old storage
      const migratedData = migrateFromOldStorage();

      // Compose initial state from slice defaults + migrated overrides
      const llmDefaults = getDefaultLLMSettings();
      const audioDefaults = getDefaultAudioSettings();
      const mediaDefaults = getDefaultMediaState();
      const layoutDefaults = getDefaultLayoutState();
      const agentsDefaults = getDefaultAgentsState();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const baseState: any = {
        // ── Spread all slice defaults ──────────────────────────
        ...llmDefaults,
        ...audioDefaults,
        ...mediaDefaults,
        ...layoutDefaults,
        ...agentsDefaults,

        // ── Override with migrated data ────────────────────────
        ...(migratedData
          ? {
              providerId: (migratedData.providerId as ProviderId) || llmDefaults.providerId,
              modelId: (migratedData.modelId as string) || '',
              thinkingConfigs: pruneThinkingConfigs(
                (migratedData.thinkingConfigs as Record<string, ThinkingConfig>) || {},
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (migratedData.providersConfig as any) || llmDefaults.providersConfig,
              ),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              providersConfig:
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (migratedData.providersConfig as any) || llmDefaults.providersConfig,
              ttsModel: (migratedData.ttsModel as string) || 'openai-tts',
              selectedAgentIds:
                (migratedData.selectedAgentIds as string[]) || agentsDefaults.selectedAgentIds,
              maxTurns: (migratedData.maxTurns as string)?.toString() || agentsDefaults.maxTurns,
            }
          : {}),

        // ── Compose action creators from all slices ────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...createLLMSetters(setAny, getAny),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...createAudioSetters(setAny, getAny),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...createMediaActions(setAny, getAny),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...createLayoutActions(setAny),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...createAgentsActions(setAny),

        // ── Cross-cutting: fetch server providers ──────────────
        fetchServerProviders: async () => {
          try {
            const res = await fetch('/api/server-providers');
            if (!res.ok) return;
            const data = (await res.json()) as {
              providers: Record<string, { models?: string[]; baseUrl?: string }>;
              tts: Record<string, { baseUrl?: string }>;
              asr: Record<string, { baseUrl?: string }>;
              pdf: Record<string, { baseUrl?: string }>;
              image: Record<string, { baseUrl?: string }>;
              video: Record<string, { baseUrl?: string }>;
              webSearch: Record<string, { baseUrl?: string }>;
            };

            setAny((state: SettingsState) => {
              // Merge LLM providers
              const newProvidersConfig = { ...state.providersConfig };
              // First reset all server flags
              for (const pid of Object.keys(newProvidersConfig)) {
                const key = pid as ProviderId;
                if (newProvidersConfig[key]) {
                  newProvidersConfig[key] = {
                    ...newProvidersConfig[key],
                    isServerConfigured: false,
                    serverModels: undefined,
                    serverBaseUrl: undefined,
                  };
                }
              }
              // Set flags for server-configured providers
              for (const [pid, info] of Object.entries(data.providers)) {
                const key = pid as ProviderId;
                if (newProvidersConfig[key]) {
                  const currentModels = newProvidersConfig[key].models;
                  const currentModelMap = new Map(currentModels.map((m: { id: string; name: string }) => [m.id, m]));
                  const filteredModels = info.models?.length
                    ? info.models.map((id) => currentModelMap.get(id) ?? { id, name: id })
                    : currentModels;
                  newProvidersConfig[key] = {
                    ...newProvidersConfig[key],
                    isServerConfigured: true,
                    serverModels: info.models,
                    serverBaseUrl: info.baseUrl,
                    models: filteredModels,
                  };
                }
              }

              // Merge TTS providers
              const newTTSConfig = { ...state.ttsProvidersConfig };
              for (const pid of Object.keys(newTTSConfig)) {
                const key = pid as TTSProviderId;
                if (newTTSConfig[key]) {
                  newTTSConfig[key] = {
                    ...newTTSConfig[key],
                    isServerConfigured: false,
                    serverBaseUrl: undefined,
                  };
                }
              }
              for (const [pid, info] of Object.entries(data.tts)) {
                const key = pid as TTSProviderId;
                if (newTTSConfig[key]) {
                  newTTSConfig[key] = {
                    ...newTTSConfig[key],
                    isServerConfigured: true,
                    serverBaseUrl: info.baseUrl,
                  };
                }
              }

              // Merge ASR providers
              const newASRConfig = { ...state.asrProvidersConfig };
              for (const pid of Object.keys(newASRConfig)) {
                const key = pid as ASRProviderId;
                if (newASRConfig[key]) {
                  newASRConfig[key] = {
                    ...newASRConfig[key],
                    isServerConfigured: false,
                    serverBaseUrl: undefined,
                  };
                }
              }
              for (const [pid, info] of Object.entries(data.asr)) {
                const key = pid as ASRProviderId;
                if (newASRConfig[key]) {
                  newASRConfig[key] = {
                    ...newASRConfig[key],
                    isServerConfigured: true,
                    serverBaseUrl: info.baseUrl,
                  };
                }
              }

              // Merge PDF providers
              const newPDFConfig = { ...state.pdfProvidersConfig };
              for (const pid of Object.keys(newPDFConfig)) {
                const key = pid as PDFProviderId;
                if (newPDFConfig[key]) {
                  newPDFConfig[key] = {
                    ...newPDFConfig[key],
                    isServerConfigured: false,
                    serverBaseUrl: undefined,
                  };
                }
              }
              for (const [pid, info] of Object.entries(data.pdf)) {
                const key = pid as PDFProviderId;
                if (newPDFConfig[key]) {
                  newPDFConfig[key] = {
                    ...newPDFConfig[key],
                    isServerConfigured: true,
                    serverBaseUrl: info.baseUrl,
                  };
                }
              }

              // Merge Image providers
              const newImageConfig = { ...state.imageProvidersConfig };
              for (const pid of Object.keys(newImageConfig)) {
                const key = pid as ImageProviderId;
                if (newImageConfig[key]) {
                  newImageConfig[key] = {
                    ...newImageConfig[key],
                    isServerConfigured: false,
                    serverBaseUrl: undefined,
                  };
                }
              }
              for (const [pid, info] of Object.entries(data.image)) {
                const key = pid as ImageProviderId;
                if (newImageConfig[key]) {
                  newImageConfig[key] = {
                    ...newImageConfig[key],
                    isServerConfigured: true,
                    serverBaseUrl: info.baseUrl,
                  };
                }
              }

              // Merge Video providers
              const newVideoConfig = { ...state.videoProvidersConfig };
              for (const pid of Object.keys(newVideoConfig)) {
                const key = pid as VideoProviderId;
                if (newVideoConfig[key]) {
                  newVideoConfig[key] = {
                    ...newVideoConfig[key],
                    isServerConfigured: false,
                    serverBaseUrl: undefined,
                  };
                }
              }
              if (data.video) {
                for (const [pid, info] of Object.entries(data.video)) {
                  const key = pid as VideoProviderId;
                  if (newVideoConfig[key]) {
                    newVideoConfig[key] = {
                      ...newVideoConfig[key],
                      isServerConfigured: true,
                      serverBaseUrl: info.baseUrl,
                    };
                  }
                }
              }

              // Merge Web Search config
              const newWebSearchConfig = { ...state.webSearchProvidersConfig };
              for (const key of Object.keys(newWebSearchConfig) as WebSearchProviderId[]) {
                newWebSearchConfig[key] = {
                  ...newWebSearchConfig[key],
                  isServerConfigured: false,
                  serverBaseUrl: undefined,
                };
              }
              if (data.webSearch) {
                for (const [pid, info] of Object.entries(data.webSearch)) {
                  const key = pid as WebSearchProviderId;
                  if (newWebSearchConfig[key]) {
                    newWebSearchConfig[key] = {
                      ...newWebSearchConfig[key],
                      isServerConfigured: true,
                      serverBaseUrl: info.baseUrl,
                    };
                  }
                }
              }

              // === Validate current selections against updated configs ===
              // Build fallback: server-configured first, then client-key-only
              const buildFallback = <T extends string>(
                config: Record<string, { isServerConfigured?: boolean; apiKey?: string }>,
              ): T[] => [
                ...Object.entries(config)
                  .filter(([, c]) => c.isServerConfigured)
                  .map(([id]) => id as T),
                ...Object.entries(config)
                  .filter(([, c]) => !c.isServerConfigured && !!c.apiKey)
                  .map(([id]) => id as T),
              ];

              const llmFallback = buildFallback<ProviderId>(newProvidersConfig);
              const ttsFallback = buildFallback<TTSProviderId>(newTTSConfig);
              const asrFallback = buildFallback<ASRProviderId>(newASRConfig);
              const pdfFallback = buildFallback<PDFProviderId>(newPDFConfig);
              const imageFallback = buildFallback<ImageProviderId>(newImageConfig);
              const videoFallback = buildFallback<VideoProviderId>(newVideoConfig);
              const webSearchFallback = buildFallback<WebSearchProviderId>(newWebSearchConfig);

              const validLLMProvider = validateProvider(
                state.providerId,
                newProvidersConfig,
                llmFallback,
              );
              const validTTSProvider = validateProvider(
                state.ttsProviderId,
                newTTSConfig,
                ttsFallback,
                'browser-native-tts' as TTSProviderId,
              );
              const validASRProvider = validateProvider(
                state.asrProviderId,
                newASRConfig,
                asrFallback,
                'browser-native' as ASRProviderId,
              );
              const validPDFProvider = validateProvider(
                state.pdfProviderId,
                newPDFConfig,
                pdfFallback,
                'unpdf' as PDFProviderId,
              );
              let validImageProvider = validateProvider(
                state.imageProviderId,
                newImageConfig,
                imageFallback,
              );
              let validVideoProvider = validateProvider(
                state.videoProviderId,
                newVideoConfig,
                videoFallback,
              );
              const validWebSearchProvider = validateProvider(
                state.webSearchProviderId,
                newWebSearchConfig,
                webSearchFallback,
                'tavily' as WebSearchProviderId,
              );

              // Auto-recover: when provider is empty but server has available ones
              let recoveredImageModel = '';
              if (!validImageProvider && imageFallback.length > 0) {
                validImageProvider = imageFallback[0];
                const models = IMAGE_PROVIDERS[validImageProvider as ImageProviderId]?.models;
                if (models?.length) recoveredImageModel = models[0].id;
              }
              let recoveredVideoModel = '';
              if (!validVideoProvider && videoFallback.length > 0) {
                validVideoProvider = videoFallback[0];
                const models = VIDEO_PROVIDERS[validVideoProvider as VideoProviderId]?.models;
                if (models?.length) recoveredVideoModel = models[0].id;
              }

              const validLLMModel = validLLMProvider
                ? validateModel(
                    state.modelId,
                    newProvidersConfig[validLLMProvider as ProviderId]?.models ?? [],
                  )
                : '';
              const imageModels =
                IMAGE_PROVIDERS[validImageProvider as ImageProviderId]?.models ?? [];
              const validImageModel = validImageProvider
                ? recoveredImageModel ||
                  validateModel(state.imageModelId, imageModels) ||
                  imageModels[0]?.id ||
                  ''
                : '';
              const videoModels =
                VIDEO_PROVIDERS[validVideoProvider as VideoProviderId]?.models ?? [];
              const validVideoModel = validVideoProvider
                ? recoveredVideoModel ||
                  validateModel(state.videoModelId, videoModels) ||
                  videoModels[0]?.id ||
                  ''
                : '';

              const validTTSVoice =
                validTTSProvider !== state.ttsProviderId
                  ? DEFAULT_TTS_VOICES[validTTSProvider as BuiltInTTSProviderId] || 'default'
                  : state.ttsVoice;

              // Auto-disable image/video generation when no provider is usable
              const shouldDisableImage = !validImageProvider && state.imageGenerationEnabled;
              const shouldDisableVideo = !validVideoProvider && state.videoGenerationEnabled;

              // === Auto-select / auto-enable (only on first run) ===
              let autoTtsProvider: TTSProviderId | undefined;
              let autoTtsVoice: string | undefined;
              let autoAsrProvider: ASRProviderId | undefined;
              let autoPdfProvider: PDFProviderId | undefined;
              let autoImageProvider: ImageProviderId | undefined;
              let autoImageModel: string | undefined;
              let autoVideoProvider: VideoProviderId | undefined;
              let autoVideoModel: string | undefined;
              let autoImageEnabled: boolean | undefined;
              let autoVideoEnabled: boolean | undefined;

              if (!state.autoConfigApplied) {
                // PDF: unpdf -> mineru-cloud or mineru if server has it
                if (state.pdfProviderId === 'unpdf') {
                  if (newPDFConfig['mineru-cloud']?.isServerConfigured) {
                    autoPdfProvider = 'mineru-cloud' as PDFProviderId;
                  } else if (newPDFConfig.mineru?.isServerConfigured) {
                    autoPdfProvider = 'mineru' as PDFProviderId;
                  }
                }

                // TTS: select first server provider if current is not server-configured
                const serverTtsIds = Object.keys(data.tts) as TTSProviderId[];
                if (
                  serverTtsIds.length > 0 &&
                  !newTTSConfig[state.ttsProviderId]?.isServerConfigured
                ) {
                  autoTtsProvider = serverTtsIds[0];
                  autoTtsVoice =
                    DEFAULT_TTS_VOICES[autoTtsProvider as BuiltInTTSProviderId] || 'default';
                }

                // ASR: select first server provider if current is not server-configured
                const serverAsrIds = Object.keys(data.asr) as ASRProviderId[];
                if (
                  serverAsrIds.length > 0 &&
                  !newASRConfig[state.asrProviderId]?.isServerConfigured
                ) {
                  autoAsrProvider = serverAsrIds[0];
                }

                // Image: first server provider
                const serverImageIds = Object.keys(data.image) as ImageProviderId[];
                if (
                  serverImageIds.length > 0 &&
                  !newImageConfig[state.imageProviderId]?.isServerConfigured
                ) {
                  autoImageProvider = serverImageIds[0];
                  const models = IMAGE_PROVIDERS[autoImageProvider]?.models;
                  if (models?.length) autoImageModel = models[0].id;
                }
                if (serverImageIds.length > 0 && !state.imageGenerationEnabled) {
                  autoImageEnabled = true;
                }

                // Video: first server provider
                const serverVideoIds = Object.keys(data.video || {}) as VideoProviderId[];
                if (
                  serverVideoIds.length > 0 &&
                  !newVideoConfig[state.videoProviderId]?.isServerConfigured
                ) {
                  autoVideoProvider = serverVideoIds[0];
                  const models = VIDEO_PROVIDERS[autoVideoProvider]?.models;
                  if (models?.length) autoVideoModel = models[0].id;
                }
                if (serverVideoIds.length > 0 && !state.videoGenerationEnabled) {
                  autoVideoEnabled = true;
                }
              }

              // LLM auto-select: only on true first load (no provider selected yet)
              let autoProviderId: ProviderId | undefined;
              let autoModelId: string | undefined;
              if (!state.providerId && !state.modelId) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                for (const [pid, cfg] of Object.entries(newProvidersConfig) as [string, any][]) {
                  if (cfg.isServerConfigured) {
                    const serverModels = cfg.serverModels as string[] | undefined;
                    const modelId = serverModels?.length
                      ? serverModels[0]
                      : PROVIDERS[pid as ProviderId]?.models[0]?.id;
                    if (modelId) {
                      autoProviderId = pid as ProviderId;
                      autoModelId = modelId;
                      break;
                    }
                  }
                }
              }

              return {
                providersConfig: newProvidersConfig,
                ttsProvidersConfig: newTTSConfig,
                asrProvidersConfig: newASRConfig,
                pdfProvidersConfig: newPDFConfig,
                imageProvidersConfig: newImageConfig,
                videoProvidersConfig: newVideoConfig,
                webSearchProvidersConfig: newWebSearchConfig,
                autoConfigApplied: true,
                // Validated selections
                ...(validLLMProvider !== state.providerId && {
                  providerId: validLLMProvider as ProviderId,
                }),
                ...(validLLMModel !== state.modelId && { modelId: validLLMModel }),
                ...(validTTSProvider !== state.ttsProviderId && {
                  ttsProviderId: validTTSProvider as TTSProviderId,
                  ttsVoice: validTTSVoice,
                }),
                ...(validASRProvider !== state.asrProviderId && {
                  asrProviderId: validASRProvider as ASRProviderId,
                }),
                ...(validPDFProvider !== state.pdfProviderId && {
                  pdfProviderId: validPDFProvider as PDFProviderId,
                }),
                ...(validWebSearchProvider !== state.webSearchProviderId && {
                  webSearchProviderId: validWebSearchProvider as WebSearchProviderId,
                }),
                ...(validImageProvider !== state.imageProviderId && {
                  imageProviderId: validImageProvider as ImageProviderId,
                }),
                ...(validImageModel !== state.imageModelId && {
                  imageModelId: validImageModel,
                }),
                ...(validVideoProvider !== state.videoProviderId && {
                  videoProviderId: validVideoProvider as VideoProviderId,
                }),
                ...(validVideoModel !== state.videoModelId && {
                  videoModelId: validVideoModel,
                }),
                ...(shouldDisableImage && { imageGenerationEnabled: false }),
                ...(shouldDisableVideo && { videoGenerationEnabled: false }),
                // First-run auto-select overrides validation (autoConfigApplied guard)
                ...(autoPdfProvider && { pdfProviderId: autoPdfProvider }),
                ...(autoTtsProvider && {
                  ttsProviderId: autoTtsProvider,
                  ttsVoice: autoTtsVoice,
                }),
                ...(autoAsrProvider && { asrProviderId: autoAsrProvider }),
                ...(autoImageProvider && { imageProviderId: autoImageProvider }),
                ...(autoImageModel && { imageModelId: autoImageModel }),
                ...(autoVideoProvider && { videoProviderId: autoVideoProvider }),
                ...(autoVideoModel && { videoModelId: autoVideoModel }),
                ...(autoImageEnabled !== undefined && {
                  imageGenerationEnabled: autoImageEnabled,
                }),
                ...(autoVideoEnabled !== undefined && {
                  videoGenerationEnabled: autoVideoEnabled,
                }),
                ...(autoProviderId && { providerId: autoProviderId }),
                ...(autoModelId && { modelId: autoModelId }),
              };
            });
          } catch (e) {
            // Silently fail — server providers are optional
            log.warn('Failed to fetch server providers:', e);
          }
        },
      };
      return baseState;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    {
      name: 'settings-storage',
      version: 3,
      migrate: migrateSettings as any,
      merge: mergeSettings as any,
    } as any,
  ),
);

// ── Preset application ─────────────────────────────────────────────

/** Apply a preset's settings to the current store via shallow merge. */
export function applyPreset(preset: Readonly<SettingsPreset>): void {
  useSettingsStore.setState(preset.settings as Partial<SettingsState>);
}

// ── Import / Export ────────────────────────────────────────────────

/** Export current settings to a JSON string. */
export function exportSettings(): string {
  return JSON.stringify(useSettingsStore.getState());
}

/** Import settings from a JSON string. */
export function importSettings(json: string): void {
  const parsed = JSON.parse(json) as Partial<SettingsState>;
  useSettingsStore.setState(parsed);
}

// Re-export migrateFromOldStorage for external consumers
export { migrateFromOldStorage } from './settings/migration';
