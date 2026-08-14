import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LearningPlanPanel,
  type LearningPlanPanelData,
} from '@/components/sky/learning/learning-plan-panel';
import type { LearningTask } from '@/lib/adaptive-learning/contracts';

function makePlanResponse(
  kind: 'today' | 'week' | 'month',
  title = '今日导数专项练习',
): LearningPlanPanelData {
  const task: LearningTask = {
    id: `task-${kind}`,
    pathNodeId: 'path-node-1',
    nodeId: 'derivative-concept',
    type: 'practice',
    title,
    objective: '巩固导数概念',
    plannedMinutes: 30,
    difficulty: 2,
    resourceIds: [],
    successCriteria: ['完成练习'],
    status: 'pending',
    scheduledDate: '2026-08-06',
    reasonCodes: ['low-mastery'],
    actionHref: '/sky/cloud-mind/quiz?topic=derivative',
  };

  const from = kind === 'today' ? '2026-08-06' : '2026-08-04';
  const to = kind === 'today' ? '2026-08-06' : kind === 'week' ? '2026-08-10' : '2026-09-02';

  return {
    plan: {
      id: 'plan-1',
      userId: 'user-1',
      pathId: 'path-1',
      version: 1,
      status: 'active',
      generatedAt: '2026-08-06T00:00:00.000Z',
      validFrom: '2026-08-06',
      validTo: '2026-09-02',
      curriculumPackVersion: 'test',
      plannerVersion: 'test',
      profileSnapshot: {} as never,
      tasks: [task],
      weeklyTargets: [],
      constraintChecks: ['within-budget'],
      evidenceEventIds: ['event-1'],
    },
    view: {
      kind,
      planId: 'plan-1',
      pathId: 'path-1',
      from,
      to,
      tasks: [task],
      weeklyTargets: [],
      nextTask: task,
      summary: {
        totalTasks: 1,
        completedTasks: 0,
        plannedMinutes: 30,
        completionRate: 0,
      },
    },
  };
}

function okJson(data: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    json: async () => ({ success: true, data }),
  } as Response);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LearningPlanPanel', () => {
  it('shows the daily projection and its path-bound task', () => {
    render(
      <LearningPlanPanel initialData={makePlanResponse('today')} onPlanChanged={vi.fn()} />,
    );

    expect(screen.getByText('今日导数专项练习')).toBeInTheDocument();
    expect(screen.getByText('1 项')).toBeInTheDocument();
    expect(screen.getByText('30 分钟')).toBeInTheDocument();
    expect(screen.getByText('按你的学习路线')).toBeInTheDocument();
    expect(screen.getByText('今天用：智能测验')).toBeInTheDocument();
    expect(screen.getByText('为什么需要做？')).toBeInTheDocument();
    expect(
      screen.getByText('这部分目前还不熟练，先把基础补清楚，再继续往后学。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /开始练习/ })).toHaveAttribute(
      'href',
      '/sky/cloud-mind/quiz?topic=derivative',
    );
  });

  it('loads the weekly projection when its tab is selected', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() => okJson(makePlanResponse('week', '本周复习任务')));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <LearningPlanPanel initialData={makePlanResponse('today')} onPlanChanged={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('tab', { name: '本周' }));

    expect(await screen.findByText('本周复习任务')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/sky/learning-plan?view=week', {
      credentials: 'include',
    });
  });

  it('marks a task complete and refreshes the completion projection', async () => {
    const initial = makePlanResponse('today');
    const refreshed = makePlanResponse('today');
    const completedTask = { ...refreshed.view.tasks[0], status: 'completed' as const };
    refreshed.view = {
      ...refreshed.view,
      tasks: [completedTask],
      nextTask: null,
      summary: {
        ...refreshed.view.summary,
        completedTasks: 1,
        completionRate: 100,
      },
    };
    refreshed.plan = { ...refreshed.plan, tasks: [completedTask] };

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() =>
        okJson({ plan: refreshed.plan, task: completedTask, event: { eventId: 'event-2' } }),
      )
      .mockImplementationOnce(() => okJson(refreshed));
    const onPlanChanged = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<LearningPlanPanel initialData={initial} onPlanChanged={onPlanChanged} />);

    fireEvent.click(screen.getByRole('button', { name: '标记任务完成' }));

    await waitFor(() => expect(onPlanChanged).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/sky/learning-plan/tasks/task-today');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      status: 'completed',
    });
    expect(await screen.findByText('100%')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();
  });

  it.each([
    ['调整未来48小时', 'micro'],
    ['重排剩余计划', 'full'],
  ] as const)('sends a %s manual replan and refreshes the panel', async (buttonName, mode) => {
    const refreshed = makePlanResponse('today', `${mode} 重排后任务`);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() => okJson({ plan: refreshed.plan, adjustment: { mode } }))
      .mockImplementationOnce(() => okJson(refreshed));
    const onPlanChanged = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <LearningPlanPanel
        initialData={makePlanResponse('today')}
        onPlanChanged={onPlanChanged}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: buttonName }));

    await waitFor(() => expect(onPlanChanged).toHaveBeenCalledTimes(1));
    const [, patchInit] = fetchMock.mock.calls[0];
    expect(fetchMock.mock.calls[0][0]).toBe('/api/sky/learning-plan');
    expect(patchInit).toMatchObject({
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(String(patchInit?.body))).toMatchObject({
      mode,
      triggerEventIds: [expect.stringMatching(/^manual-replan:/)],
    });
    expect(await screen.findByText(`${mode} 重排后任务`)).toBeInTheDocument();
  });
});
