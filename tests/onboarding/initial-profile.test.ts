import { describe, expect, it } from 'vitest';

import { buildInitialProfileSnapshot } from '@/lib/onboarding/initial-profile';
import type { UniversalOnboardingProfile } from '@/lib/onboarding/types';

function learnerProfile(): Extract<UniversalOnboardingProfile, { status: 'completed' }> {
  return {
    version: 2,
    status: 'completed',
    identities: ['learner'],
    primaryIdentity: 'learner',
    profiles: {
      learner: {
        identity: 'learner',
        context: {
          stage: 'undergraduate',
          learningDomains: [{ domain: { source: 'catalog', id: 'programming', name: '编程' } }],
          supportDomains: [{ source: 'catalog', id: 'math-statistics', name: '数学与统计' }],
        },
        goals: [{ source: 'catalog', id: 'build-foundations', label: '巩固基础' }],
        roleNeeds: ['identify-gaps', 'learning-plan'],
        preferences: { explanationStyle: 'visual-explanation' },
        baseline: {
          foundation: 'developing',
          weeklyTime: 'regular',
        },
        detail: '希望能完成一个多智能体课程项目',
        completedAt: 100,
      },
    },
    completedAt: 100,
  };
}

describe('buildInitialProfileSnapshot', () => {
  it('turns learner onboarding answers into an explainable initial profile', () => {
    const snapshot = buildInitialProfileSnapshot(learnerProfile());

    expect(snapshot).toMatchObject({
      status: 'self-reported',
      identity: 'learner',
      stage: 'undergraduate',
      stageLabel: '本科',
      focusDomains: ['编程'],
      supportDomains: ['数学与统计'],
      goals: ['巩固基础'],
      foundation: 'developing',
      weeklyTime: 'regular',
      recommendedDifficulty: 'easy',
    });
    expect(snapshot.completeness).toBeGreaterThanOrEqual(85);
    expect(snapshot.summary).toContain('本科');
    expect(snapshot.summary).toContain('数学与统计');
  });

  it('provides tool suggestions that carry profile context into real product routes', () => {
    const snapshot = buildInitialProfileSnapshot(learnerProfile());

    expect(snapshot.toolSuggestions.map((item) => item.tool)).toEqual(
      expect.arrayContaining(['quiz', 'teaching', 'slides']),
    );
    expect(snapshot.toolSuggestions[0]).toMatchObject({
      tool: 'quiz',
      title: '先诊断数学与统计',
    });
    expect(snapshot.toolSuggestions[0].href).toContain('/sky/cloud-mind/quiz');
    expect(snapshot.toolSuggestions[0].href).toContain('mode=diagnostic');
    expect(snapshot.toolSuggestions.every((item) => item.reason.length > 0)).toBe(true);
  });

  it('gives educators a complete set of teaching, slides, and diagnostic actions', () => {
    const snapshot = buildInitialProfileSnapshot({
      version: 2,
      status: 'completed',
      identities: ['educator'],
      primaryIdentity: 'educator',
      profiles: {
        educator: {
          identity: 'educator',
          contexts: [
            {
              stage: 'high',
              teachingDomains: [{ domain: { source: 'catalog', id: 'physics', name: '物理' } }],
            },
          ],
          goals: [{ source: 'catalog', id: 'prepare-lessons', label: '备课' }],
          roleNeeds: ['reduce-repetitive-work'],
          preferences: { primarySupport: 'lesson-plan-structure' },
          completedAt: 100,
        },
      },
      completedAt: 100,
    });

    expect(snapshot.toolSuggestions).toHaveLength(3);
    expect(snapshot.toolSuggestions.map((item) => item.tool)).toEqual([
      'teaching',
      'slides',
      'quiz',
    ]);
    expect(snapshot.toolSuggestions[0].title).toContain('物理');
  });
});
