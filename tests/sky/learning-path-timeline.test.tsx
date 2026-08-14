import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LearningPathTimeline } from '@/components/sky/study-lab/learning-path-timeline';
import type { StudyLabViewModel } from '@/lib/sky/study-lab-data';

describe('LearningPathTimeline', () => {
  it('shows the schedule projected from plan tasks on each path node', () => {
    const learningPath: StudyLabViewModel['learningPath'] = {
      title: '导数提升路径',
      nodes: [
        {
          id: 'node-1',
          topic: '导数概念',
          status: 'in_progress',
          knowledgePoints: ['变化率'],
          scheduledDate: '2026-08-06',
          scheduledTaskCount: 1,
          isToday: true,
        },
      ],
    };

    render(<LearningPathTimeline learningPath={learningPath} />);

    expect(screen.getByText('今日 · 1 项计划')).toBeInTheDocument();
  });
});
