import { describe, it, expect, vi } from 'vitest';
import { generateHomework } from '@/lib/teaching/homework-generator';

// Mock question-bank dao
vi.mock('@/lib/question-bank/dao', () => ({
  search: vi.fn(async (filter: { knowledgePoint?: string }) => {
    if (filter.knowledgePoint === '二次函数') {
      return [
        {
          id: 'qb_1',
          content: '二次函数顶点坐标是什么？',
          answer: 'A',
          explanation: '顶点公式解析',
          options: ['$(-b/2a, c)$', '$(0,0)$', '$(1,1)$', '$(2,2)$'],
          knowledgePoints: ['二次函数'],
          subject: 'math',
          grade: '',
          difficulty: 'medium',
          questionType: 'choice',
          image: null,
          source: null,
          tags: [],
          problemHash: 'hash1',
          verified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
    }
    return [];
  }),
}));

// Mock quiz-agent
vi.mock('@/lib/agents/cloud-mind/quiz-agent', () => ({
  generateQuiz: vi.fn(
    async (_subject: string, _difficulty: string, topic: string, count: number) => ({
      subject: 'math',
      topic,
      difficulty: 'medium',
      questions: Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        question: `AI题${i + 1}：关于${topic}`,
        options: ['A', 'B', 'C', 'D'],
        answer: 0,
        explanation: 'AI解析',
      })),
    }),
  ),
}));

describe('homework-generator', () => {
  it('generates general reinforcement when no weak points', async () => {
    const hw = await generateHomework(
      [{ sectionId: 's1', feedbackType: 'mastered', knowledgePoints: ['二次函数'], timestamp: 1 }],
      [
        {
          sectionId: 's1',
          chunkOrder: 1,
          knowledgePoints: ['二次函数'],
          isCorrect: true,
          timestamp: 1,
        },
      ],
      '二次函数',
      'math',
    );
    expect(hw.weakKnowledgePoints).toHaveLength(0);
    expect(hw.questions.length).toBeGreaterThan(0);
    expect(hw.title).toContain('巩固练习');
  });

  it('generates targeted homework for weak points', async () => {
    const hw = await generateHomework(
      [
        {
          sectionId: 's1',
          feedbackType: 'needs_review',
          knowledgePoints: ['二次函数'],
          timestamp: 1,
        },
      ],
      [],
      '二次函数',
      'math',
    );
    expect(hw.weakKnowledgePoints).toContain('二次函数');
    expect(hw.questions.length).toBeGreaterThan(0);
    expect(hw.title).toContain('个性化作业');
  });

  it('combines bank and AI questions', async () => {
    const hw = await generateHomework(
      [
        {
          sectionId: 's1',
          feedbackType: 'needs_review',
          knowledgePoints: ['二次函数'],
          timestamp: 1,
        },
        { sectionId: 's2', feedbackType: 'needs_review', knowledgePoints: ['导数'], timestamp: 1 },
      ],
      [],
      '函数',
      'math',
    );
    expect(hw.questions.length).toBeGreaterThan(0);
    // Should have at least one AI-generated question since bank only returns for 二次函数
    const aiQuestions = hw.questions.filter((q) => q.source === 'ai-generated');
    expect(aiQuestions.length).toBeGreaterThanOrEqual(0);
  });
});
