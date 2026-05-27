# 天空课堂 Beta 内测系统设计

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-05-26 |
| 作者 | Claude Code |
| 状态 | Draft |
| 目标 | 为天空课堂设计完整的内测准入、遥测数据收集、异步任务队列与性能监控方案 |

---

## 1. 概述

天空课堂将以邀请码 + 申请审批混合模式开启 Beta 内测。内测期间重点收集错误日志、性能指标和 AI 任务运行数据，为正式上线提供数据支撑。系统不引入 Redis 等额外中间件，复用 Supabase 数据库实现任务队列和限流计数。

### 1.1 核心目标

- **准入控制**：邀请码直接注册 + 申请审批双通道
- **错误与性能监控**：Web Vitals + Sentry + 自定义遥测 SDK
- **AI 任务异步化**：解决 Serverless 超时问题，支持实时进度推送
- **数据安全**：脱敏、TTL 过期、角色权限隔离

---

## 2. 整体架构

```
客户端 (Browser)          Edge Middleware          Serverless Functions          Supabase
    │                         │                          │                          │
    ├── 注册/登录 ───────────>│                          │                          │
    │  (邀请码/申请)          ├── 验证邀请码 ──────────>  │── 写入邀请码表 ─────────>│
    │                         │                          │                          │
    ├── 使用功能 ────────────>│── 限流检查 (per user) ──>│── 正常处理 ─────────────>│
    │                         │                          │                          │
    ├── 提交 AI 任务 ────────>│                          │── 写入 jobs 表 ─────────>│
    │                         │                          │   返回 jobId             │
    │                         │                          │                          │
    ├── SSE 连接 ────────────>│                          │── 轮询 jobs 状态 ───────>│
    │  (接收进度)             │<────── stream ───────────│── 执行任务 ─────────────>│
    │                         │                          │                          │
    ├── 遥测数据 ────────────>│── 速率限制 ─────────────>│── waitUntil ───────────>│
    │  (批量, 30s间隔)        │                          │   批量写入               │
    │                         │                          │                          │
    │<── Sentry 错误上报 ────│──────────── 直连 Sentry SaaS ──────────────────────│
```

### 核心原则

- 所有受保护 API 经过 Edge Middleware 的限流检查
- AI 长任务通过 `ai_tasks` 表 + SSE 实现异步进度推送
- 遥测数据客户端批量收集，服务端通过 `waitUntil` 异步写入 Supabase
- 不引入 Redis，Supabase 简单轮询支撑前数百并发

---

## 3. 邀请码与准入系统

### 3.1 数据模型

```sql
-- 邀请码表
CREATE TABLE invitation_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,          -- e.g. "SKY-7X3K-9M2P"
  type        TEXT NOT NULL DEFAULT 'direct',-- 'direct' | 'request'
  status      TEXT NOT NULL DEFAULT 'active',-- 'active' | 'used' | 'expired'
  created_by  UUID NOT NULL,                  -- admin user id
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_by     UUID,                           -- filled after use
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  max_uses    INT NOT NULL DEFAULT 1,         -- supports batch codes
  current_uses INT NOT NULL DEFAULT 0,
  notes       TEXT                            -- batch notes
);

-- 内测申请记录
CREATE TABLE beta_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',-- 'pending' | 'approved' | 'rejected'
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ
);

-- users 表新增字段
ALTER TABLE users ADD COLUMN beta_status      TEXT NOT NULL DEFAULT 'none';     -- 'none' | 'beta' | 'graduated'
ALTER TABLE users ADD COLUMN beta_invited_by   UUID REFERENCES invitation_codes(id);
ALTER TABLE users ADD COLUMN beta_joined_at    TIMESTAMPTZ;
```

### 3.2 注册流程

```
用户访问                    前端                      后端 API                   Supabase
  │                          │                          │                          │
  ├── 访问任何页面 ─────────>│                          │                          │
  │                          │── 检查 beta_access cookie │                          │
  │                          │  (存在且有效 → 放行)       │                          │
  │                          │  (不存在 → 显示 Beta 门)   │                          │
  │                          │                          │                          │
  ├── 选择"输入邀请码" ─────>│                          │                          │
  │  POST /api/beta/invite   │── 验证邀请码 ──────────>  │── 查询 + 标记已用 ─────>│
  │                          │<── 设置 beta_access cookie │                          │
  │                          │   + 跳转注册页             │                          │
  │                          │                          │                          │
  ├── 选择"申请内测" ───────>│                          │                          │
  │  POST /api/beta/request  │── 创建申请记录 ──────────>│── INSERT beta_requests >│
  │                          │<── "已提交，等待审核"      │                          │
  │                          │                          │                          │
  │                          │<── 管理员审核通过 ─────────│── 发送通知邮件/站内消息 │
  │                          │                          │                          │
  ├── 注册 ─────────────────>│── POST /api/auth/register │── 验证 beta_access ───>│
  │                          │   (需要 beta_access)       │   + 写入 beta_status    │
```

### 3.3 新增 API 端点

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/beta/invite` | 验证邀请码，设置 beta_access cookie | 无 |
| POST | `/api/beta/request` | 提交内测申请 | 无 |
| GET  | `/api/beta/requests` | 管理员查看申请列表 | admin |
| POST | `/api/beta/requests/:id/review` | 管理员审核申请 | admin |
| POST | `/api/beta/codes` | 管理员批量生成邀请码 | admin |
| GET  | `/api/beta/codes` | 管理员查看邀请码统计 | admin |
| GET  | `/api/beta/status` | 查询当前用户内测状态 | JWT |

### 3.4 Edge Middleware 增强

在现有 `middleware.ts` 中，JWT 验证通过后增加 Beta 门控逻辑：

```ts
// 现有逻辑保持不变：
// 1. JWT access_token 验证通过 → 放行
// 2. openmaic_access cookie 验证通过 → 放行
// 新增：
// 3. 如果有 beta_access cookie → 允许访问 beta 页面
// 4. 无任何有效凭证 → 重定向到 /auth/beta-gate
```

### 3.5 Beta Gate 页面

路径：`app/auth/beta-gate/page.tsx`

提供两个入口：
1. **输入邀请码** — 输入框 + 提交按钮，成功后跳转 `/auth/register`
2. **申请内测** — 表单（邮箱、申请理由），提交后显示"等待审核"

---

## 4. 遥测与数据收集

### 4.1 客户端遥测 SDK

在 `lib/monitoring/` 下新增：

```
lib/monitoring/
  ├── web-vitals.ts        (已有)
  ├── error-tracker.ts     (已有)
  ├── telemetry.ts         (新增)
  └── performance.ts       (新增)
```

#### `TelemetryCollector` 核心逻辑

```ts
// TelemetryCollector 类
// - 内存队列缓冲事件（最多 50 条或 30 秒）
// - flush 时 POST 到 /api/telemetry
// - 页面卸载时用 navigator.sendBeacon 发送最后数据
// - 自动附带：userId, sessionId, page, userAgent, timestamp
```

#### 事件类型

| 事件类型 | 说明 | 关键字段 |
|---------|------|---------|
| `page_view` | 页面访问 | `page`, `referrer` |
| `api_call` | API 调用 | `url`, `method`, `duration_ms`, `status_code` |
| `error` | 运行时错误 | `type`, `message`, `stack`, `context` |
| `performance` | Web Vitals | `fcp`, `lcp`, `cls`, `ttfb`, `inp` |
| `feature_use` | 功能使用 | `feature`, `params_summary`, `result` |
| `ai_task` | AI 任务 | `task_type`, `input_tokens`, `output_tokens`, `duration_ms`, `cost_usd` |

### 4.2 服务端接收端点

`POST /api/telemetry`

```ts
// 处理流程：
// 1. 验证 JWT / beta_access（允许匿名遥测，但不关联用户）
// 2. 速率限制：每用户每分钟最多 20 条
// 3. 数据清洗：sanitize() 去除敏感字段
// 4. waitUntil → 批量写入 Supabase
```

### 4.3 数据存储

```sql
-- 遥测事件表
CREATE TABLE telemetry_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID,                              -- nullable for anonymous
  session_id  TEXT NOT NULL,
  event_type  TEXT NOT NULL,                     -- page_view, api_call, error, etc.
  event_data  JSONB NOT NULL,
  page        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 性能指标每日汇总表
CREATE TABLE performance_daily (
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

-- AI 任务表
CREATE TABLE ai_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  task_type       TEXT NOT NULL,                 -- ppt_generate, slide_generate, solve, etc.
  status          TEXT NOT NULL DEFAULT 'queued',-- queued | running | completed | failed | cancelled
  input_summary   JSONB,                         -- sanitized input summary
  output_summary  JSONB,                         -- sanitized output summary
  input_tokens    INT DEFAULT 0,
  output_tokens   INT DEFAULT 0,
  cost_usd        FLOAT DEFAULT 0,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,
  progress        INT DEFAULT 0,                 -- 0-100
  progress_detail TEXT                           -- e.g. "正在生成幻灯片 3/12"
);
```

### 4.4 数据安全

| 措施 | 说明 |
|------|------|
| **脱敏** | `sanitize()` 函数在写入前移除密码、token、完整请求体中的 PII |
| **TTL** | 遥测数据保留 90 天，Supabase Cron 自动清理过期记录 |
| **访问控制** | `admin` 可查询全部原始数据，`beta` 用户仅能查看自身数据 |
| **合规告知** | 注册页明确告知数据收集范围，提供"关闭功能遥测"选项 |

---

## 5. 异步任务队列与实时进度推送

### 5.1 任务队列机制

不使用 Redis，以 Supabase `ai_tasks` 表作为持久化任务队列。

```
客户端                        Serverless Function              Supabase
  │                                │                              │
  ├── POST /api/generate/xxx ────>│                              │
  │   (提交任务参数)                │                              │
  │                                │── INSERT INTO ai_tasks ─────>│
  │                                │   status='queued'            │
  │                                │<── 返回 { jobId, status }   │
  │<── { jobId } ─────────────────│                              │
  │                                │                              │
  │                                │── 后台执行实际 AI 任务 ──────│
  │                                │   (waitUntil 或独立触发)      │
  │                                │                              │
  │                                │── 执行中每步更新 progress ──>│
  │                                │   UPDATE SET progress=30     │
  │                                │   detail='正在生成幻灯片'      │
  │                                │                              │
  │                                │── 完成或失败 ──────────────>│
  │                                │   UPDATE SET status='done'   │
```

### 5.2 SSE 实时进度推送

`GET /api/sky/tasks/:jobId/stream`

```ts
// 返回 SSE 流，客户端通过 EventSource 连接
// 服务端每 500ms 轮询 Supabase 获取任务最新状态
// 推送格式：data: {"type":"progress","progress":30,"detail":"正在生成幻灯片 3/12"}\n\n

export async function GET(req, { params }) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      send({ type: 'connected', jobId });

      const interval = setInterval(async () => {
        const task = await db.ai_tasks.get(jobId);
        if (!task) return;

        send({
          type: 'progress',
          progress: task.progress,
          detail: task.progress_detail,
        });

        if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
          send({ type: 'done', status: task.status, result: task.output_summary });
          clearInterval(interval);
          controller.close();
        }
      }, 500);

      // 超时保护（5 分钟）
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
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

### 5.3 客户端 Hook

`hooks/use-task-progress.ts`

```ts
export function useTaskProgress(jobId: string | null) {
  const [progress, setProgress] = useState(0);
  const [detail, setDetail] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'timeout'
  >('idle');

  useEffect(() => {
    if (!jobId) return;
    const es = new EventSource(`/api/sky/tasks/${jobId}/stream`);

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'progress') {
        setProgress(msg.progress);
        setDetail(msg.detail);
        setStatus('running');
      }
      if (msg.type === 'done') {
        setStatus(msg.status);
        es.close();
      }
      if (msg.type === 'timeout') {
        setStatus('timeout');
        es.close();
      }
    };

    es.onerror = () => {
      setStatus('failed');
      es.close();
    };

    return () => es.close();
  }, [jobId]);

  return { progress, detail, status };
}
```

### 5.4 并发与限流

| 维度 | Beta 用户 | 正式用户 |
|------|-----------|---------|
| AI 任务/小时 | 10 | 50 |
| API 调用/分钟 | 30 | 60 |
| 并发任务数 | 1 | 3 |

限流检查在 Edge Middleware 中执行：

```ts
// 每次 AI 任务提交前检查：
// SELECT COUNT(*) FROM ai_tasks
// WHERE user_id = ? AND created_at > now() - INTERVAL '1 hour'
// 如果超过限额 → 返回 429 Too Many Requests
// 同时写入遥测：event_type='rate_limited'
```

---

## 6. 管理后台

### 6.1 功能列表

| 功能 | 路径 | 说明 |
|------|------|------|
| 邀请码管理 | `/admin/beta/codes` | 批量生成、查看使用统计、过期/作废 |
| 申请审核 | `/admin/beta/requests` | 审核列表（通过/拒绝）、批量操作 |
| 遥测仪表板 | `/admin/beta/dashboard` | 用户活跃、错误率、性能指标、AI 任务统计 |
| 用户管理 | `/admin/beta/users` | Beta 用户列表、状态变更、封禁 |

### 6.2 遥测仪表板指标

| 指标 | 计算方式 |
|------|---------|
| DAU/WAU | `COUNT(DISTINCT user_id) WHERE created_at > now() - interval` |
| 错误率 | `COUNT(error events) / COUNT(total events) * 100` |
| P50/P95/P99 API 延迟 | 从 `api_call` 事件的 `duration_ms` 计算 |
| AI 任务成功率 | `COUNT(completed) / COUNT(total) * 100` |
| 平均 AI 任务耗时 | `AVG(completed_at - started_at)` |
| Top 错误类型 | `GROUP BY event_data->'type' ORDER BY COUNT DESC LIMIT 10` |
| 功能使用排行 | `GROUP BY event_data->'feature' ORDER BY COUNT DESC` |

---

## 7. 实施计划

### Phase 1: 基础设施（1 周）

- [ ] 创建 Supabase 迁移脚本（邀请码表、遥测表、任务表）
- [ ] 实现 `lib/monitoring/telemetry.ts` 客户端 SDK
- [ ] 实现 `/api/telemetry` 服务端接收端点
- [ ] Sentry 配置完善（区分 beta 环境标签）

### Phase 2: 准入系统（1 周）

- [ ] Edge Middleware Beta 门控增强
- [ ] `/api/beta/*` API 端点实现
- [ ] Beta Gate 页面组件
- [ ] 邀请码批量生成工具
- [ ] 管理后台：邀请码管理 + 申请审核

### Phase 3: 异步任务与进度（1 周）

- [ ] 改造现有 AI 生成接口为异步模式（PPT、幻灯片）
- [ ] SSE 进度推送端点
- [ ] `useTaskProgress` Hook
- [ ] 前端进度条 UI 组件
- [ ] 限流中间件

### Phase 4: 仪表板与上线准备（1 周）

- [ ] 遥测仪表板页面
- [ ] 性能每日聚合 Cron Job
- [ ] 遥测数据 90 天 TTL 清理脚本
- [ ] 端到端测试（邀请码 → 注册 → 使用 → 遥测收集）
- [ ] Beta 测试计划文档

---

## 8. 技术风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Vercel Serverless 超时（60s max） | AI 任务中断 | 任务异步化 + waitUntil + SSE 推送 |
| Supabase 连接池耗尽 | 写入失败 | 使用 Supavisor 连接池 + 批量写入减少连接数 |
| SSE 连接被 CDN 缓存 | 进度不推送 | 设置 `Cache-Control: no-cache` + 关闭 Vercel 路径缓存 |
| 遥测数据泄露 PII | 合规风险 | 严格 sanitize + 写入前审计 + 匿名化选项 |
| 邀请码被批量生成/爆破 | 未授权访问 | 6 位随机字符 + 速率限制 + 失败计数 |
