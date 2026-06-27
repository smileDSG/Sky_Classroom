import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('stage store loading', () => {
  beforeEach(async () => {
    vi.resetModules();
    indexedDB.deleteDatabase('MAIC_DB');
  });

  it('clears stale in-memory classroom when requested id is missing from IndexedDB', async () => {
    const { useStageStore } = await import('@/lib/store/stage');
    const store = useStageStore.getState();

    store.setStage({
      id: 'old-classroom',
      name: 'Old classroom',
      createdAt: 1,
      updatedAt: 1,
    });
    store.setScenes([
      {
        id: 'old-scene',
        stageId: 'old-classroom',
        type: 'slide',
        title: 'Old slide',
        order: 0,
        content: {
          type: 'slide',
          canvas: {
            id: 'old-slide',
            viewportSize: 1000,
            viewportRatio: 0.5625,
            elements: [],
          },
        },
      },
    ]);

    await store.loadFromStorage('new-server-classroom');

    expect(useStageStore.getState().stage).toBeNull();
    expect(useStageStore.getState().scenes).toEqual([]);
    expect(useStageStore.getState().currentSceneId).toBeNull();
  });
});
