/**
 * Tests for POST /api/sky/solve/explain-stream (C-004).
 *
 * Validates SSE event ordering, new event types (analysis/verification),
 * bank/cache fast paths, and backward compatibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared mock state ──────────────────────────────────────────────

const chainMocks = vi.hoisted(() => ({
  chainResult: {
    analysis: {
      subject: 'math',
      knowledgePoints: ['二次函数'],
      difficulty: 'medium',
      questionType: 'solve',
      confidence: 0.9,
    },
    steps: [{ label: '步骤1', content: '解题过程', keyPoints: [] as string[] }],
    answer: '3',
    verification: {
      isCorrect: true,
      confidence: 0.95,
      reasoning: 'verified',
      suggestedAnswer: undefined as string | undefined,
    },
    correction: null,
    knowledgePoints: [{ name: '二次函数', description: '核心概念', difficulty: 'medium' }],
    similarQuestions: [] as any[],
    warnings: [] as string[],
    metadata: { duration: 100, stepsCompleted: 6, hasCorrection: false, totalSteps: 6 },
  },
  bankMatches: [] as any[],
  cacheMatches: [] as any[],
}));

vi.mock('@/lib/solve/solve-chain', () => ({
  runSolveChain: vi.fn().mockImplementation(async (_problem, _image, onEvent) => {
    if (onEvent) {
      onEvent({ type: 'phase', phase: 'solving' });
      onEvent({ type: 'step', label: '步骤1', content: '解题过程', keyPoints: [] });
      onEvent({ type: 'answer', answer: '3' });
      onEvent({
        type: 'knowledge',
        points: [{ name: '二次函数', description: '核心概念', difficulty: 'medium' }],
      });
      onEvent({ type: 'similar', questions: [] });
    }
    return chainMocks.chainResult;
  }),
}));

vi.mock('@/lib/solve/question-bank', () => ({
  findSimilarQuestions: vi.fn().mockResolvedValue([]),
  findSimilarByKnowledgePoints: vi.fn().mockResolvedValue([]),
  hashProblemText: vi.fn().mockReturnValue('hash123'),
  isProblemInBank: vi.fn().mockResolvedValue(false),
  saveToQuestionBank: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/solve/solve-cache', () => ({
  findSolveCacheMatches: vi.fn().mockResolvedValue([]),
  saveToSolveCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/solve/math-postprocessor', () => ({
  postProcessMathContent: vi.fn((s: string) => s),
}));

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn().mockResolvedValue({ text: '' }),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue({ model: 'mock' }),
}));

vi.mock('@/lib/generation/json-repair', () => ({
  parseJsonResponse: vi.fn().mockReturnValue(null),
}));

// ── Helper: parse SSE events from a Response body ──────────────────

async function parseSSEEvents(response: Response): Promise<any[]> {
  const text = await response.text();
  const events: any[] = [];
  for (const line of text.split('\n\n')) {
    if (line.startsWith('data: ')) {
      try {
        events.push(JSON.parse(line.substring(6)));
      } catch {
        // ignore malformed
      }
    }
  }
  return events;
}

describe('POST /api/sky/solve/explain-stream', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // clear call history but keep mock implementations
    chainMocks.chainResult = {
      analysis: {
        subject: 'math',
        knowledgePoints: ['二次函数'],
        difficulty: 'medium',
        questionType: 'solve',
        confidence: 0.9,
      },
      steps: [{ label: '步骤1', content: '解题过程', keyPoints: [] as string[] }],
      answer: '3',
      verification: {
        isCorrect: true,
        confidence: 0.95,
        reasoning: 'verified',
        suggestedAnswer: undefined as string | undefined,
      },
      correction: null,
      knowledgePoints: [{ name: '二次函数', description: '核心概念', difficulty: 'medium' }],
      similarQuestions: [] as any[],
      warnings: [] as string[],
      metadata: { duration: 100, stepsCompleted: 6, hasCorrection: false, totalSteps: 6 },
    };
    chainMocks.bankMatches = [];
    chainMocks.cacheMatches = [];
  });

  it('returns error on missing problem', async () => {
    const { POST } = await import('@/app/api/sky/solve/explain-stream/route');
    const req = new Request('http://localhost/api/sky/solve/explain-stream', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const events = await parseSSEEvents(res);
    expect(events[0].type).toBe('error');
  });

  it('emits correct event order for full chain solve', async () => {
    const { POST } = await import('@/app/api/sky/solve/explain-stream/route');
    const req = new Request('http://localhost/api/sky/solve/explain-stream', {
      method: 'POST',
      body: JSON.stringify({ problem: '求x²的导数' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const events = await parseSSEEvents(res);
    const types = events.map((e) => e.type);

    // Core events must be present
    expect(types).toContain('phase'); // checking
    expect(types).toContain('step'); // from chain streaming
    expect(types).toContain('answer'); // from chain streaming
    expect(types).toContain('analysis'); // NEW: C-004
    expect(types).toContain('verification'); // NEW: C-004
    expect(types).toContain('knowledge'); // from chain
    expect(types).toContain('similar'); // from chain
    expect(types).toContain('done'); // final
  });

  it('emits analysis event with correct structure', async () => {
    const { POST } = await import('@/app/api/sky/solve/explain-stream/route');
    const req = new Request('http://localhost/api/sky/solve/explain-stream', {
      method: 'POST',
      body: JSON.stringify({ problem: '题目' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const events = await parseSSEEvents(res);
    const analysis = events.find((e) => e.type === 'analysis');

    expect(analysis).toBeDefined();
    expect(analysis.subject).toBe('math');
    expect(analysis.knowledgePoints).toContain('二次函数');
    expect(analysis.difficulty).toBe('medium');
    expect(analysis.questionType).toBe('solve');
    expect(analysis.confidence).toBe(0.9);
  });

  it('emits verification event with isCorrect', async () => {
    const { POST } = await import('@/app/api/sky/solve/explain-stream/route');
    const req = new Request('http://localhost/api/sky/solve/explain-stream', {
      method: 'POST',
      body: JSON.stringify({ problem: '题目' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const events = await parseSSEEvents(res);
    const verification = events.find((e) => e.type === 'verification');

    expect(verification).toBeDefined();
    expect(verification.isCorrect).toBe(true);
    expect(verification.confidence).toBe(0.95);
    expect(verification.reasoning).toBe('verified');
  });

  it('bank hit returns fast path without analysis/verification', async () => {
    const { findSimilarQuestions } = await import('@/lib/solve/question-bank');
    vi.mocked(findSimilarQuestions).mockResolvedValueOnce([
      {
        id: 'qb1',
        problemHash: 'hash',
        problemText: '1+1=?',
        answer: '2',
        knowledgePoints: [{ name: '加法', description: '基础', difficulty: 'easy' }],
        agentId: 'universal',
        solvedAt: Date.now(),
        verified: true,
      },
    ]);

    const { POST } = await import('@/app/api/sky/solve/explain-stream/route');
    const req = new Request('http://localhost/api/sky/solve/explain-stream', {
      method: 'POST',
      body: JSON.stringify({ problem: '1+1=?' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const events = await parseSSEEvents(res);
    const types = events.map((e) => e.type);

    expect(types).toContain('step');
    expect(types).toContain('answer');
    expect(types).toContain('knowledge');
    expect(types).toContain('done');
    // Fast path should NOT have analysis or verification
    expect(types).not.toContain('analysis');
    expect(types).not.toContain('verification');
    // done should indicate fromQuestionBank
    const done = events.find((e) => e.type === 'done');
    expect(done.fromQuestionBank).toBe(true);
  });

  it('cache hit returns fast path', async () => {
    const { findSolveCacheMatches } = await import('@/lib/solve/solve-cache');
    vi.mocked(findSolveCacheMatches).mockResolvedValueOnce([
      {
        problemText: 'test',
        problemHash: 'hash',
        solution: '解题过程',
        agentId: 'universal',
        solvedAt: Date.now(),
      },
    ]);

    const { POST } = await import('@/app/api/sky/solve/explain-stream/route');
    const req = new Request('http://localhost/api/sky/solve/explain-stream', {
      method: 'POST',
      body: JSON.stringify({ problem: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const events = await parseSSEEvents(res);
    const done = events.find((e) => e.type === 'done');

    expect(done.fromSolveCache).toBe(true);
  });

  it('verification with isCorrect=false includes suggestedAnswer', async () => {
    chainMocks.chainResult.verification = {
      isCorrect: false,
      confidence: 0.9,
      suggestedAnswer: '4',
      reasoning: 'wrong answer',
    };

    const { POST } = await import('@/app/api/sky/solve/explain-stream/route');
    const req = new Request('http://localhost/api/sky/solve/explain-stream', {
      method: 'POST',
      body: JSON.stringify({ problem: '题目' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const events = await parseSSEEvents(res);
    const verification = events.find((e) => e.type === 'verification');

    expect(verification.isCorrect).toBe(false);
    expect(verification.suggestedAnswer).toBe('4');
  });

  it('warnings are emitted as error events with step=warning', async () => {
    chainMocks.chainResult.warnings = ['分析步骤超时或失败，跳过'];

    const { POST } = await import('@/app/api/sky/solve/explain-stream/route');
    const req = new Request('http://localhost/api/sky/solve/explain-stream', {
      method: 'POST',
      body: JSON.stringify({ problem: '题目' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const events = await parseSSEEvents(res);
    const warningEvent = events.find((e) => e.type === 'error' && e.step === 'warning');

    expect(warningEvent).toBeDefined();
    expect(warningEvent.message).toContain('分析');
  });

  it('done event includes metadata from chain result', async () => {
    const { POST } = await import('@/app/api/sky/solve/explain-stream/route');
    const req = new Request('http://localhost/api/sky/solve/explain-stream', {
      method: 'POST',
      body: JSON.stringify({ problem: '题目' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const events = await parseSSEEvents(res);
    const done = events.find((e) => e.type === 'done');

    expect(done.metadata).toBeDefined();
    expect(done.metadata.duration).toBe(100);
    expect(done.metadata.stepsCompleted).toBe(6);
    expect(done.hasCorrection).toBe(false);
  });
});
