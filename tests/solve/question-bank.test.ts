import { describe, test, expect, vi, beforeEach } from 'vitest';

// ── Mock kb-manager before importing question-bank ──

const mockKBChunks = new Map<string, any>();

vi.mock('@/lib/knowledge-base/kb-manager', () => ({
  search: vi.fn().mockImplementation(async (opts: any) => {
    const results: any[] = [];
    for (const chunk of mockKBChunks.values()) {
      if (chunk.kbType === opts.kbType) {
        results.push({ chunk, score: 0.5 });
      }
    }
    return results.slice(0, opts.topK || 5);
  }),
  write: vi.fn().mockImplementation(async (opts: any) => {
    const docId = `doc-${Date.now()}`;
    const chunk = {
      id: `${docId}-chunk-0`,
      kbType: opts.kbType,
      docId,
      docTitle: opts.title,
      chunkIndex: 0,
      totalChunks: 1,
      content: opts.content,
      tags: opts.tags || [],
      sourceId: opts.sourceId || null,
      verified: opts.verified ?? true,
      usageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    mockKBChunks.set(chunk.id, chunk);
    return { docId, chunks: 1 };
  }),
  hasSource: vi.fn().mockImplementation(async (sourceId: string) => {
    return [...mockKBChunks.values()].some((c: any) => c.sourceId === sourceId);
  }),
  removeDocument: vi.fn().mockImplementation(async (docId: string) => {
    for (const [id, c] of mockKBChunks) {
      if ((c as any).docId === docId) mockKBChunks.delete(id);
    }
  }),
  stats: vi.fn().mockImplementation(async () => ({
    totalChunks: mockKBChunks.size,
    totalDocuments: new Set([...mockKBChunks.values()].map((c: any) => c.docId)).size,
    byType: {
      solve: { chunks: mockKBChunks.size, documents: mockKBChunks.size },
    },
  })),
  clearType: vi.fn().mockImplementation(async () => {
    for (const [id, c] of mockKBChunks) {
      if ((c as any).kbType === 'solve') mockKBChunks.delete(id);
    }
  }),
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

beforeEach(() => {
  mockKBChunks.clear();
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
  test('returns empty when KB is empty', async () => {
    const results = await findSimilarQuestions('test problem');
    expect(results).toEqual([]);
  });

  test('returns matches above threshold from KB', async () => {
    // Pre-populate the mock KB with a stored question entry
    const entry = {
      id: 'qb_1',
      problemHash: hashProblemText('解方程 2x+3=7'),
      problemText: '解方程 2x+3=7',
      answer: 'x = 2',
      steps: [{ label: '解答', content: '移项', keyPoints: [] }],
      knowledgePoints: [{ name: '一元一次方程', description: '', difficulty: 'medium' }],
      agentId: 'science',
      solvedAt: Date.now(),
      verified: true,
    };
    mockKBChunks.set('chunk-1', {
      id: 'chunk-1',
      kbType: 'solve',
      docId: 'doc-1',
      docTitle: '题解',
      chunkIndex: 0,
      totalChunks: 1,
      content: JSON.stringify(entry),
      tags: [],
      sourceId: entry.problemHash,
      verified: true,
      usageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const results = await findSimilarQuestions('解方程 2x+3=7');
    expect(results.length).toBe(1);
    expect(results[0].answer).toBe('x = 2');
  });
});

describe('saveToQuestionBank', () => {
  test('saves entry via kb-manager', async () => {
    const entry = await saveToQuestionBank({
      problemText: '解方程 2x+3=7',
      answer: 'x = 2',
      knowledgePoints: [{ name: '一元一次方程', description: '', difficulty: 'medium' }],
      agentId: 'science',
      solvedAt: Date.now(),
    });

    expect(entry.problemHash).toBe(hashProblemText('解方程 2x+3=7'));
    expect(entry.answer).toBe('x = 2');
    expect(entry.verified).toBe(true);
  });

  test('uses provided problemHash', async () => {
    const entry = await saveToQuestionBank({
      problemText: 'test',
      problemHash: 'custom_hash',
      answer: 'answer',
      knowledgePoints: [],
      agentId: 'universal',
      solvedAt: Date.now(),
    });

    expect(entry.problemHash).toBe('custom_hash');
  });

  test('deduplicates by problemHash', async () => {
    // First save
    await saveToQuestionBank({
      problemText: '解方程 2x+3=7',
      answer: 'x = 2',
      knowledgePoints: [],
      agentId: 'science',
      solvedAt: Date.now(),
    });

    // Second save with same problem — should be deduplicated
    const { write } = await import('@/lib/knowledge-base/kb-manager');
    const secondEntry = await saveToQuestionBank({
      problemText: '解方程 2x+3=7',
      answer: 'x = 2',
      steps: [],
      knowledgePoints: [],
      agentId: 'science',
      solvedAt: Date.now(),
    });

    // write should only be called once due to dedup
    expect(write).toHaveBeenCalledTimes(1);
  });
});

describe('isProblemInBank', () => {
  test('returns true for existing problem', async () => {
    // Save a problem first
    await saveToQuestionBank({
      problemText: '解方程 2x+3=7',
      answer: 'x = 2',
      steps: [],
      knowledgePoints: [],
      agentId: 'science',
      solvedAt: Date.now(),
    });

    const exists = await isProblemInBank('解方程 2x+3=7');
    expect(exists).toBe(true);
  });

  test('returns false for non-existing problem', async () => {
    const exists = await isProblemInBank('新题目');
    expect(exists).toBe(false);
  });
});

describe('questionBankCount', () => {
  test('returns count from stats', async () => {
    const count = await questionBankCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

describe('clearQuestionBank', () => {
  test('calls clearType for solve', async () => {
    const { clearType } = await import('@/lib/knowledge-base/kb-manager');
    await clearQuestionBank();
    expect(clearType).toHaveBeenCalledWith('solve');
  });
});
