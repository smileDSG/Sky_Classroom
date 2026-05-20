import { describe, it, expect } from 'vitest';
import {
  injectMistakeContext,
  injectGraphContext,
  buildSystemPrompt,
} from '@/lib/assistant/context-injector';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import type { GraphNode } from '@/lib/graph/types';

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
