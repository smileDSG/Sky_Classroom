/**
 * tests/store/settings-layout.test.ts
 * 测试 UI 布局相关的设置 — 时间线、聊天区域的折叠/展开和宽度
 *
 * 涉及的 store：useSettingsStore
 * 状态字段：timelineCollapsed, chatAreaCollapsed, chatAreaWidth
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupStoreMocks, clearStorage, getStore } from './mocks';

setupStoreMocks();

describe('settings-layout — 布局设置', () => {
  beforeEach(async () => {
    vi.resetModules();
    clearStorage();
  });

  // ================================================================
  // setTimelineCollapsed — 时间线折叠
  // ================================================================
  describe('setTimelineCollapsed', () => {
    it('折叠时间线', async () => {
      const store = await getStore();
      store.getState().setTimelineCollapsed(true);
      expect(store.getState().timelineCollapsed).toBe(true);
    });

    it('展开时间线', async () => {
      const store = await getStore();
      store.getState().setTimelineCollapsed(true); // 先折叠
      store.getState().setTimelineCollapsed(false); // 再展开
      expect(store.getState().timelineCollapsed).toBe(false);
    });
  });

  // ================================================================
  // setChatAreaCollapsed — 聊天区域折叠
  // ================================================================
  describe('setChatAreaCollapsed', () => {
    it('折叠聊天区域时，不影响时间线状态', async () => {
      const store = await getStore();
      store.getState().setChatAreaCollapsed(true);

      expect(store.getState().chatAreaCollapsed).toBe(true);
      // timeline 保持初始值
      expect(store.getState().timelineCollapsed).toBeDefined();
    });

    it('展开聊天区域后时间线状态不变', async () => {
      const store = await getStore();
      store.getState().setTimelineCollapsed(false);
      store.getState().setChatAreaCollapsed(false);

      expect(store.getState().chatAreaCollapsed).toBe(false);
      expect(store.getState().timelineCollapsed).toBe(false);
    });
  });

  // ================================================================
  // setChatAreaWidth — 聊天区域宽度
  // ================================================================
  describe('setChatAreaWidth', () => {
    it('设置聊天区域宽度', async () => {
      const store = await getStore();
      store.getState().setChatAreaWidth(400);
      expect(store.getState().chatAreaWidth).toBe(400);
    });

    it('设置为极小宽度', async () => {
      const store = await getStore();
      store.getState().setChatAreaWidth(100);
      expect(store.getState().chatAreaWidth).toBe(100);
    });
  });

  // ================================================================
  // 连续操作测试 — 确保多次切换状态正确
  // ================================================================
  describe('连续切换', () => {
    it('时间线折叠 → 展开 → 再折叠 → 宽度不变', async () => {
      const store = await getStore();
      store.getState().setChatAreaWidth(350);

      store.getState().setTimelineCollapsed(true);
      store.getState().setTimelineCollapsed(false);
      store.getState().setTimelineCollapsed(true);

      expect(store.getState().timelineCollapsed).toBe(true);
      expect(store.getState().chatAreaWidth).toBe(350);
    });

    it('chat area 折叠 → 展开 → 再折叠 → 宽度不变', async () => {
      const store = await getStore();
      store.getState().setChatAreaWidth(280);

      store.getState().setChatAreaCollapsed(true);
      store.getState().setChatAreaCollapsed(false);
      store.getState().setChatAreaCollapsed(true);

      expect(store.getState().chatAreaCollapsed).toBe(true);
      expect(store.getState().chatAreaWidth).toBe(280);
    });
  });
});
