import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  readJob: vi.fn(),
  updateJob: vi.fn(),
  markResumed: vi.fn(),
  runContinue: vi.fn(),
}));

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    after: mocks.after,
  };
});

vi.mock('@/lib/server/classroom-job-store-hybrid', () => ({
  isValidClassroomJobId: (jobId: string) => /^[a-zA-Z0-9_-]+$/.test(jobId),
  readClassroomGenerationJobHybrid: mocks.readJob,
  updateClassroomGenerationJobHybrid: mocks.updateJob,
  markClassroomGenerationJobResumedHybrid: mocks.markResumed,
}));

vi.mock('@/lib/server/classroom-job-runner', () => ({
  runClassroomContinueJob: mocks.runContinue,
}));

function makeRequest(body: unknown = {}): NextRequest {
  return new NextRequest('http://localhost/api/generate-classroom/job_1/approve', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeContext(jobId = 'job_1') {
  return { params: Promise.resolve({ jobId }) };
}

describe('classroom approve route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.after.mockImplementation((callback: () => void) => callback());
    mocks.updateJob.mockResolvedValue(undefined);
    mocks.markResumed.mockResolvedValue(undefined);
    mocks.runContinue.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetModules();
  });

  test('treats duplicate approval for a running continue job as idempotent', async () => {
    mocks.readJob.mockResolvedValue({
      status: 'running',
      step: 'generating_scenes',
      progress: 30,
    });

    const { POST } = await import('@/app/api/generate-classroom/[jobId]/approve/route');
    const res = await POST(makeRequest(), makeContext());
    const json = await res.json();

    expect(res.status).toBe(202);
    expect(json).toMatchObject({
      success: true,
      jobId: 'job_1',
      status: 'running',
      step: 'generating_scenes',
    });
    expect(mocks.markResumed).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
    expect(mocks.runContinue).not.toHaveBeenCalled();
  });

  test('marks the job as resumed before scheduling scene generation', async () => {
    mocks.readJob.mockResolvedValue({
      status: 'awaiting_review',
      step: 'generating_outlines',
      progress: 30,
      phaseOneResult: { outlines: [] },
      outlinesMeta: { languageDirective: 'Use Chinese.', totalScenes: 1 },
    });

    const { POST } = await import('@/app/api/generate-classroom/[jobId]/approve/route');
    const res = await POST(makeRequest(), makeContext());

    expect(res.status).toBe(202);
    expect(mocks.markResumed).toHaveBeenCalledWith('job_1');
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(mocks.runContinue).toHaveBeenCalledWith('job_1', 'http://localhost');
    expect(mocks.markResumed.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.after.mock.invocationCallOrder[0],
    );
  });
});
