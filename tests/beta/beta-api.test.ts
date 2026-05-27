import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the DAO modules used by API routes
vi.mock('@/lib/server/beta/dao/invitation-codes', () => ({
  createInvitationDAO: vi.fn(async () => ({
    getByCode: vi.fn(async (code: string) => {
      if (code === 'SKY-VALID-001') {
        return {
          id: 'mock-id',
          code: 'SKY-VALID-001',
          type: 'direct',
          status: 'active',
          createdBy: 'admin',
          createdAt: new Date(),
          usedBy: null,
          usedAt: null,
          expiresAt: new Date(Date.now() + 86400000),
          maxUses: 1,
          currentUses: 0,
          notes: null,
        };
      }
      if (code === 'SKY-EXP-001') {
        return {
          id: 'mock-exp-id',
          code: 'SKY-EXP-001',
          type: 'direct',
          status: 'active',
          createdBy: 'admin',
          createdAt: new Date(),
          usedBy: null,
          usedAt: null,
          expiresAt: new Date(Date.now() - 86400000),
          maxUses: 1,
          currentUses: 0,
          notes: null,
        };
      }
      if (code === 'SKY-FULL-001') {
        return {
          id: 'mock-full-id',
          code: 'SKY-FULL-001',
          type: 'direct',
          status: 'active',
          createdBy: 'admin',
          createdAt: new Date(),
          usedBy: null,
          usedAt: null,
          expiresAt: new Date(Date.now() + 86400000),
          maxUses: 1,
          currentUses: 1,
          notes: null,
        };
      }
      return null;
    }),
    create: vi.fn(),
    batchCreate: vi.fn(),
    markUsed: vi.fn(),
    list: vi.fn(),
  })),
}));

vi.mock('@/lib/server/beta/dao/beta-requests', () => ({
  createBetaRequestDAO: vi.fn(async () => ({
    create: vi.fn(async (input: { email: string; reason?: string }) => ({
      id: 'mock-req-id',
      email: input.email,
      reason: input.reason || null,
      status: 'pending',
      appliedAt: new Date(),
      reviewedBy: null,
      reviewedAt: null,
    })),
    getByEmail: vi.fn(async (email: string) => {
      if (email === 'existing@example.com') {
        return {
          id: 'existing-id',
          email: 'existing@example.com',
          reason: null,
          status: 'pending',
          appliedAt: new Date(),
          reviewedBy: null,
          reviewedAt: null,
        };
      }
      return null;
    }),
    list: vi.fn(async () => []),
    review: vi.fn(async (id: string, status: string, reviewerId: string) => ({
      id,
      email: 'test@example.com',
      reason: null,
      status,
      appliedAt: new Date(),
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    })),
  })),
}));

describe('Beta API Endpoints', () => {
  describe('POST /api/beta/invite', () => {
    let POST: (req: Request) => Promise<Response>;

    beforeEach(async () => {
      // Set ACCESS_CODE for cookie signing
      process.env.ACCESS_CODE = 'test-access-code';
      const mod = await import('@/app/api/beta/invite/route');
      POST = mod.POST;
    });

    it('should reject empty code', async () => {
      const res = await POST(new Request('http://localhost/api/beta/invite', {
        method: 'POST',
        body: JSON.stringify({ code: '' }),
      }));
      expect(res.status).toBe(400);
    });

    it('should reject missing code field', async () => {
      const res = await POST(new Request('http://localhost/api/beta/invite', {
        method: 'POST',
        body: JSON.stringify({}),
      }));
      expect(res.status).toBe(400);
    });

    it('should validate a correct invitation code', async () => {
      const res = await POST(new Request('http://localhost/api/beta/invite', {
        method: 'POST',
        body: JSON.stringify({ code: 'SKY-VALID-001' }),
      }));
      const data = await res.json();
      expect(data.success).toBe(true);
      // Should set beta_access cookie
      expect(res.headers.get('Set-Cookie')).toContain('beta_access');
    });

    it('should reject unknown invitation code', async () => {
      const res = await POST(new Request('http://localhost/api/beta/invite', {
        method: 'POST',
        body: JSON.stringify({ code: 'SKY-UNKNOWN' }),
      }));
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('INVITATION_INVALID');
    });

    it('should reject expired code', async () => {
      const res = await POST(new Request('http://localhost/api/beta/invite', {
        method: 'POST',
        body: JSON.stringify({ code: 'SKY-EXP-001' }),
      }));
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('INVITATION_INVALID');
    });

    it('should reject exhausted code', async () => {
      const res = await POST(new Request('http://localhost/api/beta/invite', {
        method: 'POST',
        body: JSON.stringify({ code: 'SKY-FULL-001' }),
      }));
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('INVITATION_EXHAUSTED');
    });
  });

  describe('POST /api/beta/request', () => {
    let POST: (req: Request) => Promise<Response>;

    beforeEach(async () => {
      const mod = await import('@/app/api/beta/request/route');
      POST = mod.POST;
    });

    it('should reject invalid email', async () => {
      const res = await POST(new Request('http://localhost/api/beta/request', {
        method: 'POST',
        body: JSON.stringify({ email: 'not-an-email' }),
      }));
      expect(res.status).toBe(400);
    });

    it('should submit a valid application', async () => {
      const res = await POST(new Request('http://localhost/api/beta/request', {
        method: 'POST',
        body: JSON.stringify({ email: 'new@example.com', reason: 'I want to try' }),
      }));
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(res.status).toBe(201);
    });

    it('should reject duplicate application', async () => {
      const res = await POST(new Request('http://localhost/api/beta/request', {
        method: 'POST',
        body: JSON.stringify({ email: 'existing@example.com' }),
      }));
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('BETA_REQUEST_DUPLICATE');
    });
  });
});
