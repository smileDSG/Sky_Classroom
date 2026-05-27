import { describe, it, expect, beforeEach, vi } from 'vitest';

const { createMockDB } = vi.hoisted(() => {
  let storedRequests: any[] = [];

  function createMockDB() {
    return {
      from: vi.fn(() => ({
        insert: vi.fn((data: any) => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => {
              const item = {
                id: 'mock-req-id',
                ...(data as any),
                applied_at: new Date().toISOString(),
                status: 'pending',
                reviewed_by: null,
                reviewed_at: null,
              };
              storedRequests.push(item);
              return { data: item, error: null };
            }),
          })),
        })),
        select: vi.fn(() => {
          const filters: Array<{ field: string; value: any }> = [];
          const query: any = {
            eq(field: string, value: any) {
              filters.push({ field, value });
              return query;
            },
            order(field: string, opts: { ascending: boolean }) {
              return query;
            },
            limit(n: number) {
              return query;
            },
            async single() {
              let results = [...storedRequests];
              for (const f of filters) {
                results = results.filter((r: any) => r[f.field] === f.value);
              }
              const item = results.length > 0 ? results[results.length - 1] : null;
              return { data: item, error: item ? null : { message: 'Not found' } };
            },
            async then(resolve: (value: any) => void, reject: (reason?: any) => void) {
              let results = [...storedRequests];
              for (const f of filters) {
                results = results.filter((r: any) => r[f.field] === f.value);
              }
              return Promise.resolve({ data: results, error: null }).then(resolve, reject);
            },
          };
          return query;
        }),
        update: vi.fn((updateData: any) => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                storedRequests = storedRequests.map((r: any) =>
                  r.id === updateData.id || r.id === 'mock-req-id'
                    ? { ...r, ...updateData }
                    : r
                );
                const updated = storedRequests.find((r: any) => r.id === 'mock-req-id' || r.id === updateData.id);
                return { data: updated || null, error: null };
              }),
            })),
          })),
        })),
      })),
    };
  }

  return { createMockDB };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => createMockDB()),
}));

import { createBetaRequestDAO } from '@/lib/server/beta/dao/beta-requests';

describe('BetaRequestDAO', () => {
  let dao: Awaited<ReturnType<typeof createBetaRequestDAO>>;

  beforeEach(async () => {
    dao = await createBetaRequestDAO();
  });

  it('should create a beta request', async () => {
    const req = await dao.create({
      email: 'test@example.com',
      reason: 'I want to try this!',
    });
    expect(req.email).toBe('test@example.com');
    expect(req.status).toBe('pending');
    expect(req.reason).toBe('I want to try this!');
  });

  it('should detect duplicate applications by email', async () => {
    await dao.create({ email: 'dup@example.com' });
    const found = await dao.getByEmail('dup@example.com');
    expect(found).not.toBeNull();
    expect(found!.email).toBe('dup@example.com');
  });

  it('should return null for unknown email', async () => {
    const found = await dao.getByEmail('unknown@example.com');
    expect(found).toBeNull();
  });

  it('should list requests by status', async () => {
    await dao.create({ email: 'a@example.com' });
    await dao.create({ email: 'b@example.com' });
    const list = await dao.list({ status: 'pending' });
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it('should review (approve) a request', async () => {
    const req = await dao.create({ email: 'review@example.com' });
    const reviewed = await dao.review(req.id, 'approved', 'admin-001');
    expect(reviewed.status).toBe('approved');
    expect(reviewed.reviewedBy).toBe('admin-001');
    expect(reviewed.reviewedAt).toBeInstanceOf(Date);
  });

  it('should review (reject) a request', async () => {
    const req = await dao.create({ email: 'reject@example.com' });
    const reviewed = await dao.review(req.id, 'rejected', 'admin-002');
    expect(reviewed.status).toBe('rejected');
  });
});
