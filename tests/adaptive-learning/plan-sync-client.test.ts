import { afterEach, describe, expect, it, vi } from 'vitest';

import { completeLearningPlanTaskFromEvidence } from '@/lib/adaptive-learning/client/complete-learning-plan-task';

function response(payload: unknown): Response {
  return {
    ok: true,
    json: async () => payload,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('completeLearningPlanTaskFromEvidence', () => {
  it('completes a matching practice task after a verified result', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          success: true,
          data: {
            view: {
              nextTask: {
                id: 'task-1',
                nodeId: 'uni-linear-algebra-eigenvalue',
                type: 'practice',
              },
            },
          },
        }),
      )
      .mockResolvedValueOnce(response({ success: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      completeLearningPlanTaskFromEvidence(['uni-linear-algebra-eigenvalue']),
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/sky/learning-plan/tasks/task-1');
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      status: 'completed',
    });
  });

  it('leaves unrelated tasks untouched', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        success: true,
        data: {
          view: {
            nextTask: {
              id: 'task-1',
              nodeId: 'uni-linear-algebra-eigenvalue',
              type: 'practice',
            },
          },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(completeLearningPlanTaskFromEvidence(['hs-physics-electromagnetic-induction'])).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
