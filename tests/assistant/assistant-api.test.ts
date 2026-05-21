import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock streamLLM
vi.mock('@/lib/ai/llm', () => ({
  streamLLM: vi.fn().mockImplementation(() => ({
    textStream: (async function* () {
      yield 'Mock AI response.';
    })(),
  })),
}));

// Mock resolveModel
vi.mock('@/lib/server/resolve-model', () => ({
  resolveModel: vi.fn().mockResolvedValue({
    model: {},
    modelInfo: { outputWindow: 4096 },
    thinkingConfig: undefined,
    modelString: 'mock/gpt',
    providerId: 'mock',
    modelId: 'gpt',
    apiKey: 'mock-key',
  }),
}));

import { POST } from '@/app/api/sky/assistant/route';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/sky/assistant', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ── Validation ─────────────────────────────────────────────────────

describe('POST /api/sky/assistant - validation', () => {
  it('returns 400 when messages is missing', async () => {
    const req = makeRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it('returns 400 when messages is empty array', async () => {
    const req = makeRequest({ messages: [] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it('returns 400 when messages is not an array', async () => {
    const req = makeRequest({ messages: 'not-array' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ── Successful response ────────────────────────────────────────────

describe('POST /api/sky/assistant - response', () => {
  it('returns a Response with SSE content-type', async () => {
    const req = makeRequest({
      messages: [{ role: 'user', content: '什么是二次函数？' }],
    });
    const res = await POST(req);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('has a readable body stream', async () => {
    const req = makeRequest({
      messages: [{ role: 'user', content: '解释一下' }],
    });
    const res = await POST(req);
    expect(res.body).toBeDefined();
  });

  it('accepts optional subject/difficulty/style', async () => {
    const req = makeRequest({
      messages: [{ role: 'user', content: 'hi' }],
      subject: '物理',
      difficulty: 'senior',
      style: 'heuristic',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
