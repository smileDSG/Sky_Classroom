/**
 * Audio Settings Slice
 *
 * TTS, ASR, PDF, Web Search, playback controls, and global feature toggles.
 * Composed by the barrel store into a single Zustand store.
 */

import type { TTSProviderId, ASRProviderId, BuiltInTTSProviderId } from '@/lib/audio/types';
import { isCustomTTSProvider, isCustomASRProvider } from '@/lib/audio/types';
import { ASR_PROVIDERS, DEFAULT_TTS_VOICES, TTS_PROVIDERS } from '@/lib/audio/constants';
import { DEFAULT_VOXCPM_BACKEND, VOXCPM_MODEL_ID, VOXCPM_VLLM_MODEL_ID } from '@/lib/audio/voxcpm';
import { PDF_PROVIDERS } from '@/lib/pdf/constants';
import type { PDFProviderId } from '@/lib/pdf/types';
import type { WebSearchProviderId, BaiduSubSources } from '@/lib/web-search/types';
import { WEB_SEARCH_PROVIDERS } from '@/lib/web-search/constants';

// ---------------------------------------------------------------------------
// Shared type helpers
// ---------------------------------------------------------------------------

/** Available playback speed tiers */
export const PLAYBACK_SPEEDS = [1, 1.25, 1.5, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

/** Per-provider configuration stored in ttsProvidersConfig. */
export interface TTSProviderStoreConfig {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  modelId?: string;
  customModels?: Array<{ id: string; name: string }>;
  providerOptions?: Record<string, unknown>;
  isServerConfigured?: boolean;
  serverBaseUrl?: string;
  customName?: string;
  customDefaultBaseUrl?: string;
  customVoices?: Array<{ id: string; name: string }>;
  isBuiltIn?: boolean;
  requiresApiKey?: boolean;
}

/** Per-provider configuration stored in asrProvidersConfig. */
export interface ASRProviderStoreConfig {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  modelId?: string;
  customModels?: Array<{ id: string; name: string }>;
  providerOptions?: Record<string, unknown>;
  isServerConfigured?: boolean;
  serverBaseUrl?: string;
  customName?: string;
  customDefaultBaseUrl?: string;
  isBuiltIn?: boolean;
  requiresApiKey?: boolean;
}

/** Per-provider configuration stored in pdfProvidersConfig. */
export interface PDFProviderStoreConfig {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  requiresApiKey?: boolean;
  isServerConfigured?: boolean;
  serverBaseUrl?: string;
}

/** Per-provider configuration stored in webSearchProvidersConfig. */
export interface WebSearchProviderStoreConfig {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  requiresApiKey?: boolean;
  isServerConfigured?: boolean;
  serverBaseUrl?: string;
}

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

export interface AudioSettingsSlice {
  // TTS settings (legacy, kept for backward compatibility)
  ttsModel: string;

  // Audio settings (new unified audio configuration)
  ttsProviderId: TTSProviderId;
  ttsVoice: string;
  ttsSpeed: number;
  asrProviderId: ASRProviderId;
  asrLanguage: string;

  // Audio provider configurations
  ttsProvidersConfig: Record<TTSProviderId, TTSProviderStoreConfig>;
  asrProvidersConfig: Record<ASRProviderId, ASRProviderStoreConfig>;

  // PDF settings
  pdfProviderId: PDFProviderId;
  pdfProvidersConfig: Record<PDFProviderId, PDFProviderStoreConfig>;

  // Baidu sub-sources (part of web search)
  baiduSubSources: BaiduSubSources;

  // Web Search settings
  webSearchProviderId: WebSearchProviderId;
  webSearchProvidersConfig: Record<WebSearchProviderId, WebSearchProviderStoreConfig>;

  // Global TTS/ASR toggles
  ttsEnabled: boolean;
  asrEnabled: boolean;

  // Auto-config lifecycle flag (persisted)
  autoConfigApplied: boolean;

  // Playback controls
  ttsMuted: boolean;
  ttsVolume: number; // 0-1, actual volume level
  autoPlayLecture: boolean;
  playbackSpeed: PlaybackSpeed;

  // --------------- Actions ---------------

  // TTS (legacy)
  setTtsModel: (model: string) => void;

  // Playback controls
  setTTSMuted: (muted: boolean) => void;
  setTTSVolume: (volume: number) => void;
  setAutoPlayLecture: (autoPlay: boolean) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;

  // Audio provider selection
  setTTSProvider: (providerId: TTSProviderId) => void;
  setTTSVoice: (voice: string) => void;
  setTTSSpeed: (speed: number) => void;
  setASRProvider: (providerId: ASRProviderId) => void;
  setASRLanguage: (language: string) => void;

  // Audio provider config updates
  setTTSProviderConfig: (
    providerId: TTSProviderId,
    config: Partial<{
      apiKey: string;
      baseUrl: string;
      enabled: boolean;
      modelId: string;
      customModels: Array<{ id: string; name: string }>;
      customVoices: Array<{ id: string; name: string }>;
      providerOptions: Record<string, unknown>;
    }>,
  ) => void;
  setASRProviderConfig: (
    providerId: ASRProviderId,
    config: Partial<{
      apiKey: string;
      baseUrl: string;
      enabled: boolean;
      modelId: string;
      customModels: Array<{ id: string; name: string }>;
      providerOptions: Record<string, unknown>;
    }>,
  ) => void;

  // Global toggles
  setTTSEnabled: (enabled: boolean) => void;
  setASREnabled: (enabled: boolean) => void;

  // Custom audio provider actions
  addCustomTTSProvider: (
    id: TTSProviderId,
    name: string,
    baseUrl: string,
    requiresApiKey: boolean,
    defaultModel?: string,
  ) => void;
  removeCustomTTSProvider: (id: TTSProviderId) => void;
  addCustomASRProvider: (
    id: ASRProviderId,
    name: string,
    baseUrl: string,
    requiresApiKey: boolean,
  ) => void;
  removeCustomASRProvider: (id: ASRProviderId) => void;

  // PDF actions
  setPDFProvider: (providerId: PDFProviderId) => void;
  setPDFProviderConfig: (
    providerId: PDFProviderId,
    config: Partial<{ apiKey: string; baseUrl: string; enabled: boolean }>,
  ) => void;

  // Web Search actions
  setWebSearchProvider: (providerId: WebSearchProviderId) => void;
  setWebSearchProviderConfig: (
    providerId: WebSearchProviderId,
    config: Partial<{ apiKey: string; baseUrl: string; enabled: boolean }>,
  ) => void;
  setBaiduSubSources: (sources: Partial<BaiduSubSources>) => void;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a provider ID exists in the given provider registry.
 */
function hasProviderId(providerMap: Record<string, unknown>, providerId?: string): boolean {
  return typeof providerId === 'string' && providerId in providerMap;
}

// ---------------------------------------------------------------------------
// Initial state builders
// ---------------------------------------------------------------------------

/**
 * Build default audio configuration (TTS + ASR state and provider configs).
 */
export function getDefaultAudioConfig(): Pick<
  AudioSettingsSlice,
  | 'ttsProviderId'
  | 'ttsVoice'
  | 'ttsSpeed'
  | 'asrProviderId'
  | 'asrLanguage'
  | 'ttsProvidersConfig'
  | 'asrProvidersConfig'
> {
  return {
    ttsProviderId: 'browser-native-tts' as TTSProviderId,
    ttsVoice: 'default',
    ttsSpeed: 1.0,
    asrProviderId: 'browser-native' as ASRProviderId,
    asrLanguage: 'zh',
    ttsProvidersConfig: {
      'openai-tts': { apiKey: '', baseUrl: '', enabled: true },
      'azure-tts': { apiKey: '', baseUrl: '', enabled: false },
      'glm-tts': { apiKey: '', baseUrl: '', enabled: false },
      'qwen-tts': { apiKey: '', baseUrl: '', enabled: false },
      'voxcpm-tts': {
        apiKey: '',
        baseUrl: '',
        modelId: VOXCPM_VLLM_MODEL_ID,
        enabled: false,
        providerOptions: { backend: DEFAULT_VOXCPM_BACKEND },
      },
      'doubao-tts': { apiKey: '', baseUrl: '', enabled: false },
      'elevenlabs-tts': { apiKey: '', baseUrl: '', enabled: false },
      'minimax-tts': {
        apiKey: '',
        baseUrl: '',
        modelId: 'speech-2.8-hd',
        enabled: false,
      },
      'lemonade-tts': {
        apiKey: '',
        baseUrl: '',
        modelId: 'kokoro-v1',
        enabled: false,
      },
      'browser-native-tts': { apiKey: '', baseUrl: '', enabled: true },
    } as Record<TTSProviderId, TTSProviderStoreConfig>,
    asrProvidersConfig: {
      'openai-whisper': { apiKey: '', baseUrl: '', enabled: true },
      'browser-native': { apiKey: '', baseUrl: '', enabled: true },
      'qwen-asr': { apiKey: '', baseUrl: '', enabled: false },
      'lemonade-asr': { apiKey: '', baseUrl: '', enabled: false },
    } as Record<ASRProviderId, ASRProviderStoreConfig>,
  };
}

/**
 * Build default PDF configuration.
 */
export function getDefaultPDFConfig(): Pick<
  AudioSettingsSlice,
  'pdfProviderId' | 'pdfProvidersConfig'
> {
  return {
    pdfProviderId: 'unpdf' as PDFProviderId,
    pdfProvidersConfig: {
      unpdf: { apiKey: '', baseUrl: '', enabled: true },
      mineru: { apiKey: '', baseUrl: '', enabled: false },
      'mineru-cloud': { apiKey: '', baseUrl: '', enabled: false },
    } as Record<PDFProviderId, PDFProviderStoreConfig>,
  };
}

/**
 * Build default Web Search configuration.
 */
export function getDefaultWebSearchConfig(): Pick<
  AudioSettingsSlice,
  'webSearchProviderId' | 'webSearchProvidersConfig' | 'baiduSubSources'
> {
  return {
    webSearchProviderId: 'tavily' as WebSearchProviderId,
    webSearchProvidersConfig: {
      tavily: { apiKey: '', baseUrl: '', enabled: true, requiresApiKey: true },
      bocha: { apiKey: '', baseUrl: '', enabled: true, requiresApiKey: true },
      brave: {
        apiKey: '',
        baseUrl: WEB_SEARCH_PROVIDERS.brave.defaultBaseUrl || '',
        enabled: true,
        requiresApiKey: false,
      },
      baidu: { apiKey: '', baseUrl: '', enabled: true, requiresApiKey: true },
    } as Record<WebSearchProviderId, WebSearchProviderStoreConfig>,
    baiduSubSources: {
      webSearch: true,
      baike: true,
      scholar: true,
    } as BaiduSubSources,
  };
}

/**
 * Combine all audio-slice defaults into a single initial-state object
 * (excluding action functions).
 */
export function getDefaultAudioSettings(): Omit<
  AudioSettingsSlice,
  // Action keys excluded -- these are provided by createAudioSetters
  | 'setTtsModel'
  | 'setTTSMuted'
  | 'setTTSVolume'
  | 'setAutoPlayLecture'
  | 'setPlaybackSpeed'
  | 'setTTSProvider'
  | 'setTTSVoice'
  | 'setTTSSpeed'
  | 'setASRProvider'
  | 'setASRLanguage'
  | 'setTTSProviderConfig'
  | 'setASRProviderConfig'
  | 'setTTSEnabled'
  | 'setASREnabled'
  | 'addCustomTTSProvider'
  | 'removeCustomTTSProvider'
  | 'addCustomASRProvider'
  | 'removeCustomASRProvider'
  | 'setPDFProvider'
  | 'setPDFProviderConfig'
  | 'setWebSearchProvider'
  | 'setWebSearchProviderConfig'
  | 'setBaiduSubSources'
> {
  return {
    ttsModel: 'openai-tts',

    // Playback controls
    ttsMuted: false,
    ttsVolume: 1,
    autoPlayLecture: false,
    playbackSpeed: 1 as PlaybackSpeed,

    // Audio settings (use defaults)
    ...getDefaultAudioConfig(),

    // PDF settings (use defaults)
    ...getDefaultPDFConfig(),

    // Web Search settings (use defaults)
    ...getDefaultWebSearchConfig(),

    // Audio feature toggles (on by default)
    ttsEnabled: true,
    asrEnabled: true,

    autoConfigApplied: false,
  };
}

// ---------------------------------------------------------------------------
// Ensure / migration helpers
// ---------------------------------------------------------------------------

/**
 * Ensure all built-in TTS & ASR providers exist in the config maps.
 * Called on every rehydrate so newly added providers appear automatically.
 */
export function ensureBuiltInAudioProviders(state: Partial<AudioSettingsSlice>): void {
  const defaultAudioConfig = getDefaultAudioConfig();

  if (state.ttsProvidersConfig) {
    for (const providerId of Object.keys(TTS_PROVIDERS) as BuiltInTTSProviderId[]) {
      if (!state.ttsProvidersConfig[providerId]) {
        state.ttsProvidersConfig[providerId] = defaultAudioConfig.ttsProvidersConfig[providerId];
      }
    }
    const voxcpmConfig = state.ttsProvidersConfig['voxcpm-tts'];
    if (voxcpmConfig) {
      if (!voxcpmConfig.modelId || voxcpmConfig.modelId === VOXCPM_MODEL_ID) {
        voxcpmConfig.modelId = VOXCPM_VLLM_MODEL_ID;
      }
      voxcpmConfig.providerOptions = {
        backend: DEFAULT_VOXCPM_BACKEND,
        ...(voxcpmConfig.providerOptions || {}),
      };
    }
  }

  if (state.asrProvidersConfig) {
    for (const providerId of Object.keys(ASR_PROVIDERS) as ASRProviderId[]) {
      if (!state.asrProvidersConfig[providerId]) {
        state.asrProvidersConfig[providerId] = defaultAudioConfig.asrProvidersConfig[providerId];
      }
    }
  }
}

/**
 * Ensure webSearchProvidersConfig includes all built-in web search providers.
 * Called on every rehydrate so newly added providers appear automatically.
 */
export function ensureBuiltInWebSearchProviders(state: Partial<AudioSettingsSlice>): void {
  if (!state.webSearchProvidersConfig) return;
  const defaultConfig = getDefaultWebSearchConfig().webSearchProvidersConfig;
  Object.keys(WEB_SEARCH_PROVIDERS).forEach((pid) => {
    const providerId = pid as WebSearchProviderId;
    if (!state.webSearchProvidersConfig![providerId]) {
      state.webSearchProvidersConfig![providerId] = defaultConfig[providerId];
    } else {
      state.webSearchProvidersConfig![providerId] = {
        ...state.webSearchProvidersConfig![providerId],
        requiresApiKey: WEB_SEARCH_PROVIDERS[providerId].requiresApiKey,
      };
    }
  });
}

/**
 * Ensure baiduSubSources has all required boolean fields, filling any
 * missing ones from defaults.
 */
export function ensureBaiduSubSources(state: Partial<AudioSettingsSlice>): void {
  const defaults = getDefaultWebSearchConfig().baiduSubSources;
  const current = state.baiduSubSources;
  state.baiduSubSources = {
    webSearch: current?.webSearch ?? defaults.webSearch,
    baike: current?.baike ?? defaults.baike,
    scholar: current?.scholar ?? defaults.scholar,
  };
}

/**
 * Validate all persisted audio-related provider IDs against their registries.
 * Reset any stale / removed ID back to its default value.
 * Called during both migrate and merge to cover all rehydration paths.
 */
export function ensureValidAudioProviders(state: Partial<AudioSettingsSlice>): void {
  const defaultAudioConfig = getDefaultAudioConfig();
  const defaultPdfConfig = getDefaultPDFConfig();
  const defaultWebSearchConfig = getDefaultWebSearchConfig();

  if (!hasProviderId(PDF_PROVIDERS, state.pdfProviderId)) {
    state.pdfProviderId = defaultPdfConfig.pdfProviderId;
  }

  if (!hasProviderId(WEB_SEARCH_PROVIDERS, state.webSearchProviderId)) {
    state.webSearchProviderId = defaultWebSearchConfig.webSearchProviderId;
  }
  ensureBaiduSubSources(state);

  if (
    !hasProviderId(TTS_PROVIDERS, state.ttsProviderId) &&
    !(
      state.ttsProviderId &&
      isCustomTTSProvider(state.ttsProviderId) &&
      state.ttsProvidersConfig &&
      state.ttsProviderId in state.ttsProvidersConfig
    )
  ) {
    state.ttsProviderId = defaultAudioConfig.ttsProviderId;
  }

  if (
    !hasProviderId(ASR_PROVIDERS, state.asrProviderId) &&
    !(
      state.asrProviderId &&
      isCustomASRProvider(state.asrProviderId) &&
      state.asrProvidersConfig &&
      state.asrProviderId in state.asrProvidersConfig
    )
  ) {
    state.asrProviderId = defaultAudioConfig.asrProviderId;
  }
}

// ---------------------------------------------------------------------------
// Action creators
// ---------------------------------------------------------------------------

export function createAudioSetters(
  set: (
    partial:
      | Partial<AudioSettingsSlice>
      | ((state: AudioSettingsSlice) => Partial<AudioSettingsSlice>),
  ) => void,
  _get: () => AudioSettingsSlice,
): Pick<
  AudioSettingsSlice,
  | 'setTtsModel'
  | 'setTTSMuted'
  | 'setTTSVolume'
  | 'setAutoPlayLecture'
  | 'setPlaybackSpeed'
  | 'setTTSProvider'
  | 'setTTSVoice'
  | 'setTTSSpeed'
  | 'setASRProvider'
  | 'setASRLanguage'
  | 'setTTSProviderConfig'
  | 'setASRProviderConfig'
  | 'setTTSEnabled'
  | 'setASREnabled'
  | 'addCustomTTSProvider'
  | 'removeCustomTTSProvider'
  | 'addCustomASRProvider'
  | 'removeCustomASRProvider'
  | 'setPDFProvider'
  | 'setPDFProviderConfig'
  | 'setWebSearchProvider'
  | 'setWebSearchProviderConfig'
  | 'setBaiduSubSources'
> {
  return {
    // Legacy TTS setter
    setTtsModel: (model) => set({ ttsModel: model }),

    // ---- Playback controls ----
    setTTSMuted: (muted) => set({ ttsMuted: muted }),

    setTTSVolume: (volume) => set({ ttsVolume: Math.max(0, Math.min(1, volume)) }),

    setAutoPlayLecture: (autoPlay) => set({ autoPlayLecture: autoPlay }),

    setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

    // ---- Audio provider selection ----
    setTTSProvider: (providerId) =>
      set((state) => {
        // If switching provider, set default voice for that provider
        const shouldUpdateVoice = state.ttsProviderId !== providerId;
        const defaultVoice = isCustomTTSProvider(providerId)
          ? state.ttsProvidersConfig[providerId]?.customVoices?.[0]?.id || 'default'
          : DEFAULT_TTS_VOICES[providerId as BuiltInTTSProviderId] || 'default';
        return {
          ttsProviderId: providerId,
          ...(shouldUpdateVoice && { ttsVoice: defaultVoice }),
        };
      }),

    setTTSVoice: (voice) => set({ ttsVoice: voice }),

    setTTSSpeed: (speed) => set({ ttsSpeed: speed }),

    // Reset language when switching providers, since language code formats
    // differ (e.g. browser-native uses BCP-47 "en-US", OpenAI Whisper uses
    // ISO 639-1 "en")
    setASRProvider: (providerId) =>
      set((state) => {
        let supportedLanguages: string[];
        if (isCustomASRProvider(providerId)) {
          supportedLanguages = ['auto'];
        } else {
          supportedLanguages =
            ASR_PROVIDERS[providerId as keyof typeof ASR_PROVIDERS]?.supportedLanguages || [];
        }
        const isLanguageValid = supportedLanguages.includes(state.asrLanguage);
        return {
          asrProviderId: providerId,
          ...(isLanguageValid ? {} : { asrLanguage: supportedLanguages[0] || 'auto' }),
        };
      }),

    setASRLanguage: (language) => set({ asrLanguage: language }),

    // ---- Audio provider config updates ----
    setTTSProviderConfig: (providerId, config) =>
      set((state) => ({
        ttsProvidersConfig: {
          ...state.ttsProvidersConfig,
          [providerId]: {
            ...state.ttsProvidersConfig[providerId],
            ...config,
          },
        },
      })),

    setASRProviderConfig: (providerId, config) =>
      set((state) => ({
        asrProvidersConfig: {
          ...state.asrProvidersConfig,
          [providerId]: {
            ...state.asrProvidersConfig[providerId],
            ...config,
          },
        },
      })),

    // ---- Global toggles ----
    setTTSEnabled: (enabled) => set({ ttsEnabled: enabled }),

    setASREnabled: (enabled) => set({ asrEnabled: enabled }),

    // ---- Custom audio provider actions ----
    addCustomTTSProvider: (id, name, baseUrl, requiresApiKey, defaultModel) =>
      set((state) => ({
        ttsProvidersConfig: {
          ...state.ttsProvidersConfig,
          [id]: {
            apiKey: '',
            baseUrl: '',
            enabled: true,
            modelId: defaultModel || '',
            customName: name,
            customDefaultBaseUrl: baseUrl,
            customVoices: [],
            isBuiltIn: false,
            requiresApiKey,
          },
        },
        ttsProviderId: id,
      })),

    removeCustomTTSProvider: (id) =>
      set((state) => {
        if (!isCustomTTSProvider(id)) return state;
        const { [id]: _, ...rest } = state.ttsProvidersConfig;
        return {
          ttsProvidersConfig: rest as typeof state.ttsProvidersConfig,
          ...(state.ttsProviderId === id && {
            ttsProviderId: 'browser-native-tts' as TTSProviderId,
            ttsVoice: 'default',
          }),
        };
      }),

    addCustomASRProvider: (id, name, baseUrl, requiresApiKey) =>
      set((state) => ({
        asrProvidersConfig: {
          ...state.asrProvidersConfig,
          [id]: {
            apiKey: '',
            baseUrl: '',
            enabled: true,
            modelId: '',
            customModels: [],
            customName: name,
            customDefaultBaseUrl: baseUrl,
            isBuiltIn: false,
            requiresApiKey,
          },
        },
        asrProviderId: id,
      })),

    removeCustomASRProvider: (id) =>
      set((state) => {
        if (!isCustomASRProvider(id)) return state;
        const { [id]: _, ...rest } = state.asrProvidersConfig;
        return {
          asrProvidersConfig: rest as typeof state.asrProvidersConfig,
          ...(state.asrProviderId === id && {
            asrProviderId: 'browser-native' as ASRProviderId,
            asrLanguage: 'zh',
          }),
        };
      }),

    // ---- PDF actions ----
    setPDFProvider: (providerId) => set({ pdfProviderId: providerId }),

    setPDFProviderConfig: (providerId, config) =>
      set((state) => ({
        pdfProvidersConfig: {
          ...state.pdfProvidersConfig,
          [providerId]: {
            ...state.pdfProvidersConfig[providerId],
            ...config,
          },
        },
      })),

    // ---- Web Search actions ----
    setWebSearchProvider: (providerId) => set({ webSearchProviderId: providerId }),

    setWebSearchProviderConfig: (providerId, config) =>
      set((state) => ({
        webSearchProvidersConfig: {
          ...state.webSearchProvidersConfig,
          [providerId]: {
            ...state.webSearchProvidersConfig[providerId],
            ...config,
          },
        },
      })),

    setBaiduSubSources: (sources) =>
      set((state) => {
        const next = {
          ...state.baiduSubSources,
          ...sources,
        };
        if (!next.webSearch && !next.baike && !next.scholar) {
          return state;
        }
        return { baiduSubSources: next };
      }),
  };
}
