/**
 * tests/store/presets.test.ts
 * 测试设置预设系统 — 切换预设后所有值是否正确
 *
 * 预设定义在 lib/store/settings.ts 中：
 *   DEFAULT_PRESET — 默认设置
 *   DEMO_PRESET — 演示模式（关 TTS/ASR，开侧边栏）
 *   COLLAB_PRESET — 协作模式（开聊天区、TTS、自动代理）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupStoreMocks, clearStorage, getStore } from './mocks';

setupStoreMocks();

describe('presets — 设置预设', () => {
  beforeEach(async () => {
    vi.resetModules();
    clearStorage();
  });

  async function getPresets() {
    const mod = await import('@/lib/store/settings');
    return {
      DEFAULT_PRESET: mod.DEFAULT_PRESET,
      DEMO_PRESET: mod.DEMO_PRESET,
      COLLAB_PRESET: mod.COLLAB_PRESET,
      ALL_PRESETS: mod.ALL_PRESETS,
      applyPreset: mod.applyPreset,
      useSettingsStore: mod.useSettingsStore,
    };
  }

  // ================================================================
  // 预设数量
  // ================================================================
  it('共有 3 个预设', async () => {
    const { ALL_PRESETS } = await getPresets();
    expect(ALL_PRESETS).toHaveLength(3);
  });

  // ================================================================
  // DEFAULT_PRESET — 默认预设
  // ================================================================
  it('默认预设：恢复到出厂值', async () => {
    const { DEFAULT_PRESET, applyPreset, useSettingsStore } =
      await getPresets();

    // 先打乱设置
    useSettingsStore.getState().setTTSMuted(true);
    useSettingsStore.getState().setTTSVolume(0.2);
    useSettingsStore.getState().setAgentMode('auto');

    // 应用默认预设
    applyPreset(DEFAULT_PRESET);

    const s = useSettingsStore.getState();
    expect(s.agentMode).toBe('preset');
    expect(s.ttsMuted).toBe(false);
    expect(s.ttsVolume).toBe(1);
    expect(s.timelineCollapsed).toBe(true);
  });

  // ================================================================
  // DEMO_PRESET — 演示模式
  // ================================================================
  it('演示预设：关 TTS/ASR，开侧边栏', async () => {
    const { DEMO_PRESET, applyPreset, useSettingsStore } =
      await getPresets();

    applyPreset(DEMO_PRESET);

    const s = useSettingsStore.getState();
    // 演示模式的特征
    expect(s.ttsMuted).toBe(true);
    expect(s.ttsEnabled).toBe(false);
    expect(s.asrEnabled).toBe(false);
    expect(s.timelineCollapsed).toBe(false);
    // 未涉及的字段应保持或不变
    expect(s.chatAreaCollapsed).toBe(true);
  });

  // ================================================================
  // COLLAB_PRESET — 协作模式
  // ================================================================
  it('协作预设：开聊天区、TTS 开启、自动代理', async () => {
    const { COLLAB_PRESET, applyPreset, useSettingsStore } =
      await getPresets();

    applyPreset(COLLAB_PRESET);

    const s = useSettingsStore.getState();
    // 协作模式的特征
    expect(s.ttsMuted).toBe(false);
    expect(s.ttsEnabled).toBe(true);
    expect(s.chatAreaCollapsed).toBe(false);
    expect(s.chatAreaWidth).toBe(400);
    expect(s.agentMode).toBe('auto');
    expect(s.autoAgentCount).toBe(5);
  });

  // ================================================================
  // 预设之间切换
  // ================================================================
  it('预设 A → 预设 B → 完全替换', async () => {
    const { DEMO_PRESET, COLLAB_PRESET, applyPreset, useSettingsStore } =
      await getPresets();

    // 先应用演示
    applyPreset(DEMO_PRESET);
    expect(useSettingsStore.getState().ttsEnabled).toBe(false);

    // 再切到协作
    applyPreset(COLLAB_PRESET);
    expect(useSettingsStore.getState().ttsEnabled).toBe(true);
    expect(useSettingsStore.getState().agentMode).toBe('auto');
  });
});
