import { describe, expect, it, vi } from 'vitest';

import type { ProfileSignal } from '@/lib/student/profile-signals';

vi.mock('server-only', () => ({}));

describe('software cup resource personalization', () => {
  it('uses stored conversation profile signals when generating resources', async () => {
    const { runSoftwareCupGeneration } = await import('@/lib/software-cup/demo-service');
    const profileSignals: ProfileSignal[] = [
      {
        id: 'goal',
        userId: 'student-1',
        dimension: 'learningGoal',
        value: 'finish a RAG project',
        source: 'onboarding_chat',
        confidence: 0.9,
        evidence: ['I need to finish a RAG project'],
        createdAt: 1000,
      },
      {
        id: 'weak',
        userId: 'student-1',
        dimension: 'knowledgeBase',
        value: {
          strongPoints: ['Python'],
          weakPoints: ['vector retrieval'],
        },
        source: 'onboarding_chat',
        confidence: 0.86,
        evidence: ['vector retrieval is confusing'],
        createdAt: 1001,
      },
      {
        id: 'pref',
        userId: 'student-1',
        dimension: 'resourcePreference',
        value: ['code cases', 'diagrams'],
        source: 'onboarding_chat',
        confidence: 0.83,
        evidence: ['prefers code cases and diagrams'],
        createdAt: 1002,
      },
    ];

    const result = await runSoftwareCupGeneration('Please generate learning resources.', {
      profileSignals,
    });

    expect(result.studentProfile.dimensions.learningGoal.value).toBe('finish a RAG project');
    expect(result.studentProfile.dimensions.knowledgeBase.weakPoints).toEqual(['vector retrieval']);
    expect(result.studentProfile.dimensions.resourcePreference.value).toEqual([
      'code cases',
      'diagrams',
    ]);
    expect(result.resources[0].title).toContain('vector retrieval');
    expect(result.resources[0].personalizationReason).toContain('vector retrieval');
    expect(result.learningPath[0].goal).toContain('vector retrieval');
  });

  it('returns substantive downloadable content for every generated resource', async () => {
    const { runSoftwareCupGeneration } = await import('@/lib/software-cup/demo-service');

    const result = await runSoftwareCupGeneration(
      '软件工程学生，想补强过拟合、模型评估和 RAG，需要讲义、PPT、题库、代码案例和视频脚本。',
    );

    expect(result.resources.length).toBeGreaterThan(0);
    for (const resource of result.resources) {
      expect(resource.downloadFileName).toMatch(/\.md$/);
      expect(resource.content?.length ?? 0).toBeGreaterThan(180);
    }

    expect(result.resources.find((resource) => resource.type === 'quiz_bank')?.content).toContain(
      '参考答案',
    );
    expect(result.resources.find((resource) => resource.type === 'code_case')?.content).toContain(
      '实操案例',
    );
    expect(
      result.resources.find((resource) => resource.type === 'video_script')?.content,
    ).toContain('视频脚本');
  });
});
