/**
 * tests/store/import-export.test.ts
 * 测试设置的 JSON 导入/导出功能
 *
 * 核心验证：导出 → 修改 → 导入 → 再次导出 → 两次 JSON 内容一致（往返数据一致）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupStoreMocks, clearStorage, getStore } from './mocks';

setupStoreMocks();

describe('import-export — 设置导入导出', () => {
  beforeEach(async () => {
    vi.resetModules();
    clearStorage();
  });

  // 获取 import/export 函数
  async function getImportExport() {
    const mod = await import('@/lib/store/settings');
    return {
      exportSettings: mod.exportSettings,
      importSettings: mod.importSettings,
      useSettingsStore: mod.useSettingsStore,
    };
  }

  // ================================================================
  // exportSettings
  // ================================================================
  it('exportSettings 返回有效 JSON 字符串', async () => {
    const { exportSettings } = await getImportExport();
    const json = exportSettings();

    // 能成功 parse 回来
    const parsed = JSON.parse(json);
    expect(parsed).toBeDefined();
    expect(typeof parsed).toBe('object');
  });

  it('导出的 JSON 包含关键字段', async () => {
    const { exportSettings, useSettingsStore } = await getImportExport();
    // 先设置一些值
    useSettingsStore.getState().setModel('openai', 'gpt-4o');
    useSettingsStore.getState().setTTSVolume(0.7);

    const json = exportSettings();
    const parsed = JSON.parse(json);

    expect(parsed.providerId).toBe('openai');
    expect(parsed.modelId).toBe('gpt-4o');
    expect(parsed.ttsVolume).toBe(0.7);
  });

  // ================================================================
  // importSettings
  // ================================================================
  it('importSettings 正确恢复设置', async () => {
    const { importSettings, useSettingsStore } = await getImportExport();

    // 导入一段 JSON
    const imported = JSON.stringify({
      providerId: 'anthropic',
      modelId: 'claude-sonnet-4-6',
      ttsVolume: 0.5,
    });
    importSettings(imported);

    const state = useSettingsStore.getState();
    expect(state.providerId).toBe('anthropic');
    expect(state.modelId).toBe('claude-sonnet-4-6');
    expect(state.ttsVolume).toBe(0.5);
  });

  // ================================================================
  // 往返测试（核心）
  // ================================================================
  it('往返测试：导出 → 修改 → 导入 → 导出 → JSON 一致', async () => {
    const { exportSettings, importSettings, useSettingsStore } =
      await getImportExport();

    // 1. 先导出原始状态
    const original = exportSettings();

    // 2. 修改一些值
    useSettingsStore.getState().setModel('anthropic', 'claude-sonnet-4-6');
    useSettingsStore.getState().setTTSVolume(0.3);
    useSettingsStore.getState().setTTSVoice('echo');

    // 3. 导入回原始数据
    importSettings(original);

    // 4. 再次导出
    const restored = exportSettings();

    // 5. 应该和原始一致
    expect(restored).toBe(original);
  });

  // ================================================================
  // 非法 JSON
  // ================================================================
  it('传入非法 JSON 字符串时抛出错误', async () => {
    const { importSettings } = await getImportExport();

    expect(() => importSettings('这不是有效的 json{{{')).toThrow();
  });
});
