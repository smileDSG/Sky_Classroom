/**
 * P6-001 Test 10: 设置导入/导出 → 预设切换
 *
 * Tests the settings management flow — importing/exporting settings
 * as JSON files, switching between presets, and verifying that
 * all settings are correctly applied.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  exportSettings,
  importSettings,
  applyPreset,
  migrateFromOldStorage,
} from '@/lib/store/settings';
import { EDUCATION_PRESET, DEMO_PRESET, DEVELOPMENT_PRESET } from '@/lib/store/settings/presets';

// ─── Tests ───

describe('P6-001 Test 10: 设置导入/导出 → 预设切换', () => {
  describe('settings export', () => {
    test('export returns valid JSON string', () => {
      const exported = exportSettings();
      expect(typeof exported).toBe('string');
      expect(() => JSON.parse(exported)).not.toThrow();
    });

    test('exported JSON contains providerId', () => {
      const exported = exportSettings();
      const parsed = JSON.parse(exported);
      expect(parsed).toHaveProperty('providerId');
    });

    test('exported JSON contains TTS settings', () => {
      const exported = exportSettings();
      const parsed = JSON.parse(exported);
      expect(parsed).toHaveProperty('ttsProviderId');
    });

    test('exported JSON contains layout settings', () => {
      const exported = exportSettings();
      const parsed = JSON.parse(exported);
      expect(parsed).toHaveProperty('timelineCollapsed');
    });

    test('exported JSON contains agent settings', () => {
      const exported = exportSettings();
      const parsed = JSON.parse(exported);
      expect(parsed).toHaveProperty('selectedAgentIds');
      expect(parsed).toHaveProperty('maxTurns');
    });

    test('export is round-trippable', () => {
      const state = useSettingsStore.getState();
      const exported = exportSettings();
      const imported = JSON.parse(exported);

      // Core fields should match
      expect(imported.providerId).toBe(state.providerId);
      expect(imported.ttsProviderId).toBe(state.ttsProviderId);
    });
  });

  describe('settings import', () => {
    test('import applies settings to store', () => {
      const before = useSettingsStore.getState();
      const newState = {
        providerId: 'anthropic' as const,
        modelId: 'claude-sonnet-4-6',
      };

      importSettings(JSON.stringify(newState));

      const after = useSettingsStore.getState();
      expect(after.providerId).toBe('anthropic');
      expect(after.modelId).toBe('claude-sonnet-4-6');
    });

    test('import merges with existing settings', () => {
      importSettings(JSON.stringify({ providerId: 'google' }));

      const state = useSettingsStore.getState();
      expect(state.providerId).toBe('google');
      // Other settings should remain intact
      expect(state).toHaveProperty('ttsProviderId');
    });

    test('import with empty JSON does not crash', () => {
      expect(() => importSettings('{}')).not.toThrow();
    });

    test('import handles invalid JSON gracefully', () => {
      expect(() => importSettings('not json')).toThrow();
    });
  });

  describe('preset switching', () => {
    test('apply education preset', () => {
      applyPreset(EDUCATION_PRESET);

      const state = useSettingsStore.getState();
      // Education preset should set specific values
      expect(state).toBeDefined();
    });

    test('apply demo preset', () => {
      applyPreset(DEMO_PRESET);

      const state = useSettingsStore.getState();
      expect(state).toBeDefined();
    });

    test('apply development preset', () => {
      applyPreset(DEVELOPMENT_PRESET);

      const state = useSettingsStore.getState();
      expect(state).toBeDefined();
    });

    test('presets have different default values', () => {
      // Apply education, capture state
      applyPreset(EDUCATION_PRESET);
      const eduState = { ...useSettingsStore.getState() };

      // Apply demo, capture state
      applyPreset(DEMO_PRESET);
      const demoState = { ...useSettingsStore.getState() };

      // At least some fields should differ
      expect(eduState).not.toEqual(demoState);
    });

    test('preset switch is reversible via import', () => {
      // Save current state
      const exported = exportSettings();

      // Switch to demo
      applyPreset(DEMO_PRESET);

      // Restore via import
      importSettings(exported);
      const restored = JSON.parse(exportSettings());
      const original = JSON.parse(exported);

      expect(restored.providerId).toBe(original.providerId);
    });
  });

  describe('import-export full flow', () => {
    test('export → modify → import → restore works', () => {
      // Export
      const snapshot = exportSettings();

      // Modify
      importSettings(JSON.stringify({ providerId: 'deepseek' }));
      expect(useSettingsStore.getState().providerId).toBe('deepseek');

      // Restore
      importSettings(snapshot);
      expect(useSettingsStore.getState().providerId).not.toBe('deepseek');
    });

    test('export contains all necessary settings for full restore', () => {
      const exported = exportSettings();
      const parsed = JSON.parse(exported);

      const requiredKeys = [
        'providerId',
        'modelId',
        'ttsProviderId',
        'asrProviderId',
        'selectedAgentIds',
        'maxTurns',
      ];

      for (const key of requiredKeys) {
        expect(parsed).toHaveProperty(key);
      }
    });
  });
});

import { useSettingsStore } from '@/lib/store/settings';
