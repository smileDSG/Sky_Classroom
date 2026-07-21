import { beforeEach, describe, expect, it } from 'vitest';
import {
  HANDWRITING_MAX_PAGES,
  createHandwritingPageDAO,
  createHandwritingSubmissionDAO,
} from '@/lib/handwriting';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';

const storage = new MemoryStorageProvider();
const pageDAO = createHandwritingPageDAO(storage);
const submissionDAO = createHandwritingSubmissionDAO(storage);

describe('handwriting page DAO', () => {
  beforeEach(async () => {
    await storage.clear('handwriting_pages');
    await storage.clear('handwriting_submissions');
  });

  it('creates and lists submission pages in page order', async () => {
    const second = await pageDAO.create({
      submissionId: 'submission-1',
      order: 2,
      objectKey: 'user/submission/page-2.png',
      width: 1200,
      height: 1600,
      qualityScore: 0.8,
      qualityIssues: [],
    });
    const first = await pageDAO.create({
      submissionId: 'submission-1',
      order: 1,
      objectKey: 'user/submission/page-1.png',
      width: 1200,
      height: 1600,
      qualityScore: 0.9,
      qualityIssues: [],
    });

    expect(first.id).toMatch(/^handwriting_page_/);
    expect(first.regions).toEqual([]);
    await expect(pageDAO.listBySubmission('submission-1')).resolves.toEqual([first, second]);
  });

  it('attaches page IDs to an owned submission without exceeding twelve pages', async () => {
    const submission = await submissionDAO.create({ userId: 'user-1', subject: 'math' });
    const initialPageIds = Array.from(
      { length: HANDWRITING_MAX_PAGES - 1 },
      (_, index) => `page-${index + 1}`,
    );

    const attached = await submissionDAO.attachPages(submission.id, 'user-1', initialPageIds);
    expect(attached?.pageIds).toEqual(initialPageIds);

    await expect(
      submissionDAO.attachPages(submission.id, 'user-1', ['page-12', 'page-13']),
    ).rejects.toThrow('A handwriting submission can contain at most 12 pages');
    expect((await submissionDAO.getForUser(submission.id, 'user-1'))?.pageIds).toEqual(
      initialPageIds,
    );
  });

  it('does not attach pages to a foreign or missing submission', async () => {
    const submission = await submissionDAO.create({ userId: 'user-1', subject: 'physics' });

    await expect(
      submissionDAO.attachPages(submission.id, 'user-2', ['page-1']),
    ).resolves.toBeNull();
    await expect(submissionDAO.attachPages('missing', 'user-1', ['page-1'])).resolves.toBeNull();
  });
});
