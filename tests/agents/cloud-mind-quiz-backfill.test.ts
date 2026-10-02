import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  backfillQuizToQuestionBank,
  buildBankAnswer,
  buildBankQuestion,
} from '@/lib/agents/cloud-mind/quiz-backfill';
import type { QuizOutput, QuizQuestion } from '@/lib/agents/cloud-mind/quiz-agent';
import { hashProblemText } from '@/lib/solve/question-bank-utils';

const daoMocks = vi.hoisted(() => ({
  findByHash: vi.fn(),
  insertOne: vi.fn(),
}));

vi.mock('@/lib/question-bank/dao', () => ({
  findByHash: daoMocks.findByHash,
  insertOne: daoMocks.insertOne,
}));

function makeQuestion(
  overrides: Partial<QuizQuestion> & { questionType: QuizQuestion['questionType'] },
): QuizQuestion {
  return {
    id: 1,
    question: '测试题目',
    options: [],
    answer: 0,
    answerText: '正确答案',
    explanation: '解析',
    ...overrides,
  };
}

describe('quiz backfill bank-answer mapping', () => {
  it('maps a choice answer index to a letter', () => {
    expect(buildBankAnswer(makeQuestion({ questionType: 'choice', answer: 0 }))).toBe('A');
    expect(buildBankAnswer(makeQuestion({ questionType: 'choice', answer: 2 }))).toBe('C');
  });

  it('maps fill and judge answers to their answerText', () => {
    expect(buildBankAnswer(makeQuestion({ questionType: 'fill', answerText: '叶绿体' }))).toBe(
      '叶绿体',
    );
    expect(buildBankAnswer(makeQuestion({ questionType: 'judge', answerText: '错误' }))).toBe(
      '错误',
    );
  });
});

describe('quiz backfill bank-question mapping', () => {
  const input = { subject: '数学', difficulty: 'medium' as const, topic: '二次函数' };

  it('builds a choice insert with AI-generation tags and knowledge points', () => {
    const question = makeQuestion({
      questionType: 'choice',
      question: '$y=x^2$ 的顶点是？',
      options: ['(0, 0)', '(1, 1)', '(2, 2)', '(3, 3)'],
      answer: 0,
      answerText: '(0, 0)',
    });

    const row = buildBankQuestion(question, input);
    expect(row).toMatchObject({
      subject: '数学',
      grade: '',
      difficulty: 'medium',
      questionType: 'choice',
      content: '$y=x^2$ 的顶点是？',
      answer: 'A',
      explanation: '解析',
      knowledgePoints: ['二次函数'],
      source: 'AI智能出题',
      tags: ['AI生成', '智能出题', '生成题'],
      verified: true,
    });
    expect(row.options).toEqual(question.options);
  });

  it('omits options for fill questions', () => {
    const row = buildBankQuestion(
      makeQuestion({
        questionType: 'fill',
        question: '光合作用的场所是 ____。',
        answerText: '叶绿体',
      }),
      input,
    );
    expect(row.questionType).toBe('fill');
    expect(row.answer).toBe('叶绿体');
    expect(row.options).toBeUndefined();
  });
});

describe('quiz backfill to question bank', () => {
  const input = { subject: '数学', difficulty: 'medium' as const, topic: '二次函数' };

  beforeEach(() => {
    daoMocks.findByHash.mockReset();
    daoMocks.insertOne.mockReset();
  });

  it('backfills new questions and skips duplicates by problem hash', async () => {
    const newQuestion = makeQuestion({
      id: 1,
      questionType: 'choice',
      question: '新题：$y=(x-1)^2$ 的顶点是？',
      answer: 0,
      answerText: '(1, 0)',
    });
    const dupQuestion = makeQuestion({
      id: 2,
      questionType: 'fill',
      question: '已存在的题：光合作用的场所是 ____。',
      answerText: '叶绿体',
    });
    const quiz: QuizOutput = {
      subject: '数学',
      topic: '二次函数',
      difficulty: 'medium',
      questions: [newQuestion, dupQuestion],
    };

    daoMocks.findByHash.mockImplementation(async (hash: string) =>
      hash === hashProblemText(dupQuestion.question) ? { id: 'existing' } : null,
    );
    daoMocks.insertOne.mockResolvedValue({ id: 'new' });

    const stats = await backfillQuizToQuestionBank(quiz, input);

    expect(stats).toEqual({ backfilled: 1, duplicates: 1, errors: 0 });
    expect(daoMocks.insertOne).toHaveBeenCalledTimes(1);
    expect(daoMocks.findByHash).toHaveBeenNthCalledWith(1, hashProblemText(newQuestion.question));
    expect(daoMocks.findByHash).toHaveBeenNthCalledWith(2, hashProblemText(dupQuestion.question));
  });

  it('counts a failed insert as an error without throwing', async () => {
    const quiz: QuizOutput = {
      subject: '数学',
      topic: '二次函数',
      difficulty: 'medium',
      questions: [
        makeQuestion({
          questionType: 'judge',
          question: '判断：抛物线开口向上。',
          answer: 0,
          answerText: '正确',
        }),
      ],
    };
    daoMocks.findByHash.mockResolvedValue(null);
    daoMocks.insertOne.mockRejectedValue(new Error('db down'));

    const stats = await backfillQuizToQuestionBank(quiz, input);
    expect(stats).toEqual({ backfilled: 0, duplicates: 0, errors: 1 });
    expect(daoMocks.insertOne).toHaveBeenCalledTimes(1);
  });

  it('counts blank question text as an error and skips the database', async () => {
    const quiz: QuizOutput = {
      subject: '数学',
      topic: '二次函数',
      difficulty: 'medium',
      questions: [makeQuestion({ questionType: 'fill', question: '   ', answerText: '叶绿体' })],
    };

    const stats = await backfillQuizToQuestionBank(quiz, input);
    expect(stats).toEqual({ backfilled: 0, duplicates: 0, errors: 1 });
    expect(daoMocks.findByHash).not.toHaveBeenCalled();
    expect(daoMocks.insertOne).not.toHaveBeenCalled();
  });
});
