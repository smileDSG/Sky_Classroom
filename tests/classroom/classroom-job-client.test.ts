import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchClassroomJob, pollClassroomJob } from '@/lib/classroom/classroom-job-client';

describe('classroom job client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('treats failed jobs as terminal poll results instead of throwing', async () => {
    const failedJob = {
      status: 'failed',
      step: 'failed',
      progress: 10,
      message: 'Classroom generation failed',
      error: 'Stale job: process may have restarted during generation',
      done: true,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: failedJob }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const onUpdate = vi.fn();

    await expect(
      pollClassroomJob('job_1', onUpdate, new AbortController().signal),
    ).resolves.toBeUndefined();

    expect(onUpdate).toHaveBeenCalledWith(failedJob);
    expect(fetchMock).toHaveBeenCalledWith('/api/generate-classroom/job_1', {
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    });
  });

  it('fetches job status without browser cache', async () => {
    const job = {
      status: 'awaiting_review',
      step: 'generating_outlines',
      progress: 30,
      message: '大纲已生成，等待审阅',
      done: false,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: job }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchClassroomJob('job_2')).resolves.toEqual(job);

    expect(fetchMock).toHaveBeenCalledWith('/api/generate-classroom/job_2', {
      cache: 'no-store',
    });
  });
});
