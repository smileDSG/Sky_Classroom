/**
 * 共享 mock 定义 — 所有 store 测试文件都会用到
 *
 * 使用方法：在每个测试文件顶部：
 *   import { setupStoreMocks, clearStorage } from './mocks';
 *   setupStoreMocks();   // 必须在 import store 之前调用（vitest 会自动 hoist vi.mock）
 */

import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// ================================================================
// localStorage 假对象 — 模拟浏览器的 localStorage
// ================================================================
export const storage = new Map<string, string>();

export function mockLocalStorage() {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
    removeItem: vi.fn((key: string) => storage.delete(key)),
    clear: vi.fn(() => storage.clear()),
    get length() {
      return storage.size;
    },
    key: vi.fn(() => null),
  });
}

export function clearStorage() {
  storage.clear();
}

// ================================================================
// 把所有 provider 注册表的 mock 集中在这里
// ================================================================
export function setupStoreMocks() {
  // --- LLM provider ---
  vi.mock('@/lib/ai/providers', () => ({
    PROVIDERS: {
      openai: {
        id: 'openai',
        name: 'OpenAI',
        type: 'openai',
        defaultBaseUrl: 'https://api.openai.com/v1',
        requiresApiKey: true,
        icon: '/logos/openai.svg',
        models: [
          {
            id: 'gpt-4o',
            name: 'GPT-4o',
            capabilities: {
              thinking: {
                control: 'budget-only' as const,
                requestAdapter: 'openai' as const,
                defaultBudgetTokens: 4000,
                budgetRange: { min: 1000, max: 32000 },
              },
            },
          },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        ],
      },
      anthropic: {
        id: 'anthropic',
        name: 'Anthropic',
        type: 'anthropic',
        defaultBaseUrl: 'https://api.anthropic.com',
        requiresApiKey: true,
        icon: '/logos/anthropic.svg',
        models: [
          {
            id: 'claude-sonnet-4-6',
            name: 'Claude Sonnet 4.6',
            capabilities: {
              thinking: {
                control: 'budget-only' as const,
                requestAdapter: 'anthropic' as const,
                defaultBudgetTokens: 16000,
                budgetRange: { min: 1000, max: 32000 },
              },
            },
          },
        ],
      },
    },
  }));

  // --- 音频 provider ---
  vi.mock('@/lib/audio/constants', () => ({
    TTS_PROVIDERS: {
      'openai-tts': {
        id: 'openai-tts',
        name: 'OpenAI TTS',
        defaultBaseUrl: 'https://api.openai.com/v1',
        requiresApiKey: true,
        voices: [
          { id: 'alloy', name: 'Alloy' },
          { id: 'echo', name: 'Echo' },
        ],
      },
      'browser-native-tts': {
        id: 'browser-native-tts',
        name: 'Browser Native',
        voices: [],
        requiresApiKey: false,
      },
      'azure-tts': {
        id: 'azure-tts',
        name: 'Azure TTS',
        defaultBaseUrl: '',
        requiresApiKey: true,
        voices: [{ id: 'zh-CN-XiaoxiaoNeural', name: 'Xiaoxiao' }],
      },
    },
    DEFAULT_TTS_VOICES: {
      'openai-tts': 'alloy',
      'azure-tts': 'zh-CN-XiaoxiaoNeural',
      'browser-native-tts': 'default',
    },
    ASR_PROVIDERS: {
      'browser-native': {
        id: 'browser-native',
        name: 'Browser Native',
        supportedLanguages: ['zh', 'en', 'auto'],
      },
      'openai-whisper': {
        id: 'openai-whisper',
        name: 'OpenAI Whisper',
        supportedLanguages: ['en', 'ja'],
      },
    },
  }));

  // --- VoxCPM ---
  vi.mock('@/lib/audio/voxcpm', () => ({
    DEFAULT_VOXCPM_BACKEND: 'voxcpm',
    VOXCPM_MODEL_ID: 'voxcpm-1',
    VOXCPM_VLLM_MODEL_ID: 'voxcpm-vllm',
  }));

  // --- PDF ---
  vi.mock('@/lib/pdf/constants', () => ({
    PDF_PROVIDERS: {
      unpdf: { id: 'unpdf', name: 'UnPDF', requiresApiKey: false },
      mineru: { id: 'mineru', name: 'MinerU', requiresApiKey: true },
    },
  }));

  // --- 图片生成 ---
  vi.mock('@/lib/media/image-providers', () => ({
    IMAGE_PROVIDERS: {
      'openai-image': {
        id: 'openai-image',
        name: 'OpenAI',
        models: [{ id: 'dall-e-3', name: 'DALL-E 3' }],
      },
    },
  }));

  // --- 视频生成 ---
  vi.mock('@/lib/media/video-providers', () => ({
    VIDEO_PROVIDERS: {
      kling: {
        id: 'kling',
        name: 'Kling',
        models: [{ id: 'kling-v1', name: 'Kling v1' }],
      },
    },
  }));

  // --- 网络搜索 ---
  vi.mock('@/lib/web-search/constants', () => ({
    WEB_SEARCH_PROVIDERS: {
      tavily: { id: 'tavily', name: 'Tavily', requiresApiKey: true },
      brave: {
        id: 'brave',
        name: 'Brave',
        requiresApiKey: false,
        defaultBaseUrl: 'https://api.search.brave.com',
      },
    },
  }));

  // --- logger ---
  vi.mock('@/lib/logger', () => ({
    createLogger: () => ({
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  }));

  // --- localStorage ---
  mockLocalStorage();
}

/**
 * 动态加载 store（配合 vi.resetModules() 使用）
 * 每次调用都会重新加载一个干净的 store 实例
 */
export async function getStore() {
  const mod = await import('@/lib/store/settings');
  return mod.useSettingsStore;
}
