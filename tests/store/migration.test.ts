/**
 * tests/store/migration.test.ts
 * 测试 localStorage 数据格式升级
 *
 * settings store 使用 zustand persist 中间件，支持版本迁移：
 *   v0 → v1：清理旧的硬编码默认模型
 *   v1 → v2：deepResearchProviderId → webSearchProviderId
 *   merge hook：每次恢复时合并新的 provider / 模型
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupStoreMocks, clearStorage, storage } from './mocks';

setupStoreMocks();

describe('migration — 数据格式升级', () => {
  beforeEach(async () => {
    vi.resetModules();
    clearStorage();
  });

  // 动态获取 store
  async function getStore() {
    const mod = await import('@/lib/store/settings');
    return mod.useSettingsStore;
  }

  // ================================================================
  // v0 → 当前版本
  // ================================================================
  it('v0 schema 升级后，不再有 deepResearchProviderId', async () => {
    // 构造一个 v0 格式的旧数据
    const v0State = {
      providerId: 'openai',
      modelId: 'gpt-4o',
      deepResearchProviderId: 'perplexity',
      // v0 没有 webSearchProviderId
    };

    // 写入 localStorage，version: 0
    storage.set('settings-storage', JSON.stringify({ state: v0State, version: 0 }));

    // 加载 store（zustand persist 会自动触发 migrate）
    const store = await getStore();

    // deepResearchProviderId 应该不存在（v2 迁移会删除）
    const state = store.getState() as unknown as Record<string, unknown>;
    expect(state.deepResearchProviderId).toBeUndefined();
    // webSearchProviderId 应该被设为默认值 'tavily'
    expect(state.webSearchProviderId).toBe('tavily');
  });

  // ================================================================
  // v0 旧模型被清空
  // ================================================================
  it('v0 中如果存了硬编码默认模型 gpt-4o-mini 则清空', async () => {
    const v0State = {
      providerId: 'openai',
      modelId: 'gpt-4o-mini', // 旧的硬编码默认值
    };

    storage.set('settings-storage', JSON.stringify({ state: v0State, version: 0 }));

    const store = await getStore();
    // v0 → v1 迁移会清空这个硬编码默认值
    expect(store.getState().modelId).toBe('');
  });

  // ================================================================
  // 旧 localStorage key 迁移
  // ================================================================
  it('发现旧 localStorage key 时迁移到新 key', async () => {
    // 旧版本用独立的 key 存储各项设置
    storage.set('llmModel', 'anthropic:claude-sonnet-4-6');
    storage.set('ttsModel', 'openai-tts');
    storage.set('selectedAgentIds', JSON.stringify(['agent-a', 'agent-b']));
    storage.set('maxTurns', '8');

    const store = await getStore();
    // 迁移后设置正确取到旧数据
    expect(store.getState().providerId).toBe('anthropic');
    expect(store.getState().modelId).toBe('claude-sonnet-4-6');
    expect(store.getState().selectedAgentIds).toEqual(['agent-a', 'agent-b']);
    expect(store.getState().maxTurns).toBe('8');
  });

  // ================================================================
  // 缺失 provider 不崩溃
  // ================================================================
  it('存储的 provider 已不存在时，不崩溃', async () => {
    const state = {
      providerId: 'nonexistent-provider',
      modelId: '',
    };

    storage.set('settings-storage', JSON.stringify({ state, version: 2 }));

    // 不应抛错
    const store = await getStore();
    // providerId 已被 merge hook 修复
    expect(store.getState().providerId).toBeDefined();
  });

  // ================================================================
  // 空 initial state
  // ================================================================
  it('空 localStorage 时，使用默认初始状态', async () => {
    const store = await getStore();

    // 检查默认值
    expect(store.getState().providerId).toBe('openai');
    expect(store.getState().agentMode).toBe('auto');
    expect(store.getState().ttsVolume).toBe(1);
    expect(store.getState().timelineCollapsed).toBe(true);
  });
});
