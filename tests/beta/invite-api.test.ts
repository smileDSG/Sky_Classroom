import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: 'test-id',
        code: 'BETA-TEST123',
        type: 'direct',
        status: 'active',
        created_by: 'cli',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        max_uses: 1,
        current_uses: 0,
        notes: null,
      },
      error: null,
    }),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
  })),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabase,
}));

vi.stubGlobal('crypto', {
  subtle: {
    importKey: async () => ({}),
    sign: async () => new ArrayBuffer(32),
  },
});

describe('POST /api/beta/invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 for empty code', async () => {
    const { POST } = await import('@/app/api/beta/invite/route');
    const req = new Request('http://test/api/beta/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid code', async () => {
    mockSupabase.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
    })) as any;

    const { POST } = await import('@/app/api/beta/invite/route');
    const req = new Request('http://test/api/beta/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'INVALID-CODE' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('无效');
  });
});
