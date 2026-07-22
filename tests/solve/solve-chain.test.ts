import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runSolveChain } from '@/lib/solve/solve-chain';

// ── Mock all dependencies ──────────────────────────────────────────

vi.mock('@/lib/solve/agents/analyze-agent', () => ({
  analyzeProblem: vi.fn(),
}));

vi.mock('@/lib/solve/agents/verify-agent', () => ({
  verifyAnswer: vi.fn(),
}));

vi.mock('@/lib/solve/agents/correct-agent', () => ({
  correctAnswer: vi.fn(),
}));

vi.mock('@/lib/solve/streaming-solver', () => ({
  streamSolve: vi.fn(async function* () {
    yield { type: 'step', label: '步骤1', content: '解题过程', keyPoints: [] };
    yield { type: 'answer', answer: '3' };
    yield {
      type: 'knowledge',
      points: [{ name: '代数', description: '基础代数', difficulty: 'medium' }],
    };
    yield { type: 'similar', questions: [] };
  }),
}));

vi.mock('@/lib/solve/solver-constants', () => ({
  classifyProblem: vi.fn(() => 'universal'),
  resolveSolverModel: vi.fn(() => ({ providerId: 'deepseek', modelId: 'deepseek-v4-flash' })),
}));

vi.mock('@/lib/solve/solver-prompts', () => ({
  buildKnowledgePointsPrompt: vi.fn(() => 'prompt'),
}));

vi.mock('@/lib/solve/question-bank', () => ({
  findSimilarByKnowledgePoints: vi.fn(async () => []),
  hashProblemText: vi.fn(() => 'hash123'),
}));

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => ({ model: 'mock-model' })),
}));

vi.mock('@/lib/generation/json-repair', () => ({
  parseJsonResponse: vi.fn(() => null),
}));

describe('runSolveChain', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('runs the full chain: analyze → solve → verify → knowledge → similar', async () => {
    const { analyzeProblem } = await import('@/lib/solve/agents/analyze-agent');
    vi.mocked(analyzeProblem).mockResolvedValue({
      subject: 'math',
      knowledgePoints: ['二次函数'],
      difficulty: 'medium',
      questionType: 'solve',
      confidence: 0.9,
    });

    const { verifyAnswer } = await import('@/lib/solve/agents/verify-agent');
    vi.mocked(verifyAnswer).mockResolvedValue({
      isCorrect: true,
      confidence: 0.95,
      reasoning: 'matches',
    });

    const result = await runSolveChain('已知y=x²，求x=2时的值');

    expect(result.analysis).not.toBeNull();
    expect(result.analysis!.subject).toBe('math');
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.answer).toBe('3');
    expect(result.verification).not.toBeNull();
    expect(result.verification!.isCorrect).toBe(true);
    expect(result.correction).toBeNull(); // no correction needed
    expect(result.metadata.hasCorrection).toBe(false);
    expect(result.warnings.length).toBe(0);
  });

  it('triggers correction when verify returns isCorrect=false', async () => {
    const { analyzeProblem } = await import('@/lib/solve/agents/analyze-agent');
    vi.mocked(analyzeProblem).mockResolvedValue({
      subject: 'math',
      knowledgePoints: ['算术'],
      difficulty: 'easy',
      questionType: 'solve',
      confidence: 0.5,
    });

    const { verifyAnswer } = await import('@/lib/solve/agents/verify-agent');
    vi.mocked(verifyAnswer).mockResolvedValue({
      isCorrect: false,
      confidence: 0.9,
      suggestedAnswer: '4',
      reasoning: 'wrong calculation',
    });

    const { correctAnswer } = await import('@/lib/solve/agents/correct-agent');
    vi.mocked(correctAnswer).mockResolvedValue({
      steps: [{ label: '修正', content: '重新计算', keyPoints: [] }],
      answer: '4',
    });

    const result = await runSolveChain('求2+2');

    expect(result.verification!.isCorrect).toBe(false);
    expect(result.correction).not.toBeNull();
    expect(result.correction!.answer).toBe('4');
    expect(result.answer).toBe('4'); // answer was updated
    expect(result.metadata.hasCorrection).toBe(true);
  });

  it('passes confirmed ProblemSpec to the verification agent for traceable validation', async () => {
    const { analyzeProblem } = await import('@/lib/solve/agents/analyze-agent');
    vi.mocked(analyzeProblem).mockResolvedValue({
      subject: 'math',
      knowledgePoints: ['方程'],
      difficulty: 'medium',
      questionType: 'solve',
      confidence: 0.5,
    });
    const { streamSolve } = await import('@/lib/solve/streaming-solver');
    vi.mocked(streamSolve).mockImplementationOnce(async function* () {
      yield { type: 'step', label: '步骤1', content: '移项', keyPoints: [] };
      yield { type: 'answer', answer: 'x=1' };
    });
    const { verifyAnswer } = await import('@/lib/solve/agents/verify-agent');
    vi.mocked(verifyAnswer).mockResolvedValue({
      isCorrect: true,
      confidence: 0.95,
      reasoning: 'matches confirmed recognition',
    });
    const problemSpec = {
      id: 'confirmed-1',
      stage: '高中' as const,
      subject: '数学',
      questionType: 'calculation',
      stem: '解方程 $x+1=2$，并说明移项依据。',
      options: [],
      givens: [{ name: '方程', value: 'x+1=2' }],
      asks: ['求 x', '说明移项依据'],
      formulas: ['x+1=2'],
      ambiguities: [],
      materials: [],
      subQuestions: [],
      diagram: null,
      confidence: 1,
    };

    await runSolveChain(
      '解方程 $x+1=2$，并说明移项依据。这是一道需要完整过程、列出已知条件并解释每一步推导依据的长题目。',
      null,
      undefined,
      undefined,
      undefined,
      problemSpec,
    );

    expect(verifyAnswer).toHaveBeenCalledWith(expect.any(String), 'x=1', problemSpec);
  });

  it('continues chain when analyze fails (with warning)', async () => {
    const { analyzeProblem } = await import('@/lib/solve/agents/analyze-agent');
    vi.mocked(analyzeProblem).mockRejectedValue(new Error('LLM error'));

    const { verifyAnswer } = await import('@/lib/solve/agents/verify-agent');
    vi.mocked(verifyAnswer).mockResolvedValue({
      isCorrect: true,
      confidence: 0.9,
      reasoning: 'ok',
    });

    const result = await runSolveChain('求1+1');

    expect(result.analysis).toBeNull();
    expect(result.warnings.some((w) => w.includes('分析'))).toBe(true);
    // Chain still produces answer despite analyze failure
    expect(result.answer).toBe('3');
  });

  it('continues chain when verify fails (with warning)', async () => {
    const { analyzeProblem } = await import('@/lib/solve/agents/analyze-agent');
    vi.mocked(analyzeProblem).mockResolvedValue({
      subject: 'math',
      knowledgePoints: ['代数'],
      difficulty: 'easy',
      questionType: 'solve',
      confidence: 0.5,
    });

    const { verifyAnswer } = await import('@/lib/solve/agents/verify-agent');
    vi.mocked(verifyAnswer).mockRejectedValue(new Error('timeout'));

    const result = await runSolveChain('求1+1');

    expect(result.verification).toBeNull();
    expect(result.warnings.some((w) => w.includes('校验'))).toBe(true);
    // No correction attempted (verify result is null)
    expect(result.correction).toBeNull();
    expect(result.answer).toBe('3'); // original answer preserved
  });

  it('generates knowledge points when solver does not return them', async () => {
    const { analyzeProblem } = await import('@/lib/solve/agents/analyze-agent');
    vi.mocked(analyzeProblem).mockResolvedValue({
      subject: 'math',
      knowledgePoints: ['代数'],
      difficulty: 'easy',
      questionType: 'solve',
      confidence: 0.9,
    });

    const { verifyAnswer } = await import('@/lib/solve/agents/verify-agent');
    vi.mocked(verifyAnswer).mockResolvedValue({
      isCorrect: true,
      confidence: 0.9,
      reasoning: 'ok',
    });

    // Override the callLLM mock to return knowledge points
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValue({
      text: JSON.stringify({
        knowledgePoints: [
          { name: '二次函数', description: '核心概念+应用场景+易错点', difficulty: 'medium' },
        ],
      }),
    } as any);

    // parseJsonResponse must also return the parsed object
    const { parseJsonResponse } = await import('@/lib/generation/json-repair');
    vi.mocked(parseJsonResponse).mockReturnValue({
      knowledgePoints: [
        { name: '二次函数', description: '核心概念+应用场景+易错点', difficulty: 'medium' },
      ],
    });

    // Override streamSolve to NOT return knowledge points
    const { streamSolve } = await import('@/lib/solve/streaming-solver');
    vi.mocked(streamSolve).mockImplementation(async function* () {
      yield { type: 'step', label: '步骤', content: '解题', keyPoints: [] };
      yield { type: 'answer', answer: '3' };
      // No knowledge or similar events
    });

    const result = await runSolveChain('求y=x²的顶点');

    expect(result.knowledgePoints.length).toBe(1);
    expect(result.knowledgePoints[0].name).toBe('二次函数');
  });

  it('calls onStreamEvent callback for each streaming event', async () => {
    const { analyzeProblem } = await import('@/lib/solve/agents/analyze-agent');
    vi.mocked(analyzeProblem).mockResolvedValue({
      subject: 'math',
      knowledgePoints: [],
      difficulty: 'easy',
      questionType: 'solve',
      confidence: 0.9,
    });

    const { verifyAnswer } = await import('@/lib/solve/agents/verify-agent');
    vi.mocked(verifyAnswer).mockResolvedValue({
      isCorrect: true,
      confidence: 0.9,
      reasoning: 'ok',
    });

    const events: any[] = [];
    await runSolveChain('求1+1', null, (e) => events.push(e));

    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'step')).toBe(true);
    expect(events.some((e) => e.type === 'answer')).toBe(true);
  });

  it('skips verification when answer is empty', async () => {
    const { analyzeProblem } = await import('@/lib/solve/agents/analyze-agent');
    vi.mocked(analyzeProblem).mockResolvedValue({
      subject: 'math',
      knowledgePoints: [],
      difficulty: 'easy',
      questionType: 'solve',
      confidence: 0.5,
    });

    // Override streamSolve to return empty answer
    const { streamSolve } = await import('@/lib/solve/streaming-solver');
    vi.mocked(streamSolve).mockImplementation(async function* () {
      yield { type: 'step', label: '步骤', content: '解题', keyPoints: [] };
      yield { type: 'answer', answer: '' };
      yield { type: 'knowledge', points: [] };
      yield { type: 'similar', questions: [] };
    });

    const result = await runSolveChain('求1+1');

    expect(result.answer).toBe('');
    expect(result.verification).toBeNull();
    expect(result.warnings.some((w) => w.includes('无答案'))).toBe(true);
  });

  it('metadata includes duration and step counts', async () => {
    const { analyzeProblem } = await import('@/lib/solve/agents/analyze-agent');
    vi.mocked(analyzeProblem).mockResolvedValue({
      subject: 'math',
      knowledgePoints: ['代数'],
      difficulty: 'easy',
      questionType: 'solve',
      confidence: 0.9,
    });

    const { verifyAnswer } = await import('@/lib/solve/agents/verify-agent');
    vi.mocked(verifyAnswer).mockResolvedValue({
      isCorrect: true,
      confidence: 0.9,
      reasoning: 'ok',
    });

    const result = await runSolveChain('求1+1');

    expect(result.metadata.totalSteps).toBe(6);
    expect(result.metadata.duration).toBeGreaterThanOrEqual(0);
    expect(result.metadata.stepsCompleted).toBeGreaterThanOrEqual(0);
    expect(typeof result.metadata.hasCorrection).toBe('boolean');
  });
});
