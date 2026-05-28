import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSupabase = {
  from: vi.fn(() => ({
    insert: vi.fn().mockResolvedValue({ error: null }),
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  })),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabase,
}));

describe('POST /api/beta/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject empty description', async () => {
    const { POST } = await import('@/app/api/beta/feedback/route');
    const req = new Request('http://test/api/beta/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: 'test-session',
        category: 'bug',
        severity: 'major',
        description: '',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should accept valid feedback', async () => {
    const { POST } = await import('@/app/api/beta/feedback/route');
    const req = new Request('http://test/api/beta/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: 'test-session',
        category: 'bug',
        severity: 'major',
        quick_tags: ['报错'],
        description: '生成课件时数学公式渲染错误',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('should reject invalid category', async () => {
    const { POST } = await import('@/app/api/beta/feedback/route');
    const req = new Request('http://test/api/beta/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: 'test-session',
        category: 'invalid',
        severity: 'major',
        description: 'test',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
