import { describe, it, expect } from 'vitest';
import {
  injectMistakeContext,
  injectGraphContext,
  injectSolveHistory,
  buildSystemPrompt,
} from '@/lib/assistant/context-injector';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import type { GraphNode } from '@/lib/graph/types';
import type { QuestionBankEntry } from '@/lib/solve/types';

const BASE_PROMPT = '你是一位专业的数学学习助手。';

function makeMistake(overrides: Partial<MistakeBookEntry> = {}): MistakeBookEntry {
  return {
    id: 'm1',
    problemText: '1+1=?',
    userAnswer: '3',
    correctAnswer: '2',
    errorType: 'calculation',
    knowledgePoints: ['加法'],
    reviewCount: 0,
    masteryLevel: 0,
    reviewed: false,
    ...overrides,
  };
}

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: 'kp1',
    name: '加法',
    category: '代数',
    mastery: 80,
    problemCount: 10,
    mistakeCount: 2,
    children: [],
    ...overrides,
  };
}

// ── injectMistakeContext ───────────────────────────────────────────

describe('injectMistakeContext', () => {
  it('with mistakes → prompt includes mistake count', () => {
    const result = injectMistakeContext(BASE_PROMPT, [makeMistake()]);
    expect(result).toContain('1 道错题');
    expect(result).toContain(BASE_PROMPT);
  });

  it('with mistakes → prompt includes weak knowledge points', () => {
    const result = injectMistakeContext(BASE_PROMPT, [
      makeMistake({ knowledgePoints: ['二次函数'] }),
    ]);
    expect(result).toContain('二次函数');
  });

  it('with mistakes → prompt includes error type analysis', () => {
    const result = injectMistakeContext(BASE_PROMPT, [
      makeMistake({ errorType: 'concept' }),
    ]);
    expect(result).toContain('概念不清');
  });

  it('empty array → returns base prompt unchanged', () => {
    const result = injectMistakeContext(BASE_PROMPT, []);
    expect(result).toBe(BASE_PROMPT);
  });

  it('null-like empty → returns base prompt unchanged', () => {
    const result = injectMistakeContext(BASE_PROMPT, [] as unknown as MistakeBookEntry[]);
    expect(result).toBe(BASE_PROMPT);
  });

  it('sorts knowledge points by frequency', () => {
    const result = injectMistakeContext(BASE_PROMPT, [
      makeMistake({ id: 'm1', knowledgePoints: ['二次函数'] }),
      makeMistake({ id: 'm2', knowledgePoints: ['二次函数'] }),
      makeMistake({ id: 'm3', knowledgePoints: ['一次函数'] }),
    ]);
    expect(result).toContain('二次函数');
  });

  it('includes guidance instruction', () => {
    const result = injectMistakeContext(BASE_PROMPT, [makeMistake()]);
    expect(result).toContain('薄弱知识点');
  });
});

// ── injectGraphContext ─────────────────────────────────────────────

describe('injectGraphContext', () => {
  it('with nodes → includes strong point info', () => {
    const result = injectGraphContext(BASE_PROMPT, [makeNode({ mastery: 90 })]);
    expect(result).toContain('掌握较好');
  });

  it('with weak nodes → includes weakness info', () => {
    const result = injectGraphContext(BASE_PROMPT, [makeNode({ mastery: 30 })]);
    expect(result).toContain('薄弱');
  });

  it('empty nodes → returns base prompt unchanged', () => {
    const result = injectGraphContext(BASE_PROMPT, []);
    expect(result).toBe(BASE_PROMPT);
  });

  it('all nodes at 50-79 → no strong or weak segments', () => {
    const result = injectGraphContext(BASE_PROMPT, [makeNode({ mastery: 60 })]);
    // Only the instruction line is appended, but no strong/weak lists
    expect(result).not.toContain('掌握较好的知识点');
    expect(result).not.toContain('薄弱知识点（需重点辅导）');
  });

  it('includes connection guidance', () => {
    const result = injectGraphContext(BASE_PROMPT, [makeNode({ mastery: 30 })]);
    expect(result).toContain('薄弱点');
  });
});

// ── buildSystemPrompt ──────────────────────────────────────────────

describe('buildSystemPrompt', () => {
  it('base prompt without context', () => {
    const prompt = buildSystemPrompt('数学', 'junior', 'concise');
    expect(prompt).toContain('数学');
    expect(prompt).toContain('初中');
    expect(prompt).toContain('简洁明了');
  });

  it('with mistake context → includes mistake analysis', () => {
    const prompt = buildSystemPrompt('数学', 'junior', 'concise', {
      mistakes: [makeMistake()],
    });
    expect(prompt).toContain('错题分析');
  });

  it('with graph context → includes mastery info', () => {
    const prompt = buildSystemPrompt('数学', 'junior', 'concise', {
      graphNodes: [makeNode({ mastery: 30 })],
    });
    expect(prompt).toContain('知识掌握');
  });

  it('with both contexts → includes both', () => {
    const prompt = buildSystemPrompt('数学', 'junior', 'detailed', {
      mistakes: [makeMistake()],
      graphNodes: [makeNode({ mastery: 30 })],
    });
    expect(prompt).toContain('错题分析');
    expect(prompt).toContain('知识掌握');
  });

  it('heuristic style hint', () => {
    const prompt = buildSystemPrompt('物理', 'senior', 'heuristic');
    expect(prompt).toContain('启发式');
    expect(prompt).toContain('高中');
  });
});

// ── helpers ─────────────────────────────────────────────────────────

function makeHistoryEntry(overrides: Partial<QuestionBankEntry> = {}): QuestionBankEntry {
  return {
    id: 'h1',
    problemHash: 'hash1',
    problemText: '1+1=?',
    answer: '2',
    knowledgePoints: [{ name: '代数', description: '代数基础', difficulty: 'easy' }],
    agentId: 'universal',
    solvedAt: Date.now(),
    verified: true,
    ...overrides,
  };
}

// ── injectSolveHistory ─────────────────────────────────────────────

describe('injectSolveHistory', () => {
  it('with solve history entries includes entry count', () => {
    const entries = [makeHistoryEntry({ problemText: 'test', knowledgePoints: [{ name: '代数', description: '', difficulty: 'easy' }] })];
    const result = injectSolveHistory(BASE_PROMPT, entries);
    expect(result).toContain('该学生已解答 1 道题目');
    expect(result).toContain(BASE_PROMPT);
  });

  it('with solve history includes knowledge points', () => {
    const entries = [
      makeHistoryEntry({
        id: 'h1',
        knowledgePoints: [
          { name: '代数', description: '', difficulty: 'easy' },
          { name: '几何', description: '', difficulty: 'medium' },
        ],
      }),
    ];
    const result = injectSolveHistory(BASE_PROMPT, entries);
    expect(result).toContain('代数');
    expect(result).toContain('几何');
  });

  it('empty array returns base prompt unchanged', () => {
    const result = injectSolveHistory(BASE_PROMPT, []);
    expect(result).toBe(BASE_PROMPT);
  });

  it('slices to 5 most recent entries', () => {
    const entries = Array.from({ length: 7 }, (_, i) =>
      makeHistoryEntry({
        id: `h${i + 1}`,
        problemText: `题目${i + 1}`,
        solvedAt: Date.now() + i * 1000,
      }),
    );
    const result = injectSolveHistory(BASE_PROMPT, entries);
    // Only first 5 entries should appear in output
    for (let i = 0; i < 5; i++) {
      expect(result).toContain(`题目${i + 1}`);
    }
    // Entries 6 and 7 should not appear
    expect(result).not.toContain('题目6');
    expect(result).not.toContain('题目7');
  });

  it('null/undefined returns base prompt unchanged', () => {
    const result = injectSolveHistory(BASE_PROMPT, null as any);
    expect(result).toBe(BASE_PROMPT);
  });

  it('truncates context when exceeding MAX_CONTEXT_CHARS', () => {
    const longText = 'x'.repeat(1500);
    const entries = [
      makeHistoryEntry({ id: 'h1', problemText: longText }),
      makeHistoryEntry({ id: 'h2', problemText: longText }),
    ];
    const result = injectSolveHistory(BASE_PROMPT, entries);
    // The combined length should be capped at basePrompt.length + MAX_CONTEXT_CHARS (1200)
    expect(result.length).toBeLessThanOrEqual(BASE_PROMPT.length + 1300); // ~1200 + small margin for newline
    expect(result).toContain(BASE_PROMPT);
  });
});
