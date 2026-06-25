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
  savePhaseOneResult: vi.fn(),
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
  savePhaseOneResultHybrid: mocks.savePhaseOneResult,
  updateClassroomGenerationJobProgressHybrid: mocks.updateProgress,
}));

describe('runClassroomGenerationJob', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    mocks.markRunning.mockResolvedValue(undefined);
    mocks.readJob.mockResolvedValue({ status: 'running', modelConfig: undefined });
    mocks.savePhaseOneResult.mockResolvedValue(undefined);
    mocks.markAwaitingReview.mockResolvedValue(undefined);
    mocks.updateProgress.mockResolvedValue(undefined);
    mocks.generateClassroom.mockResolvedValue({
      outlines: [],
      languageDirective: 'Use Chinese.',
      agents: [],
      stage: { id: 'stage-test', elements: [] },
      requirement: 'test',
      enableImageGeneration: false,
      enableVideoGeneration: false,
      enableTTS: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('continues outline generation when classroom KB search hangs', async () => {
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
        phase: 'outline_only',
      }),
    );

    await jobPromise;
  });
});
