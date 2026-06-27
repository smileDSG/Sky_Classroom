import { describe, it, expect, vi } from 'vitest';
import {
  generateQuizSectionContent,
  deterministicQuizChunks,
} from '@/lib/teaching/quiz-section-generator';
import * as quizAgent from '@/lib/agents/cloud-mind/quiz-agent';
import type { LessonSection } from '@/lib/teaching/lesson-types';

const mockSection: LessonSection = {
  id: 'section-quiz-1',
  title: '综合应用 - 随堂测验',
  contentType: 'quiz',
  depth: 'intermediate',
  knowledgePoints: ['受力分析', '连接体问题'],
  estimatedDuration: 5,
  hasQuiz: true,
};

describe('deterministicQuizChunks', () => {
  it('returns one quiz chunk per knowledge point', () => {
    const chunks = deterministicQuizChunks(mockSection);
    expect(chunks).toHaveLength(2);
    for (const chunk of chunks) {
      expect(chunk.type).toBe('quiz');
      expect(chunk.sectionId).toBe(mockSection.id);
      expect(chunk.question).toContain('下列说法正确的是');
      expect(chunk.options).toHaveLength(4);
      expect(chunk.correctAnswer).toBe(0);
      expect(typeof chunk.content).toBe('string');
      expect(chunk.order).toBeGreaterThan(0);
    }
  });

  it('falls back to section title when no knowledge points', () => {
    const section: LessonSection = { ...mockSection, knowledgePoints: [] };
    const chunks = deterministicQuizChunks(section);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].question).toContain(section.title);
  });
});

describe('generateQuizSectionContent', () => {
  it('converts quiz agent output to content chunks', async () => {
    vi.spyOn(quizAgent, 'generateQuiz').mockResolvedValueOnce({
      subject: 'physics',
      topic: '受力分析',
      difficulty: 'medium',
      questions: [
        {
          id: 1,
          question: '测试题',
          options: ['A', 'B', 'C', 'D'],
          answer: 2,
          explanation: '解析',
        },
      ],
    });

    const chunks = await generateQuizSectionContent(mockSection);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('quiz');
    expect(chunks[0].question).toBe('测试题');
    expect(chunks[0].options).toEqual(['A', 'B', 'C', 'D']);
    expect(chunks[0].correctAnswer).toBe(2);
    expect(chunks[0].content).toBe('解析');
  });

  it('throws when quiz agent returns empty questions', async () => {
    vi.spyOn(quizAgent, 'generateQuiz').mockResolvedValueOnce({
      subject: 'physics',
      topic: '受力分析',
      difficulty: 'medium',
      questions: [],
    });

    await expect(generateQuizSectionContent(mockSection)).rejects.toThrow(
      'Quiz agent returned empty questions',
    );
  });
});
