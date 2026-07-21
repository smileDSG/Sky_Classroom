import { beforeEach, describe, expect, it } from 'vitest';
import {
  createHandwritingPageDAO,
  createHandwritingPageIngestionService,
  createHandwritingSubmissionDAO,
} from '@/lib/handwriting';
import type { HandwritingImageQualityResult, HandwritingObjectStore } from '@/lib/handwriting';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';

const storage = new MemoryStorageProvider();
const pageDAO = createHandwritingPageDAO(storage);
const submissionDAO = createHandwritingSubmissionDAO(storage);

function qualityResult(
  overrides: Partial<HandwritingImageQualityResult> = {},
): HandwritingImageQualityResult {
  return {
    width: 1200,
    height: 1600,
    qualityScore: 0.9,
    qualityIssues: [],
    metrics: { sharpness: 0.8, overexposedRatio: 0.1, underexposedRatio: 0.1 },
    ...overrides,
  };
}

describe('handwriting page ingestion service', () => {
  beforeEach(async () => {
    await storage.clear('handwriting_pages');
    await storage.clear('handwriting_submissions');
  });

  it('validates the entire batch before writing any binary or metadata', async () => {
    const writes: string[] = [];
    const objectStore: HandwritingObjectStore = {
      put: async ({ pageId }) => {
        writes.push(pageId);
        return `objects/${pageId}.png`;
      },
    };
    const submission = await submissionDAO.create({ userId: 'user-1', subject: 'math' });
    const service = createHandwritingPageIngestionService({
      submissionDAO,
      pageDAO,
      objectStore,
      analyzeImage: async () => qualityResult(),
    });

    await expect(
      service.ingest({
        submission,
        userId: 'user-1',
        files: [
          new File([new Uint8Array([1])], 'answer.png', { type: 'image/png' }),
          new File([new Uint8Array([2])], 'answer.pdf', { type: 'application/pdf' }),
        ],
      }),
    ).rejects.toMatchObject({ code: 'invalid_type' });

    expect(writes).toEqual([]);
    await expect(pageDAO.listBySubmission(submission.id)).resolves.toEqual([]);
    expect((await submissionDAO.getForUser(submission.id, 'user-1'))?.pageIds).toEqual([]);
  });

  it('analyzes the entire batch before writing any binary', async () => {
    const writes: string[] = [];
    let analyses = 0;
    const submission = await submissionDAO.create({ userId: 'user-1', subject: 'physics' });
    const service = createHandwritingPageIngestionService({
      submissionDAO,
      pageDAO,
      objectStore: {
        put: async ({ pageId }) => {
          writes.push(pageId);
          return `objects/${pageId}.png`;
        },
      },
      analyzeImage: async () => {
        analyses += 1;
        if (analyses === 2) throw new Error('decode failed');
        return qualityResult();
      },
    });

    await expect(
      service.ingest({
        submission,
        userId: 'user-1',
        files: [
          new File([new Uint8Array([1])], 'one.png', { type: 'image/png' }),
          new File([new Uint8Array([2])], 'two.png', { type: 'image/png' }),
        ],
      }),
    ).rejects.toThrow('decode failed');

    expect(writes).toEqual([]);
  });

  it('stores valid pages, persists quality metadata, and attaches their IDs', async () => {
    const writes: string[] = [];
    const submission = await submissionDAO.create({ userId: 'user-1', subject: 'math' });
    const service = createHandwritingPageIngestionService({
      submissionDAO,
      pageDAO,
      objectStore: {
        put: async ({ pageId }) => {
          writes.push(pageId);
          return `objects/${pageId}.png`;
        },
      },
      analyzeImage: async () =>
        qualityResult({
          qualityScore: 0.4,
          qualityIssues: [
            { code: 'blur', severity: 'blocking', confidence: 0.9, message: '图片模糊' },
          ],
        }),
    });

    const result = await service.ingest({
      submission,
      userId: 'user-1',
      files: [new File([new Uint8Array([1])], 'answer.png', { type: 'image/png' })],
    });

    expect(writes).toEqual([result.pages[0].id]);
    expect(result.pages[0]).toEqual(
      expect.objectContaining({
        submissionId: submission.id,
        order: 1,
        objectKey: `objects/${result.pages[0].id}.png`,
        qualityScore: 0.4,
      }),
    );
    expect(result.blockingIssues).toHaveLength(1);
    expect(result.canContinue).toBe(false);
    expect((await submissionDAO.getForUser(submission.id, 'user-1'))?.pageIds).toEqual([
      result.pages[0].id,
    ]);
  });
});
