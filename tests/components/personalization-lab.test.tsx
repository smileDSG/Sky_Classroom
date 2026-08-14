import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PersonalizationLab } from '@/components/sky/learning/personalization-lab';

const initialState = {
  sessionId: 'client-demo',
  generatedAt: '2026-07-31T00:00:00.000Z',
  eventCount: 0,
  knowledgeStates: [
    {
      nodeId: 'derivative-definition',
      displayName: '导数定义',
      alpha: 1,
      beta: 1,
      mastery: 0.5,
      confidence: 0,
      retention: 1,
      stabilityDays: 7,
      evidenceCount: 0,
      repeatedErrorCount: 0,
      lastEvidenceAt: null,
    },
  ],
  decision: {
    action: 'diagnostic',
    difficulty: 'easy',
    format: 'worked-example',
    durationMinutes: 5,
    topic: '导数定义',
    reasonCodes: ['no-evidence'],
    summary: '还没有答题证据，先做一次基础诊断。',
  },
};

const fetchMock = vi.fn();

describe('PersonalizationLab', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: initialState }), { status: 200 }),
    );
  });

  it('shows the current decision and updates after a simulated incorrect answer', async () => {
    render(<PersonalizationLab />);

    expect(await screen.findByRole('heading', { name: '学习情况实验室' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '导数定义' })).toBeInTheDocument();
    expect(screen.getByText('先做基础练习')).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            ...initialState,
            eventCount: 1,
            knowledgeStates: [
              { ...initialState.knowledgeStates[0], evidenceCount: 1, mastery: 0.357 },
            ],
            decision: {
              ...initialState.decision,
              reasonCodes: ['low-confidence'],
              summary: '已有少量证据，但判断还不稳定，继续诊断。',
            },
          },
        }),
        { status: 200 },
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: '答错一题' }));

    await waitFor(() => {
      expect(screen.getByText('已模拟 1 个学习事件')).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/sky/personalization-lab',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
