/**
 * tests/store/settings-media.test.ts
 * 测试图片/视频生成相关的设置，以及媒体生成的运行时状态
 *
 * 涉及两个 store：
 *   1. useSettingsStore — 图片/视频 provider 选择、模型选择、生成开关
 *   2. useMediaGenerationStore — 按元素的媒体生成任务状态
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupStoreMocks, clearStorage, getStore } from './mocks';

setupStoreMocks();

describe('settings-media — 媒体设置', () => {
  beforeEach(async () => {
    vi.resetModules();
    clearStorage();
  });

  // ================================================================
  // 图片 provider / model 测试
  // ================================================================
  describe('setImageProvider', () => {
    it('切换图片引擎时，modelId 重置为该引擎的第一个模型', async () => {
      const store = await getStore();
      store.getState().setImageProvider('openai-image');

      const state = store.getState();
      expect(state.imageProviderId).toBe('openai-image');
      expect(state.imageModelId).toBe('dall-e-3'); // openai 的第一个模型
    });
  });

  describe('setImageModelId', () => {
    it('仅变更模型 ID，不影响 engine', async () => {
      const store = await getStore();
      store.getState().setImageProvider('openai-image');
      store.getState().setImageModelId('dall-e-3');

      expect(store.getState().imageProviderId).toBe('openai-image');
      expect(store.getState().imageModelId).toBe('dall-e-3');
    });
  });

  // ================================================================
  // 视频 provider 测试
  // ================================================================
  describe('setVideoProvider', () => {
    it('切换视频引擎', async () => {
      const store = await getStore();
      store.getState().setVideoProvider('kling');

      expect(store.getState().videoProviderId).toBe('kling');
    });
  });

  describe('setVideoModelId', () => {
    it('设置视频模型 ID', async () => {
      const store = await getStore();
      store.getState().setVideoModelId('kling-v1');

      expect(store.getState().videoModelId).toBe('kling-v1');
    });
  });

  // ================================================================
  // 生成开关测试
  // ================================================================
  describe('imageGenerationEnabled', () => {
    it('设置 API Key 后可以开启', async () => {
      const store = await getStore();
      // 先给 openai 配 API Key
      store.getState().setImageProviderConfig('openai-image', { apiKey: 'sk-test' });
      store.getState().setImageGenerationEnabled(true);

      expect(store.getState().imageGenerationEnabled).toBe(true);
    });
  });

  describe('setReviewOutlineEnabled', () => {
    it('开启/关闭大纲审查', async () => {
      const store = await getStore();
      store.getState().setReviewOutlineEnabled(true);
      expect(store.getState().reviewOutlineEnabled).toBe(true);

      store.getState().setReviewOutlineEnabled(false);
      expect(store.getState().reviewOutlineEnabled).toBe(false);
    });
  });
});

// ================================================================
// useMediaGenerationStore — 媒体生成任务状态
// ================================================================
describe('useMediaGenerationStore — 生成任务状态', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function getMediaStore() {
    const mod = await import('@/lib/store/media-generation');
    return mod.useMediaGenerationStore;
  }

  it('入队任务 → status 为 pending', async () => {
    const store = await getMediaStore();
    store.getState().enqueueTasks('stage-1', [
      { elementId: 'el-1', type: 'image' as const, prompt: 'test image' },
    ]);

    const task = store.getState().getTask('el-1');
    expect(task).toBeDefined();
    expect(task!.status).toBe('pending');
    expect(task!.type).toBe('image');
  });

  it('markGenerating → status 变为 generating', async () => {
    const store = await getMediaStore();
    store.getState().enqueueTasks('stage-1', [
      { elementId: 'el-2', type: 'video' as const, prompt: 'test' },
    ]);
    store.getState().markGenerating('el-2');

    expect(store.getState().getTask('el-2')!.status).toBe('generating');
  });

  it('markDone → status 变为 done 且 objectUrl 已设置', async () => {
    const store = await getMediaStore();
    store.getState().enqueueTasks('stage-1', [
      { elementId: 'el-3', type: 'image' as const, prompt: 'test' },
    ]);
    store.getState().markDone('el-3', 'blob:http://example.com/img.png');

    const task = store.getState().getTask('el-3')!;
    expect(task.status).toBe('done');
    expect(task.objectUrl).toBe('blob:http://example.com/img.png');
  });

  it('markFailed → status 变为 failed 且 error/errorCode 正确', async () => {
    const store = await getMediaStore();
    store.getState().enqueueTasks('stage-1', [
      { elementId: 'el-4', type: 'image' as const, prompt: 'test' },
    ]);
    store.getState().markFailed('el-4', '请求超时', 'ERR_TIMEOUT');

    const task = store.getState().getTask('el-4')!;
    expect(task.status).toBe('failed');
    expect(task.error).toBe('请求超时');
    expect(task.errorCode).toBe('ERR_TIMEOUT');
  });
});
