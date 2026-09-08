import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { db, mediaFileKey } from '@/lib/utils/database';

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('media generation store persistence', () => {
  beforeEach(async () => {
    useMediaGenerationStore.setState({ tasks: {} });
    await db.mediaFiles.clear();
  });

  it('enqueueTasks persists pending records so interrupted runs survive refresh', async () => {
    const store = useMediaGenerationStore.getState();

    await store.enqueueTasks('stage-1', [
      {
        type: 'image',
        prompt: 'a cat',
        elementId: 'gen_img_1',
        aspectRatio: '1:1',
        style: 'anime',
      },
      { type: 'video', prompt: 'a dog', elementId: 'gen_vid_1', aspectRatio: '16:9' },
    ]);

    expect(useMediaGenerationStore.getState().tasks['gen_img_1']?.status).toBe('pending');
    expect(useMediaGenerationStore.getState().tasks['gen_vid_1']?.status).toBe('pending');

    const rec1 = await db.mediaFiles.get(mediaFileKey('stage-1', 'gen_img_1'));
    expect(rec1?.status).toBe('pending');
    expect(rec1?.blob).toBeUndefined();
    expect(rec1?.prompt).toBe('a cat');

    const rec2 = await db.mediaFiles.get(mediaFileKey('stage-1', 'gen_vid_1'));
    expect(rec2?.status).toBe('pending');
    expect(rec2?.type).toBe('video');
  });

  it('enqueueTasks skips already-tracked tasks', async () => {
    const store = useMediaGenerationStore.getState();

    await store.enqueueTasks('stage-1', [
      { type: 'image', prompt: 'first', elementId: 'gen_img_1', aspectRatio: '1:1' },
    ]);
    await store.enqueueTasks('stage-1', [
      { type: 'image', prompt: 'second', elementId: 'gen_img_1', aspectRatio: '1:1' },
      { type: 'image', prompt: 'new', elementId: 'gen_img_2', aspectRatio: '1:1' },
    ]);

    expect(useMediaGenerationStore.getState().tasks['gen_img_1']?.prompt).toBe('first');
    expect(useMediaGenerationStore.getState().tasks['gen_img_2']?.prompt).toBe('new');
  });

  it('restoreFromDB restores done/pending/failed tasks correctly', async () => {
    const now = Date.now();
    await db.mediaFiles.bulkPut([
      {
        id: mediaFileKey('stage-1', 'gen_img_done'),
        stageId: 'stage-1',
        type: 'image',
        blob: new Blob(['img'], { type: 'image/png' }),
        mimeType: 'image/png',
        size: 3,
        prompt: 'done',
        params: '{}',
        status: 'done',
        createdAt: now,
      },
      {
        id: mediaFileKey('stage-1', 'gen_img_pending'),
        stageId: 'stage-1',
        type: 'image',
        blob: new Blob(),
        mimeType: 'image/png',
        size: 0,
        prompt: 'pending',
        params: '{}',
        status: 'pending',
        createdAt: now,
      },
      {
        id: mediaFileKey('stage-1', 'gen_img_failed'),
        stageId: 'stage-1',
        type: 'image',
        blob: new Blob(),
        mimeType: 'image/png',
        size: 0,
        prompt: 'failed',
        params: '{}',
        status: 'failed',
        error: 'boom',
        errorCode: 'CONTENT_SENSITIVE',
        createdAt: now,
      },
    ]);

    await useMediaGenerationStore.getState().restoreFromDB('stage-1');

    const tasks = useMediaGenerationStore.getState().tasks;
    expect(tasks['gen_img_done']?.status).toBe('done');
    expect(tasks['gen_img_done']?.objectUrl).toMatch(/^blob:/);
    expect(tasks['gen_img_pending']?.status).toBe('pending');
    expect(tasks['gen_img_pending']?.objectUrl).toBeUndefined();
    expect(tasks['gen_img_failed']?.status).toBe('failed');
    expect(tasks['gen_img_failed']?.errorCode).toBe('CONTENT_SENSITIVE');
  });

  it('restoreFromDB handles legacy records without status field', async () => {
    const now = Date.now();
    await db.mediaFiles.bulkPut([
      // Legacy completed record (real blob, no status) → done
      {
        id: mediaFileKey('stage-1', 'legacy_done'),
        stageId: 'stage-1',
        type: 'image',
        blob: new Blob(['img'], { type: 'image/png' }),
        mimeType: 'image/png',
        size: 3,
        prompt: 'legacy done',
        params: '{}',
        createdAt: now,
      },
      // Legacy interrupted record (no blob, no status, no error) → pending
      {
        id: mediaFileKey('stage-1', 'legacy_empty'),
        stageId: 'stage-1',
        type: 'video',
        mimeType: 'video/mp4',
        size: 0,
        prompt: 'legacy empty',
        params: '{}',
        createdAt: now,
      },
    ]);

    await useMediaGenerationStore.getState().restoreFromDB('stage-1');

    const tasks = useMediaGenerationStore.getState().tasks;
    expect(tasks['legacy_done']?.status).toBe('done');
    expect(tasks['legacy_done']?.objectUrl).toMatch(/^blob:/);
    expect(tasks['legacy_empty']?.status).toBe('pending');
    expect(tasks['legacy_empty']?.objectUrl).toBeUndefined();
  });
});
