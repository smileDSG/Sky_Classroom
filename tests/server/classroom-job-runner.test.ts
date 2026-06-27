import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  generateClassroom: vi.fn(),
  markRunning: vi.fn(),
  markFailed: vi.fn(),
  markAwaitingReview: vi.fn(),
  markSucceeded: vi.fn(),
  markResumed: vi.fn(),
  readJob: vi.fn(),
  updateProgress: vi.fn(),
}));

vi.mock('@/lib/knowledge-base/kb-manager', () => ({
  search: mocks.search,
}));

vi.mock('@/lib/server/classroom-generation', () => ({
  generateClassroom: mocks.generateClassroom,
  generateClassroomContinue: vi.fn(),
}));

vi.mock('@/lib/server/classroom-job-store-hybrid', () => ({
  markClassroomGenerationJobFailedHybrid: mocks.markFailed,
  markClassroomGenerationJobRunningHybrid: mocks.markRunning,
  markClassroomGenerationJobSucceededHybrid: mocks.markSucceeded,
  markClassroomGenerationJobAwaitingReviewHybrid: mocks.markAwaitingReview,
  markClassroomGenerationJobResumedHybrid: mocks.markResumed,
  readClassroomGenerationJobHybrid: mocks.readJob,
  updateClassroomGenerationJobProgressHybrid: mocks.updateProgress,
}));

describe('runClassroomGenerationJob', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    mocks.search.mockResolvedValue([]);
    mocks.markRunning.mockResolvedValue(undefined);
    mocks.readJob.mockResolvedValue({ status: 'initializing', modelConfig: undefined });
    mocks.markAwaitingReview.mockResolvedValue(undefined);
    mocks.markSucceeded.mockResolvedValue(undefined);
    mocks.updateProgress.mockResolvedValue(undefined);
    mocks.generateClassroom.mockResolvedValue({
      id: 'stage-test',
      url: 'http://localhost:3000/classroom/stage-test',
      stage: { id: 'stage-test', name: 'Test', createdAt: 1, updatedAt: 1 },
      scenes: [],
      scenesCount: 0,
      createdAt: '2026-06-26T00:00:00.000Z',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('continues full OpenMAIC classroom generation when classroom KB search hangs', async () => {
    mocks.search.mockReturnValue(new Promise(() => {}));

    const { runClassroomGenerationJob } = await import('@/lib/server/classroom-job-runner');

    const jobPromise = runClassroomGenerationJob(
      'job-kb-hangs',
      { requirement: 'Teach Chinese paper cutting' },
      'http://localhost:3000',
    );

    await vi.advanceTimersByTimeAsync(2100);

    expect(mocks.generateClassroom).toHaveBeenCalledWith(
      { requirement: 'Teach Chinese paper cutting' },
      expect.objectContaining({
        baseUrl: 'http://localhost:3000',
      }),
    );
    expect(mocks.generateClassroom.mock.calls[0][1]).not.toHaveProperty('phase');
    expect(mocks.markSucceeded).toHaveBeenCalledWith(
      'job-kb-hangs',
      expect.objectContaining({ id: 'stage-test', scenesCount: 0 }),
    );
    expect(mocks.markAwaitingReview).not.toHaveBeenCalled();

    await jobPromise;
  });

  test('does not restart legacy review jobs', async () => {
    mocks.readJob.mockResolvedValue({
      status: 'awaiting_review',
      modelConfig: undefined,
      outlines: [{ id: 'outline-1', type: 'slide', title: 'Ready', order: 1 }],
      phaseOneResult: { outlines: [] },
    });

    const { runClassroomGenerationJob } = await import('@/lib/server/classroom-job-runner');

    await runClassroomGenerationJob(
      'job-already-reviewing',
      { requirement: 'Teach quadratic functions' },
      'http://localhost:3000',
    );

    expect(mocks.markRunning).not.toHaveBeenCalled();
    expect(mocks.generateClassroom).not.toHaveBeenCalled();
    expect(mocks.markAwaitingReview).not.toHaveBeenCalled();
  });

  test('resumes a persisted running job when no in-memory runner exists', async () => {
    mocks.readJob.mockResolvedValue({
      status: 'running',
      startedAt: new Date().toISOString(),
      modelConfig: undefined,
    });

    const { runClassroomGenerationJob } = await import('@/lib/server/classroom-job-runner');

    await runClassroomGenerationJob(
      'job-already-running',
      { requirement: 'Teach cubic functions' },
      'http://localhost:3000',
    );

    expect(mocks.markRunning).toHaveBeenCalledWith('job-already-running');
    expect(mocks.generateClassroom).toHaveBeenCalledWith(
      { requirement: 'Teach cubic functions' },
      expect.objectContaining({ baseUrl: 'http://localhost:3000' }),
    );
    expect(mocks.markSucceeded).toHaveBeenCalledWith(
      'job-already-running',
      expect.objectContaining({ id: 'stage-test', scenesCount: 0 }),
    );
    expect(mocks.markAwaitingReview).not.toHaveBeenCalled();
  });
});
