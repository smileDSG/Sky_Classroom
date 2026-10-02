/**
 * POST /api/sky/teaching/[jobId]/to-classroom — idempotency & quota safety tests.
 *
 * The conversion must be replayable: clicking "转为课堂模式" again (or retrying after
 * a timeout) must NOT generate a second stage or consume a second generation quota
 * when the teaching job was already converted and its classroom still exists.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { TeachingJob } from '@/lib/server/teaching-job-store';

const boundary = vi.hoisted(() => ({
  userId: 'user-1',
  job: null as TeachingJob | null,
  persisted: null as { id: string; scenes?: unknown[] } | null,
  conversionCount: 0 as number,
  quotaCount: 0 as number,
  persistCount: 0 as number,
  lastMarker: undefined as string | undefined,
  convertError: null as Error | null,
}));

vi.mock('@/lib/server/teaching-job-store', () => ({
  readTeachingJob: vi.fn(async () => boundary.job),
  updateTeachingJob: vi.fn(async (_id: string, patch: Partial<TeachingJob>) => {
    if (patch.classroomStageId !== undefined) boundary.lastMarker = patch.classroomStageId;
    return boundary.job as TeachingJob;
  }),
}));

vi.mock('@/lib/server/classroom-storage', () => ({
  persistClassroom: vi.fn(async (data: { id: string; scenes?: unknown[] }) => {
    boundary.persistCount += 1;
    boundary.persisted = { id: data.id, scenes: data.scenes };
    return { id: data.id, url: `http://x/classroom/${data.id}` };
  }),
  readClassroom: vi.fn(async (id: string) =>
    boundary.persisted?.id === id ? (boundary.persisted as never) : null,
  ),
}));

vi.mock('@/lib/server/billing/require-quota', () => ({
  requireQuota: vi.fn(async () => {
    boundary.quotaCount += 1;
    return { userId: boundary.userId };
  }),
}));

vi.mock('@/lib/teaching/to-classroom', () => ({
  convertTeachingJobToStage: vi.fn(async () => {
    if (boundary.convertError) throw boundary.convertError;
    boundary.conversionCount += 1;
    return { stage: { id: `stage_${boundary.conversionCount}` }, scenes: [{ id: 's1' }] };
  }),
}));

import { POST } from '@/app/api/sky/teaching/[jobId]/to-classroom/route';

function makeSucceededJob(overrides?: Partial<TeachingJob>): TeachingJob {
  return {
    id: 'job-1',
    userId: boundary.userId,
    topic: '二次函数',
    status: 'succeeded',
    step: 'done',
    progress: 100,
    message: '完成',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function post(jobId = 'job-1') {
  return POST(
    new NextRequest(`http://localhost/api/sky/teaching/${jobId}/to-classroom`, {
      method: 'POST',
    }),
    { params: Promise.resolve({ jobId }) },
  );
}

beforeEach(() => {
  boundary.job = makeSucceededJob();
  boundary.persisted = null;
  boundary.conversionCount = 0;
  boundary.quotaCount = 0;
  boundary.persistCount = 0;
  boundary.lastMarker = undefined;
  boundary.convertError = null;
});

describe('POST /api/sky/teaching/[jobId]/to-classroom', () => {
  it('converts first time, persists the classroom and records the marker', async () => {
    const res = await post();
    expect(res.status).toBe(201);
    const payload = await res.json();
    expect(payload.data.stageId).toBe('stage_1');
    expect(boundary.conversionCount).toBe(1);
    expect(boundary.persistCount).toBe(1);
    expect(boundary.quotaCount).toBe(1);
    expect(boundary.lastMarker).toBe('stage_1');
  });

  it('replays idempotently without a second conversion or persist', async () => {
    boundary.persisted = { id: 'stage_1', scenes: [{ id: 's1' }] };
    boundary.job = makeSucceededJob({ classroomStageId: 'stage_1' });

    const res = await post();
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.data.stageId).toBe('stage_1');
    expect(payload.data.redirectUrl).toBe('/classroom/stage_1');
    // No fresh LLM generation, no orphan classroom — the core idempotency win.
    expect(boundary.conversionCount).toBe(0);
    expect(boundary.persistCount).toBe(0);
    expect(boundary.lastMarker).toBeUndefined();
  });

  it('regenerates when the referenced classroom is missing', async () => {
    boundary.persisted = null; // classroom file gone
    boundary.job = makeSucceededJob({ classroomStageId: 'stage_lost' });

    const res = await post();
    expect(res.status).toBe(201);
    const payload = await res.json();
    expect(payload.data.stageId).toBe('stage_1');
    expect(boundary.conversionCount).toBe(1);
    expect(boundary.quotaCount).toBe(1);
    expect(boundary.lastMarker).toBe('stage_1');
  });

  it('does not record a marker when conversion throws, leaving the job retryable', async () => {
    boundary.convertError = new Error('boom');

    const res = await post();
    expect(res.status).toBe(500);
    expect(boundary.lastMarker).toBeUndefined();
  });
});
