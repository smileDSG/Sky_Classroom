import type { ImageProviderId, VideoProviderId } from '@/lib/media/types';
import { IMAGE_PROVIDERS } from '@/lib/media/image-providers';
import { VIDEO_PROVIDERS } from '@/lib/media/video-providers';

export type ImageProviderConfig = {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  isServerConfigured?: boolean;
  serverBaseUrl?: string;
  customModels?: Array<{ id: string; name: string }>;
};

export type VideoProviderConfig = {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  isServerConfigured?: boolean;
  serverBaseUrl?: string;
  customModels?: Array<{ id: string; name: string }>;
};

export interface MediaSliceState {
  imageProviderId: ImageProviderId;
  imageModelId: string;
  imageProvidersConfig: Record<ImageProviderId, ImageProviderConfig>;
  videoProviderId: VideoProviderId;
  videoModelId: string;
  videoProvidersConfig: Record<VideoProviderId, VideoProviderConfig>;
  imageGenerationEnabled: boolean;
  videoGenerationEnabled: boolean;
  reviewOutlineEnabled: boolean;
}

export interface MediaSliceActions {
  setImageProvider: (providerId: ImageProviderId) => void;
  setImageModelId: (modelId: string) => void;
  setImageProviderConfig: (
    providerId: ImageProviderId,
    config: Partial<{
      apiKey: string;
      baseUrl: string;
      enabled: boolean;
      customModels: Array<{ id: string; name: string }>;
    }>,
  ) => void;
  setVideoProvider: (providerId: VideoProviderId) => void;
  setVideoModelId: (modelId: string) => void;
  setVideoProviderConfig: (
    providerId: VideoProviderId,
    config: Partial<{
      apiKey: string;
      baseUrl: string;
      enabled: boolean;
      customModels: Array<{ id: string; name: string }>;
    }>,
  ) => void;
  setImageGenerationEnabled: (enabled: boolean) => void;
  setVideoGenerationEnabled: (enabled: boolean) => void;
  setReviewOutlineEnabled: (enabled: boolean) => void;
}

export function getDefaultImageConfig() {
  return {
    imageProviderId: 'seedream' as ImageProviderId,
    imageModelId: 'doubao-seedream-5-0-260128',
    imageProvidersConfig: {
      seedream: { apiKey: '', baseUrl: '', enabled: false },
      'openai-image': { apiKey: '', baseUrl: '', enabled: false },
      'qwen-image': { apiKey: '', baseUrl: '', enabled: false },
      'nano-banana': { apiKey: '', baseUrl: '', enabled: false },
      'minimax-image': { apiKey: '', baseUrl: '', enabled: false },
      'grok-image': { apiKey: '', baseUrl: '', enabled: false },
      lemonade: { apiKey: '', baseUrl: '', enabled: false },
    } as Record<ImageProviderId, ImageProviderConfig>,
  };
}

export function getDefaultVideoConfig() {
  return {
    videoProviderId: 'seedance' as VideoProviderId,
    videoModelId: 'doubao-seedance-1-5-pro-251215',
    videoProvidersConfig: {
      seedance: { apiKey: '', baseUrl: '', enabled: false },
      kling: { apiKey: '', baseUrl: '', enabled: false },
      veo: { apiKey: '', baseUrl: '', enabled: false },
      sora: { apiKey: '', baseUrl: '', enabled: false },
      'minimax-video': { apiKey: '', baseUrl: '', enabled: false },
      'grok-video': { apiKey: '', baseUrl: '', enabled: false },
      happyhorse: { apiKey: '', baseUrl: '', enabled: false },
    } as Record<VideoProviderId, VideoProviderConfig>,
  };
}

export function getDefaultMediaState() {
  return {
    ...getDefaultImageConfig(),
    ...getDefaultVideoConfig(),
    imageGenerationEnabled: false,
    videoGenerationEnabled: false,
    reviewOutlineEnabled: false,
  };
}

export function createMediaActions(
  set: (
    partial:
      | Partial<MediaSliceState>
      | ((state: MediaSliceState) => Partial<MediaSliceState>),
  ) => void,
  get: () => MediaSliceState,
): MediaSliceActions {
  return {
    setImageProvider: (providerId) =>
      set(() => {
        const models = IMAGE_PROVIDERS[providerId]?.models || [];
        return {
          imageProviderId: providerId,
          imageModelId: models[0]?.id || '',
        };
      }),

    setImageModelId: (modelId) => set({ imageModelId: modelId }),

    setImageProviderConfig: (providerId, config) =>
      set((state) => ({
        imageProvidersConfig: {
          ...state.imageProvidersConfig,
          [providerId]: {
            ...state.imageProvidersConfig[providerId],
            ...config,
          },
        },
      })),

    setVideoProvider: (providerId) => set({ videoProviderId: providerId }),

    setVideoModelId: (modelId) => set({ videoModelId: modelId }),

    setVideoProviderConfig: (providerId, config) =>
      set((state) => ({
        videoProvidersConfig: {
          ...state.videoProvidersConfig,
          [providerId]: {
            ...state.videoProvidersConfig[providerId],
            ...config,
          },
        },
      })),

    setImageGenerationEnabled: (enabled) => {
      if (enabled) {
        const cfg = get().imageProvidersConfig;
        const hasUsable = Object.values(cfg).some(
          (c) => c.isServerConfigured || c.apiKey,
        );
        if (!hasUsable) return;
      }
      set({ imageGenerationEnabled: enabled });
    },

    setVideoGenerationEnabled: (enabled) => {
      if (enabled) {
        const cfg = get().videoProvidersConfig;
        const hasUsable = Object.values(cfg).some(
          (c) => c.isServerConfigured || c.apiKey,
        );
        if (!hasUsable) return;
      }
      set({ videoGenerationEnabled: enabled });
    },

    setReviewOutlineEnabled: (enabled) =>
      set({ reviewOutlineEnabled: enabled }),
  };
}

export function ensureBuiltInImageProviders(
  state: Partial<MediaSliceState>,
): void {
  if (!state.imageProvidersConfig) return;
  const defaultConfig = getDefaultImageConfig().imageProvidersConfig;
  for (const pid of Object.keys(IMAGE_PROVIDERS)) {
    const providerId = pid as ImageProviderId;
    if (!state.imageProvidersConfig[providerId]) {
      state.imageProvidersConfig[providerId] = defaultConfig[providerId];
    }
  }
}

export function ensureBuiltInVideoProviders(
  state: Partial<MediaSliceState>,
): void {
  if (!state.videoProvidersConfig) return;
  const defaultConfig = getDefaultVideoConfig().videoProvidersConfig;
  for (const pid of Object.keys(VIDEO_PROVIDERS)) {
    const providerId = pid as VideoProviderId;
    if (!state.videoProvidersConfig[providerId]) {
      state.videoProvidersConfig[providerId] = defaultConfig[providerId];
    }
  }
}
