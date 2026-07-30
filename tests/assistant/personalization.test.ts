import { describe, expect, it } from 'vitest';
import {
  buildAssistantActionPlan,
  buildAssistantPersonalizationPrompt,
  buildAssistantRagEvidence,
  buildAssistantStrategy,
  pickPersonalizationFromUser,
} from '@/lib/assistant/personalization';
import { buildPersonalizationPrompt } from '@/lib/agents/personalization-utils';
import type { StudentProfile } from '@/lib/student/profile-types';
import type { QuestionBankEntry } from '@/lib/solve/types';
import type { UserEntry } from '@/lib/storage/dao/users';
import type { TeachingPreference } from '@/lib/onboarding/types';

const masteryBySubject: StudentProfile['masteryBySubject'] = {
  math: 40,
  physics: 0,
  chemistry: 0,
  biology: 0,
  chinese: 0,
  english: 0,
  history: 0,
  geography: 0,
  politics: 0,
  unknown: 0,
};

const weakQuadraticProfile: StudentProfile = {
  userId: 'u1',
  masteryBySubject,
  masteryByKnowledge: { 二次函数顶点式: 22 },
  weakPoints: ['二次函数顶点式'],
  strongPoints: [],
  errorPatterns: [
    {
      knowledgePoint: '二次函数顶点式',
      errorType: 'concept-unclear',
      frequency: 4,
      lastOccurrence: new Date('2026-06-01'),
    },
  ],
  totalQuestions: 12,
  totalCorrect: 5,
  lastUpdated: new Date('2026-06-01'),
};

const quadraticHistoryEntry: QuestionBankEntry = {
  id: 'q1',
  problemHash: 'hash-q1',
  problemText: '求二次函数顶点',
  answer: '顶点由配方得到',
  knowledgePoints: [
    {
      name: '二次函数图像平移',
      description: '二次函数图像的左右上下移动',
      difficulty: 'medium',
    },
  ],
  agentId: 'universal',
  solvedAt: Date.now(),
  verified: true,
};

describe('assistant personalization', () => {
  function userWithPreference(preference: TeachingPreference): UserEntry {
    return {
      learningOnboarding: {
        version: 1,
        status: 'completed',
        weakSubjects: ['math'],
        learningGoal: 'build-foundations',
        teachingPreference: preference,
        completedAt: 100,
      },
    } as UserEntry;
  }

  it('lowers difficulty and starts with hints when the question touches weak knowledge', () => {
    const strategy = buildAssistantStrategy({
      userMessage: '二次函数顶点式怎么配方？',
      style: 'detailed',
      profile: weakQuadraticProfile,
    });

    expect(strategy.difficulty).toBe('easier');
    expect(strategy.teachingMode).toBe('hint_first');
    expect(strategy.shouldMentionProfile).toBe(true);
    expect(strategy.recommendedNextAction).toBe('quiz');
  });

  it('respects explicit concise and visual preferences', () => {
    const strategy = buildAssistantStrategy({
      userMessage: '解释一下力的合成',
      style: 'detailed',
      personalization: {
        detailLevel: 'concise',
        learningStyle: 'visual',
        aiPersonality: 'professional',
      },
    });

    expect(strategy.answerDepth).toBe('concise');
    expect(strategy.teachingMode).toBe('visual');
    expect(strategy.tone).toBe('professional');
  });

  it('selects RAG evidence from matching mistakes and solve history', () => {
    const evidence = buildAssistantRagEvidence({
      userMessage: '二次函数图像平移老是弄错',
      mistakes: [
        {
          id: 'm1',
          problemText: '二次函数图像向左平移',
          userAnswer: '向右',
          correctAnswer: '向左',
          errorType: 'concept',
          knowledgePoints: ['二次函数图像平移'],
          reviewCount: 0,
          masteryLevel: 0,
          reviewed: false,
        },
        {
          id: 'm2',
          problemText: '英语语法题',
          userAnswer: 'A',
          correctAnswer: 'B',
          errorType: 'reading',
          knowledgePoints: ['定语从句'],
          reviewCount: 0,
          masteryLevel: 0,
          reviewed: false,
        },
      ],
      solveHistory: [quadraticHistoryEntry],
    });

    expect(evidence.items.map((item) => item.sourceId)).toEqual(['m1', 'q1']);
    expect(evidence.summary).toContain('二次函数图像平移');
  });

  it('detects lightweight action plans from student feedback', () => {
    expect(buildAssistantActionPlan('我懂了').primaryAction).toBe('update_mastery');
    expect(buildAssistantActionPlan('再练一题').primaryAction).toBe('generate_quiz');
    expect(buildAssistantActionPlan('复习一下三角函数').primaryAction).toBe('review_plan');
  });

  it('builds a compact prompt without leaking raw JSON', () => {
    const prompt = buildAssistantPersonalizationPrompt({
      userMessage: '这道二次函数题怎么做？',
      strategy: {
        answerDepth: 'detailed',
        teachingMode: 'hint_first',
        difficulty: 'easier',
        tone: 'encouraging',
        shouldMentionProfile: true,
        recommendedNextAction: 'quiz',
      },
      evidence: {
        summary: '相关证据：二次函数顶点式掌握度较低。',
        items: [],
      },
    });

    expect(prompt).toContain('【个性化教学策略】');
    expect(prompt).toContain('自然提及');
    expect(prompt).not.toContain('{');
    expect(prompt.length).toBeLessThan(1800);
  });

  it('uses a completed onboarding teaching preference in centralized prompts', () => {
    expect(
      pickPersonalizationFromUser(userWithPreference('example-first')).teachingPreference,
    ).toBe('example-first');

    const prompt = buildAssistantPersonalizationPrompt({
      userMessage: '讲一下函数',
      strategy: {
        answerDepth: 'standard',
        teachingMode: 'direct',
        difficulty: 'current',
        tone: 'friendly',
        shouldMentionProfile: false,
        recommendedNextAction: 'none',
      },
      personalization: { teachingPreference: 'step-by-step' },
    });

    expect(prompt).toContain('把推导拆成连续步骤');
    expect(buildPersonalizationPrompt({ teachingPreference: 'step-by-step' })).toContain(
      '把推导拆成连续步骤',
    );
  });

  it('uses a v2 learner explanation preference without treating self-report as mastery', () => {
    const personalization = pickPersonalizationFromUser({
      educationLevel: null,
      grade: null,
      favoriteSubjects: null,
      learningOnboarding: {
        version: 2,
        status: 'completed',
        identities: ['learner'],
        primaryIdentity: 'learner',
        profiles: {
          learner: {
            identity: 'learner',
            context: {
              stage: 'undergraduate',
              learningDomains: [{ domain: { source: 'custom', name: '量子信息' } }],
              supportDomains: [],
            },
            goals: [{ source: 'catalog', id: 'explore-interest', label: '探索兴趣' }],
            roleNeeds: ['clearer-explanations'],
            preferences: { explanationStyle: 'visual-explanation' },
            completedAt: 10,
          },
        },
        completedAt: 10,
      },
    } as unknown as UserEntry);

    expect(personalization.teachingPreference).toBe('visual-explanation');
    expect(personalization.productIdentity).toBe('learner');
    expect(personalization.profileInstructions).toContain('当前身份：学习者');
  });

  it('builds educator-specific prompt context from the primary identity', () => {
    const personalization = pickPersonalizationFromUser({
      educationLevel: null,
      grade: null,
      favoriteSubjects: null,
      learningOnboarding: {
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
                teachingDomains: [{ domain: { source: 'catalog', id: 'math', name: '数学' } }],
              },
            ],
            goals: [{ source: 'catalog', id: 'prepare-lessons', label: '备课' }],
            roleNeeds: ['question-design'],
            preferences: { primarySupport: 'lesson-plan-structure' },
            completedAt: 10,
          },
        },
        completedAt: 10,
      },
    } as UserEntry);
    const prompt = buildAssistantPersonalizationPrompt({
      userMessage: '帮我设计一节函数课',
      strategy: {
        answerDepth: 'standard',
        teachingMode: 'direct',
        difficulty: 'current',
        tone: 'professional',
        shouldMentionProfile: false,
        recommendedNextAction: 'none',
      },
      personalization,
    });

    expect(personalization.productIdentity).toBe('educator');
    expect(personalization.teachingPreference).toBeNull();
    expect(prompt).toContain('当前身份：教师 / 培训者');
    expect(prompt).toContain('优先支持：教案结构');
    expect(prompt).not.toContain('学生薄弱点');
  });
});
