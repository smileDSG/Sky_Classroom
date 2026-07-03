import { describe, expect, it } from 'vitest';
import { buildLearningPrescription } from '@/lib/student/learning-prescription';
import type { ConversationalProfilePatch } from '@/lib/student/conversation-profile';

const baseProfile = {
  userId: 'u1',
  masteryBySubject: { math: 72, unknown: 0 },
  masteryByKnowledge: {
    过拟合: 20,
    模型评估: 35,
    RAG: 48,
    Python: 86,
  },
  weakPoints: ['模型评估', '过拟合'],
  strongPoints: ['Python'],
  errorPatterns: [
    {
      knowledgePoint: '过拟合',
      errorType: 'concept-unclear',
      frequency: 3,
      lastOccurrence: '2026-07-01T08:00:00.000Z',
    },
    {
      knowledgePoint: '模型评估',
      errorType: 'method-wrong',
      frequency: 1,
      lastOccurrence: '2026-06-29T08:00:00.000Z',
    },
  ],
  totalQuestions: 25,
  totalCorrect: 16,
  lastUpdated: '2026-07-01T09:00:00.000Z',
};

describe('buildLearningPrescription', () => {
  it('prioritizes weak behavior data and uses conversation preferences for the learning mode', () => {
    const preference: ConversationalProfilePatch = {
      learningGoal: {
        value: '两周内补齐机器学习基础',
        confidence: 0.84,
        evidence: ['两周', '机器学习'],
      },
      knowledgeBase: {
        weakPoints: ['RAG', '过拟合'],
        strongPoints: [],
        confidence: 0.82,
        evidence: ['RAG', '过拟合'],
      },
      resourcePreference: {
        value: ['代码案例', '练习'],
        confidence: 0.82,
        evidence: ['代码', '练习'],
      },
      interactionPreference: {
        value: '步骤优先',
        confidence: 0.8,
        evidence: ['步骤'],
      },
      learningPace: {
        value: '两周内完成一轮补强',
        confidence: 0.82,
        evidence: ['两周'],
      },
    };

    const prescription = buildLearningPrescription(baseProfile, preference);

    expect(prescription.priorityTopics.map((topic) => topic.name).slice(0, 3)).toEqual([
      '过拟合',
      '模型评估',
      'RAG',
    ]);
    expect(prescription.recommendedMode).toContain('代码案例');
    expect(prescription.recommendedMode).toContain('步骤');
    expect(prescription.headline).toContain('过拟合');
    expect(prescription.nextActions.map((action) => action.key)).toEqual([
      'teach',
      'quiz',
      'review',
      'graph',
    ]);
    expect(prescription.evidence.some((item) => item.source === 'mixed')).toBe(true);
  });

  it('returns an onboarding-oriented prescription when there is no behavior data yet', () => {
    const prescription = buildLearningPrescription({
      ...baseProfile,
      masteryByKnowledge: {},
      weakPoints: [],
      strongPoints: [],
      errorPatterns: [],
      totalQuestions: 0,
      totalCorrect: 0,
    });

    expect(prescription.headline).toContain('还没有足够数据');
    expect(prescription.nextActions[0].key).toBe('diagnostic');
    expect(prescription.priorityTopics).toEqual([]);
  });
});
