import { Target } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import type { LearningPlanPanelData } from '@/components/sky/learning/learning-plan-panel';
import { buildPlannedDailyTaskAction } from '@/components/sky/learning/workshop-page';

const fallback = {
  title: '画像兜底任务',
  detail: '旧画像推荐',
  href: '/fallback',
  icon: Target,
  duration: { min: 10, max: 20 },
};

function makePlanData(nextTask: unknown) {
  return {
    plan: { id: 'plan-1' },
    view: {
      nextTask,
      summary: {
        totalTasks: nextTask ? 1 : 0,
        completedTasks: 0,
        plannedMinutes: nextTask ? 30 : 0,
        completionRate: 0,
      },
    },
  } as unknown as LearningPlanPanelData;
}

describe('天梯工坊算法计划', () => {
  it('prioritizes today plan task over the old profile fallback', () => {
    const action = buildPlannedDailyTaskAction(
      makePlanData({
        title: '今日函数专项',
        objective: '完成路径节点练习',
        actionHref: '/sky/cloud-mind/quiz?topic=function',
        plannedMinutes: 30,
      }),
      fallback,
    );

    expect(action).toMatchObject({
      title: '今日函数专项',
      detail: '完成路径节点练习',
      href: '/sky/cloud-mind/quiz?topic=function',
      duration: { min: 30, max: 30 },
    });
  });

  it('shows a buffer day when an active plan has no task today', () => {
    const action = buildPlannedDailyTaskAction(makePlanData(null), fallback);

    expect(action).toMatchObject({
      title: '今日为计划缓冲日',
      href: '/sky/learning/path',
      duration: { min: 0, max: 0 },
    });
  });
});
