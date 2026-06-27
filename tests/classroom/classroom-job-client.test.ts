import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchClassroomJob,
  isClassroomPollAbort,
  isTransientClassroomPollError,
  pollClassroomJob,
} from '@/lib/classroom/classroom-job-client';

describe('classroom job client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
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

  it('passes abort signals to direct job status fetches', async () => {
    const job = {
      status: 'running',
      step: 'generating_scenes',
      progress: 45,
      message: 'Generating scenes',
      done: false,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: job }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const abortController = new AbortController();

    await expect(fetchClassroomJob('job_3', abortController.signal)).resolves.toEqual(job);

    expect(fetchMock).toHaveBeenCalledWith('/api/generate-classroom/job_3', {
      cache: 'no-store',
      signal: abortController.signal,
    });
  });

  it('classifies browser fetch failures as transient poll errors', () => {
    expect(isTransientClassroomPollError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isTransientClassroomPollError(new Error('NetworkError when attempting to fetch'))).toBe(
      true,
    );
    expect(isTransientClassroomPollError(new Error('Job is in failed state'))).toBe(false);
    expect(isClassroomPollAbort(new DOMException('Aborted', 'AbortError'))).toBe(true);
    expect(isTransientClassroomPollError(new DOMException('Aborted', 'AbortError'))).toBe(false);
  });

  it('retries transient fetch failures while polling', async () => {
    vi.useFakeTimers();

    const completedJob = {
      status: 'succeeded',
      step: 'done',
      progress: 100,
      message: 'Classroom ready',
      done: true,
    };
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: completedJob }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const onUpdate = vi.fn();
    const promise = pollClassroomJob('job_4', onUpdate, new AbortController().signal);

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledWith(completedJob);
  });
});
