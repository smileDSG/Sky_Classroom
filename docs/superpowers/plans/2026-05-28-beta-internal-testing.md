# Beta 内测版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 master 上构建完整的 beta 内测系统 — 邀请码门禁、测试任务清单、应用内反馈表单、管理员后台、邀请码 CLI 工具。

**Architecture:** 以 master 为基线，在中间件层加入邀请码验证逻辑，在 sky 布局中嵌入测试清单与反馈面板，所有数据通过 Supabase 存储。

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase, Tailwind CSS 4, vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `migrations/002_beta_feedback.sql` | Create | beta_feedback 表 + 反馈管理索引 |
| `middleware.ts` | Modify | 添加邀请码 cookie 检查，无有效 cookie 重定向到 /beta/gate |
| `app/beta/gate/page.tsx` | Create | 邀请码输入页面（门禁页） |
| `app/api/beta/invite/route.ts` | Create | 验证邀请码，设置 beta_access cookie |
| `app/api/beta/feedback/route.ts` | Create | 用户提交反馈 |
| `app/api/beta/admin/feedback/route.ts` | Create | 管理员查看反馈列表 |
| `app/beta/admin/page.tsx` | Create | 管理员后台页面 |
| `app/beta/test-checklist/page.tsx` | Create | 测试清单页面（独立页面，也可嵌入侧栏） |
| `components/beta/beta-badge.tsx` | Create | 页面 Beta 标识徽章 |
| `components/beta/feedback-panel.tsx` | Create | 反馈侧面板（浮动按钮 + 面板） |
| `components/beta/test-checklist.tsx` | Create | 测试清单组件（可嵌入任何页面） |
| `components/beta/invite-gate.tsx` | Create | 邀请码输入组件（门禁页用） |
| `scripts/beta/invite-cli.ts` | Create | CLI 工具：生成/列出邀请码 |
| `tests/beta/invite-api.test.ts` | Create | 邀请码 API 测试 |
| `tests/beta/feedback-api.test.ts` | Create | 反馈 API 测试 |
| `tests/beta/test-checklist.test.tsx` | Create | 测试清单组件测试 |

---

### Task 1: 数据库迁移 — beta_feedback 表

**Files:**
- Create: `migrations/002_beta_feedback.sql`

- [ ] **Step 1: 创建反馈表迁移**

```sql
-- 002_beta_feedback.sql
-- Beta 内测反馈系统

-- 反馈表
CREATE TABLE IF NOT EXISTS beta_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('bug', 'suggestion', 'complaint', 'praise')),
  severity        TEXT NOT NULL CHECK (severity IN ('blocker', 'major', 'minor', 'trivial')),
  test_case_ref   TEXT,
  page_context    JSONB,
  quick_tags      TEXT[],
  description     TEXT NOT NULL,
  screenshot_urls TEXT[],
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'wontfix')),
  admin_notes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE beta_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable insert for all" ON beta_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable select for all" ON beta_feedback FOR SELECT USING (true);
CREATE POLICY "Enable update for authenticated users" ON beta_feedback FOR UPDATE USING (true);

-- 索引
CREATE INDEX IF NOT EXISTS idx_beta_feedback_category ON beta_feedback(category);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_severity ON beta_feedback(severity);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_status ON beta_feedback(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_created ON beta_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_session ON beta_feedback(session_id);
```

- [ ] **Step 2: 提交**

```bash
git add migrations/002_beta_feedback.sql
git commit -m "feat: add beta_feedback table migration"
```

---

### Task 2: 邀请码验证 API

**Files:**
- Create: `app/api/beta/invite/route.ts`

- [ ] **Step 1: 创建邀请码验证 API**

```typescript
/**
 * POST /api/beta/invite
 * 验证邀请码，成功后设置 beta_access HttpOnly cookie
 */
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function signBetaToken(secret: string): Promise<string> {
  const timestamp = String(Date.now());
  const keyData = encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const data = encode(timestamp);
  const sig = bufToHex(await crypto.subtle.sign('HMAC', key, data.buffer as ArrayBuffer));
  return `${timestamp}.${sig}`;
}

const InviteSchema = z.object({
  code: z.string().min(1, '邀请码不能为空'),
});

export async function POST(request: Request) {
  const accessCode = process.env.ACCESS_CODE;

  try {
    const body = await request.json();
    const parsed = InviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const { code } = parsed.data;
    const db = createClient(supabaseUrl, supabaseKey);

    const { data: invite } = await db
      .from('invitation_codes')
      .select()
      .eq('code', code.trim().toUpperCase())
      .eq('status', 'active')
      .single();

    if (!invite) {
      return NextResponse.json(
        { success: false, error: '邀请码无效或已过期' },
        { status: 400 },
      );
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await db.from('invitation_codes').update({ status: 'expired' }).eq('id', invite.id);
      return NextResponse.json(
        { success: false, error: '邀请码已过期' },
        { status: 400 },
      );
    }

    if (invite.current_uses >= invite.max_uses) {
      return NextResponse.json(
        { success: false, error: '邀请码已被使用完' },
        { status: 410 },
      );
    }

    // 更新使用次数
    await db
      .from('invitation_codes')
      .update({ current_uses: invite.current_uses + 1 })
      .eq('id', invite.id);

    // 签名 beta_access cookie
    const secret = accessCode || process.env.JWT_SECRET || 'beta-default-secret';
    const betaToken = await signBetaToken(secret);

    return NextResponse.json({ success: true, message: '验证成功' }, {
      headers: {
        'Set-Cookie': `beta_access=${betaToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`,
      },
    });
  } catch (err) {
    console.error('[Beta Invite] Error:', err);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add app/api/beta/invite/route.ts
git commit -m "feat: add beta invite API with HMAC-signed cookie"
```

---

### Task 3: 中间件 — 邀请码门禁

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: 重写 middleware 添加 beta 门禁**

```typescript
import { NextRequest, NextResponse } from 'next/server';

function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyBetaToken(token: string, accessCode: string): Promise<boolean> {
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return false;

  const timestamp = token.substring(0, dotIndex);
  const signature = token.substring(dotIndex + 1);

  const keyData = encode(accessCode);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const data = encode(timestamp);
  const expected = bufToHex(await crypto.subtle.sign('HMAC', key, data.buffer as ArrayBuffer));

  if (signature.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 永远放行的路径
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/beta/invite') ||
    pathname === '/beta/gate' ||
    pathname === '/api/health' ||
    pathname.startsWith('/logos/') ||
    pathname.startsWith('/avatars/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 没有设置 BETA_MODE 时，不启用门禁
  if (process.env.BETA_MODE !== 'true') {
    return NextResponse.next();
  }

  // 检查 beta_access cookie
  const betaCookie = request.cookies.get('beta_access');
  if (betaCookie?.value) {
    const accessCode = process.env.ACCESS_CODE || process.env.JWT_SECRET || 'beta-default-secret';
    const valid = await verifyBetaToken(betaCookie.value, accessCode);
    if (valid) {
      return NextResponse.next();
    }
  }

  // API 请求返回 401
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, error: '需要邀请码访问' },
      { status: 401 },
    );
  }

  // 页面请求重定向到门禁页
  return NextResponse.redirect(new URL('/beta/gate', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logos/|avatars/).*)'],
};
```

- [ ] **Step 2: 提交**

```bash
git add middleware.ts
git commit -m "feat: add beta access gate middleware controlled by BETA_MODE env"
```

---

### Task 4: 邀请码门禁页面

**Files:**
- Create: `app/beta/gate/page.tsx`
- Create: `components/beta/invite-gate.tsx`

- [ ] **Step 1: 创建邀请码输入组件**

```typescript
'use client';

import { useState } from 'react';
import { toast } from 'sonner';

export function InviteGate() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/beta/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success('验证成功，正在跳转...');
        window.location.href = '/sky';
      } else {
        toast.error(data.error || '验证失败');
      }
    } catch {
      toast.error('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50/50 dark:from-slate-950 dark:via-indigo-950/30 dark:to-slate-900 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo-icon.svg" alt="天空课堂" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 dark:from-sky-400 dark:to-blue-400 bg-clip-text text-transparent">
            天空课堂
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Beta 内测版</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            输入邀请码
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            请输入管理员发放的邀请码以进入内测版本
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="例如: BETA-XXXX"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center text-lg tracking-widest font-mono"
              autoFocus
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white font-medium transition-colors"
            >
              {loading ? '验证中...' : '进入内测'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建门禁页面**

```typescript
import { InviteGate } from '@/components/beta/invite-gate';

export const metadata = {
  title: '邀请码 - 天空课堂 Beta',
  description: '输入邀请码以访问天空课堂内测版',
};

export default function BetaGatePage() {
  return <InviteGate />;
}
```

- [ ] **Step 3: 提交**

```bash
git add components/beta/invite-gate.tsx app/beta/gate/page.tsx
git commit -m "feat: add beta invite gate page with code input"
```

---

### Task 5: 测试清单组件

**Files:**
- Create: `components/beta/test-checklist.tsx`

- [ ] **Step 1: 创建测试清单组件**

```typescript
'use client';

import { useState } from 'react';

interface TestCase {
  id: string;
  label: string;
}

interface TestCategory {
  id: string;
  label: string;
  icon: string;
  cases: TestCase[];
}

const TEST_CATEGORIES: TestCategory[] = [
  {
    id: 'core',
    label: '核心功能',
    icon: '🎯',
    cases: [
      { id: 'core-1', label: '输入话题生成完整课程' },
      { id: 'core-2', label: '与 AI 老师/同学互动讨论' },
      { id: 'core-3', label: '白板画图/写字功能' },
      { id: 'core-4', label: 'TTS 语音播报' },
    ],
  },
  {
    id: 'scenes',
    label: '互动场景',
    icon: '📝',
    cases: [
      { id: 'scenes-1', label: '幻灯片讲解' },
      { id: 'scenes-2', label: '交互式模拟实验' },
      { id: 'scenes-3', label: '3D 可视化' },
      { id: 'scenes-4', label: '在线编程' },
    ],
  },
  {
    id: 'quiz',
    label: '测验与评估',
    icon: '🧪',
    cases: [
      { id: 'quiz-1', label: '单选题作答 + AI 批改' },
      { id: 'quiz-2', label: '多选题作答' },
      { id: 'quiz-3', label: '简答题 AI 评分' },
      { id: 'quiz-4', label: '课程结束页状态保持' },
    ],
  },
  {
    id: 'export',
    label: '导出与分享',
    icon: '📦',
    cases: [
      { id: 'export-1', label: '导出 PPTX（格式完好）' },
      { id: 'export-2', label: '导出交互式 HTML' },
      { id: 'export-3', label: '导出完整课堂 ZIP' },
    ],
  },
  {
    id: 'ux',
    label: '体验与性能',
    icon: '🎨',
    cases: [
      { id: 'ux-1', label: '页面加载速度' },
      { id: 'ux-2', label: 'AI 响应速度' },
      { id: 'ux-3', label: '深色模式切换' },
    ],
  },
];

const QUICK_TAGS = ['效果好', '有bug', '速度慢', '结果不准确', '崩溃', '超预期', '有创意', '样式错乱'];

interface CaseFeedback {
  completed: boolean;
  rating: number; // 1-5
  tags: string[];
  notes: string;
}

export function TestChecklist() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, CaseFeedback>>({});

  const updateCase = (caseId: string, updates: Partial<CaseFeedback>) => {
    setFeedback((prev) => ({
      ...prev,
      [caseId]: { completed: false, rating: 0, tags: [], notes: '', ...prev[caseId], ...updates },
    }));
  };

  const completedCount = Object.values(feedback).filter((f) => f.completed).length;
  const totalCases = TEST_CATEGORIES.reduce((sum, c) => sum + c.cases.length, 0);
  const progress = totalCases > 0 ? Math.round((completedCount / totalCases) * 100) : 0;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">📋</span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">内测测试清单</h2>
          <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">
            {completedCount}/{totalCases} 已完成 ({progress}%)
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Categories */}
      {TEST_CATEGORIES.map((cat) => {
        const isExpanded = expandedCategory === cat.id;
        const catCompleted = cat.cases.filter((c) => feedback[c.id]?.completed).length;

        return (
          <div key={cat.id} className="mb-3">
            <button
              onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors text-left"
            >
              <span className="text-lg">{cat.icon}</span>
              <span className="font-medium text-slate-900 dark:text-white">{cat.label}</span>
              <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">
                {catCompleted}/{cat.cases.length}
              </span>
              <svg
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div className="mt-1 ml-4 pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-2 py-2">
                {cat.cases.map((tc) => {
                  const fc = feedback[tc.id] || { completed: false, rating: 0, tags: [], notes: '' };
                  const caseExpanded = expandedCase === tc.id;

                  return (
                    <div key={tc.id}>
                      <button
                        onClick={() => {
                          if (!fc.completed) {
                            updateCase(tc.id, { completed: true });
                          }
                          setExpandedCase(caseExpanded ? null : tc.id);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
                      >
                        <span
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            fc.completed
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {fc.completed && '✓'}
                        </span>
                        <span className={`text-sm ${fc.completed ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}`}>
                          {tc.label}
                        </span>
                      </button>

                      {caseExpanded && (
                        <div className="ml-8 mt-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-3">
                          {/* Rating */}
                          <div>
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                              评分
                            </label>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  onClick={() => updateCase(tc.id, { rating: star })}
                                  className="text-2xl transition-transform hover:scale-110"
                                >
                                  {star <= fc.rating ? '★' : '☆'}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Quick tags */}
                          <div>
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                              快捷标签
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {QUICK_TAGS.map((tag) => (
                                <button
                                  key={tag}
                                  onClick={() => {
                                    const tags = fc.tags.includes(tag)
                                      ? fc.tags.filter((t) => t !== tag)
                                      : [...fc.tags, tag];
                                    updateCase(tc.id, { tags });
                                  }}
                                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                    fc.tags.includes(tag)
                                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600'
                                  }`}
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Notes */}
                          <div>
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                              备注（可选）
                            </label>
                            <textarea
                              value={fc.notes}
                              onChange={(e) => updateCase(tc.id, { notes: e.target.value })}
                              placeholder="描述你遇到的具体问题，或你对这个功能的评价..."
                              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                              rows={2}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 创建测试清单页面**

```typescript
import { TestChecklist } from '@/components/beta/test-checklist';

export const metadata = {
  title: '测试清单 - 天空课堂 Beta',
};

export default function TestChecklistPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50/50 dark:from-slate-950 dark:via-indigo-950/30 dark:to-slate-900 py-8 px-4">
      <TestChecklist />
    </div>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add components/beta/test-checklist.tsx app/beta/test-checklist/page.tsx
git commit -m "feat: add beta test checklist with ratings and quick tags"
```

---

### Task 6: 反馈面板

**Files:**
- Create: `components/beta/feedback-panel.tsx`
- Create: `app/api/beta/feedback/route.ts`

- [ ] **Step 1: 创建反馈提交 API**

```typescript
/**
 * POST /api/beta/feedback
 * 用户提交反馈到 Supabase
 */
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const FeedbackSchema = z.object({
  session_id: z.string(),
  category: z.enum(['bug', 'suggestion', 'complaint', 'praise']),
  severity: z.enum(['blocker', 'major', 'minor', 'trivial']),
  test_case_ref: z.string().optional(),
  page_context: z.record(z.unknown()).optional(),
  quick_tags: z.array(z.string()).default([]),
  description: z.string().min(1, '描述不能为空'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = FeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const db = createClient(supabaseUrl, supabaseKey);
    const { error } = await db.from('beta_feedback').insert({
      session_id: parsed.data.session_id,
      category: parsed.data.category,
      severity: parsed.data.severity,
      test_case_ref: parsed.data.test_case_ref || null,
      page_context: parsed.data.page_context || null,
      quick_tags: parsed.data.quick_tags,
      description: parsed.data.description,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: '保存反馈失败' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: 创建反馈面板组件**

```typescript
'use client';

import { useState } from 'react';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'bug', label: '🐛 Bug 报告' },
  { value: 'suggestion', label: '💡 功能建议' },
  { value: 'complaint', label: '😤 体验吐槽' },
  { value: 'praise', label: '👍 赞美' },
] as const;

const SEVERITIES = [
  { value: 'blocker', label: '🔴 阻碍使用' },
  { value: 'major', label: '🟠 影响体验' },
  { value: 'minor', label: '🟡 小问题' },
  { value: 'trivial', label: '⚪ 无所谓' },
] as const;

const QUICK_TAGS = ['加载慢', 'AI 答非所问', '白屏', '样式错乱', '报错', '效果好', '超预期', '有创意'];

export function FeedbackPanel() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<'bug' | 'suggestion' | 'complaint' | 'praise'>('bug');
  const [severity, setSeverity] = useState<'blocker' | 'major' | 'minor' | 'trivial'>('major');
  const [tags, setTags] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error('请填写详细描述');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/beta/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: crypto.randomUUID(),
          category,
          severity,
          quick_tags: tags,
          description,
          page_context: {
            url: window.location.href,
            pathname: window.location.pathname,
            title: document.title,
          },
        }),
      });

      if (res.ok) {
        toast.success('反馈已提交，感谢！');
        setCategory('bug');
        setSeverity('major');
        setTags([]);
        setDescription('');
        setOpen(false);
      } else {
        toast.error('提交失败，请重试');
      }
    } catch {
      toast.error('网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 transition-all hover:scale-105"
      >
        <span className="text-lg">🐛</span>
        <span className="text-sm font-medium">反馈</span>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setOpen(false)} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-800 shadow-2xl z-50 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">提交反馈</h2>
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
            >
              ✕
            </button>
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
              反馈类型
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    category === c.value
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 border-2 border-indigo-500'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-2 border-transparent hover:border-slate-300'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
              优先级
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SEVERITIES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSeverity(s.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    severity === s.value
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 border-2 border-indigo-500'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-2 border-transparent hover:border-slate-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick tags */}
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
              快捷标签
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    setTags((prev) =>
                      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                    );
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    tags.includes(tag)
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-300'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
              详细描述 *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请详细描述你遇到的问题或你的建议..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows={5}
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !description.trim()}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white font-medium transition-colors"
          >
            {submitting ? '提交中...' : '提交反馈'}
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add app/api/beta/feedback/route.ts components/beta/feedback-panel.tsx
git commit -m "feat: add beta feedback submission API and panel component"
```

---

### Task 7: Beta 标识徽章 + 全局注入

**Files:**
- Create: `components/beta/beta-badge.tsx`
- Modify: `components/sky/layout/app-shell.tsx`

- [ ] **Step 1: 创建 Beta 徽章组件**

```typescript
'use client';

import { FeedbackPanel } from './feedback-panel';

export function BetaChrome() {
  // 只在 BETA_MODE 开启时显示
  if (process.env.NEXT_PUBLIC_BETA_MODE !== 'true') {
    return null;
  }

  return (
    <>
      {/* Beta badge — fixed top-left */}
      <div className="fixed top-3 left-3 z-[60] flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/90 text-white text-xs font-bold shadow-sm backdrop-blur-sm">
        <span>BETA</span>
        <span className="opacity-75">v0.2.1</span>
      </div>

      {/* Feedback button — fixed bottom-right */}
      <FeedbackPanel />
    </>
  );
}
```

- [ ] **Step 2: 在 app-shell 中注入 BetaChrome**

在 `components/sky/layout/app-shell.tsx` 中：

添加 import:
```typescript
import { BetaChrome } from '@/components/beta/beta-chrome';
```

在 `<div className="flex h-screen w-full flex-col relative">` 内部最下方添加：
```typescript
<BetaChrome />
```

最终文件的关键区域应该像这样（只展示 import 和 return 部分）:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { HeaderControls } from '@/components/sky/home/header-controls';
import { FloatingUserCard } from '@/components/sky/home/floating-user-card';
import { SettingsDialog } from '@/components/settings';
import { UpgradeDialog } from '@/components/billing/upgrade-dialog';
import { SkyTabBar } from './sky-tab-bar';
import { BackgroundTasksIndicator } from './background-tasks-indicator';
import { BetaChrome } from '@/components/beta/beta-chrome';
import Link from 'next/link';

// ... StarryBackground, AnimatedLogo unchanged ...

export function SkyAppShell({ children }: SkyAppShellProps) {
  // ... existing state/effects ...

  return (
    <div className="flex h-screen w-full flex-col relative">
      <StarryBackground />
      {/* ... existing header, main, etc ... */}
      <BetaChrome />
    </div>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add components/beta/beta-chrome.tsx
git add components/sky/layout/app-shell.tsx
git commit -m "feat: add beta badge and feedback button to sky app shell"
```

Note: Rename `beta-badge.tsx` to `beta-chrome.tsx` since it contains both the badge and the feedback button.

---

### Task 8: 管理员后台

**Files:**
- Create: `app/api/beta/admin/feedback/route.ts`
- Create: `app/beta/admin/page.tsx`

- [ ] **Step 1: 管理员反馈列表 API**

```typescript
/**
 * GET /api/beta/admin/feedback
 * 管理员查看反馈列表（需检查 admin cookie 或 ACCESS_CODE）
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const limit = parseInt(searchParams.get('limit') || '50');

  const db = createClient(supabaseUrl, supabaseKey);
  let query = db.from('beta_feedback').select().order('created_at', { ascending: false }).limit(limit);

  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

/**
 * PATCH /api/beta/admin/feedback
 * 更新反馈状态
 */
export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
  }

  const body = await request.json();
  const db = createClient(supabaseUrl, supabaseKey);

  const { error } = await db
    .from('beta_feedback')
    .update({
      status: body.status,
      admin_notes: body.admin_notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: 管理员页面**

```typescript
'use client';

import { useState, useEffect } from 'react';

interface Feedback {
  id: string;
  category: string;
  severity: string;
  quick_tags: string[];
  description: string;
  status: string;
  admin_notes: string | null;
  page_context: { pathname?: string; title?: string } | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  bug: '🐛 Bug',
  suggestion: '💡 建议',
  complaint: '😤 吐槽',
  praise: '👍 赞美',
};

const SEVERITY_LABELS: Record<string, string> = {
  blocker: '🔴 阻碍',
  major: '🟠 影响',
  minor: '🟡 小问题',
  trivial: '⚪ 无所谓',
};

const SEVERITY_ORDER = { blocker: 0, major: 1, minor: 2, trivial: 3 };

export default function BetaAdminPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    fetch(`/api/beta/admin/feedback?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setFeedbacks(data.data || []);
        setLoading(false);
      });
  }, [filterStatus]);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/beta/admin/feedback?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setFeedbacks((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status } : f))
    );
  };

  const sorted = [...feedbacks].sort(
    (a, b) => (SEVERITY_ORDER[a.severity as keyof typeof SEVERITY_ORDER] ?? 9) - (SEVERITY_ORDER[b.severity as keyof typeof SEVERITY_ORDER] ?? 9)
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
          Beta 管理后台
        </h1>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {['', 'new', 'reviewing', 'resolved', 'wontfix'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {s || '全部'}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <p className="text-slate-500">加载中...</p>
        ) : sorted.length === 0 ? (
          <p className="text-slate-500">暂无反馈</p>
        ) : (
          <div className="space-y-3">
            {sorted.map((fb) => (
              <div
                key={fb.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{CATEGORY_LABELS[fb.category] || fb.category}</span>
                  <span className="text-sm">{SEVERITY_LABELS[fb.severity] || fb.severity}</span>
                  {fb.quick_tags?.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-400"
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="ml-auto text-xs text-slate-400">
                    {new Date(fb.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                  {fb.description}
                </p>
                {fb.page_context?.pathname && (
                  <p className="text-xs text-slate-400 mb-2">
                    页面: {fb.page_context.pathname} {fb.page_context.title ? `(${fb.page_context.title})` : ''}
                  </p>
                )}
                <div className="flex gap-2">
                  {fb.status === 'new' && (
                    <button
                      onClick={() => updateStatus(fb.id, 'reviewing')}
                      className="px-3 py-1 rounded text-xs bg-blue-100 text-blue-700 hover:bg-blue-200"
                    >
                      标记为处理中
                    </button>
                  )}
                  {fb.status === 'reviewing' && (
                    <button
                      onClick={() => updateStatus(fb.id, 'resolved')}
                      className="px-3 py-1 rounded text-xs bg-green-100 text-green-700 hover:bg-green-200"
                    >
                      标记为已解决
                    </button>
                  )}
                  {(fb.status === 'new' || fb.status === 'reviewing') && (
                    <button
                      onClick={() => updateStatus(fb.id, 'wontfix')}
                      className="px-3 py-1 rounded text-xs bg-slate-100 text-slate-600 hover:bg-slate-200"
                    >
                      暂不处理
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add app/api/beta/admin/feedback/route.ts app/beta/admin/page.tsx
git commit -m "feat: add beta admin page for feedback management"
```

---

### Task 9: 邀请码 CLI 工具

**Files:**
- Create: `scripts/beta/invite-cli.ts`

- [ ] **Step 1: 创建 CLI 脚本**

```typescript
#!/usr/bin/env tsx
/**
 * Beta 邀请码管理 CLI
 *
 * Usage:
 *   npx tsx scripts/beta/invite-cli.ts create [--count N] [--uses N] [--days N] [--prefix PREFIX]
 *   npx tsx scripts/beta/invite-cli.ts list [--status STATUS]
 *   npx tsx scripts/beta/invite-cli.ts revoke <CODE>
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const db = createClient(supabaseUrl, supabaseKey);
const TABLE = 'invitation_codes';

function generateCode(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function createCodes(options: { count: number; uses: number; days: number; prefix: string }) {
  const expiresAt = new Date(Date.now() + options.days * 24 * 60 * 60 * 1000);
  const codes = [];

  for (let i = 0; i < options.count; i++) {
    const code = `${options.prefix}-${generateCode(8)}`;
    codes.push({
      code,
      type: 'direct' as const,
      created_by: 'cli',
      expires_at: expiresAt.toISOString(),
      max_uses: options.uses,
      current_uses: 0,
      status: 'active',
    });
  }

  const { data, error } = await db.from(TABLE).insert(codes).select();
  if (error) {
    console.error('❌ 创建失败:', error.message);
    process.exit(1);
  }

  console.log(`\n✅ 成功创建 ${data.length} 个邀请码:\n`);
  for (const item of data) {
    console.log(`  ${item.code}  (可用 ${item.max_uses} 次, 过期: ${new Date(item.expires_at).toLocaleDateString('zh-CN')})`);
  }
  console.log(`\n总计: ${data.length} 个\n`);
}

async function listCodes(status?: string) {
  let query = db.from(TABLE).select().order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  }

  console.log(`\n邀请码列表 (${data.length} 个):\n`);
  console.log('  %-25s %-8s %-8s %-12s %-10s', 'CODE', 'STATUS', 'USES', 'EXPIRES', 'NOTES');
  console.log('  ' + '-'.repeat(70));
  for (const item of data) {
    console.log(
      '  %-25s %-8s %-8s %-12s %-10s',
      item.code,
      item.status,
      `${item.current_uses}/${item.max_uses}`,
      item.expires_at ? new Date(item.expires_at).toLocaleDateString('zh-CN') : '永不过期',
      item.notes || '',
    );
  }
  console.log();
}

async function revokeCode(code: string) {
  const { data, error } = await db
    .from(TABLE)
    .update({ status: 'expired' })
    .eq('code', code.toUpperCase())
    .select();

  if (error) {
    console.error('❌ 撤销失败:', error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.error('❌ 未找到邀请码:', code);
    process.exit(1);
  }

  console.log(`✅ 已撤销邀请码: ${code.toUpperCase()}`);
}

// Parse args
const args = process.argv.slice(2);
const command = args[0];

if (command === 'create') {
  const count = parseInt(args.find((a) => a.startsWith('--count='))?.split('=')[1] || '10');
  const uses = parseInt(args.find((a) => a.startsWith('--uses='))?.split('=')[1] || '1');
  const days = parseInt(args.find((a) => a.startsWith('--days='))?.split('=')[1] || '30');
  const prefix = args.find((a) => a.startsWith('--prefix='))?.split('=')[1] || 'BETA';

  createCodes({ count, uses, days, prefix });
} else if (command === 'list') {
  const status = args.find((a) => a.startsWith('--status='))?.split('=')[1];
  listCodes(status);
} else if (command === 'revoke') {
  if (!args[1]) {
    console.error('Usage: npx tsx scripts/beta/invite-cli.ts revoke <CODE>');
    process.exit(1);
  }
  revokeCode(args[1]);
} else {
  console.log('用法:');
  console.log('  npx tsx scripts/beta/invite-cli.ts create [--count N] [--uses N] [--days N] [--prefix PREFIX]');
  console.log('  npx tsx scripts/beta/invite-cli.ts list [--status STATUS]');
  console.log('  npx tsx scripts/beta/invite-cli.ts revoke <CODE>');
}
```

- [ ] **Step 2: 提交**

```bash
git add scripts/beta/invite-cli.ts
git commit -m "feat: add beta invitation code CLI tool"
```

---

### Task 10: 测试

**Files:**
- Create: `tests/beta/invite-api.test.ts`
- Create: `tests/beta/feedback-api.test.ts`
- Create: `tests/beta/test-checklist.test.tsx`

- [ ] **Step 1: 邀请码 API 测试**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
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

// Mock crypto.subtle for HMAC
const mockSign = async () => new ArrayBuffer(32);
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
```

- [ ] **Step 2: 反馈 API 测试**

```typescript
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
```

- [ ] **Step 3: 测试清单组件测试**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestChecklist } from '@/components/beta/test-checklist';

describe('TestChecklist', () => {
  it('should render all categories', () => {
    render(<TestChecklist />);
    expect(screen.getByText('核心功能')).toBeTruthy();
    expect(screen.getByText('互动场景')).toBeTruthy();
    expect(screen.getByText('测验与评估')).toBeTruthy();
    expect(screen.getByText('导出与分享')).toBeTruthy();
    expect(screen.getByText('体验与性能')).toBeTruthy();
  });

  it('should show progress as 0/14 initially', () => {
    render(<TestChecklist />);
    expect(screen.getByText(/0\/14/)).toBeTruthy();
  });

  it('should expand category on click', () => {
    render(<TestChecklist />);
    fireEvent.click(screen.getByText('核心功能'));
    expect(screen.getByText('输入话题生成完整课程')).toBeTruthy();
  });

  it('should mark case as completed on click', () => {
    render(<TestChecklist />);
    fireEvent.click(screen.getByText('核心功能'));
    fireEvent.click(screen.getByText('输入话题生成完整课程'));
    expect(screen.getByText(/1\/14/)).toBeTruthy();
  });
});
```

- [ ] **Step 4: 运行测试验证**

```bash
pnpm test tests/beta/
```

Expected: All tests pass.

- [ ] **Step 5: 提交**

```bash
git add tests/beta/
git commit -m "test: add beta system unit tests"
```

---

### Task 11: 验证完整流程 + 文档

**Files:**
- Create: `docs/beta-setup.md`

- [ ] **Step 1: 创建部署文档**

```markdown
# Beta 内测版部署指南

## 1. 数据库迁移

在 Supabase SQL Editor 中执行:
- `migrations/001_beta_system.sql` (已存在)
- `migrations/002_beta_feedback.sql` (新增)

## 2. 环境变量

在 `.env.local` 中添加/确认:

```env
# 开启 beta 门禁模式
BETA_MODE=true

# 全局访问密码 (用于 cookie 签名 + ACCESS_CODE 备选)
ACCESS_CODE=your-secret-beta-password

# Supabase (已有)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 3. 生成邀请码

```bash
# 生成 20 个可用 1 次的邀请码，30 天过期
npx tsx scripts/beta/invite-cli.ts create --count 20 --uses 1 --days 30 --prefix BETA

# 查看已生成的邀请码
npx tsx scripts/beta/invite-cli.ts list

# 撤销某个邀请码
npx tsx scripts/beta/invite-cli.ts revoke BETA-XXXXX
```

## 4. 启动

```bash
pnpm dev
```

- 访问 `http://localhost:3000` → 会跳转到 `/beta/gate` 要求输入邀请码
- 验证成功后可正常使用
- 页面左上角显示 "BETA v0.2.1" 徽章
- 右下角有 🐛 反馈按钮
- 访问 `/beta/test-checklist` 查看测试清单
- 访问 `/beta/admin` 查看反馈管理后台

## 5. 生产部署 (Vercel)

```bash
git push origin beta-v1
```

在 Vercel 项目设置中添加 `BETA_MODE=true` 环境变量即可。
```

- [ ] **Step 2: 提交**

```bash
git add docs/beta-setup.md
git commit -m "docs: add beta deployment guide"
```

---

## Self-Review

**1. Spec coverage check:**

| Spec Requirement | Task | Status |
|---|---|---|
| 邀请码门禁 | Task 2, 3, 4 | ✅ |
| 测试清单 (5 大类, 每类 2-4 项) | Task 5 | ✅ |
| 评分 (1-5 星) + 快捷标签 + 备注 | Task 5 | ✅ |
| 反馈面板 (类型/优先级/标签/描述) | Task 6 | ✅ |
| 页面自动附带上下文 | Task 6 | ✅ |
| Beta 标识徽章 | Task 7 | ✅ |
| 管理员后台 (反馈列表/筛选/状态管理) | Task 8 | ✅ |
| 邀请码 CLI 工具 | Task 9 | ✅ |
| 测试 | Task 10 | ✅ |
| Supabase 迁移 | Task 1 | ✅ |
| BETA_MODE 环境变量控制 | Task 3 | ✅ |

**2. Placeholder scan:** No TBD/TODO/fill-in-later patterns found.

**3. Type consistency:** All API routes use `createClient` from `@supabase/supabase-js` with the same env vars. All components use `'use client'` directive. Tag arrays are `string[]` consistently.

**4. Scope:** This plan is focused on a single cohesive feature — beta testing infrastructure. Each task produces independently testable work.

---

Plan complete and saved to `docs/superpowers/plans/YYYY-MM-DD-beta-internal-testing.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
