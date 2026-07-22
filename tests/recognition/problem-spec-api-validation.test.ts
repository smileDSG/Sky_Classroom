import { beforeEach, describe, expect, test, vi } from 'vitest';
import { parseProblemSpecs } from '@/lib/recognition/problem-spec-parser';

const graphInvoke = vi.hoisted(() => vi.fn());

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: vi.fn() };
});

vi.mock('@/lib/solve/solve-graph', () => ({
  buildSolveInitialState: vi.fn((problem, problemImage, userAnswer, problemSpec) => ({
    problemText: problem,
    problemImage,
    userAnswer,
    problemSpec,
  })),
  createSolveGraph: vi.fn(() => ({ invoke: graphInvoke })),
}));

vi.mock('@/lib/solve/question-bank', () => ({
  findSimilarQuestions: vi.fn(async () => []),
  isProblemInBank: vi.fn(async () => true),
  saveToQuestionBank: vi.fn(),
}));

vi.mock('@/lib/solve/solve-cache', () => ({
  findSolveCacheMatches: vi.fn(async () => []),
}));

vi.mock('@/lib/solve/solve-chain', () => ({
  runSolveChain: vi.fn(async () => ({
    analysis: null,
    solution: '',
    steps: [],
    answer: '',
    verification: null,
    correction: null,
    knowledgePoints: [],
    similarQuestions: [],
    warnings: [],
    metadata: { duration: 0, stepsCompleted: 0, hasCorrection: false, totalSteps: 6 },
  })),
}));

const invalidProblemSpec = {
  id: 'broken',
  stage: '小学',
  subject: '数学',
  questionType: 'calculation',
  stem: '',
  options: 'not-an-array',
};

function request(path: string): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problem: '解方程', problemSpec: invalidProblemSpec }),
  });
}

describe('solve API ProblemSpec validation', () => {
  beforeEach(() => {
    graphInvoke.mockResolvedValue({
      error: null,
      solution: '1',
      fourPartOutput: {
        solution: '过程',
        answer: '1',
        steps: [],
        knowledgePoints: [],
        similarQuestions: [],
      },
      fromQuestionBank: true,
      agentRoute: 'science',
    });
  });

  test.each([
    ['jobs', '/api/sky/solve/jobs', () => import('@/app/api/sky/solve/jobs/route')],
    ['explain', '/api/sky/solve/explain', () => import('@/app/api/sky/solve/explain/route')],
  ])('%s rejects an invalid problemSpec with a clear 400 response', async (_name, path, load) => {
    const { POST } = await load();
    const response = await POST(request(path));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errorCode).toBe('INVALID_REQUEST');
    expect(body.error).toContain('problemSpec');
  });

  test('explain-stream rejects an invalid problemSpec with an SSE error event', async () => {
    const { POST } = await import('@/app/api/sky/solve/explain-stream/route');
    const response = await POST(request('/api/sky/solve/explain-stream'));
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(body).toContain('INVALID_REQUEST');
    expect(body).toContain('problemSpec');
  });
});

test('structured recognition rejects unknown ProblemSpec fields instead of dropping them', () => {
  expect(() =>
    parseProblemSpecs(
      JSON.stringify({
        problems: [
          {
            id: 'p1',
            stage: '高中',
            subject: '数学',
            questionType: 'solve',
            stem: 'x + 1 = 2',
            unexpectedField: 'must not be silently ignored',
          },
        ],
      }),
    ),
  ).toThrow(/unexpectedField|问题|Unknown/i);
});
