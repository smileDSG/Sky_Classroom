import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('personalization lab API', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns a cold-start diagnostic state', async () => {
    const { GET } = await import('@/app/api/sky/personalization-lab/route');
    const response = await GET(
      new Request('http://localhost/api/sky/personalization-lab?sessionId=test'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.decision.action).toBe('diagnostic');
    expect(payload.data.knowledgeStates[0].evidenceCount).toBe(0);
  });

  it('applies a simulated answer and returns updated decision data', async () => {
    const { GET, POST } = await import('@/app/api/sky/personalization-lab/route');
    const sessionId = 'answer-flow';

    await POST(
      new Request('http://localhost/api/sky/personalization-lab', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, eventType: 'answer-incorrect' }),
      }),
    );

    const response = await GET(
      new Request(`http://localhost/api/sky/personalization-lab?sessionId=${sessionId}`),
    );
    const payload = await response.json();

    expect(payload.data.knowledgeStates[0].evidenceCount).toBe(1);
    expect(payload.data.knowledgeStates[0].mastery).toBeLessThan(0.5);
    expect(payload.data.decision.reasonCodes).toContain('low-confidence');
  });
});
