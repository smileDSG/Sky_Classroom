import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TodayMissionPanel } from '@/components/sky/study-lab/today-mission-panel';
import type { StudyLabViewModel } from '@/lib/sky/study-lab-data';

function makeViewModel(): StudyLabViewModel {
  return {
    generatedAt: 1,
    profile: {
      hasLearningData: true,
      weakPoints: [],
      recentAccuracy: 60,
      preferredDifficulty: 'medium',
      recommendation: {
        title: '旧画像推荐',
        reason: '旧推荐理由',
        href: '/sky/cloud-mind/memory',
        targetTool: 'memory',
      },
    },
    workshop: {
      mistakeTotal: 0,
      dueReviewCount: 0,
      todayStudyMinutes: 0,
      streakDays: 0,
      masteryPercent: 0,
      dataSources: {},
    },
    learningPath: null,
    learningPlan: {
      id: 'plan-1',
      pathId: 'path-1',
      validFrom: '2026-08-06',
      validTo: '2026-09-02',
      todayDate: '2026-08-06',
      todayTask: {
        id: 'task-1',
        pathNodeId: 'node-1',
        nodeId: 'derivative-concept',
        type: 'practice',
        title: '今日导数专项练习',
        objective: '巩固导数概念',
        plannedMinutes: 30,
        status: 'pending',
        scheduledDate: '2026-08-06',
        successCriteria: ['完成练习'],
        actionHref: '/sky/cloud-mind/quiz?topic=derivative',
      },
      tasks: [],
      todaySummary: {
        totalTasks: 1,
        completedTasks: 0,
        plannedMinutes: 30,
        completionRate: 0,
      },
    },
    errors: {},
  };
}

describe('TodayMissionPanel', () => {
  it('prioritizes the scheduled plan task over the profile recommendation', () => {
    render(
      <TodayMissionPanel viewModel={makeViewModel()} onRefresh={vi.fn()} refreshing={false} />,
    );

    expect(screen.getByText('今日导数专项练习')).toBeInTheDocument();
    expect(screen.getByText('30 分钟')).toBeInTheDocument();
    expect(screen.queryByText('旧画像推荐')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /开始今日任务/ })).toHaveAttribute(
      'href',
      '/sky/cloud-mind/quiz?topic=derivative',
    );
  });

  it('shows a plan rest day instead of falling back when an active plan has no task today', () => {
    const viewModel = makeViewModel();
    viewModel.learningPlan!.todayTask = null;
    viewModel.learningPlan!.todaySummary = {
      totalTasks: 0,
      completedTasks: 0,
      plannedMinutes: 0,
      completionRate: 0,
    };

    render(<TodayMissionPanel viewModel={viewModel} onRefresh={vi.fn()} refreshing={false} />);

    expect(screen.getByText('今日为计划缓冲日')).toBeInTheDocument();
    expect(screen.queryByText('旧画像推荐')).not.toBeInTheDocument();
  });
});
