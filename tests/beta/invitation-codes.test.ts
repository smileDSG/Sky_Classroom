import { describe, it, expect, beforeEach, vi } from 'vitest';

const { createMockDB } = vi.hoisted(() => {
  let storedCodes: any[] = [];

  function createMockDB() {
    return {
      from: vi.fn(() => ({
        insert: vi.fn((data: any) => {
          const items = Array.isArray(data)
            ? data.map((d: any, i: number) => ({ id: `mock-id-${i}`, ...d, created_at: new Date().toISOString(), status: 'active', current_uses: 0 }))
            : [{ id: 'mock-id', ...(data as any), created_at: new Date().toISOString(), status: 'active', current_uses: 0 }];

          return {
            select: vi.fn(() => {
              // Build a query-like object with eq/order/single for chaining
              const filters: Array<{ field: string; value: any }> = [];
              const orderBy: { field: string; opts: { ascending: boolean } } | null = null;

              const query: any = {
                eq(field: string, value: any) {
                  filters.push({ field, value });
                  return query;
                },
                order(field: string, opts: { ascending: boolean }) {
                  return query;
                },
                async single() {
                  let results = [...items];
                  for (const f of filters) {
                    results = results.filter((r: any) => r[f.field] === f.value);
                  }
                  const item = results.length > 0 ? results[0] : null;
                  if (item) storedCodes.push(item);
                  return { data: item, error: null };
                },
                then(resolve: (value: any) => void, reject: (reason?: any) => void) {
                  // Awaited directly (batchCreate pattern): store items and resolve
                  storedCodes.push(...items);
                  return Promise.resolve({ data: items, error: null }).then(resolve, reject);
                },
              };
              return query;
            }),
          };
        }),
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
            async single() {
              let results = [...storedCodes];
              for (const f of filters) {
                results = results.filter((r: any) => r[f.field] === f.value);
              }
              const item = results.length > 0 ? results[0] : null;
              return { data: item, error: item ? null : { message: 'Not found' } };
            },
            async then(resolve: (value: any) => void, reject: (reason?: any) => void) {
              let results = [...storedCodes];
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
                storedCodes = storedCodes.map((c: any) =>
                  c.id === updateData.id || (updateData.code && c.code === updateData.code)
                    ? { ...c, ...updateData }
                    : c
                );
                const updated = storedCodes.find((c: any) => c.code === updateData.code || c.id === 'mock-id');
                return { data: { ...updated, ...updateData }, error: null };
              }),
            })),
          })),
        })),
      })),
    };
  }

  return { createMockDB, getStoredCodes: () => storedCodes, resetStoredCodes: () => { storedCodes = []; } };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => createMockDB()),
}));

import { createInvitationDAO } from '@/lib/server/beta/dao/invitation-codes';

describe('InvitationDAO', () => {
  let dao: Awaited<ReturnType<typeof createInvitationDAO>>;

  beforeEach(async () => {
    dao = await createInvitationDAO();
  });

  it('should create and find an invitation code', async () => {
    const code = await dao.create({
      code: 'SKY-TEST-001',
      type: 'direct',
      createdBy: 'admin-001',
    });
    expect(code.code).toBe('SKY-TEST-001');
    expect(code.status).toBe('active');

    const found = await dao.getByCode('SKY-TEST-001');
    expect(found).not.toBeNull();
    expect(found!.id).toBe(code.id);
  });

  it('should mark a code as used', async () => {
    const code = await dao.create({ code: 'SKY-USE-001', type: 'direct', createdBy: 'admin-001' });
    const updated = await dao.markUsed(code.id, 'user-123');
    expect(updated.status).toBe('used');
    expect(updated.usedBy).toBe('user-123');
    expect(updated.currentUses).toBe(1);
  });

  it('should reject expired codes', async () => {
    const code = await dao.create({
      code: 'SKY-EXP-001',
      type: 'direct',
      createdBy: 'admin-001',
      expiresAt: new Date(Date.now() - 86400000),
    });
    const found = await dao.getByCode('SKY-EXP-001');
    expect(found).toBeNull();
  });

  it('should batch generate codes', async () => {
    const codes = await dao.batchCreate({
      prefix: 'SKY-BATCH',
      count: 5,
      type: 'direct',
      createdBy: 'admin-001',
    });
    expect(codes).toHaveLength(5);
    expect(codes[0].code).toMatch(/^SKY-BATCH-/);
  });

  it('should list active codes with stats', async () => {
    await dao.create({ code: 'SKY-LIST-001', type: 'direct', createdBy: 'admin-001' });
    await dao.create({ code: 'SKY-LIST-002', type: 'direct', createdBy: 'admin-001' });
    const list = await dao.list({ status: 'active' });
    expect(list.length).toBeGreaterThanOrEqual(2);
  });
});
