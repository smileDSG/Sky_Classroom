/**
 * tests/store/settings-audio.test.ts
 * 测试 TTS（文字转语音）和 ASR（语音识别）的设置
 *
 * 涉及的 store：useSettingsStore
 * 被测试方法：setTTSProvider, setTTSVoice, setTTSSpeed, setTTSVolume,
 *   setTTSMuted, setASRProvider, setASRLanguage, addCustomTTSProvider,
 *   removeCustomTTSProvider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupStoreMocks, clearStorage, getStore } from './mocks';

// ⚠️ 必须在 import store 之前设置 mock
setupStoreMocks();

describe('settings-audio — 音频设置', () => {
  beforeEach(async () => {
    // 每个测试前：清除模块缓存 + 清除 localStorage + 重新加载 store
    vi.resetModules();
    clearStorage();
  });

  // ================================================================
  // TTS provider 相关测试
  // ================================================================
  describe('setTTSProvider', () => {
    it('切换 TTS 引擎时，语音自动重置为该引擎的默认值', async () => {
      const store = await getStore();
      const { setTTSProvider } = store.getState();

      // 先设为 OpenAI TTS，选一个非默认语音
      store.getState().setTTSVoice('echo');
      // 切换到 Azure TTS → voice 应该重置为 azure 的默认值
      setTTSProvider('azure-tts');

      const state = store.getState();
      expect(state.ttsProviderId).toBe('azure-tts');
      expect(state.ttsVoice).toBe('zh-CN-XiaoxiaoNeural');
    });

    it('切换到同一个引擎时，语音不变', async () => {
      const store = await getStore();
      // 先切换到 openai-tts 并设置 voice
      store.getState().setTTSProvider('openai-tts');
      store.getState().setTTSVoice('echo');
      // 再次切到同一个 provider — voice 不应被重置
      store.getState().setTTSProvider('openai-tts');

      expect(store.getState().ttsVoice).toBe('echo');
    });
  });

  // ================================================================
  // TTS voice / speed 测试
  // ================================================================
  describe('setTTSVoice & setTTSSpeed', () => {
    it('设置 TTS 语音', async () => {
      const store = await getStore();
      store.getState().setTTSVoice('alloy');
      expect(store.getState().ttsVoice).toBe('alloy');
    });

    it('设置 TTS 语速', async () => {
      const store = await getStore();
      store.getState().setTTSSpeed(1.5);
      expect(store.getState().ttsSpeed).toBe(1.5);
    });
  });

  // ================================================================
  // 音量 clamp 测试
  // ================================================================
  describe('setTTSVolume — 音量钳位', () => {
    it('正常音量值直接设置', async () => {
      const store = await getStore();
      store.getState().setTTSVolume(0.5);
      expect(store.getState().ttsVolume).toBe(0.5);
    });

    it('负数被钳位到 0', async () => {
      const store = await getStore();
      store.getState().setTTSVolume(-0.5);
      expect(store.getState().ttsVolume).toBe(0);
    });

    it('大于 1 被钳位到 1', async () => {
      const store = await getStore();
      store.getState().setTTSVolume(1.5);
      expect(store.getState().ttsVolume).toBe(1);
    });
  });

  // ================================================================
  // 静音测试
  // ================================================================
  describe('setTTSMuted', () => {
    it('设置静音时，音量值保留不变', async () => {
      const store = await getStore();
      store.getState().setTTSVolume(0.8);
      store.getState().setTTSMuted(true);

      expect(store.getState().ttsMuted).toBe(true);
      expect(store.getState().ttsVolume).toBe(0.8); // 音量仍保留
    });

    it('取消静音时，恢复之前的音量', async () => {
      const store = await getStore();
      store.getState().setTTSVolume(0.6);
      store.getState().setTTSMuted(true);
      store.getState().setTTSMuted(false);

      expect(store.getState().ttsMuted).toBe(false);
      expect(store.getState().ttsVolume).toBe(0.6);
    });
  });

  // ================================================================
  // ASR provider 测试
  // ================================================================
  describe('setASRProvider', () => {
    it('切换 ASR 引擎时，语言重置为第一个支持的语言', async () => {
      const store = await getStore();
      store.getState().setASRLanguage('zh');
      // whisper 支持 ['en', 'ja']，zh 不在其中
      store.getState().setASRProvider('openai-whisper');

      const state = store.getState();
      expect(state.asrProviderId).toBe('openai-whisper');
      expect(state.asrLanguage).toBe('en'); // whisper 的第一个语言
    });

    it('切换 ASR 引擎时，当前语言兼容则保留', async () => {
      const store = await getStore();
      store.getState().setASRLanguage('en');
      // browser-native 支持 ['zh', 'en', 'auto']，en 在其中
      store.getState().setASRProvider('browser-native');

      expect(store.getState().asrLanguage).toBe('en'); // 保留
    });
  });

  describe('setASRLanguage', () => {
    it('设置 ASR 语言', async () => {
      const store = await getStore();
      store.getState().setASRLanguage('zh');
      expect(store.getState().asrLanguage).toBe('zh');
    });
  });

  // ================================================================
  // 自定义 TTS provider 测试
  // ================================================================
  describe('addCustomTTSProvider & removeCustomTTSProvider', () => {
    it('添加自定义 TTS 引擎', async () => {
      const store = await getStore();
      store.getState().addCustomTTSProvider(
        'custom-tts-1' as any,
        '我的 TTS',
        'http://localhost:8080',
        false,
        'my-model',
      );

      const cfg = store.getState().ttsProvidersConfig['custom-tts-1' as any];
      expect(cfg).toBeDefined();
      expect(cfg.customName).toBe('我的 TTS');
      expect(cfg.customDefaultBaseUrl).toBe('http://localhost:8080');
      expect(cfg.modelId).toBe('my-model');
    });

    it('添加后自动切换为当前 provider', async () => {
      const store = await getStore();
      store.getState().addCustomTTSProvider(
        'custom-tts-2' as any,
        '测试',
        'http://localhost:9090',
        false,
      );

      expect(store.getState().ttsProviderId).toBe('custom-tts-2');
    });

    it('删除自定义 TTS 引擎后回退到浏览器原生引擎', async () => {
      const store = await getStore();
      // 先添加一个自定义 provider（addCustomTTSProvider 会自动切换为它）
      const customId = 'custom-tts-del' as any;
      store.getState().addCustomTTSProvider(
        customId,
        '待删除',
        'http://localhost:7070',
        false,
      );
      // 确认当前是它（addCustomTTSProvider 会 set ttsProviderId）
      expect(store.getState().ttsProviderId).toBe(customId);

      // 删除它 → 回退到 browser-native-tts
      store.getState().removeCustomTTSProvider(customId);

      expect(store.getState().ttsProviderId).toBe('browser-native-tts');
      expect(store.getState().ttsProvidersConfig[customId]).toBeUndefined();
    });
  });
});
