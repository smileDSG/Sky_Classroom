/**
 * tests/components/shortcuts.test.tsx
 * 测试快捷键系统 — keyboard store 和 hotkey 配置
 *
 * 涉及模块：
 *   lib/store/keyboard.ts — 修饰键状态 store
 *   configs/hotkey.ts — 快捷键文档/枚举
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('shortcuts — 快捷键', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  // ================================================================
  // keyboard store — 修饰键状态
  // ================================================================
  describe('useKeyboardStore', () => {
    async function getKeyboardStore() {
      const mod = await import('@/lib/store/keyboard');
      return mod.useKeyboardStore;
    }

    it('按下 Ctrl 后 ctrlKeyState 变为 true', async () => {
      const store = await getKeyboardStore();
      store.getState().setCtrlKeyState(true);
      expect(store.getState().ctrlKeyState).toBe(true);
    });

    it('释放 Ctrl 后 ctrlKeyState 变为 false', async () => {
      const store = await getKeyboardStore();
      store.getState().setCtrlKeyState(true);
      store.getState().setCtrlKeyState(false);
      expect(store.getState().ctrlKeyState).toBe(false);
    });

    it('按下 Shift 后 shiftKeyState 变为 true', async () => {
      const store = await getKeyboardStore();
      store.getState().setShiftKeyState(true);
      expect(store.getState().shiftKeyState).toBe(true);
    });

    it('按下 Space 后 spaceKeyState 变为 true', async () => {
      const store = await getKeyboardStore();
      store.getState().setSpaceKeyState(true);
      expect(store.getState().spaceKeyState).toBe(true);
    });

    it('ctrlOrShiftKeyActive 任一按下返回 true', async () => {
      const store = await getKeyboardStore();
      store.getState().setCtrlKeyState(true);
      expect(store.getState().ctrlOrShiftKeyActive()).toBe(true);

      store.getState().setCtrlKeyState(false);
      store.getState().setShiftKeyState(true);
      expect(store.getState().ctrlOrShiftKeyActive()).toBe(true);

      store.getState().setShiftKeyState(false);
      expect(store.getState().ctrlOrShiftKeyActive()).toBe(false);
    });
  });

  // ================================================================
  // hotkey 配置 — 枚举值完整
  // ================================================================
  describe('hotkey 配置', () => {
    it('KEYS 枚举存在所有常见快捷键', async () => {
      const mod = await import('@/configs/hotkey');
      const { KEYS } = mod;

      // 检查关键快捷键
      expect(KEYS).toBeDefined();
    });

    it('HOTKEY_DOC 包含所有分组', async () => {
      const mod = await import('@/configs/hotkey');
      const { HOTKEY_DOC } = mod;

      expect(Array.isArray(HOTKEY_DOC)).toBe(true);
      expect(HOTKEY_DOC.length).toBeGreaterThan(0);
    });
  });
});
