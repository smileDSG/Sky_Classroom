import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalHandwritingObjectStore } from '@/lib/handwriting';

describe('local handwriting object store', () => {
  it('stores image bytes below the configured root with sanitized path segments', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'handwriting-store-'));
    const store = new LocalHandwritingObjectStore(root);
    const buffer = Buffer.from('image-bytes');

    const objectKey = await store.put({
      userId: '../../user',
      submissionId: '../submission',
      pageId: '..\\page',
      mimeType: 'image/png',
      buffer,
    });

    expect(objectKey).not.toContain('..');
    expect(objectKey).toMatch(/\.png$/);
    const storedPath = path.resolve(root, ...objectKey.split('/'));
    expect(path.relative(root, storedPath)).not.toMatch(/^\.\.(?:[\\/]|$)/);
    await expect(readFile(storedPath)).resolves.toEqual(buffer);
  });

  it('uses a MIME-based extension instead of trusting a file name', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'handwriting-store-'));
    const store = new LocalHandwritingObjectStore(root);

    const objectKey = await store.put({
      userId: 'user-1',
      submissionId: 'submission-1',
      pageId: 'page-1',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([1]),
    });

    expect(objectKey).toBe('user-1/submission-1/page-1.jpg');
  });
});
