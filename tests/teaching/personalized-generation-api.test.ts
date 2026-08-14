import { beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({
  createTeachingJob: vi.fn(),
  runTeachingJob: vi.fn(),
  after: vi.fn((callback: () => void) => callback()),
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: boundary.after };
});

vi.mock('nanoid', () => ({ nanoid: () => 'job-1' }));

vi.mock('@/lib/server/billing/require-quota', () => ({
  requireQuota: vi.fn(async () => ({ userId: 'student-1', planType: 'free' })),
  recordUsage: vi.fn(async () => undefined),
}));

vi.mock('@/lib/server/teaching-job-store', () => ({
  createTeachingJob: boundary.createTeachingJob,
}));

vi.mock('@/lib/server/teaching-job-runner', () => ({
  runTeachingJob: boundary.runTeachingJob,
}));

describe('personalized teaching generation API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists and runs the job with validated personalization policy', async () => {
    const { POST } = await import('@/app/api/sky/teaching/generate-stream/route');
    const policy = {
      difficulty: 'easy',
      explanationStyle: 'example_first',
      resourceFormats: ['diagram', 'practice'],
      pacing: 'remedial',
      reasonCodes: ['low-mastery'],
      profileVersion: 4,
    };
    const response = await POST(
      new Request('http://localhost/api/sky/teaching/generate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: '函数基础', personalizationPolicy: policy }),
      }) as never,
    );

    expect(response.status).toBe(202);
    expect(boundary.createTeachingJob).toHaveBeenCalledWith(
      'job-1',
      'student-1',
      '函数基础',
      policy,
    );
    expect(boundary.runTeachingJob).toHaveBeenCalledWith('job-1', '函数基础', 'student-1', policy);
  });

  it('rejects untrusted policy values', async () => {
    const { POST } = await import('@/app/api/sky/teaching/generate-stream/route');
    const response = await POST(
      new Request('http://localhost/api/sky/teaching/generate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: '函数基础',
          personalizationPolicy: {
            difficulty: 'impossible',
            explanationStyle: 'inject_prompt',
            resourceFormats: [],
            pacing: 'instant',
          },
        }),
      }) as never,
    );

    expect(response.status).toBe(400);
    expect(boundary.createTeachingJob).not.toHaveBeenCalled();
  });
});
