# Beta 内测系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为天空课堂构建完整的内测准入、遥测数据收集、异步任务队列与管理后台系统。

**Architecture:** 四阶段递进实施——数据库迁移 → 遥测 SDK → 准入系统 → 异步任务队列 → 管理后台。所有组件复用 Supabase 数据库，不引入 Redis。

**Tech Stack:** Next.js 16 (App Router), Supabase (PostgreSQL), Edge Middleware, SSE (Server-Sent Events), Sentry, jose JWT, zod

---

## 文件地图

### 新增文件

| 文件 | 职责 |
|------|------|
| `lib/server/beta/dao/invitation-codes.ts` | 邀请码 CRUD DAO |
| `lib/server/beta/dao/beta-requests.ts` | 内测申请 CRUD DAO |
| `lib/server/beta/dao/telemetry.ts` | 遥测数据写入 DAO |
| `lib/server/beta/dao/ai-tasks.ts` | AI 任务 CRUD DAO |
| `lib/server/beta/sanitize.ts` | 遥测数据脱敏函数 |
| `lib/server/beta/rate-limiter.ts` | 基于 Supabase 的速率限制 |
| `lib/monitoring/telemetry.ts` | 客户端遥测采集 SDK |
| `lib/monitoring/performance.ts` | 客户端自定义性能指标 |
| `hooks/use-task-progress.ts` | SSE 任务进度 Hook |
| `app/auth/beta-gate/page.tsx` | Beta 准入页面 |
| `app/api/beta/invite/route.ts` | 验证邀请码 API |
| `app/api/beta/request/route.ts` | 提交内测申请 API |
| `app/api/beta/requests/route.ts` | 管理员查看申请列表 API |
| `app/api/beta/requests/[id]/review/route.ts` | 管理员审核申请 API |
| `app/api/beta/codes/route.ts` | 管理员生成/查看邀请码 API |
| `app/api/beta/status/route.ts` | 查询用户内测状态 API |
| `app/api/telemetry/route.ts` | 遥测数据接收 API |
| `app/api/sky/tasks/[jobId]/stream/route.ts` | SSE 任务进度推送 API |
| `app/admin/beta/codes/page.tsx` | 管理后台：邀请码管理 |
| `app/admin/beta/requests/page.tsx` | 管理后台：申请审核 |
| `app/admin/beta/dashboard/page.tsx` | 管理后台：遥测仪表板 |
| `migrations/001_beta_system.sql` | Supabase 数据库迁移脚本 |
| `scripts/generate-invite-codes.ts` | 批量生成邀请码 CLI 工具 |
| `scripts/cleanup-telemetry.ts` | 90 天 TTL 清理脚本 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `middleware.ts` | 增加 Beta 门控逻辑 + 速率限制检查 |
| `lib/storage/dao/users.ts` | UserEntry 增加 beta_status, beta_invited_by, beta_joined_at 字段 |
| `app/api/auth/register/route.ts` | 注册时验证 beta_access cookie，写入 beta_status |
| `app/layout.tsx` | 初始化遥测 SDK |

---

## Phase 1: 数据库迁移 + 遥测 SDK

### Task 1: 数据库迁移脚本

**Files:**
- Create: `migrations/001_beta_system.sql`

- [x] **Step 1: 创建迁移脚本**

```sql
-- 001_beta_system.sql
-- Beta 内测系统数据库迁移

-- 1. 邀请码表
CREATE TABLE IF NOT EXISTS invitation_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  type        TEXT NOT NULL DEFAULT 'direct',
  status      TEXT NOT NULL DEFAULT 'active',
  created_by  UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_by     UUID,
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  max_uses    INT NOT NULL DEFAULT 1,
  current_uses INT NOT NULL DEFAULT 0,
  notes       TEXT
);

-- 2. 内测申请记录
CREATE TABLE IF NOT EXISTS beta_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ
);

-- 3. 遥测事件表
CREATE TABLE IF NOT EXISTS telemetry_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID,
  session_id  TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  event_data  JSONB NOT NULL,
  page        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. 性能每日汇总表
CREATE TABLE IF NOT EXISTS performance_daily (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date           DATE NOT NULL,
  user_id        UUID,
  avg_fcp        FLOAT,
  avg_lcp        FLOAT,
  avg_cls        FLOAT,
  avg_ttfb       FLOAT,
  avg_inp        FLOAT,
  error_count    INT DEFAULT 0,
  api_call_count INT DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date, user_id)
);

-- 5. AI 任务表
CREATE TABLE IF NOT EXISTS ai_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  task_type       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'queued',
  input_summary   JSONB,
  output_summary  JSONB,
  input_tokens    INT DEFAULT 0,
  output_tokens   INT DEFAULT 0,
  cost_usd        FLOAT DEFAULT 0,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,
  progress        INT DEFAULT 0,
  progress_detail TEXT
);

-- 6. 索引
CREATE INDEX IF NOT EXISTS idx_telemetry_events_type ON telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_user ON telemetry_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_created ON telemetry_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_user ON ai_tasks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_tasks(status, started_at);
CREATE INDEX IF NOT EXISTS idx_beta_requests_status ON beta_requests(status, applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON invitation_codes(code);

-- 7. users 表扩展（如果 users 表存在）
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS beta_status TEXT NOT NULL DEFAULT 'none';
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS beta_invited_by UUID REFERENCES invitation_codes(id);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS beta_joined_at TIMESTAMPTZ;

-- 8. 90 天 TTL 清理函数
CREATE OR REPLACE FUNCTION cleanup_old_telemetry() RETURNS void AS $$
BEGIN
  DELETE FROM telemetry_events WHERE created_at < now() - INTERVAL '90 days';
  DELETE FROM performance_daily WHERE date < CURRENT_DATE - INTERVAL '90 days';
  DELETE FROM ai_tasks WHERE completed_at < now() - INTERVAL '90 days' AND status IN ('completed', 'failed', 'cancelled');
END;
$$ LANGUAGE plpgsql;
```

- [x] **Step 2: 提交**

---

### Task 2: 邀请码 DAO

**Files:**
- Create: `lib/server/beta/dao/invitation-codes.ts`

- [x] **Step 1: 编写测试**

Create: `tests/beta/invitation-codes.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
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
      expiresAt: new Date(Date.now() - 86400000), // yesterday
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
```

- [x] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/beta/invitation-codes.test.ts -v
```
预期：失败，模块不存在

- [x] **Step 3: 实现 DAO**

Create: `lib/server/beta/dao/invitation-codes.ts`

```typescript
/**
 * Invitation code DAO for beta access control.
 * Uses Supabase PostgreSQL.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

export interface InvitationCode {
  id: string;
  code: string;
  type: 'direct' | 'request';
  status: 'active' | 'used' | 'expired';
  createdBy: string;
  createdAt: Date;
  usedBy: string | null;
  usedAt: Date | null;
  expiresAt: Date | null;
  maxUses: number;
  currentUses: number;
  notes: string | null;
}

export async function createInvitationDAO() {
  const db = getSupabase();
  const TABLE = 'invitation_codes';

  return {
    async create(input: { code: string; type: 'direct' | 'request'; createdBy: string; expiresAt?: Date; maxUses?: number; notes?: string }): Promise<InvitationCode> {
      const { data, error } = await db
        .from(TABLE)
        .insert({
          code: input.code,
          type: input.type,
          created_by: input.createdBy,
          expires_at: input.expiresAt?.toISOString() ?? null,
          max_uses: input.maxUses ?? 1,
          notes: input.notes ?? null,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create invitation code: ${error.message}`);
      return mapInvitationCode(data);
    },

    async batchCreate(input: { prefix: string; count: number; type: 'direct' | 'request'; createdBy: string; expiresAt?: Date; notes?: string }): Promise<InvitationCode[]> {
      const codes: { code: string; type: string; created_by: string; expires_at: string | null; max_uses: number; notes: string | null }[] = [];
      for (let i = 0; i < input.count; i++) {
        const suffix = generateCode(8);
        codes.push({
          code: `${input.prefix}-${suffix}`,
          type: input.type,
          created_by: input.createdBy,
          expires_at: input.expiresAt?.toISOString() ?? null,
          max_uses: 1,
          notes: input.notes ?? null,
        });
      }

      const { data, error } = await db.from(TABLE).insert(codes).select();
      if (error) throw new Error(`Failed to batch create invitation codes: ${error.message}`);
      return (data as any[]).map(mapInvitationCode);
    },

    async getByCode(code: string): Promise<InvitationCode | null> {
      const { data, error } = await db
        .from(TABLE)
        .select()
        .eq('code', code)
        .eq('status', 'active')
        .single();

      if (error || !data) return null;

      // Check expiration
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        // Mark as expired
        await db.from(TABLE).update({ status: 'expired' }).eq('id', data.id);
        return null;
      }

      return mapInvitationCode(data);
    },

    async markUsed(id: string, userId: string): Promise<InvitationCode> {
      const { data, error } = await db
        .from(TABLE)
        .update({
          status: 'used',
          used_by: userId,
          used_at: new Date().toISOString(),
          current_uses: (await db.from(TABLE).select('current_uses').eq('id', id).single()).data?.current_uses + 1,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(`Failed to mark invitation as used: ${error.message}`);
      return mapInvitationCode(data);
    },

    async list(filter?: { status?: string }): Promise<InvitationCode[]> {
      let query = db.from(TABLE).select();
      if (filter?.status) query = query.eq('status', filter.status);
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw new Error(`Failed to list invitation codes: ${error.message}`);
      return (data as any[]).map(mapInvitationCode);
    },
  };
}

function generateCode(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function mapInvitationCode(data: any): InvitationCode {
  return {
    id: data.id,
    code: data.code,
    type: data.type,
    status: data.status,
    createdBy: data.created_by,
    createdAt: new Date(data.created_at),
    usedBy: data.used_by,
    usedAt: data.used_at ? new Date(data.used_at) : null,
    expiresAt: data.expires_at ? new Date(data.expires_at) : null,
    maxUses: data.max_uses,
    currentUses: data.current_uses,
    notes: data.notes,
  };
}
```

- [x] **Step 4: Mock Supabase for tests**

Add to `tests/beta/invitation-codes.test.ts` at the top:

```ts
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      insert: vi.fn((data: any) => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: Array.isArray(data) ? data.map((d: any, i: number) => ({ id: `mock-id-${i}`, ...d, created_at: new Date().toISOString(), status: 'active', current_uses: 0 })) : [{ id: 'mock-id', ...data, created_at: new Date().toISOString(), status: 'active', current_uses: 0 }],
            error: null,
          })),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(function(this: any, _field: string, _value: any) { return this; }),
        order: vi.fn(async function(this: any) { return { data: [], error: null }; }),
        single: vi.fn(async () => ({ data: { id: 'mock-id', code: 'SKY-TEST-001', type: 'direct', status: 'active', created_by: 'admin-001', created_at: new Date().toISOString(), current_uses: 0 }, error: null })),
      })),
      update: vi.fn((data: any) => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { id: 'mock-id', code: 'SKY-TEST-001', type: 'direct', status: data.status || 'active', used_by: data.used_by, used_at: data.used_at, current_uses: data.current_uses || 1 }, error: null }),
          })),
        })),
      })),
    })),
  })),
}));
```

- [x] **Step 5: 运行测试确认通过**

```bash
npx vitest run tests/beta/invitation-codes.test.ts -v
```
预期：全部通过

- [ ] **Step 6: 提交**

```bash
git add lib/server/beta/dao/invitation-codes.ts tests/beta/invitation-codes.test.ts
git commit -m "feat: add invitation code DAO with tests"
```

---

### Task 3: 遥测 DAO + 脱敏

**Files:**
- Create: `lib/server/beta/dao/telemetry.ts`
- Create: `lib/server/beta/sanitize.ts`
- Test: `tests/beta/sanitize.test.ts`

- [x] **Step 1: 编写脱敏测试**

Create: `tests/beta/sanitize.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { sanitize } from '@/lib/server/beta/sanitize';

describe('sanitize', () => {
  it('should remove password fields', () => {
    const input = { username: 'test', password: 'secret123', email: 'test@example.com' };
    const output = sanitize(input);
    expect(output).not.toHaveProperty('password');
    expect(output).toHaveProperty('username', 'test');
    expect(output).toHaveProperty('email', 'test@example.com');
  });

  it('should remove token fields', () => {
    const input = { token: 'abc123', access_token: 'xyz', user_id: '123' };
    const output = sanitize(input);
    expect(output).not.toHaveProperty('token');
    expect(output).not.toHaveProperty('access_token');
    expect(output).toHaveProperty('user_id', '123');
  });

  it('should truncate long strings', () => {
    const input = { data: 'a'.repeat(5000) };
    const output = sanitize(input);
    expect((output as any).data.length).toBeLessThanOrEqual(1000);
  });

  it('should handle nested objects', () => {
    const input = { user: { name: 'test', password: 'secret' } };
    const output = sanitize(input);
    expect((output as any).user).not.toHaveProperty('password');
  });

  it('should not modify safe data', () => {
    const input = { feature: 'ppt_generate', result: 'success', duration: 1200 };
    const output = sanitize(input);
    expect(output).toEqual(input);
  });
});
```

- [~] **Step 2: 实现脱敏函数** (内联于 app/api/telemetry/route.ts)

Create: `lib/server/beta/sanitize.ts`

```typescript
/**
 * Sanitize telemetry data before storage.
 * Removes PII, tokens, passwords, and truncates long strings.
 */

const SENSITIVE_KEYS = new Set([
  'password', 'passwd', 'secret', 'token', 'access_token', 'refresh_token',
  'api_key', 'apikey', 'api_secret', 'authorization', 'cookie',
  'authorization_header', 'x-api-key', 'jwt', 'session_id',
]);

const MAX_STRING_LENGTH = 1000;

export function sanitize(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') return truncate(data);
  if (typeof data === 'number' || typeof data === 'boolean') return data;
  if (Array.isArray(data)) return data.map(sanitize);
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
      result[key] = sanitize(value);
    }
    return result;
  }
  return String(data);
}

function truncate(str: string): string {
  if (str.length <= MAX_STRING_LENGTH) return str;
  return str.substring(0, MAX_STRING_LENGTH) + '...[truncated]';
}
```

- [x] **Step 3: 运行脱敏测试**

```bash
npx vitest run tests/beta/sanitize.test.ts -v
```

- [~] **Step 4: 实现遥测 DAO** (逻辑内联于 telemetry route)

Create: `lib/server/beta/dao/telemetry.ts`

```typescript
/**
 * Telemetry data DAO — batch insert and query.
 */

import { createClient } from '@supabase/supabase-js';
import { sanitize } from '../sanitize';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

export async function createTelemetryDAO() {
  const db = getSupabase();
  const EVENTS_TABLE = 'telemetry_events';
  const PERFORMANCE_TABLE = 'performance_daily';

  return {
    async batchInsert(events: Array<{ userId?: string; sessionId: string; eventType: string; eventData: unknown; page?: string }>): Promise<void> {
      const rows = events.map((e) => ({
        user_id: e.userId ?? null,
        session_id: e.sessionId,
        event_type: e.eventType,
        event_data: sanitize(e.eventData) as object,
        page: e.page ?? null,
      }));

      const { error } = await db.from(EVENTS_TABLE).insert(rows);
      if (error) throw new Error(`Telemetry batch insert failed: ${error.message}`);
    },

    async aggregateDaily(userId: string, date: Date): Promise<void> {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await db
        .from('telemetry_events')
        .select('event_type, event_data')
        .eq('user_id', userId)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());

      if (error) return;

      const performanceEvents = (data as any[]).filter((e) => e.event_type === 'performance');
      const errorEvents = (data as any[]).filter((e) => e.event_type === 'error');
      const apiCalls = (data as any[]).filter((e) => e.event_type === 'api_call');

      const averages: Record<string, number[]> = { fcp: [], lcp: [], cls: [], ttfb: [], inp: [] };
      for (const e of performanceEvents) {
        const d = e.event_data;
        if (d.fcp) averages.fcp.push(d.fcp);
        if (d.lcp) averages.lcp.push(d.lcp);
        if (d.cls) averages.cls.push(d.cls);
        if (d.ttfb) averages.ttfb.push(d.ttfb);
        if (d.inp) averages.inp.push(d.inp);
      }

      const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

      const { error: upsertError } = await db.from(PERFORMANCE_TABLE).upsert({
        date: startOfDay.toISOString().split('T')[0],
        user_id: userId,
        avg_fcp: avg(averages.fcp),
        avg_lcp: avg(averages.lcp),
        avg_cls: avg(averages.cls),
        avg_ttfb: avg(averages.ttfb),
        avg_inp: avg(averages.inp),
        error_count: errorEvents.length,
        api_call_count: apiCalls.length,
      }, { onConflict: 'date,user_id' });

      if (upsertError) throw new Error(`Daily performance aggregation failed: ${upsertError.message}`);
    },

    async cleanupOldRecords(): Promise<{ deleted: number }> {
      const { error } = await db.rpc('cleanup_old_telemetry');
      if (error) throw new Error(`Telemetry cleanup failed: ${error.message}`);
      return { deleted: 0 }; // PostgreSQL function doesn't return count
    },
  };
}
```

- [ ] **Step 5: 提交**

```bash
git add lib/server/beta/sanitize.ts lib/server/beta/dao/telemetry.ts tests/beta/sanitize.test.ts
git commit -m "feat: add telemetry DAO and sanitize utility with tests"
```

---

### Task 4: 客户端遥测 SDK

**Files:**
- Create: `lib/monitoring/telemetry.ts`
- Create: `lib/monitoring/performance.ts`

- [x] **Step 1: 实现遥测采集器**

Create: `lib/monitoring/telemetry.ts`

```typescript
/**
 * Client-side telemetry collector.
 * Buffers events in memory and flushes periodically or on page unload.
 */

export type TelemetryEventType =
  | 'page_view'
  | 'api_call'
  | 'error'
  | 'performance'
  | 'feature_use'
  | 'ai_task'
  | 'rate_limited';

interface TelemetryEvent {
  eventType: TelemetryEventType;
  eventData: Record<string, unknown>;
  page?: string;
  timestamp: number;
}

const MAX_QUEUE_SIZE = 50;
const FLUSH_INTERVAL_MS = 30_000;

let sessionId: string;
let queue: TelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let featureTrackingEnabled = true;

function getSessionId(): string {
  if (!sessionId) {
    sessionId = globalThis.sessionStorage?.getItem('telemetry-session-id') ?? crypto.randomUUID();
    globalThis.sessionStorage?.setItem('telemetry-session-id', sessionId);
  }
  return sessionId;
}

function getMeta(): { sessionId: string; page: string; userAgent: string } {
  return {
    sessionId: getSessionId(),
    page: typeof window !== 'undefined' ? window.location.pathname : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };
}

async function flush(): Promise<void> {
  if (queue.length === 0) return;

  const events = queue.splice(0, queue.length);
  const meta = getMeta();

  const payload = events.map((e) => ({
    sessionId: meta.sessionId,
    eventType: e.eventType,
    eventData: e.eventData,
    page: e.page ?? meta.page,
  }));

  try {
    if (typeof window !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon('/api/telemetry', blob);
    } else {
      await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    }
  } catch {
    // Telemetry failure should not break the app — push back to queue
    queue.unshift(...events);
    if (queue.length > MAX_QUEUE_SIZE * 2) queue.splice(MAX_QUEUE_SIZE);
  }
}

/** Start the telemetry collector. Call once at app initialization. */
export function startTelemetry(): void {
  if (typeof window === 'undefined') return;

  // Flush periodically
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);

  // Flush on page unload
  window.addEventListener('beforeunload', () => {
    flush();
  });
}

/** Stop the telemetry collector. */
export function stopTelemetry(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

/** Record a telemetry event. */
export function track(type: TelemetryEventType, data: Record<string, unknown>, page?: string): void {
  if (type === 'feature_use' && !featureTrackingEnabled) return;

  queue.push({ eventType: type, eventData: data, page, timestamp: Date.now() });

  if (queue.length >= MAX_QUEUE_SIZE) {
    flush();
  }
}

/** Disable feature tracking (still collects errors and performance). */
export function disableFeatureTracking(): void {
  featureTrackingEnabled = false;
}

/** Enable feature tracking. */
export function enableFeatureTracking(): void {
  featureTrackingEnabled = true;
}

// Convenience wrappers
export function trackApiCall(url: string, method: string, durationMs: number, statusCode: number): void {
  track('api_call', { url, method, duration_ms: durationMs, status_code: statusCode });
}

export function trackError(type: string, message: string, context?: Record<string, unknown>): void {
  track('error', { type, message, context, stack: new Error().stack?.split('\n').slice(2, 5).join('\n') });
}

export function trackFeatureUse(feature: string, params?: Record<string, unknown>, result?: string): void {
  track('feature_use', { feature, params_summary: params, result });
}

export function trackAiTask(taskType: string, inputTokens: number, outputTokens: number, durationMs: number, costUsd: number): void {
  track('ai_task', { task_type: taskType, input_tokens: inputTokens, output_tokens: outputTokens, duration_ms: durationMs, cost_usd: costUsd });
}
```

- [ ] **Step 2: 实现性能模块**

Create: `lib/monitoring/performance.ts`

```typescript
/**
 * Custom performance metrics beyond Web Vitals.
 * Tracks API call timing, page interaction latency.
 */

import { trackApiCall, track } from './telemetry';

/** Wrap a fetch call to auto-track API performance. */
export async function trackedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const method = init?.method ?? 'GET';
  const start = performance.now();

  try {
    const response = await fetch(input, init);
    const duration = performance.now() - start;
    trackApiCall(url, method, Math.round(duration), response.status);
    return response;
  } catch (err) {
    const duration = performance.now() - start;
    trackApiCall(url, method, Math.round(duration), 0);
    throw err;
  }
}

/** Track a custom function's execution time. */
export async function trackPerformance<T>(
  feature: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    track('performance', { feature, duration_ms: Math.round(duration) });
    return result;
  } catch (err) {
    const duration = performance.now() - start;
    track('performance', { feature, duration_ms: Math.round(duration), error: true });
    throw err;
  }
}

/** Track user interaction latency (click to visible). */
export function trackInteraction(feature: string): () => void {
  const start = performance.now();
  return () => {
    const duration = performance.now() - start;
    track('performance', { feature, interaction_latency_ms: Math.round(duration) });
  };
}
```

- [ ] **Step 3: 修改 app/layout.tsx 初始化遥测**

Read `app/layout.tsx` 当前内容，在客户端初始化中添加 `startTelemetry()`。

```tsx
// In the client component (or a new ClientInit component):
import { startTelemetry, onWebVitals, storeVital } from '@/lib/monitoring';

// Inside useEffect or client init:
startTelemetry();
onWebVitals((entry) => {
  storeVital(entry);
  track('performance', {
    name: entry.name,
    value: entry.value,
    rating: entry.rating,
  });
});
```

- [ ] **Step 4: 提交**

```bash
git add lib/monitoring/telemetry.ts lib/monitoring/performance.ts
git commit -m "feat: add client-side telemetry SDK and performance tracking"
```

---

### Task 5: 遥测接收 API

**Files:**
- Create: `app/api/telemetry/route.ts`

- [x] **Step 1: 实现遥测接收端点**

Create: `app/api/telemetry/route.ts`

```typescript
/**
 * POST /api/telemetry
 * Receive batched telemetry events from clients.
 * Uses waitUntil for async Supabase write.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createTelemetryDAO } from '@/lib/server/beta/dao/telemetry';
import { verifyAccessToken } from '@/lib/server/auth';

const RATE_LIMIT = 20; // events per minute per user
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

export async function POST(request: NextRequest) {
  try {
    const events = await request.json();
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ success: false, error: 'Empty payload' }, { status: 400 });
    }

    // Try to identify user from JWT
    let userId: string | undefined;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const payload = await verifyAccessToken(authHeader.substring(7));
      if (payload) userId = payload.sub;
    }

    // Rate limit check
    const limiterKey = userId ?? request.ip ?? 'anonymous';
    if (!checkRateLimit(limiterKey)) {
      return NextResponse.json({ success: false, error: 'Rate limited' }, { status: 429 });
    }

    // Async write — don't block the response
    // @ts-ignore — waitUntil available in Next.js Edge/Node runtime
    if (typeof (globalThis as any).waitUntil === 'function') {
      // @ts-ignore
      (globalThis as any).waitUntil(async () => {
        try {
          const dao = await createTelemetryDAO();
          await dao.batchInsert(events.map((e: any) => ({
            userId,
            sessionId: e.sessionId,
            eventType: e.eventType,
            eventData: e.eventData,
            page: e.page,
          })));
        } catch {
          // Telemetry write failure is non-critical
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
```

- [x] **Step 2: 提交**---

## Phase 2: 准入系统

### Task 6: Beta API 端点（invite, request, status）

**Files:**
- Create: `app/api/beta/invite/route.ts`
- Create: `app/api/beta/request/route.ts`
- Create: `app/api/beta/status/route.ts`
- Test: `tests/beta/beta-api.test.ts`

- [x] **Step 1: 实现邀请码验证 API**

Create: `app/api/beta/invite/route.ts`

```typescript
/**
 * POST /api/beta/invite
 * Validate an invitation code and set beta_access cookie.
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createInvitationDAO } from '@/lib/server/beta/dao/invitation-codes';

const InviteSchema = z.object({
  code: z.string().min(6).max(30),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = InviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid code format' }, { status: 400 });
    }

    const dao = await createInvitationDAO();
    const invitation = await dao.getByCode(parsed.data.code);

    if (!invitation) {
      return NextResponse.json({ success: false, error: 'Invalid or expired code' }, { status: 404 });
    }

    // Set beta_access cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set('beta_access', 'verified', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
```

- [x] **Step 2: 实现申请提交 API**

Create: `app/api/beta/request/route.ts`

```typescript
/**
 * POST /api/beta/request
 * Submit a beta access request (for review by admin).
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const RequestSchema = z.object({
  email: z.string().email(),
  reason: z.string().min(10).max(500),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { error } = await supabase.from('beta_requests').insert({
      email: parsed.data.email,
      reason: parsed.data.reason,
      status: 'pending',
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, message: '申请已提交，等待审核' }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
```

- [x] **Step 3: 实现状态查询 API**

Create: `app/api/beta/status/route.ts`

```typescript
/**
 * GET /api/beta/status
 * Check current user's beta access status.
 */

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const hasBetaCookie = request.headers.get('cookie')?.includes('beta_access=verified');

  return NextResponse.json({
    hasAccess: !!hasBetaCookie,
    status: hasBetaCookie ? 'verified' : 'none',
  });
}
```

- [x] **Step 4: 提交**---

### Task 7: 管理员 Beta API（审核 + 邀请码管理）

**Files:**
- Create: `app/api/beta/requests/route.ts`
- Create: `app/api/beta/requests/[id]/review/route.ts`
- Create: `app/api/beta/codes/route.ts`
- Create: `lib/server/beta/dao/beta-requests.ts`

- [x] **Step 1: 实现申请 DAO**

Create: `lib/server/beta/dao/beta-requests.ts`

```typescript
/**
 * Beta request DAO — CRUD for beta access requests.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

export async function createBetaRequestDAO() {
  const db = getSupabase();
  const TABLE = 'beta_requests';

  return {
    async list(status?: string): Promise<any[]> {
      let query = db.from(TABLE).select().order('applied_at', { ascending: false });
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw new Error(`Failed to list beta requests: ${error.message}`);
      return data ?? [];
    },

    async review(id: string, status: 'approved' | 'rejected', reviewedBy: string): Promise<void> {
      const { error } = await db
        .from(TABLE)
        .update({ status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(`Failed to review beta request: ${error.message}`);
    },
  };
}
```

- [x] **Step 2: 实现管理员 API 端点**

Create: `app/api/beta/requests/route.ts`

```typescript
/**
 * GET /api/beta/requests — list all beta requests (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/server/auth';
import { createBetaRequestDAO } from '@/lib/server/beta/dao/beta-requests';

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyAccessToken(token);
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const dao = await createBetaRequestDAO();
  const status = request.nextUrl.searchParams.get('status') ?? undefined;
  const requests = await dao.list(status);

  return NextResponse.json({ success: true, data: requests });
}
```

Create: `app/api/beta/requests/[id]/review/route.ts`

```typescript
/**
 * POST /api/beta/requests/:id/review — approve/reject a beta request (admin only)
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/server/auth';
import { createBetaRequestDAO } from '@/lib/server/beta/dao/beta-requests';

const ReviewSchema = z.object({
  action: z.enum(['approved', 'rejected']),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyAccessToken(token);
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  const { id } = await params;
  const dao = await createBetaRequestDAO();
  await dao.review(id, parsed.data.action, payload.sub);

  return NextResponse.json({ success: true });
}
```

Update: `app/api/beta/codes/route.ts` — combine GET and POST for codes management.

```typescript
/**
 * GET /api/beta/codes — list invitation codes (admin)
 * POST /api/beta/codes — batch generate invitation codes (admin)
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/server/auth';
import { createInvitationDAO } from '@/lib/server/beta/dao/invitation-codes';

async function requireAdmin(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const payload = await verifyAccessToken(token);
  if (!payload || payload.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) };
  }
  return { payload };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const dao = await createInvitationDAO();
  const status = request.nextUrl.searchParams.get('status') ?? undefined;
  const codes = await dao.list(status ? { status } : undefined);

  return NextResponse.json({ success: true, data: codes });
}

const GenerateSchema = z.object({
  count: z.number().int().min(1).max(100),
  prefix: z.string().default('BETA'),
  expiresAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const body = await request.json();
  const parsed = GenerateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const dao = await createInvitationDAO();
  const codes = await dao.batchCreate({
    prefix: parsed.data.prefix,
    count: parsed.data.count,
    type: 'direct',
    createdBy: auth.payload.sub,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
    notes: parsed.data.notes,
  });

  return NextResponse.json({ success: true, data: codes }, { status: 201 });
}
```

- [x] **Step 3: 提交**---

### Task 8: Beta Gate 页面

**Files:**
- Create: `app/auth/beta-gate/page.tsx`

- [x] **Step 1: 创建 Beta Gate 页面**

Create: `app/auth/beta-gate/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BetaGatePage() {
  const [mode, setMode] = useState<'invite' | 'request'>('invite');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();

  const handleInvite = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/beta/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? '邀请码无效');
        return;
      }
      router.push('/auth/register');
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/beta/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, reason }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? '提交失败');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800">
          <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">申请已提交</h2>
          <p className="text-gray-600 dark:text-gray-300">
            我们已收到您的内测申请，审核通过后将通过邮件通知您。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800">
        <h1 className="mb-2 text-center text-3xl font-bold text-gray-900 dark:text-white">
          天空课堂 Beta 内测
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">
          欢迎参与内测，帮助我们改进产品
        </p>

        {/* Tab switcher */}
        <div className="mb-6 flex rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
          <button
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === 'invite' ? 'bg-white text-gray-900 shadow dark:bg-gray-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'
            }`}
            onClick={() => setMode('invite')}
          >
            输入邀请码
          </button>
          <button
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === 'request' ? 'bg-white text-gray-900 shadow dark:bg-gray-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'
            }`}
            onClick={() => setMode('request')}
          >
            申请内测
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {mode === 'invite' ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              邀请码
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="例如: SKY-7X3K-9M2P"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            />
            <button
              onClick={handleInvite}
              disabled={loading || code.length < 6}
              className="mt-4 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '验证中...' : '验证并注册'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                邮箱
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                申请理由
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请简要说明您参与内测的意愿和用途..."
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <button
              onClick={handleRequest}
              disabled={loading || email.length < 5 || reason.length < 10}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '提交中...' : '提交申请'}
            </button>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          参与内测即表示您同意我们收集匿名使用数据以改进产品
        </p>
      </div>
    </div>
  );
}
```

- [x] **Step 2: 提交**---

### Task 9: Edge Middleware Beta 门控 + 注册流程修改

**Files:**
- Modify: `middleware.ts`
- Modify: `app/api/auth/register/route.ts`
- Modify: `lib/storage/dao/users.ts`

- [x] **Step 1: 扩展 UserEntry 类型**

Modify: `lib/storage/dao/users.ts` — 在 UserEntry interface 中添加字段：

```typescript
export interface UserEntry {
  id: string;
  email: string | null;
  username: string;
  passwordHash: string | null;
  role: 'guest' | 'user' | 'admin';
  status: 'active' | 'suspended';
  guestId: string | null;
  planType: 'free' | 'basic' | 'pro' | 'enterprise';
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number | null;
  // Beta fields
  betaStatus?: 'none' | 'beta' | 'graduated';
  betaInvitedBy?: string | null;
  betaJoinedAt?: number | null;
}
```

- [~] **Step 2: 修改注册 API 验证 Beta 资格** (middleware 中实现)

Modify: `app/api/auth/register/route.ts` — 在重复检查之前添加：

```typescript
// Verify beta access
const betaCookie = request.cookies.get('beta_access');
if (betaCookie?.value !== 'verified') {
  return apiError('BETA_ACCESS_REQUIRED', 403, 'Beta access required. Please get an invite first.');
}
```

并在用户创建时写入 beta 信息：

```typescript
const user = await dao.create({
  id: crypto.randomUUID(),
  email: email ?? null,
  username,
  passwordHash,
  role: 'user',
  status: 'active',
  guestId: null,
  planType: 'free',
  betaStatus: 'beta',
  betaJoinedAt: Date.now(),
});
```

- [x] **Step 3: 修改 Middleware 增加 Beta 门控**

Modify: `middleware.ts` — 在 JWT 验证之后、ACCESS_CODE 检查之前添加 Beta 门控：

```typescript
// After JWT verification block (around line 82):
// Beta gate check: if no valid auth, redirect to beta gate
// Only apply beta gate when ACCESS_CODE is set AND the path is not whitelisted
if (!accessToken?.value || !(await verifyJwtToken(accessToken.value))) {
  // Allow access to beta gate and auth pages without beta cookie
  if (pathname.startsWith('/auth/beta-gate') || pathname === '/auth/login') {
    return NextResponse.next();
  }
}
```

实际上更合理的方式是：新增一个 `beta-gate` middleware 或在现有逻辑中，当 `ACCESS_CODE` 未设置时不强制 Beta 门（开发模式），当 `ACCESS_CODE` 设置时才强制。

修改方案：在 middleware 中检查 beta_access cookie，如果没有则重定向到 `/auth/beta-gate`。

```typescript
// Add after the existing access-code check block:
// Beta gate: redirect unauthenticated users to beta gate page
if (
  !accessToken?.value &&
  !cookie?.value &&
  !pathname.startsWith('/auth/') &&
  !pathname.startsWith('/_next/') &&
  !pathname.startsWith('/api/')
) {
  return NextResponse.redirect(new URL('/auth/beta-gate', request.url));
}
```

- [x] **Step 4: 提交**---

## Phase 3: 异步任务队列

### Task 10: AI 任务 DAO

**Files:**
- Create: `lib/server/beta/dao/ai-tasks.ts`

- [ ] **Step 1: 实现 AI 任务 DAO**

Create: `lib/server/beta/dao/ai-tasks.ts`

```typescript
/**
 * AI task queue DAO — CRUD for async AI generation tasks.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

export async function createAiTaskDAO() {
  const db = getSupabase();
  const TABLE = 'ai_tasks';

  return {
    async create(input: { userId: string; taskType: string; inputSummary?: object }): Promise<{ id: string }> {
      const { data, error } = await db
        .from(TABLE)
        .insert({
          user_id: input.userId,
          task_type: input.taskType,
          input_summary: input.inputSummary ?? {},
          status: 'queued',
          progress: 0,
        })
        .select('id')
        .single();

      if (error) throw new Error(`Failed to create AI task: ${error.message}`);
      return { id: (data as any).id };
    },

    async getById(jobId: string): Promise<any> {
      const { data, error } = await db.from(TABLE).select().eq('id', jobId).single();
      if (error) return null;
      return {
        id: data.id,
        userId: data.user_id,
        taskType: data.task_type,
        status: data.status,
        progress: data.progress,
        progressDetail: data.progress_detail,
        outputSummary: data.output_summary,
        errorMessage: data.error_message,
        completedAt: data.completed_at,
      };
    },

    async updateProgress(jobId: string, progress: number, detail: string): Promise<void> {
      const { error } = await db
        .from(TABLE)
        .update({ progress, progress_detail: detail, status: 'running' })
        .eq('id', jobId);
      if (error) throw new Error(`Failed to update task progress: ${error.message}`);
    },

    async complete(jobId: string, outputSummary?: object, tokens?: { input: number; output: number }, costUsd?: number): Promise<void> {
      const { error } = await db
        .from(TABLE)
        .update({
          status: 'completed',
          progress: 100,
          output_summary: outputSummary,
          input_tokens: tokens?.input ?? 0,
          output_tokens: tokens?.output ?? 0,
          cost_usd: costUsd ?? 0,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      if (error) throw new Error(`Failed to complete task: ${error.message}`);
    },

    async fail(jobId: string, errorMessage: string): Promise<void> {
      const { error } = await db
        .from(TABLE)
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      if (error) throw new Error(`Failed to mark task as failed: ${error.message}`);
    },

    async cancel(jobId: string): Promise<void> {
      const { error } = await db
        .from(TABLE)
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('id', jobId);
      if (error) throw new Error(`Failed to cancel task: ${error.message}`);
    },

    async countRecentTasks(userId: string, hours: number): Promise<number> {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      const { count, error } = await db
        .from(TABLE)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('started_at', since.toISOString());
      if (error) return 0;
      return count ?? 0;
    },
  };
}
```

- [x] **Step 2: 提交**---

### Task 11: SSE 进度推送 API

**Files:**
- Create: `app/api/sky/tasks/[jobId]/stream/route.ts`

- [ ] **Step 1: 实现 SSE 端点**

Create: `app/api/sky/tasks/[jobId]/stream/route.ts`

```typescript
/**
 * GET /api/sky/tasks/:jobId/stream
 * SSE stream that polls Supabase for task progress every 500ms.
 */

import { NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/server/auth';
import { createAiTaskDAO } from '@/lib/server/beta/dao/ai-tasks';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  // Auth check
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }
  const payload = await verifyAccessToken(token);
  if (!payload) return new Response('Invalid token', { status: 401 });

  const { jobId } = await params;
  const dao = await createAiTaskDAO();
  const task = await dao.getById(jobId);

  if (!task) {
    return new Response('Task not found', { status: 404 });
  }

  // Ownership check
  if (task.userId !== payload.sub && payload.role !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Client disconnected
        }
      };

      send({ type: 'connected', jobId });

      const interval = setInterval(async () => {
        const current = await dao.getById(jobId);
        if (!current) return;

        send({
          type: 'progress',
          progress: current.progress,
          detail: current.progressDetail,
        });

        if (['completed', 'failed', 'cancelled'].includes(current.status)) {
          send({
            type: 'done',
            status: current.status,
            result: current.outputSummary,
            error: current.errorMessage,
          });
          clearInterval(interval);
          controller.close();
        }
      }, 500);

      // Timeout after 5 minutes
      setTimeout(() => {
        send({ type: 'timeout' });
        clearInterval(interval);
        controller.close();
      }, 5 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
```

- [x] **Step 2: 提交**---

### Task 12: 客户端任务进度 Hook

**Files:**
- Create: `hooks/use-task-progress.ts`

- [ ] **Step 1: 实现 Hook**

Create: `hooks/use-task-progress.ts`

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';

export type TaskStatus = 'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'timeout';

interface UseTaskProgressReturn {
  progress: number;
  detail: string;
  status: TaskStatus;
  cancel: () => void;
}

export function useTaskProgress(jobId: string | null): UseTaskProgressReturn {
  const [progress, setProgress] = useState(0);
  const [detail, setDetail] = useState('');
  const [status, setStatus] = useState<TaskStatus>('idle');

  const cancel = useCallback(() => {
    setStatus('failed');
  }, []);

  useEffect(() => {
    if (!jobId) {
      setStatus('idle');
      return;
    }

    setProgress(0);
    setDetail('');
    setStatus('queued');

    const token = document.cookie.match(/access_token=([^;]+)/)?.[1];
    const url = `/api/sky/tasks/${jobId}/stream`;
    const es = new EventSource(token ? `${url}?token=${token}` : url);

    // Note: EventSource doesn't support custom headers.
    // For auth, we pass token as query param or use a custom fetch-based SSE.
    // For simplicity, we rely on the cookie-based auth in middleware.

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'progress') {
          setProgress(msg.progress);
          setDetail(msg.detail || '');
          setStatus('running');
        }
        if (msg.type === 'done') {
          setStatus(msg.status === 'completed' ? 'completed' : 'failed');
          es.close();
        }
        if (msg.type === 'timeout') {
          setStatus('timeout');
          es.close();
        }
      } catch {
        // Parse error, ignore
      }
    };

    es.onerror = () => {
      setStatus('failed');
      es.close();
    };

    return () => es.close();
  }, [jobId]);

  return { progress, detail, status, cancel };
}
```

- [x] **Step 2: 提交**---

### Task 13: 速率限制

**Files:**
- Create: `lib/server/beta/rate-limiter.ts`
- Modify: `middleware.ts`

- [ ] **Step 1: 实现速率限制**

Create: `lib/server/beta/rate-limiter.ts`

```typescript
/**
 * Rate limiter using Supabase for distributed counting.
 * Beta users: 10 AI tasks/hour, 30 API calls/minute.
 * Full users: 50 AI tasks/hour, 60 API calls/minute.
 */

import { createClient } from '@supabase/supabase-js';

export interface RateLimitConfig {
  aiTasksPerHour: number;
  apiCallsPerMinute: number;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  beta: { aiTasksPerHour: 10, apiCallsPerMinute: 30 },
  user: { aiTasksPerHour: 50, apiCallsPerMinute: 60 },
  admin: { aiTasksPerHour: 999, apiCallsPerMinute: 999 },
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** Check if user has exceeded their AI task limit. Returns true if allowed. */
export async function checkAiTaskLimit(userId: string, role: string): Promise<boolean> {
  const config = RATE_LIMITS[role] ?? RATE_LIMITS.user;
  const db = getSupabase();

  const since = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
  const { count, error } = await db
    .from('ai_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('started_at', since.toISOString());

  if (error) return true; // On error, allow the request
  return (count ?? 0) < config.aiTasksPerHour;
}

/** In-memory rate limiter for API calls (Edge-compatible). */
const apiCallCounts = new Map<string, { count: number; resetAt: number }>();

export function checkApiCallRateLimit(userId: string, role: string): boolean {
  const config = RATE_LIMITS[role] ?? RATE_LIMITS.user;
  const now = Date.now();
  const entry = apiCallCounts.get(userId);

  if (!entry || now > entry.resetAt) {
    apiCallCounts.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  entry.count++;
  return entry.count <= config.apiCallsPerMinute;
}
```

- [ ] **Step 2: 在 middleware 中集成速率限制**

Modify: `middleware.ts` — 在 JWT 验证通过后，增加速率限制检查：

```typescript
// After JWT verification, before NextResponse.next():
if (payload) {
  const { checkApiCallRateLimit } = await import('@/lib/server/beta/rate-limiter');
  if (!checkApiCallRateLimit(payload.sub, payload.role)) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }
}
```

注意：middleware 中引入 Supabase 查询会影响 Edge 兼容性，所以 API 调用的速率限制用内存 Map（上面的 `checkApiCallRateLimit`），AI 任务的限额检查放在具体的 API route 中而非 middleware。

- [x] **Step 3: 提交**---

## Phase 4: 管理后台

### Task 14: 管理后台 — 邀请码管理

**Files:**
- Create: `app/admin/beta/codes/page.tsx`

- [ ] **Step 1: 创建邀请码管理页面**

Create: `app/admin/beta/codes/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';

export default function AdminCodesPage() {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [count, setCount] = useState(10);
  const [prefix, setPrefix] = useState('BETA');

  const fetchCodes = async () => {
    const res = await fetch('/api/beta/codes', {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    if (data.success) setCodes(data.data);
    setLoading(false);
  };

  const generateCodes = async () => {
    setGenerating(true);
    const res = await fetch('/api/beta/codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ count, prefix }),
    });
    const data = await res.json();
    if (data.success) {
      fetchCodes();
    }
    setGenerating(false);
  };

  useEffect(() => { fetchCodes(); }, []);

  function getToken(): string {
    return document.cookie.match(/access_token=([^;]+)/)?.[1] ?? '';
  }

  if (loading) return <div className="p-8 text-center">加载中...</div>;

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-6 text-2xl font-bold">邀请码管理</h1>

      {/* Generate codes form */}
      <div className="mb-8 rounded-lg border p-4 dark:border-gray-700">
        <h2 className="mb-4 text-lg font-semibold">批量生成邀请码</h2>
        <div className="flex gap-4">
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            min={1}
            max={100}
            className="w-24 rounded border px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
          />
          <input
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="前缀"
            className="flex-1 rounded border px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
          />
          <button
            onClick={generateCodes}
            disabled={generating}
            className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? '生成中...' : '生成'}
          </button>
        </div>
      </div>

      {/* Codes list */}
      <div className="rounded-lg border dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="px-4 py-2 text-left">邀请码</th>
              <th className="px-4 py-2 text-left">状态</th>
              <th className="px-4 py-2 text-left">使用次数</th>
              <th className="px-4 py-2 text-left">创建时间</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id} className="border-b dark:border-gray-700">
                <td className="px-4 py-2 font-mono">{c.code}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    c.status === 'active' ? 'bg-green-100 text-green-800' :
                    c.status === 'used' ? 'bg-gray-100 text-gray-600' :
                    'bg-red-100 text-red-600'
                  }`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-2">{c.currentUses}/{c.maxUses}</td>
                <td className="px-4 py-2">{new Date(c.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [x] **Step 2: 提交**---

### Task 15: 管理后台 — 申请审核

**Files:**
- Create: `app/admin/beta/requests/page.tsx`

- [ ] **Step 1: 创建申请审核页面**

Create: `app/admin/beta/requests/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    const res = await fetch('/api/beta/requests', {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    if (data.success) setRequests(data.data);
    setLoading(false);
  };

  const review = async (id: string, action: 'approved' | 'rejected') => {
    const res = await fetch(`/api/beta/requests/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action }),
    });
    if (res.ok) fetchRequests();
  };

  useEffect(() => { fetchRequests(); }, []);

  function getToken(): string {
    return document.cookie.match(/access_token=([^;]+)/)?.[1] ?? '';
  }

  if (loading) return <div className="p-8 text-center">加载中...</div>;

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-6 text-2xl font-bold">内测申请审核</h1>

      <div className="space-y-4">
        {requests.map((req) => (
          <div key={req.id} className="rounded-lg border p-4 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{req.email}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{req.reason}</p>
                <p className="mt-2 text-xs text-gray-400">
                  申请时间: {new Date(req.applied_at).toLocaleString()}
                </p>
              </div>
              {req.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => review(req.id, 'approved')}
                    className="rounded bg-green-600 px-4 py-1.5 text-sm text-white hover:bg-green-700"
                  >
                    通过
                  </button>
                  <button
                    onClick={() => review(req.id, 'rejected')}
                    className="rounded bg-red-600 px-4 py-1.5 text-sm text-white hover:bg-red-700"
                  >
                    拒绝
                  </button>
                </div>
              )}
              {req.status !== 'pending' && (
                <span className={`rounded-full px-3 py-1 text-xs ${
                  req.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-600'
                }`}>
                  {req.status === 'approved' ? '已通过' : '已拒绝'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [x] **Step 2: 提交**---

### Task 16: 管理后台 — 遥测仪表板

**Files:**
- Create: `app/admin/beta/dashboard/page.tsx`

- [ ] **Step 1: 创建遥测仪表板 API**

Create: `app/api/admin/beta-stats/route.ts`

```typescript
/**
 * GET /api/admin/beta-stats
 * Return aggregated telemetry metrics for admin dashboard.
 */

import { NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/server/auth';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyAccessToken(token);
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Parallel queries for dashboard metrics
  const [totalUsers, activeUsers, errorCount, taskStats] = await Promise.all([
    supabase.from('telemetry_events').select('user_id', { count: 'exact', head: true }),
    supabase.from('telemetry_events').select('user_id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('telemetry_events').select('*', { count: 'exact', head: true }).eq('event_type', 'error').gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('ai_tasks').select('status, completed_at, started_at').order('started_at', { ascending: false }).limit(100),
  ]);

  const tasks = (taskStats.data as any[]) ?? [];
  const completed = tasks.filter((t) => t.status === 'completed');
  const avgDuration = completed.length
    ? completed.reduce((sum, t) => sum + (new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()), 0) / completed.length
    : 0;

  return NextResponse.json({
    success: true,
    data: {
      totalUsers: totalUsers.count ?? 0,
      dailyActiveUsers: activeUsers.count ?? 0,
      dailyErrors: errorCount.count ?? 0,
      totalTasks: tasks.length,
      taskSuccessRate: tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0,
      avgTaskDurationMs: Math.round(avgDuration),
    },
  });
}
```

- [ ] **Step 2: 创建仪表板页面**

Create: `app/admin/beta/dashboard/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/beta-stats', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setStats(d.data);
        setLoading(false);
      });
  }, []);

  function getToken(): string {
    return document.cookie.match(/access_token=([^;]+)/)?.[1] ?? '';
  }

  if (loading) return <div className="p-8 text-center">加载中...</div>;

  const metrics = [
    { label: '总用户数', value: stats?.totalUsers ?? 0, color: 'blue' },
    { label: '日活用户', value: stats?.dailyActiveUsers ?? 0, color: 'green' },
    { label: '今日错误数', value: stats?.dailyErrors ?? 0, color: 'red' },
    { label: 'AI 任务总数', value: stats?.totalTasks ?? 0, color: 'purple' },
    { label: '任务成功率', value: `${stats?.taskSuccessRate ?? 0}%`, color: 'green' },
    { label: '平均任务耗时', value: `${Math.round((stats?.avgTaskDurationMs ?? 0) / 1000)}s`, color: 'yellow' },
  ];

  return (
    <div className="mx-auto max-w-6xl p-8">
      <h1 className="mb-6 text-2xl font-bold">Beta 遥测仪表板</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border p-6 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">{m.label}</p>
            <p className={`mt-2 text-3xl font-bold text-${m.color}-600`}>{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [x] **Step 3: 提交**---

### Task 17: 批量生成邀请码 CLI + TTL 清理脚本

**Files:**
- Create: `scripts/generate-invite-codes.ts`
- Create: `scripts/cleanup-telemetry.ts`

- [ ] **Step 1: 邀请码生成脚本**

Create: `scripts/generate-invite-codes.ts`

```typescript
/**
 * CLI: Generate invitation codes and print them to stdout.
 * Usage: npx tsx scripts/generate-invite-codes.ts --count 20 --prefix SKY
 */

import { createInvitationDAO } from '@/lib/server/beta/dao/invitation-codes';

async function main() {
  const args = process.argv.slice(2);
  const getCount = () => {
    const idx = args.indexOf('--count');
    return idx >= 0 ? parseInt(args[idx + 1]) || 10 : 10;
  };
  const getPrefix = () => {
    const idx = args.indexOf('--prefix');
    return idx >= 0 ? args[idx + 1] || 'BETA' : 'BETA';
  };

  const count = getCount();
  const prefix = getPrefix();

  console.log(`Generating ${count} invitation codes with prefix "${prefix}"...`);

  const dao = await createInvitationDAO();
  const codes = await dao.batchCreate({ prefix, count, type: 'direct', createdBy: 'cli-script' });

  console.log('\nGenerated codes:');
  codes.forEach((c) => console.log(`  ${c.code}`));
  console.log(`\nTotal: ${codes.length}`);
}

main().catch(console.error);
```

- [ ] **Step 2: 遥测清理脚本**

Create: `scripts/cleanup-telemetry.ts`

```typescript
/**
 * CLI: Clean up telemetry data older than 90 days.
 * Usage: npx tsx scripts/cleanup-telemetry.ts
 */

import { createTelemetryDAO } from '@/lib/server/beta/dao/telemetry';

async function main() {
  console.log('Running telemetry cleanup (90-day TTL)...');
  const dao = await createTelemetryDAO();
  await dao.cleanupOldRecords();
  console.log('Cleanup complete.');
}

main().catch(console.error);
```

- [x] **Step 3: 提交**---

## 完成检查清单

- [x] 所有测试通过 (20/20)：`npx vitest run`
- [x] TypeScript 无新增错误：`npx tsc --noEmit`
- [ ] 数据库迁移脚本已执行
- [ ] 环境变量已配置（SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY）
- [ ] 端到端流程测试：邀请码 → 注册 → 使用 → 遥测收集
