/**
 * tests/store/settings-llm.test.ts
 * 测试 LLM（大语言模型）相关设置
 *
 * 涉及的 store：useSettingsStore
 * 被测试方法：setModel, setThinkingConfig, setProviderConfig, setProvidersConfig
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupStoreMocks, clearStorage, getStore } from './mocks';

// 必须在 import store 之前设置 mock
setupStoreMocks();

describe('settings-llm — LLM 设置', () => {
  beforeEach(async () => {
    vi.resetModules();
    clearStorage();
  });

  // ================================================================
  // setModel — 设置 LLM provider 和 model
  // ================================================================
  describe('setModel', () => {
    it('同时设置 providerId 和 modelId', async () => {
      const store = await getStore();
      store.getState().setModel('openai', 'gpt-4o');

      const state = store.getState();
      expect(state.providerId).toBe('openai');
      expect(state.modelId).toBe('gpt-4o');
    });

    it('可以切换到其他 provider', async () => {
      const store = await getStore();
      store.getState().setModel('openai', 'gpt-4o');
      store.getState().setModel('anthropic', 'claude-sonnet-4-6');

      const state = store.getState();
      expect(state.providerId).toBe('anthropic');
      expect(state.modelId).toBe('claude-sonnet-4-6');
    });
  });

  // ================================================================
  // setThinkingConfig — 思维预算配置
  // ================================================================
  describe('setThinkingConfig', () => {
    it('设置思维预算配置', async () => {
      const store = await getStore();
      store.getState().setThinkingConfig('openai', 'gpt-4o', {
        budgetTokens: 8000,
        mode: 'enabled',
      });

      const config = store.getState().thinkingConfigs['openai:gpt-4o'];
      expect(config).toBeDefined();
      expect(config.budgetTokens).toBe(8000);
      expect(config.mode).toBe('enabled');
    });

    it('传入 undefined 清理思维配置', async () => {
      const store = await getStore();
      // 先设置
      store.getState().setThinkingConfig('openai', 'gpt-4o', {
        budgetTokens: 8000,
        mode: 'enabled',
      });
      // 再清除
      store.getState().setThinkingConfig('openai', 'gpt-4o', undefined);

      const key = 'openai:gpt-4o';
      expect(store.getState().thinkingConfigs[key]).toBeUndefined();
    });

    it('不同模型的思维配置互不影响', async () => {
      const store = await getStore();
      store.getState().setThinkingConfig('openai', 'gpt-4o', {
        budgetTokens: 4000,
      });
      store.getState().setThinkingConfig('anthropic', 'claude-sonnet-4-6', {
        budgetTokens: 16000,
      });

      const configs = store.getState().thinkingConfigs;
      expect(configs['openai:gpt-4o']?.budgetTokens).toBe(4000);
      expect(configs['anthropic:claude-sonnet-4-6']?.budgetTokens).toBe(16000);
    });
  });

  // ================================================================
  // setProviderConfig — 更新单个 provider 配置
  // ================================================================
  describe('setProviderConfig', () => {
    it('只更新指定 provider 的配置，不影响其他', async () => {
      const store = await getStore();
      store.getState().setProviderConfig('openai', { apiKey: 'sk-test-key' });

      const openaiConfig = store.getState().providersConfig.openai;
      const anthropicConfig = store.getState().providersConfig.anthropic;

      expect(openaiConfig.apiKey).toBe('sk-test-key');
      // anthropic 不应被影响
      expect(anthropicConfig).toBeDefined();
      expect(anthropicConfig.apiKey).toBe('');
    });

    it('可以分别更新多个 provider', async () => {
      const store = await getStore();
      store.getState().setProviderConfig('openai', { apiKey: 'sk-openai' });
      store.getState().setProviderConfig('anthropic', { apiKey: 'sk-anthropic' });

      expect(store.getState().providersConfig.openai.apiKey).toBe('sk-openai');
      expect(store.getState().providersConfig.anthropic.apiKey).toBe(
        'sk-anthropic',
      );
    });
  });

  // ================================================================
  // setProvidersConfig — 全部替换 provider 配置
  // ================================================================
  describe('setProvidersConfig', () => {
    it('用新对象完全替换配置', async () => {
      const store = await getStore();
      const newConfig = {
        ...store.getState().providersConfig,
        openai: {
          ...store.getState().providersConfig.openai,
          apiKey: 'sk-replaced',
          baseUrl: 'https://custom-proxy.example.com/v1',
        },
      };

      store.getState().setProvidersConfig(newConfig);

      const config = store.getState().providersConfig.openai;
      expect(config.apiKey).toBe('sk-replaced');
      expect(config.baseUrl).toBe('https://custom-proxy.example.com/v1');
    });
  });

  // ================================================================
  // getThinkingConfigKey — 工具函数
  // ================================================================
  describe('getThinkingConfigKey', () => {
    it('key 格式为 providerId:modelId', async () => {
      const { getThinkingConfigKey } = await import('@/lib/ai/thinking-config');
      expect(getThinkingConfigKey('openai', 'gpt-4o')).toBe('openai:gpt-4o');
    });
  });
});
