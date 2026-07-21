import { beforeEach, describe, expect, it } from 'vitest';
import { createHandwritingSubmissionDAO } from '@/lib/handwriting';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';

const storage = new MemoryStorageProvider();
const dao = createHandwritingSubmissionDAO(storage);

describe('handwriting submission DAO', () => {
  beforeEach(async () => {
    await storage.clear('handwriting_submissions');
  });

  it('creates a user-owned draft submission', async () => {
    const created = await dao.create({
      userId: 'user-1',
      subject: 'math',
      title: '代数练习',
    });

    expect(created.id).toMatch(/^handwriting_/);
    expect(created.status).toBe('draft');
    expect(created.userId).toBe('user-1');
    expect(created.pageIds).toEqual([]);
  });

  it('does not expose a submission to another user', async () => {
    const created = await dao.create({ userId: 'user-1', subject: 'physics' });

    expect(await dao.getForUser(created.id, 'user-2')).toBeNull();
    expect(await dao.getForUser(created.id, 'user-1')).toEqual(created);
  });

  it('lists only the requested user submissions', async () => {
    await dao.create({ userId: 'user-1', subject: 'math' });
    await dao.create({ userId: 'user-2', subject: 'physics' });

    const result = await dao.listByUser('user-1');

    expect(result.total).toBe(1);
    expect(result.items[0].userId).toBe('user-1');
  });

  it('updates status only through legal transitions', async () => {
    const created = await dao.create({ userId: 'user-1', subject: 'math' });

    const updated = await dao.updateStatus(created.id, 'user-1', 'uploaded');

    expect(updated?.status).toBe('uploaded');
    await expect(dao.updateStatus(created.id, 'user-1', 'graded')).rejects.toThrow(
      'Illegal handwriting submission transition: uploaded -> graded',
    );
  });

  it('returns null when updating a missing or foreign submission', async () => {
    const created = await dao.create({ userId: 'user-1', subject: 'math' });

    expect(await dao.updateStatus(created.id, 'user-2', 'uploaded')).toBeNull();
    expect(await dao.updateStatus('missing', 'user-1', 'uploaded')).toBeNull();
  });
});
