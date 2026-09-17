import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mockRead = vi.fn();

vi.mock('@/lib/server/resource-generation-job-store', () => ({
  readResourceGenerationJobHybrid: (...args: unknown[]) => mockRead(...args),
}));

import { streamResourceGenerationJob } from '@/lib/server/resource-generation-stream';

function makeJob(patch: Record<string, unknown>) {
  return {
    id: 'res_test_1',
    input: 'input',
    inputPreview: 'input',
    ...patch,
  };
}

async function collect(job: Parameters<typeof streamResourceGenerationJob>[0]) {
  const events: any[] = [];
  for await (const event of streamResourceGenerationJob('res_test_1', {
    stageInitial: false,
    pollIntervalMs: 1,
    timeoutMs: 2000,
  })) {
    events.push(event);
    if (event.type === 'done' || event.type === 'error') break;
  }
  return events;
}

describe('resource generation stream helper', () => {
  it('emits incremental progress and a final done event', async () => {
    mockRead
      .mockResolvedValueOnce(
        makeJob({
          status: 'running',
          step: 'profile',
          progress: 20,
          message: '已了解你的学习情况',
        }),
      )
      .mockResolvedValueOnce(
        makeJob({ status: 'running', step: 'generate', progress: 74, message: '正在生成讲义' }),
      )
      .mockResolvedValueOnce(
        makeJob({
          status: 'succeeded',
          step: 'completed',
          progress: 100,
          result: { resources: [{ id: 'r1', type: 'markdown_lecture' }] },
        }),
      );

    const events = await collect('res_test_1');

    expect(events[0]?.type).toBe('progress');
    expect(events[0]?.progress).toBe(20);
    expect(events[0]?.message).toContain('了解你的学习情况');

    const progressEvents = events.filter((event) => event.type === 'progress');
    expect(progressEvents.map((event) => event.progress)).toEqual([20, 74]);
    expect(events.at(-1)?.type).toBe('done');
    expect(events.at(-1)?.result.resources[0].id).toBe('r1');
  });

  it('does not emit duplicate progress for unchanged state', async () => {
    mockRead.mockResolvedValue(
      makeJob({ status: 'running', step: 'generate', progress: 42, message: '进行中' }),
    );
    const events = await collect('res_test_1');
    const progressEvents = events.filter((event) => event.type === 'progress');
    expect(progressEvents).toHaveLength(1);
    expect(progressEvents[0]?.progress).toBe(42);
    expect(events.at(-1)?.type).toBe('error');
  });

  it('emits an error event when the job failed', async () => {
    mockRead
      .mockResolvedValueOnce(
        makeJob({ status: 'running', step: 'generate', progress: 60, message: '生成中' }),
      )
      .mockResolvedValueOnce(
        makeJob({ status: 'failed', step: 'failed', error: '生成模型不可用' }),
      );

    const events = await collect('res_test_1');
    expect(events.at(-1)?.type).toBe('error');
    expect(events.at(-1)?.message).toContain('生成模型不可用');
  });
});
