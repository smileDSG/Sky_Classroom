import { createCanvas } from '@napi-rs/canvas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { HANDWRITING_MAX_PAGES, createHandwritingSubmissionDAO } from '@/lib/handwriting';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';

vi.mock('server-only', () => ({}));

const authState = vi.hoisted(() => ({ token: 'token-user-1' as string | undefined }));
const storedObjectKeys = vi.hoisted(() => [] as string[]);
const storage = new MemoryStorageProvider();
const submissionDAO = createHandwritingSubmissionDAO(storage);

vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: async () => storage,
}));

vi.mock('@/lib/handwriting/object-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/handwriting/object-store')>();
  return {
    ...actual,
    getHandwritingObjectStore: () => ({
      put: async ({ pageId, mimeType }: { pageId: string; mimeType: string }) => {
        const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1];
        const key = `test/${pageId}.${extension}`;
        storedObjectKeys.push(key);
        return key;
      },
    }),
  };
});

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => (authState.token ? { value: authState.token } : undefined),
  }),
}));

vi.mock('@/lib/server/auth', () => ({
  verifyAccessToken: async (token: string) => {
    if (token === 'token-user-1') return { sub: 'user-1' };
    if (token === 'token-user-2') return { sub: 'user-2' };
    return null;
  },
}));

const BASE = 'http://localhost/api/sky/handwriting/submissions';

function context(submissionId: string) {
  return { params: Promise.resolve({ submissionId }) };
}

interface MultipartFile {
  name: string;
  type: string;
  buffer: Buffer;
}

function uploadRequest(files: MultipartFile[] = []): NextRequest {
  const formData = new FormData();
  for (const file of files) {
    formData.append(
      'images[]',
      new File([Uint8Array.from(file.buffer)], file.name, { type: file.type }),
    );
  }
  const request = new NextRequest(`${BASE}/placeholder/pages`, { method: 'POST' });
  Object.defineProperty(request, 'formData', {
    value: async () => formData,
  });
  return request;
}

function sharpPngFile(): MultipartFile {
  const canvas = createCanvas(1200, 1600);
  const context = canvas.getContext('2d');
  for (let x = 0; x < 1200; x += 16) {
    context.fillStyle = x % 32 === 0 ? '#ffffff' : '#000000';
    context.fillRect(x, 0, 16, 1600);
  }
  return { name: 'answer.png', type: 'image/png', buffer: canvas.toBuffer('image/png') };
}

describe('/api/sky/handwriting/submissions/[submissionId]/pages', () => {
  beforeEach(async () => {
    authState.token = 'token-user-1';
    storedObjectKeys.length = 0;
    await storage.clear('handwriting_submissions');
    await storage.clear('handwriting_pages');
  });

  it('rejects unauthenticated uploads', async () => {
    const { POST } =
      await import('@/app/api/sky/handwriting/submissions/[submissionId]/pages/route');
    authState.token = undefined;

    const response = await POST(uploadRequest([sharpPngFile()]), context('submission-1'));

    expect(response.status).toBe(401);
  });

  it('hides foreign submissions', async () => {
    const submission = await submissionDAO.create({ userId: 'user-1', subject: 'math' });
    const { POST } =
      await import('@/app/api/sky/handwriting/submissions/[submissionId]/pages/route');
    authState.token = 'token-user-2';

    const response = await POST(uploadRequest([sharpPngFile()]), context(submission.id));

    expect(response.status).toBe(404);
    expect(storedObjectKeys).toEqual([]);
  });

  it('rejects a multipart request without images', async () => {
    const submission = await submissionDAO.create({ userId: 'user-1', subject: 'math' });
    const { POST } =
      await import('@/app/api/sky/handwriting/submissions/[submissionId]/pages/route');

    const response = await POST(uploadRequest(), context(submission.id));

    expect(response.status).toBe(400);
  });

  it('uploads valid images and advances a draft submission to uploaded', async () => {
    const submission = await submissionDAO.create({ userId: 'user-1', subject: 'physics' });
    const { POST } =
      await import('@/app/api/sky/handwriting/submissions/[submissionId]/pages/route');

    const response = await POST(uploadRequest([sharpPngFile()]), context(submission.id));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.pages).toHaveLength(1);
    expect(payload.blockingIssues).toEqual([]);
    expect(payload.canContinue).toBe(true);
    expect(storedObjectKeys).toHaveLength(1);
    expect((await submissionDAO.getForUser(submission.id, 'user-1'))?.status).toBe('uploaded');
  });

  it('rejects uploads that would exceed twelve total pages', async () => {
    const submission = await submissionDAO.create({ userId: 'user-1', subject: 'math' });
    await submissionDAO.attachPages(
      submission.id,
      'user-1',
      Array.from({ length: HANDWRITING_MAX_PAGES }, (_, index) => `existing-${index + 1}`),
    );
    const { POST } =
      await import('@/app/api/sky/handwriting/submissions/[submissionId]/pages/route');

    const response = await POST(uploadRequest([sharpPngFile()]), context(submission.id));

    expect(response.status).toBe(409);
    expect(storedObjectKeys).toEqual([]);
  });

  it('rejects uploads for a closed submission', async () => {
    const submission = await submissionDAO.create({ userId: 'user-1', subject: 'math' });
    await submissionDAO.updateStatus(submission.id, 'user-1', 'closed');
    const { POST } =
      await import('@/app/api/sky/handwriting/submissions/[submissionId]/pages/route');

    const response = await POST(uploadRequest([sharpPngFile()]), context(submission.id));

    expect(response.status).toBe(409);
    expect(storedObjectKeys).toEqual([]);
  });
});
