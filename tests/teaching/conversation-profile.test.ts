import { describe, expect, it } from 'vitest';

import { extractConversationProfile } from '@/lib/student/conversation-profile';

describe('extractConversationProfile', () => {
  it('extracts onboarding signals with evidence from a rich learning request', () => {
    const result = extractConversationProfile({
      message:
        '我是计算机专业学生，想两周内补机器学习，主要卡在过拟合和模型评估，希望多用 Python 代码案例和图解讲。',
      stage: 'onboarding',
    });

    expect(result.profilePatch.learningGoal?.value).toContain('机器学习');
    expect(result.profilePatch.knowledgeBase?.weakPoints).toEqual(
      expect.arrayContaining(['过拟合', '模型评估']),
    );
    expect(result.profilePatch.resourcePreference?.value).toEqual(
      expect.arrayContaining(['代码案例', '图解']),
    );
    expect(result.profilePatch.learningPace?.value).toContain('两周');
    expect(result.evidence).toEqual(expect.arrayContaining(['机器学习', '过拟合', '模型评估']));
    expect(result.needsConfirmation).toBe(true);
    expect(result.nextQuestion).toContain('我先按这个画像');
  });

  it('asks a follow-up question when the learner only gives a broad goal', () => {
    const result = extractConversationProfile({
      message: '我想学 AI',
      stage: 'onboarding',
    });

    expect(result.profilePatch.learningGoal?.value).toBe('AI');
    expect(result.needsConfirmation).toBe(false);
    expect(result.nextQuestion).toContain('卡在哪里');
  });

  it('keeps emotional state short-term and asks for confirmation when core fields are covered', () => {
    const result = extractConversationProfile({
      message: '我下个月要比赛，现在特别焦虑，RAG 总是搞不懂。请直接给我步骤，再配一点练习。',
      stage: 'learning',
    });

    expect(result.profilePatch.currentLearningState?.value).toContain('焦虑');
    expect(result.profilePatch.interactionPreference?.value).toBe('步骤优先');
    expect(result.profilePatch.resourcePreference?.value).toEqual(expect.arrayContaining(['练习']));
    expect(result.profilePatch.knowledgeBase?.weakPoints).toContain('RAG');
    expect(result.needsConfirmation).toBe(true);
  });
});
