import { describe, expect, it } from 'vitest';
import { buildToolPersonalizationPolicies } from '@/lib/cloud-mind/tool-policies';

describe('buildToolPersonalizationPolicies', () => {
  it('gives each tool a different job and focus', () => {
    const policies = buildToolPersonalizationPolicies({
      tutoringPolicy: {
        targetTopic: '二次函数',
        difficulty: 'medium',
        explanationStyle: 'step_first',
        resourceFormats: ['worked_example'],
        pacing: 'steady',
        directives: [],
        evidence: [],
      },
      weakPoints: [
        {
          knowledgePoint: '二次函数',
          mastery: 48,
          recentMistakeCount: 3,
          actionHref: '/sky/cloud-mind/quiz?topic=二次函数',
        },
      ],
      dueReviews: [
        {
          id: 'review-1',
          kind: 'mistake',
          title: '顶点式应用题',
          knowledgePoints: ['顶点式'],
          dueAt: Date.now(),
          href: '/sky/learning',
        },
      ],
      learningPath: { next: '函数图像' },
    });

    expect(new Set(Object.values(policies).map((policy) => policy.mode)).size).toBe(6);
    expect(policies.solve).toMatchObject({
      mode: 'diagnose',
      targetTopic: '顶点式',
      questionCount: 1,
      durationMinutes: 5,
    });
    expect(policies.quiz).toMatchObject({
      mode: 'practice',
      targetTopic: '二次函数',
      action: 'quiz',
    });
    expect(policies.memory).toMatchObject({
      mode: 'retain',
      targetTopic: '顶点式',
      action: 'review',
    });
    expect(policies.teaching.mode).toBe('teach');
    expect(policies.slides).toMatchObject({ mode: 'present', questionCount: 0 });
    expect(policies.learningPath).toMatchObject({
      mode: 'plan',
      targetTopic: '函数图像',
      questionCount: 0,
    });
  });

  it('keeps first-time users on a short diagnostic path', () => {
    const policies = buildToolPersonalizationPolicies({
      tutoringPolicy: {
        difficulty: 'medium',
        explanationStyle: 'step_first',
        resourceFormats: ['worked_example'],
        pacing: 'steady',
        directives: [],
        evidence: [],
      },
      weakPoints: [],
      dueReviews: [],
    });

    expect(policies.solve.action).toBe('diagnostic');
    expect(policies.quiz).toMatchObject({ action: 'diagnostic', questionCount: 3 });
    expect(policies.memory.mode).toBe('retain');
  });
});
