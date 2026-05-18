import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/utils/database', () => ({
  db: {
    questionBank: {
      toArray: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      orderBy: vi.fn(),
      count: vi.fn(),
      clear: vi.fn(),
      where: vi.fn(),
    },
  },
}));

import {
  hashProblemText,
  textSimilarity,
  findSimilarQuestions,
  saveToQuestionBank,
  deleteQuestionBankEntry,
  listQuestionBankEntries,
  questionBankCount,
  clearQuestionBank,
  isProblemInBank,
} from '@/lib/solve/question-bank';
import { db } from '@/lib/utils/database';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('hashProblemText', () => {
  test('produces consistent hashes for same input', () => {
    expect(hashProblemText('2+2=?')).toBe(hashProblemText('2+2=?'));
  });

  test('ignores whitespace differences', () => {
    expect(hashProblemText('  2+2=?  ')).toBe(hashProblemText('2+2=?'));
  });

  test('ignores case differences', () => {
    expect(hashProblemText('ABC')).toBe(hashProblemText('abc'));
  });

  test('ignores Chinese punctuation', () => {
    expect(hashProblemText('解方程。')).toBe(hashProblemText('解方程'));
  });

  test('produces different hashes for different text', () => {
    expect(hashProblemText('2+2=?')).not.toBe(hashProblemText('3+3=?'));
  });
});

describe('textSimilarity', () => {
  test('identical strings have similarity 1', () => {
    expect(textSimilarity('解方程 2x+3=7', '解方程 2x+3=7')).toBe(1);
  });

  test('empty strings return 0', () => {
    expect(textSimilarity('', 'test')).toBe(0);
    expect(textSimilarity('test', '')).toBe(0);
  });

  test('completely different strings have low similarity', () => {
    expect(textSimilarity('香蕉', '方程')).toBe(0);
  });

  test('partial overlap returns intermediate score', () => {
    const score = textSimilarity('解方程 2x+3=7', '解方程 3x-1=5');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  test('one character difference has high similarity', () => {
    const score = textSimilarity('计算 1+1=2', '计算 1+1=3');
    expect(score).toBeGreaterThan(0.7);
  });
});

describe('findSimilarQuestions', () => {
  test('returns empty when bank is empty', async () => {
    (db.questionBank.toArray as any).mockResolvedValue([]);

    const results = await findSimilarQuestions('test problem');
    expect(results).toEqual([]);
  });

  test('returns matches above threshold', async () => {
    (db.questionBank.toArray as any).mockResolvedValue([
      {
        id: 'qb_1',
        problemHash: hashProblemText('解方程 2x+3=7'),
        problemText: '解方程 2x+3=7',
        answer: 'x = 2',
        steps: ['移项', '计算'],
        knowledgePoints: ['一元一次方程'],
        agentId: 'science',
        solvedAt: Date.now(),
        verified: true,
      },
    ]);

    const results = await findSimilarQuestions('解方程 2x+3=7');
    expect(results.length).toBe(1);
    expect(results[0]._similarity).toBe(1);
    expect(results[0].answer).toBe('x = 2');
  });

  test('filters out entries below threshold', async () => {
    (db.questionBank.toArray as any).mockResolvedValue([
      {
        id: 'qb_1',
        problemHash: 'hash1',
        problemText: '完全不同的题目',
        answer: 'x = 0',
        steps: [],
        knowledgePoints: [],
        agentId: 'universal',
        solvedAt: Date.now(),
        verified: false,
      },
    ]);

    const results = await findSimilarQuestions('解方程 2x+3=7');
    expect(results).toEqual([]);
  });

  test('sorts by similarity descending', async () => {
    (db.questionBank.toArray as any).mockResolvedValue([
      {
        id: 'qb_1',
        problemHash: 'hash1',
        problemText: '解方程 2x+3=8',
        answer: 'x = 2.5',
        steps: [],
        knowledgePoints: [],
        agentId: 'science',
        solvedAt: Date.now(),
        verified: false,
      },
      {
        id: 'qb_2',
        problemHash: 'hash2',
        problemText: '解方程 2x+3=7',
        answer: 'x = 2',
        steps: [],
        knowledgePoints: [],
        agentId: 'science',
        solvedAt: Date.now(),
        verified: false,
      },
    ]);

    const results = await findSimilarQuestions('解方程 2x+3=7', 0.8);
    expect(results.length).toBe(2);
    expect(results[0].id).toBe('qb_2'); // exact match should be first
  });
});

describe('saveToQuestionBank', () => {
  test('saves entry and returns it', async () => {
    (db.questionBank.put as any).mockResolvedValue(undefined);

    const entry = await saveToQuestionBank({
      problemText: '解方程 2x+3=7',
      answer: 'x = 2',
      steps: ['移项', '计算'],
      knowledgePoints: ['一元一次方程'],
      agentId: 'science',
      verified: false,
    });

    expect(db.questionBank.put).toHaveBeenCalledTimes(1);
    expect(entry.problemHash).toBe(hashProblemText('解方程 2x+3=7'));
    expect(entry.answer).toBe('x = 2');
    expect(entry.verified).toBe(false);
  });

  test('uses provided problemHash', async () => {
    (db.questionBank.put as any).mockResolvedValue(undefined);

    const entry = await saveToQuestionBank({
      problemText: 'test',
      problemHash: 'custom_hash',
      answer: 'answer',
      steps: [],
      knowledgePoints: [],
      agentId: 'universal',
    });

    expect(entry.problemHash).toBe('custom_hash');
  });
});

describe('deleteQuestionBankEntry', () => {
  test('deletes by id', async () => {
    (db.questionBank.delete as any).mockResolvedValue(undefined);

    await deleteQuestionBankEntry('qb_123');
    expect(db.questionBank.delete).toHaveBeenCalledWith('qb_123');
  });
});

describe('listQuestionBankEntries', () => {
  test('returns entries sorted by solvedAt desc', async () => {
    const mockEntries = [
      { id: 'qb_2', solvedAt: 200 },
      { id: 'qb_1', solvedAt: 100 },
    ];
    (db.questionBank.orderBy as any).mockReturnValue({
      reverse: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockEntries),
        }),
      }),
    });

    const results = await listQuestionBankEntries();
    expect(results.length).toBe(2);
    expect(results[0].id).toBe('qb_2');
  });
});

describe('questionBankCount', () => {
  test('returns count', async () => {
    (db.questionBank.count as any).mockResolvedValue(42);

    const count = await questionBankCount();
    expect(count).toBe(42);
  });
});

describe('clearQuestionBank', () => {
  test('clears all entries', async () => {
    (db.questionBank.clear as any).mockResolvedValue(undefined);

    await clearQuestionBank();
    expect(db.questionBank.clear).toHaveBeenCalled();
  });
});

describe('isProblemInBank', () => {
  test('returns true for existing problem', async () => {
    (db.questionBank.where as any).mockImplementation(() => ({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([{ id: 'qb_1' }]),
      }),
    }));

    const exists = await isProblemInBank('解方程 2x+3=7');
    expect(exists).toBe(true);
  });

  test('returns false for non-existing problem', async () => {
    (db.questionBank.where as any).mockImplementation(() => ({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    }));

    const exists = await isProblemInBank('新题目');
    expect(exists).toBe(false);
  });
});
