/**
 * tests/components/canvas-hooks.test.tsx
 * 测试 Canvas store — pan / zoom / selection / 教学特效
 *
 * 被测试模块：lib/store/canvas.ts → useCanvasStore
 * canvas store 管理画布编辑器的全部 UI 状态
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('canvas-hooks — 画布交互', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function getCanvasStore() {
    const mod = await import('@/lib/store/canvas');
    return mod.useCanvasStore;
  }

  // ================================================================
  // viewport — 视口
  // ================================================================
  describe('viewport', () => {
    it('setCanvasScale 设置画布缩放比', async () => {
      const store = await getCanvasStore();
      store.getState().setCanvasScale(1.5);
      expect(store.getState().canvasScale).toBe(1.5);
    });

    it('setViewportSize 设置视口基准宽度', async () => {
      const store = await getCanvasStore();
      store.getState().setViewportSize(1200);
      expect(store.getState().viewportSize).toBe(1200);
    });

    it('setCanvasPercentage 设置画布百分比', async () => {
      const store = await getCanvasStore();
      store.getState().setCanvasPercentage(75);
      expect(store.getState().canvasPercentage).toBe(75);
    });

    it('setCanvasDragged 标记画布被拖拽', async () => {
      const store = await getCanvasStore();
      store.getState().setCanvasDragged(true);
      expect(store.getState().canvasDragged).toBe(true);
      store.getState().setCanvasDragged(false);
      expect(store.getState().canvasDragged).toBe(false);
    });

    it('setViewportRatio 设置视口宽高比', async () => {
      const store = await getCanvasStore();
      store.getState().setViewportRatio(0.75); // 4:3
      expect(store.getState().viewportRatio).toBe(0.75);
    });
  });

  // ================================================================
  // selection — 元素选择
  // ================================================================
  describe('selection', () => {
    it('setActiveElementIdList 选中多个元素', async () => {
      const store = await getCanvasStore();
      store.getState().setActiveElementIdList(['el-1', 'el-2']);
      expect(store.getState().activeElementIdList).toEqual(['el-1', 'el-2']);
    });

    it('单选时自动设置 handleElementId', async () => {
      const store = await getCanvasStore();
      store.getState().setActiveElementIdList(['el-only']);
      expect(store.getState().handleElementId).toBe('el-only');
    });

    it('多选时 handleElementId 为空', async () => {
      const store = await getCanvasStore();
      store.getState().setActiveElementIdList(['a', 'b']);
      expect(store.getState().handleElementId).toBe('');
    });

    it('clearSelection 清除所有选择', async () => {
      const store = await getCanvasStore();
      store.getState().setActiveElementIdList(['el-1', 'el-2']);
      store.getState().clearSelection();
      expect(store.getState().activeElementIdList).toEqual([]);
      expect(store.getState().handleElementId).toBe('');
      expect(store.getState().editingElementId).toBe('');
    });
  });

  // ================================================================
  // spotlight — 聚光灯（教学特效）
  // ================================================================
  describe('spotlight', () => {
    it('setSpotlight 设置聚光灯到指定元素', async () => {
      const store = await getCanvasStore();
      store.getState().setSpotlight('slide-element-1');
      expect(store.getState().spotlightElementId).toBe('slide-element-1');
    });

    it('setSpotlight 可带 options（半径/暗度/动画时长）', async () => {
      const store = await getCanvasStore();
      store.getState().setSpotlight('el-1', { radius: 80, dimness: 0.5 });
      expect(store.getState().spotlightElementId).toBe('el-1');
      // store 自动补了默认值 transition=300
      expect(store.getState().spotlightOptions).toMatchObject({
        radius: 80,
        dimness: 0.5,
      });
    });

    it('clearSpotlight 清除聚光灯', async () => {
      const store = await getCanvasStore();
      store.getState().setSpotlight('el-1');
      store.getState().clearSpotlight();
      expect(store.getState().spotlightElementId).toBe('');
      expect(store.getState().spotlightOptions).toBeNull();
    });
  });

  // ================================================================
  // highlight — 高亮（教学特效）
  // ================================================================
  describe('highlight', () => {
    it('setHighlight 高亮指定元素', async () => {
      const store = await getCanvasStore();
      store.getState().setHighlight(['el-a', 'el-b']);
      expect(store.getState().highlightedElementIds).toEqual(['el-a', 'el-b']);
    });

    it('setHighlight 可带 options（颜色/透明度/边框）', async () => {
      const store = await getCanvasStore();
      store.getState().setHighlight(['el-1'], {
        color: '#ff0000',
        opacity: 0.8,
        borderWidth: 3,
      });
      // store 自动补了默认值 animated=true
      expect(store.getState().highlightOptions).toMatchObject({
        color: '#ff0000',
        opacity: 0.8,
        borderWidth: 3,
      });
    });

    it('clearHighlight 清除高亮', async () => {
      const store = await getCanvasStore();
      store.getState().setHighlight(['el-1']);
      store.getState().clearHighlight();
      expect(store.getState().highlightedElementIds).toEqual([]);
      expect(store.getState().highlightOptions).toBeNull();
    });
  });

  // ================================================================
  // laser — 激光笔（教学特效）
  // ================================================================
  describe('laser', () => {
    it('setLaser 设置激光笔指向元素', async () => {
      const store = await getCanvasStore();
      store.getState().setLaser('chart-1');
      expect(store.getState().laserElementId).toBe('chart-1');
    });

    it('setLaser 可带 options（颜色/持续时长）', async () => {
      const store = await getCanvasStore();
      store.getState().setLaser('chart-1', {
        color: '#00ff00',
        duration: 3000,
      });
      expect(store.getState().laserOptions).toEqual({
        color: '#00ff00',
        duration: 3000,
      });
    });

    it('clearLaser 清除激光笔', async () => {
      const store = await getCanvasStore();
      store.getState().setLaser('chart-1');
      store.getState().clearLaser();
      expect(store.getState().laserElementId).toBe('');
      expect(store.getState().laserOptions).toBeNull();
    });
  });

  // ================================================================
  // zoom — 缩放聚焦（教学特效）
  // ================================================================
  describe('zoom', () => {
    it('setZoom 设置缩放目标', async () => {
      const store = await getCanvasStore();
      store.getState().setZoom('detail-img', 2.0);
      expect(store.getState().zoomTarget).toEqual({
        elementId: 'detail-img',
        scale: 2.0,
      });
    });

    it('clearZoom 清除缩放', async () => {
      const store = await getCanvasStore();
      store.getState().setZoom('img', 1.5);
      store.getState().clearZoom();
      expect(store.getState().zoomTarget).toBeNull();
    });
  });

  // ================================================================
  // 组合操作
  // ================================================================
  describe('组合操作', () => {
    it('clearAllEffects 一键清除所有教学特效', async () => {
      const store = await getCanvasStore();
      store.getState().setSpotlight('el-1');
      store.getState().setHighlight(['el-2']);
      store.getState().setLaser('el-3');
      store.getState().setZoom('el-4', 2);

      store.getState().clearAllEffects();

      expect(store.getState().spotlightElementId).toBe('');
      expect(store.getState().spotlightOptions).toBeNull();
      expect(store.getState().highlightedElementIds).toEqual([]);
      expect(store.getState().highlightOptions).toBeNull();
      expect(store.getState().laserElementId).toBe('');
      expect(store.getState().laserOptions).toBeNull();
      expect(store.getState().zoomTarget).toBeNull();
    });

    it('resetCanvasState 重置画布所有状态', async () => {
      const store = await getCanvasStore();
      store.getState().setSpotlight('el-1');
      store.getState().setActiveElementIdList(['el-1']);
      store.getState().setCanvasScale(2);
      store.getState().setCanvasDragged(true);

      store.getState().resetCanvasState();

      // 恢复到初始值
      expect(store.getState().spotlightElementId).toBe('');
      expect(store.getState().activeElementIdList).toEqual([]);
      expect(store.getState().canvasScale).toBe(1);
      expect(store.getState().canvasDragged).toBe(false);
      expect(store.getState().viewportSize).toBe(1000);
    });
  });

  // ================================================================
  // display aids — 辅助显示
  // ================================================================
  describe('display aids', () => {
    it('setRulerState 设置标尺显示', async () => {
      const store = await getCanvasStore();
      store.getState().setRulerState(true);
      expect(store.getState().showRuler).toBe(true);
    });

    it('setGridLineSize 设置网格线', async () => {
      const store = await getCanvasStore();
      store.getState().setGridLineSize(20);
      expect(store.getState().gridLineSize).toBe(20);
    });

    it('setGridLineSize 设为 0 隐藏网格', async () => {
      const store = await getCanvasStore();
      store.getState().setGridLineSize(0);
      expect(store.getState().gridLineSize).toBe(0);
    });
  });

  // ================================================================
  // whiteboard — 白板
  // ================================================================
  describe('whiteboard', () => {
    it('setWhiteboardOpen 打开/关闭白板', async () => {
      const store = await getCanvasStore();
      store.getState().setWhiteboardOpen(true);
      expect(store.getState().whiteboardOpen).toBe(true);
    });

    it('setWhiteboardClearing 标记白板清除中', async () => {
      const store = await getCanvasStore();
      store.getState().setWhiteboardClearing(true);
      expect(store.getState().whiteboardClearing).toBe(true);
    });
  });

  // ================================================================
  // keyboard store — 被 canvas hooks 用的修饰键
  // ================================================================
  describe('canvas keyboard 集成', () => {
    async function getKeyboardStore() {
      const mod = await import('@/lib/store/keyboard');
      return mod.useKeyboardStore;
    }

    it('Space 按下可用于画布拖拽', async () => {
      const store = await getKeyboardStore();
      store.getState().setSpaceKeyState(true);
      expect(store.getState().spaceKeyState).toBe(true);
    });

    it('Ctrl+Shift 同时按下 ctrlOrShiftKeyActive 返回 true', async () => {
      const store = await getKeyboardStore();
      store.getState().setCtrlKeyState(true);
      store.getState().setShiftKeyState(true);
      expect(store.getState().ctrlOrShiftKeyActive()).toBe(true);
    });
  });
});
