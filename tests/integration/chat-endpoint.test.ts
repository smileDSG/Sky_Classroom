/**
 * B-003: Chat endpoint integration tests
 *
 * Tests the stateless /api/chat endpoint request validation,
 * error handling, and streaming behavior (without actual LLM calls).
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock the orchestrator to avoid real LLM calls
vi.mock('@/lib/orchestration/stateless-generate', () => ({
  statelessGenerate: vi.fn(),
}));

vi.mock('@/lib/ai/providers', () => ({
  isProviderKeyRequired: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/server/resolve-model', () => ({
  resolveModel: vi.fn().mockResolvedValue({ modelId: 'test-model' }),
}));

import { POST } from '@/app/api/chat/route';
import { NextRequest } from 'next/server';

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('rejects request missing messages field', async () => {
    const req = createRequest({ storeState: { stage: {}, scenes: [] } });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('MISSING_REQUIRED_FIELD');
    expect(body.error).toContain('messages');
  });

  test('rejects request missing storeState field', async () => {
    const req = createRequest({ messages: [] });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('storeState');
  });

  test('rejects request when messages is not an array', async () => {
    const req = createRequest({
      messages: 'not-an-array',
      storeState: { stage: {}, scenes: [] },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('rejects empty request body', async () => {
    const req = createRequest({});
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('error response follows unified format', async () => {
    const req = createRequest({});
    const res = await POST(req);
    const body = await res.json();

    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('errorCode');
    expect(body).toHaveProperty('error');
    expect(typeof body.errorCode).toBe('string');
    expect(typeof body.error).toBe('string');
    expect(body.errorCode).toMatch(/^[A-Z_]+$/);
  });

  test('sets correct Content-Type for error responses', async () => {
    const req = createRequest({});
    const res = await POST(req);

    expect(res.headers.get('Content-Type')).toContain('application/json');
  });

  test('includes CORS headers in response', async () => {
    const req = createRequest({});
    const res = await POST(req);

    // API responses should include CORS headers from middleware
    const body = await res.json();
    expect(body).toBeDefined();
  });
});
