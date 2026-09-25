import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateQuiz: vi.fn(),
  requireQuota: vi.fn(),
  recordUsage: vi.fn(),
}));

vi.mock('@/lib/agents/cloud-mind/quiz-agent', () => ({
  generateQuiz: mocks.generateQuiz,
}));
vi.mock('@/lib/server/billing/require-quota', () => ({
  requireQuota: mocks.requireQuota,
  recordUsage: mocks.recordUsage,
}));

const { POST } = await import('@/app/api/sky/cloud-mind/quiz-preview/route');

describe('POST /api/sky/cloud-mind/quiz-preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireQuota.mockResolvedValue({ userId: 'user-1', planType: 'free' });
    mocks.generateQuiz.mockResolvedValue({
      subject: '数学',
      topic: '二次函数',
      difficulty: 'medium',
      questions: [
        {
          id: 1,
          questionType: 'choice',
          question: '下列函数中，哪一个是二次函数？',
          options: ['y=x²+1', 'y=2x+1', 'y=1/x', 'y=3'],
          answer: 0,
          answerText: 'y=x²+1',
          explanation: '二次函数的最高次数为 2。',
        },
      ],
    });
  });

  it('generates one question with the selected goal and hides the answer', async () => {
    const response = await POST(
      new Request('http://localhost/api/sky/cloud-mind/quiz-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'math',
          topic: '二次函数',
          difficulty: 'medium',
          questionType: 'choice',
          goal: 'diagnose',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.generateQuiz).toHaveBeenCalledWith(
      'math',
      'medium',
      '二次函数',
      1,
      undefined,
      'choice',
      'diagnose',
    );
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body).toMatchObject({
      signature: expect.any(String),
      question: {
        questionType: 'choice',
        question: '下列函数中，哪一个是二次函数？',
        options: ['y=x²+1', 'y=2x+1', 'y=1/x', 'y=3'],
      },
    });
    expect(JSON.stringify(body)).not.toContain('answer');
    expect(JSON.stringify(body)).not.toContain('explanation');
    expect(mocks.recordUsage).toHaveBeenCalledWith('user-1', 'free', 'llmCalls');
  });

  it('falls back to practice for an unsupported goal', async () => {
    await POST(
      new Request('http://localhost/api/sky/cloud-mind/quiz-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'math',
          topic: '',
          difficulty: 'easy',
          questionType: 'fill',
          goal: 'unknown',
        }),
      }),
    );

    expect(mocks.generateQuiz).toHaveBeenCalledWith(
      'math',
      'easy',
      '',
      1,
      undefined,
      'fill',
      'practice',
    );
  });
});
