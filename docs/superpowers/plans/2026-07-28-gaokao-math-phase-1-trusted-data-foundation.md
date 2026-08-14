# Gaokao Math Phase 1 Trusted Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立高考数学自适应学习系统的可信数据地基：严格数据契约、版本化课程包、抓取资料治理、人工验证清单、可复现资源索引，以及只返回已验证资源的认证 API。

**Architecture:** 新代码集中在 `lib/adaptive-learning/`，业务对象全部通过严格 Zod Schema。抓取资料由确定性 CLI 解析、去重、映射并结合人工验证清单生成版本化 JSON 索引；运行时 API 只读取该索引中的 `verified` 资源，任何缺口或索引错误都显式返回，不访问旧的关键词检索脚本，也不使用内存或跨学科 fallback。

**Tech Stack:** Next.js 16 Route Handlers、TypeScript 5、Zod 4、Vitest 4、`js-yaml`、Node.js `fs/promises` 与 `crypto`。

---

## 范围拆分

已批准规格覆盖四个独立子系统，因此按 `writing-plans` 的范围检查拆成四份可独立交付的计划：

1. **本计划：可信数据地基**——契约、课程包、数据治理、验证索引和只读资源 API。
2. **后续计划：证据与知识状态**——认证画像、`LearningEvent`、持久化、Beta 掌握度、遗忘和导入确认。
3. **后续计划：确定性计划闭环**——优先级、约束调度、局部调整/重算、计划 API 和“智能计划”界面。
4. **后续计划：教师审查与试点**——教师覆盖、端到端试点、指标采集和权重校准。

第一期完成后必须具备可运行、可测试的 `verified-only` 资源检索能力；后续计划不得绕过本期契约和资源状态。

## 参考

- 设计规格：`docs/superpowers/specs/2026-07-23-gaokao-math-adaptive-learning-plan-design.md`
- 当前旧脚本：`scripts/generate-learning-plan.ts`
- 当前认证模式：`lib/server/auth/helpers.ts:16-37`
- 当前 API 响应工具：`lib/server/api-response.ts:33-61`
- 测试入口：`package.json:9-22`、`vitest.config.ts`

## 文件结构

### 新建

| 文件 | 单一职责 |
|---|---|
| `lib/adaptive-learning/contracts/curriculum.ts` | 课程节点与课程包 Schema |
| `lib/adaptive-learning/contracts/resource.ts` | 数学资源、验证清单、索引和查询 Schema |
| `lib/adaptive-learning/contracts/learner.ts` | 画像、知识状态和学习事件 Schema |
| `lib/adaptive-learning/contracts/plan.ts` | 学习任务、计划和调整 Schema |
| `lib/adaptive-learning/contracts/index.ts` | 合同统一导出 |
| `lib/adaptive-learning/errors.ts` | 自适应学习错误码与错误类 |
| `lib/adaptive-learning/api-error.ts` | 新 API 的嵌套错误响应 |
| `lib/adaptive-learning/curriculum/validate-pack.ts` | 课程包引用、权重和无环校验 |
| `lib/adaptive-learning/curriculum/gaokao-math-v1.ts` | 12 节点最小高考数学课程包 |
| `lib/adaptive-learning/curriculum/registry.ts` | 按 ID 获取已发布课程包 |
| `lib/adaptive-learning/resources/crawled-document.ts` | Markdown/front matter 严格解析与标准化 |
| `lib/adaptive-learning/resources/mapper.ts` | 文档到课程节点的确定性候选打分 |
| `lib/adaptive-learning/resources/duplicate-detector.ts` | URL、内容哈希和标题碰撞检测 |
| `lib/adaptive-learning/resources/governance.ts` | 状态判定、人工覆盖、质量分和报告 |
| `lib/adaptive-learning/resources/index-builder.ts` | 扫描目录并原子写出索引与报告 |
| `lib/adaptive-learning/resources/repository.ts` | 读取索引并只查询 `verified` 资源 |
| `lib/adaptive-learning/index.ts` | 模块统一导出 |
| `scripts/build-gaokao-math-resource-index.ts` | 可测试 CLI 入口 |
| `data/adaptive-learning/gaokao-math/manual-verification.v1.json` | 六份已人工检查的种子资源 |
| `data/adaptive-learning/gaokao-math/resource-index.v1.json` | CLI 生成的版本化索引 |
| `data/adaptive-learning/gaokao-math/governance-report.v1.json` | CLI 生成的治理报告 |
| `app/api/sky/math-resources/route.ts` | 认证、严格查询和资源缺口 API |
| `docs/adaptive-learning/resource-governance.md` | 审核与重建操作说明 |

### 修改

| 文件 | 修改 |
|---|---|
| `package.json:9-22` | 增加 `adaptive:resources` 脚本 |

### 测试

| 文件 | 覆盖 |
|---|---|
| `tests/adaptive-learning/contracts.test.ts` | 全部 Schema 严格性 |
| `tests/adaptive-learning/curriculum-pack.test.ts` | 引用、权重、别名和 DAG |
| `tests/adaptive-learning/crawled-document.test.ts` | front matter、URL、语言和哈希 |
| `tests/adaptive-learning/resource-mapping.test.ts` | 节点候选和重复判定 |
| `tests/adaptive-learning/resource-governance.test.ts` | 三态、人工验证和资源缺口 |
| `tests/adaptive-learning/resource-index-builder.test.ts` | 目录扫描、原子输出和确定性 |
| `tests/adaptive-learning/resource-index-cli.test.ts` | CLI 参数与失败暴露 |
| `tests/adaptive-learning/resource-repository.test.ts` | verified-only 查询 |
| `tests/api/math-resources.test.ts` | 认证、查询、缺口和索引失败 |
| `tests/integration/adaptive-learning-resource-flow.test.ts` | 实际生成索引的端到端读取 |

## Task 1: 课程与资源严格契约

**Files:**
- Create: `lib/adaptive-learning/contracts/curriculum.ts`
- Create: `lib/adaptive-learning/contracts/resource.ts`
- Create: `lib/adaptive-learning/contracts/index.ts`
- Test: `tests/adaptive-learning/contracts.test.ts`

- [ ] **Step 1: 写课程与资源合同的失败测试**

```typescript
import { describe, expect, it } from 'vitest';
import {
  curriculumNodeSchema,
  curriculumPackSchema,
  mathResourceSchema,
  manualVerificationManifestSchema,
  mathResourceQuerySchema,
} from '@/lib/adaptive-learning/contracts';

const node = {
  id: 'derivative-concept',
  version: '2026.1',
  subject: 'math',
  stage: 'senior-high',
  name: '导数概念',
  aliases: ['导数', 'derivative'],
  description: '理解导数作为瞬时变化率和切线斜率。',
  prerequisiteIds: ['functions-properties'],
  relatedIds: ['derivative-applications'],
  examWeight: 0.1,
  defaultStabilityDays: 7,
  commonErrorCodes: ['derivative_definition_confusion'],
  activityTypes: ['learn', 'worked-example', 'practice', 'review', 'diagnostic'],
};

describe('adaptive learning curriculum and resource contracts', () => {
  it('accepts a strict curriculum node and pack', () => {
    expect(curriculumNodeSchema.parse(node).id).toBe('derivative-concept');
    expect(
      curriculumPackSchema.parse({
        id: 'gaokao-math-2026.1',
        version: '2026.1',
        title: '2026 高考数学最小课程包',
        subject: 'math',
        stage: 'senior-high',
        examSystem: 'gaokao',
        examYear: 2026,
        nodes: [node],
      }).nodes,
    ).toHaveLength(1);
  });

  it('rejects unknown fields and cross-subject resources', () => {
    expect(() => curriculumNodeSchema.parse({ ...node, unknown: true })).toThrow();
    expect(() =>
      mathResourceSchema.parse({
        id: 'math_1234567890abcdef',
        sourcePath: 'data/crawled/math/example.md',
        canonicalUrl: 'https://example.com/math',
        title: 'Example',
        language: 'en',
        subject: 'biology',
        stage: 'senior-high',
        examSystem: 'gaokao',
        nodeIds: ['derivative-concept'],
        resourceType: 'concept',
        difficulty: 3,
        qualityScore: 0.9,
        contentHash: 'a'.repeat(64),
        excerpt: 'A valid mathematical explanation.',
        status: 'verified',
        verifiedBy: 'reviewer-1',
        verifiedAt: '2026-07-28T00:00:00.000Z',
        rejectionReasons: [],
      }),
    ).toThrow();
  });

  it('requires verification metadata for verified resources', () => {
    expect(() =>
      mathResourceSchema.parse({
        id: 'math_1234567890abcdef',
        sourcePath: 'data/crawled/math/example.md',
        canonicalUrl: 'https://example.com/math',
        title: 'Example',
        language: 'en',
        subject: 'math',
        stage: 'senior-high',
        examSystem: 'gaokao',
        nodeIds: ['derivative-concept'],
        resourceType: 'concept',
        difficulty: 3,
        qualityScore: 0.9,
        contentHash: 'a'.repeat(64),
        excerpt: 'A valid mathematical explanation.',
        status: 'verified',
        rejectionReasons: [],
      }),
    ).toThrow();
  });

  it('validates manual verification and query coercion', () => {
    const manifest = manualVerificationManifestSchema.parse({
      schemaVersion: '1.0.0',
      curriculumPackId: 'gaokao-math-2026.1',
      entries: [
        {
          sourcePath: 'data/crawled/math/example.md',
          status: 'verified',
          nodeIds: ['derivative-concept'],
          resourceType: 'concept',
          difficulty: 3,
          reviewer: 'reviewer-1',
          reviewedAt: '2026-07-28T00:00:00.000Z',
          notes: 'Checked against the source.',
        },
      ],
    });
    expect(manifest.entries).toHaveLength(1);
    expect(mathResourceQuerySchema.parse({ maxDifficulty: '4', limit: '20' })).toEqual({
      maxDifficulty: 4,
      limit: 20,
    });
  });
});
```

- [ ] **Step 2: 运行测试并确认因模块不存在而失败**

Run: `npm test -- tests/adaptive-learning/contracts.test.ts`
Expected: FAIL，错误包含 `Cannot find module '@/lib/adaptive-learning/contracts'`。

- [ ] **Step 3: 实现课程合同**

```typescript
// lib/adaptive-learning/contracts/curriculum.ts
import { z } from 'zod';

export const nodeIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const activityTypeSchema = z.enum([
  'learn',
  'worked-example',
  'practice',
  'review',
  'diagnostic',
]);

export const curriculumNodeSchema = z.object({
  id: nodeIdSchema,
  version: z.string().min(1),
  subject: z.literal('math'),
  stage: z.literal('senior-high'),
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).min(1),
  description: z.string().min(1),
  parentId: nodeIdSchema.optional(),
  prerequisiteIds: z.array(nodeIdSchema),
  relatedIds: z.array(nodeIdSchema),
  examWeight: z.number().min(0).max(1),
  defaultStabilityDays: z.number().positive(),
  commonErrorCodes: z.array(z.string().min(1)),
  activityTypes: z.array(activityTypeSchema).min(1),
}).strict();

export const curriculumPackSchema = z.object({
  id: z.string().regex(/^gaokao-math-\d{4}\.\d+$/),
  version: z.string().regex(/^\d{4}\.\d+$/),
  title: z.string().min(1),
  subject: z.literal('math'),
  stage: z.literal('senior-high'),
  examSystem: z.literal('gaokao'),
  examYear: z.number().int().min(2026),
  nodes: z.array(curriculumNodeSchema).min(1),
}).strict();

export type ActivityType = z.infer<typeof activityTypeSchema>;
export type CurriculumNode = z.infer<typeof curriculumNodeSchema>;
export type CurriculumPack = z.infer<typeof curriculumPackSchema>;
```

- [ ] **Step 4: 实现资源合同**

```typescript
// lib/adaptive-learning/contracts/resource.ts
import { z } from 'zod';
import { nodeIdSchema } from './curriculum';

export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const mathResourceStatusSchema = z.enum(['verified', 'needs-review', 'rejected']);
export const mathResourceTypeSchema = z.enum([
  'concept',
  'worked-example',
  'exercise',
  'solution',
  'review',
]);
export const mathResourceLanguageSchema = z.enum(['zh-CN', 'en', 'mixed']);

export const mathResourceSchema = z.object({
  id: z.string().regex(/^math_[a-f0-9]{16}$/),
  sourcePath: z.string().min(1),
  canonicalUrl: z.string().url(),
  title: z.string().min(1),
  language: mathResourceLanguageSchema,
  subject: z.literal('math'),
  stage: z.literal('senior-high'),
  examSystem: z.literal('gaokao'),
  nodeIds: z.array(nodeIdSchema),
  resourceType: mathResourceTypeSchema,
  difficulty: z.number().int().min(1).max(5),
  qualityScore: z.number().min(0).max(1),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  excerpt: z.string().min(1).max(4000),
  status: mathResourceStatusSchema,
  verifiedBy: z.string().min(1).optional(),
  verifiedAt: isoDateTimeSchema.optional(),
  rejectionReasons: z.array(z.string().min(1)),
}).strict().superRefine((resource, ctx) => {
  if (resource.status === 'verified') {
    if (!resource.verifiedBy || !resource.verifiedAt) {
      ctx.addIssue({ code: 'custom', message: 'verified resources require verifiedBy and verifiedAt' });
    }
    if (resource.nodeIds.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'verified resources require nodeIds' });
    }
    if (resource.rejectionReasons.length > 0) {
      ctx.addIssue({ code: 'custom', message: 'verified resources cannot have rejectionReasons' });
    }
  }
  if (resource.status === 'rejected' && resource.rejectionReasons.length === 0) {
    ctx.addIssue({ code: 'custom', message: 'rejected resources require a reason' });
  }
});

const verifiedManifestEntrySchema = z.object({
  sourcePath: z.string().min(1),
  status: z.literal('verified'),
  nodeIds: z.array(nodeIdSchema).min(1),
  resourceType: mathResourceTypeSchema,
  difficulty: z.number().int().min(1).max(5),
  reviewer: z.string().min(1),
  reviewedAt: isoDateTimeSchema,
  notes: z.string().min(1),
}).strict();

const rejectedManifestEntrySchema = z.object({
  sourcePath: z.string().min(1),
  status: z.literal('rejected'),
  reasons: z.array(z.string().min(1)).min(1),
  reviewer: z.string().min(1),
  reviewedAt: isoDateTimeSchema,
  notes: z.string().min(1),
}).strict();

export const manualVerificationEntrySchema = z.discriminatedUnion('status', [
  verifiedManifestEntrySchema,
  rejectedManifestEntrySchema,
]);

export const manualVerificationManifestSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  curriculumPackId: z.string().min(1),
  entries: z.array(manualVerificationEntrySchema),
}).strict();

export const resourceIndexSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  indexVersion: z.string().min(1),
  curriculumPackId: z.string().min(1),
  generatedAt: isoDateTimeSchema,
  resources: z.array(mathResourceSchema),
}).strict();

export const governanceReportSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  indexVersion: z.string().min(1),
  scanned: z.number().int().min(0),
  parsed: z.number().int().min(0),
  statusCounts: z.object({
    verified: z.number().int().min(0),
    needsReview: z.number().int().min(0),
    rejected: z.number().int().min(0),
  }),
  reasonCounts: z.record(z.string(), z.number().int().min(0)),
  parseFailures: z.array(
    z.object({ sourcePath: z.string(), code: z.string(), message: z.string() }).strict(),
  ),
  resourceGapNodeIds: z.array(nodeIdSchema),
}).strict();

export const mathResourceQuerySchema = z.object({
  nodeId: nodeIdSchema.optional(),
  resourceType: mathResourceTypeSchema.optional(),
  maxDifficulty: z.coerce.number().int().min(1).max(5).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export type MathResource = z.infer<typeof mathResourceSchema>;
export type MathResourceStatus = z.infer<typeof mathResourceStatusSchema>;
export type MathResourceType = z.infer<typeof mathResourceTypeSchema>;
export type ManualVerificationManifest = z.infer<typeof manualVerificationManifestSchema>;
export type ResourceIndex = z.infer<typeof resourceIndexSchema>;
export type GovernanceReport = z.infer<typeof governanceReportSchema>;
export type MathResourceQuery = z.infer<typeof mathResourceQuerySchema>;
```

- [ ] **Step 5: 增加合同导出并运行测试**

```typescript
// lib/adaptive-learning/contracts/index.ts
export * from './curriculum';
export * from './resource';
```

Run: `npm test -- tests/adaptive-learning/contracts.test.ts`
Expected: PASS，4 tests passed。

- [ ] **Step 6: 提交课程与资源合同**

```bash
git add lib/adaptive-learning/contracts tests/adaptive-learning/contracts.test.ts
git commit -m "feat: add adaptive learning resource contracts"
```

## Task 2: 画像、事件、计划合同与显式错误

**Files:**
- Create: `lib/adaptive-learning/contracts/learner.ts`
- Create: `lib/adaptive-learning/contracts/plan.ts`
- Create: `lib/adaptive-learning/errors.ts`
- Modify: `lib/adaptive-learning/contracts/index.ts`
- Test: `tests/adaptive-learning/contracts.test.ts`

- [ ] **Step 1: 扩展失败测试**

将下列测试追加到 `tests/adaptive-learning/contracts.test.ts`：

```typescript
import {
  knowledgeStateSchema,
  learnerProfileSchema,
  learningEventSchema,
  learningPlanSchema,
  planAdjustmentSchema,
} from '@/lib/adaptive-learning/contracts';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';

it('validates learner, evidence, plan, and adjustment contracts', () => {
  const profile = learnerProfileSchema.parse({
    userId: 'user-1',
    stage: 'senior-high',
    grade: 'grade-12',
    subject: 'math',
    curriculumPackVersion: '2026.1',
    examDate: '2027-06-07',
    targetScore: 125,
    latestScore: 96,
    weeklyAvailableMinutes: 600,
    dailyAvailability: { monday: 90, tuesday: 90 },
    preferredSessionMinutes: 30,
    constraints: { restDays: ['sunday'], maxDailyMinutes: 120, teacherLockedNodeIds: [] },
    createdAt: '2026-07-28T00:00:00.000Z',
    updatedAt: '2026-07-28T00:00:00.000Z',
  });
  const state = knowledgeStateSchema.parse({
    userId: profile.userId,
    nodeId: 'derivative-concept',
    alpha: 2,
    beta: 2,
    mastery: 0.5,
    confidence: 0,
    retention: 1,
    reviewStabilityDays: 7,
    repeatedErrorCount: 0,
    evidenceCount: 0,
    version: 1,
  });
  const event = learningEventSchema.parse({
    eventId: 'event-1',
    userId: profile.userId,
    type: 'answer-submitted',
    occurredAt: '2026-07-28T00:00:00.000Z',
    source: 'quiz',
    nodeIds: [state.nodeId],
    payload: { correct: true },
    schemaVersion: '1.0.0',
  });
  const plan = learningPlanSchema.parse({
    id: 'plan-1',
    userId: profile.userId,
    version: 1,
    status: 'active',
    generatedAt: '2026-07-28T00:00:00.000Z',
    validFrom: '2026-07-28',
    validTo: '2026-08-03',
    curriculumPackVersion: '2026.1',
    plannerVersion: '1.0.0',
    profileSnapshot: profile,
    tasks: [],
    weeklyTargets: [],
    constraintChecks: ['daily_minutes_ok'],
    evidenceEventIds: [event.eventId],
  });
  expect(plan.userId).toBe('user-1');
  expect(planAdjustmentSchema.parse({
    id: 'adjustment-1',
    userId: 'user-1',
    previousPlanId: 'plan-1',
    nextPlanId: 'plan-2',
    mode: 'micro',
    triggerEventIds: ['event-1'],
    changedTaskIds: [],
    preservedTaskIds: [],
    ruleEvidence: [],
    explanation: '新证据未改变今日任务。',
    createdAt: '2026-07-28T00:00:01.000Z',
  }).mode).toBe('micro');
});

it('carries structured non-fallback errors', () => {
  const error = new AdaptiveLearningError({
    code: 'RESOURCE_GAP',
    message: 'No verified derivative resource',
    retryable: false,
    stage: 'resource-query',
    details: { nodeId: 'derivative-concept' },
  });
  expect(error.code).toBe('RESOURCE_GAP');
  expect(error.details).toEqual({ nodeId: 'derivative-concept' });
});
```

- [ ] **Step 2: 运行测试并确认缺少合同和错误类**

Run: `npm test -- tests/adaptive-learning/contracts.test.ts`
Expected: FAIL，错误指向缺少 `learnerProfileSchema` 或 `@/lib/adaptive-learning/errors`。

- [ ] **Step 3: 实现画像、知识状态和事件合同**

```typescript
// lib/adaptive-learning/contracts/learner.ts
import { z } from 'zod';
import { nodeIdSchema } from './curriculum';
import { isoDateTimeSchema } from './resource';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const learnerProfileSchema = z.object({
  userId: z.string().min(1),
  stage: z.literal('senior-high'),
  grade: z.literal('grade-12'),
  subject: z.literal('math'),
  curriculumPackVersion: z.string().min(1),
  examDate: dateSchema,
  targetScore: z.number().min(0).max(150).optional(),
  latestScore: z.number().min(0).max(150).optional(),
  weeklyAvailableMinutes: z.number().int().positive(),
  dailyAvailability: z.record(z.string(), z.number().int().min(0)),
  preferredSessionMinutes: z.number().int().min(10).max(120),
  constraints: z.object({
    restDays: z.array(z.string().min(1)),
    maxDailyMinutes: z.number().int().positive(),
    teacherLockedNodeIds: z.array(nodeIdSchema),
  }).strict(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
}).strict();

export const knowledgeStateSchema = z.object({
  userId: z.string().min(1),
  nodeId: nodeIdSchema,
  alpha: z.number().positive(),
  beta: z.number().positive(),
  mastery: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  retention: z.number().min(0).max(1),
  reviewStabilityDays: z.number().positive(),
  repeatedErrorCount: z.number().int().min(0),
  lastEvidenceAt: isoDateTimeSchema.optional(),
  lastReviewedAt: isoDateTimeSchema.optional(),
  evidenceCount: z.number().int().min(0),
  version: z.number().int().positive(),
}).strict();

export const learningEventTypeSchema = z.enum([
  'assessment-imported',
  'answer-submitted',
  'mistake-recorded',
  'review-completed',
  'task-started',
  'task-completed',
  'study-time-recorded',
  'teacher-correction',
  'profile-updated',
]);

export const learningEventSchema = z.object({
  eventId: z.string().min(1),
  userId: z.string().min(1),
  type: learningEventTypeSchema,
  occurredAt: isoDateTimeSchema,
  source: z.string().min(1),
  nodeIds: z.array(nodeIdSchema),
  payload: z.record(z.string(), z.unknown()),
  schemaVersion: z.literal('1.0.0'),
  correlationId: z.string().min(1).optional(),
}).strict();

export type LearnerProfile = z.infer<typeof learnerProfileSchema>;
export type KnowledgeState = z.infer<typeof knowledgeStateSchema>;
export type LearningEvent = z.infer<typeof learningEventSchema>;
```

- [ ] **Step 4: 实现任务、计划与调整合同**

```typescript
// lib/adaptive-learning/contracts/plan.ts
import { z } from 'zod';
import { nodeIdSchema } from './curriculum';
import { isoDateTimeSchema } from './resource';
import { learnerProfileSchema } from './learner';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const learningTaskSchema = z.object({
  id: z.string().min(1),
  nodeId: nodeIdSchema,
  type: z.enum(['learn', 'worked-example', 'practice', 'review', 'diagnostic']),
  title: z.string().min(1),
  objective: z.string().min(1),
  plannedMinutes: z.number().int().positive(),
  difficulty: z.number().int().min(1).max(5),
  resourceIds: z.array(z.string().regex(/^math_[a-f0-9]{16}$/)),
  successCriteria: z.array(z.string().min(1)).min(1),
  status: z.enum(['pending', 'in-progress', 'completed', 'skipped']),
  scheduledDate: dateSchema,
  reasonCodes: z.array(z.string().min(1)).min(1),
}).strict();

export const weeklyTargetSchema = z.object({
  weekStart: dateSchema,
  targetNodeIds: z.array(nodeIdSchema),
  plannedMinutes: z.number().int().min(0),
  expectedOutcomes: z.array(z.string().min(1)),
}).strict();

export const learningPlanSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  version: z.number().int().positive(),
  status: z.enum(['draft', 'active', 'superseded', 'completed']),
  generatedAt: isoDateTimeSchema,
  validFrom: dateSchema,
  validTo: dateSchema,
  curriculumPackVersion: z.string().min(1),
  plannerVersion: z.string().min(1),
  profileSnapshot: learnerProfileSchema,
  tasks: z.array(learningTaskSchema),
  weeklyTargets: z.array(weeklyTargetSchema),
  constraintChecks: z.array(z.string().min(1)),
  evidenceEventIds: z.array(z.string().min(1)),
}).strict();

export const planAdjustmentSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  previousPlanId: z.string().min(1),
  nextPlanId: z.string().min(1),
  mode: z.enum(['micro', 'full']),
  triggerEventIds: z.array(z.string().min(1)).min(1),
  changedTaskIds: z.array(z.string().min(1)),
  preservedTaskIds: z.array(z.string().min(1)),
  ruleEvidence: z.array(z.object({
    nodeId: nodeIdSchema,
    reasonCode: z.string().min(1),
    before: z.union([z.number(), z.string(), z.boolean()]),
    after: z.union([z.number(), z.string(), z.boolean()]),
  }).strict()),
  explanation: z.string().min(1),
  createdAt: isoDateTimeSchema,
}).strict();

export type LearningTask = z.infer<typeof learningTaskSchema>;
export type LearningPlan = z.infer<typeof learningPlanSchema>;
export type PlanAdjustment = z.infer<typeof planAdjustmentSchema>;
```

- [ ] **Step 5: 实现错误类并补齐导出**

```typescript
// lib/adaptive-learning/errors.ts
export const ADAPTIVE_LEARNING_ERROR_CODES = [
  'INVALID_SCHEMA',
  'AMBIGUOUS_CURRICULUM_MAPPING',
  'RESOURCE_GAP',
  'RESOURCE_INDEX_UNAVAILABLE',
  'PLAN_CONSTRAINT_VIOLATION',
  'DUPLICATE_EVENT',
  'SYNC_FAILED',
  'UNAUTHENTICATED',
  'CURRICULUM_VERSION_MISMATCH',
  'RETRY_EXHAUSTED',
] as const;

export type AdaptiveLearningErrorCode = (typeof ADAPTIVE_LEARNING_ERROR_CODES)[number];

export interface AdaptiveLearningErrorInput {
  code: AdaptiveLearningErrorCode;
  message: string;
  retryable: boolean;
  stage: string;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class AdaptiveLearningError extends Error {
  readonly code: AdaptiveLearningErrorCode;
  readonly retryable: boolean;
  readonly stage: string;
  readonly details?: Record<string, unknown>;
  override readonly cause?: unknown;

  constructor(input: AdaptiveLearningErrorInput) {
    super(input.message);
    this.name = 'AdaptiveLearningError';
    this.code = input.code;
    this.retryable = input.retryable;
    this.stage = input.stage;
    this.details = input.details;
    this.cause = input.cause;
  }
}
```

```typescript
// lib/adaptive-learning/contracts/index.ts
export * from './curriculum';
export * from './resource';
export * from './learner';
export * from './plan';
```

- [ ] **Step 6: 运行合同测试**

Run: `npm test -- tests/adaptive-learning/contracts.test.ts`
Expected: PASS，6 tests passed。

- [ ] **Step 7: 提交完整业务合同**

```bash
git add lib/adaptive-learning/contracts lib/adaptive-learning/errors.ts tests/adaptive-learning/contracts.test.ts
git commit -m "feat: define adaptive learning domain contracts"
```

## Task 3: 最小高考数学课程包与发布校验

**Files:**
- Create: `lib/adaptive-learning/curriculum/validate-pack.ts`
- Create: `lib/adaptive-learning/curriculum/gaokao-math-v1.ts`
- Create: `lib/adaptive-learning/curriculum/registry.ts`
- Test: `tests/adaptive-learning/curriculum-pack.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, expect, it } from 'vitest';
import { curriculumPackSchema } from '@/lib/adaptive-learning/contracts';
import {
  GAOKAO_MATH_PACK_V1,
  getCurriculumPack,
  validateCurriculumPack,
} from '@/lib/adaptive-learning/curriculum/registry';

describe('Gaokao math curriculum pack', () => {
  it('publishes twelve valid nodes with normalized exam weights', () => {
    const pack = validateCurriculumPack(GAOKAO_MATH_PACK_V1);
    expect(pack.nodes).toHaveLength(12);
    expect(pack.nodes.reduce((sum, item) => sum + item.examWeight, 0)).toBeCloseTo(1, 8);
    expect(getCurriculumPack('gaokao-math-2026.1')).toEqual(pack);
  });

  it('contains the prerequisite chain for derivative applications', () => {
    const byId = new Map(GAOKAO_MATH_PACK_V1.nodes.map((item) => [item.id, item]));
    expect(byId.get('functions-properties')?.prerequisiteIds).toEqual(['functions-basic']);
    expect(byId.get('derivative-concept')?.prerequisiteIds).toEqual(['functions-properties']);
    expect(byId.get('derivative-applications')?.prerequisiteIds).toEqual(['derivative-concept']);
  });

  it('rejects missing references, cycles, duplicate aliases, and bad weight totals', () => {
    const missing = structuredClone(GAOKAO_MATH_PACK_V1);
    missing.nodes[0].prerequisiteIds = ['missing-node'];
    expect(() => validateCurriculumPack(missing)).toThrow(/missing-node/);

    const cyclic = structuredClone(GAOKAO_MATH_PACK_V1);
    cyclic.nodes[0].prerequisiteIds = ['derivative-applications'];
    expect(() => validateCurriculumPack(cyclic)).toThrow(/cycle/);

    const collision = structuredClone(GAOKAO_MATH_PACK_V1);
    collision.nodes[1].aliases.push(collision.nodes[0].aliases[0]);
    expect(() => validateCurriculumPack(collision)).toThrow(/alias/);

    const badWeight = structuredClone(GAOKAO_MATH_PACK_V1);
    badWeight.nodes[0].examWeight = 0.9;
    expect(() => validateCurriculumPack(badWeight)).toThrow(/sum to 1/);
  });

  it('rejects an unknown pack id instead of falling back', () => {
    expect(() => getCurriculumPack('unknown')).toThrow(/Unknown curriculum pack/);
  });

  it('matches the strict pack schema', () => {
    expect(curriculumPackSchema.parse(GAOKAO_MATH_PACK_V1).id).toBe('gaokao-math-2026.1');
  });
});
```

- [ ] **Step 2: 运行测试并确认缺少课程包**

Run: `npm test -- tests/adaptive-learning/curriculum-pack.test.ts`
Expected: FAIL，错误包含 `Cannot find module '@/lib/adaptive-learning/curriculum/registry'`。

- [ ] **Step 3: 实现课程包校验**

```typescript
// lib/adaptive-learning/curriculum/validate-pack.ts
import { curriculumPackSchema, type CurriculumPack } from '@/lib/adaptive-learning/contracts';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';

function fail(message: string, details?: Record<string, unknown>): never {
  throw new AdaptiveLearningError({
    code: 'INVALID_SCHEMA',
    message,
    retryable: false,
    stage: 'curriculum-validation',
    details,
  });
}

export function validateCurriculumPack(input: unknown): CurriculumPack {
  const parsed = curriculumPackSchema.safeParse(input);
  if (!parsed.success) fail('Curriculum pack schema validation failed', { issues: parsed.error.issues });
  const pack = parsed.data;
  const ids = new Set(pack.nodes.map((item) => item.id));
  if (ids.size !== pack.nodes.length) fail('Curriculum node ids must be unique');

  const aliases = new Map<string, string>();
  for (const item of pack.nodes) {
    for (const referenced of [
      ...(item.parentId ? [item.parentId] : []),
      ...item.prerequisiteIds,
      ...item.relatedIds,
    ]) {
      if (!ids.has(referenced)) {
        fail('Curriculum node ' + item.id + ' references missing node ' + referenced);
      }
    }
    for (const alias of [item.name, ...item.aliases]) {
      const key = alias.normalize('NFKC').trim().toLowerCase();
      const existing = aliases.get(key);
      if (existing && existing !== item.id) {
        fail('Curriculum alias collision: ' + alias, { first: existing, second: item.id });
      }
      aliases.set(key, item.id);
    }
  }

  const weightTotal = pack.nodes.reduce((sum, item) => sum + item.examWeight, 0);
  if (Math.abs(weightTotal - 1) > 1e-9) {
    fail('Curriculum exam weights must sum to 1', { weightTotal });
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(pack.nodes.map((item) => [item.id, item]));
  const visit = (nodeId: string): void => {
    if (visiting.has(nodeId)) fail('Curriculum prerequisite cycle detected at ' + nodeId);
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);
    for (const prerequisiteId of byId.get(nodeId)?.prerequisiteIds ?? []) visit(prerequisiteId);
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  for (const item of pack.nodes) visit(item.id);
  return pack;
}
```

- [ ] **Step 4: 创建 12 节点课程包**

```typescript
// lib/adaptive-learning/curriculum/gaokao-math-v1.ts
import type { CurriculumNode, CurriculumPack } from '@/lib/adaptive-learning/contracts';

const activities: CurriculumNode['activityTypes'] = [
  'learn', 'worked-example', 'practice', 'review', 'diagnostic',
];

function node(
  input: Omit<CurriculumNode, 'version' | 'subject' | 'stage' | 'activityTypes'>,
): CurriculumNode {
  return { ...input, version: '2026.1', subject: 'math', stage: 'senior-high', activityTypes: activities };
}

export const GAOKAO_MATH_PACK_V1: CurriculumPack = {
  id: 'gaokao-math-2026.1',
  version: '2026.1',
  title: '2026 高考数学最小课程包',
  subject: 'math',
  stage: 'senior-high',
  examSystem: 'gaokao',
  examYear: 2026,
  nodes: [
    node({ id: 'functions-basic', name: '函数基础', aliases: ['函数', 'function', 'domain and range', 'function definition'], description: '函数定义、定义域、值域和表示方法。', prerequisiteIds: [], relatedIds: ['functions-properties', 'analytic-geometry'], examWeight: 0.08, defaultStabilityDays: 10, commonErrorCodes: ['function_definition_confusion', 'domain_error'] }),
    node({ id: 'functions-properties', name: '函数性质', aliases: ['函数性质', 'function properties', 'monotonicity', 'increasing and decreasing'], description: '单调性、奇偶性、周期性、图像与变换。', parentId: 'functions-basic', prerequisiteIds: ['functions-basic'], relatedIds: ['derivative-concept'], examWeight: 0.1, defaultStabilityDays: 8, commonErrorCodes: ['monotonicity_interval_error', 'function_transform_error'] }),
    node({ id: 'derivative-concept', name: '导数概念', aliases: ['导数', 'derivative', 'slope at a point', 'instantaneous rate of change'], description: '导数定义、几何意义和基本求导。', parentId: 'functions-basic', prerequisiteIds: ['functions-properties'], relatedIds: ['derivative-applications'], examWeight: 0.1, defaultStabilityDays: 7, commonErrorCodes: ['derivative_definition_confusion', 'derivative_rule_error'] }),
    node({ id: 'derivative-applications', name: '导数应用', aliases: ['导数应用', 'maxima and minima', 'optimization with derivatives', 'extrema'], description: '利用导数研究单调性、极值、最值和实际优化。', parentId: 'derivative-concept', prerequisiteIds: ['derivative-concept'], relatedIds: ['inequalities'], examWeight: 0.1, defaultStabilityDays: 6, commonErrorCodes: ['critical_point_omission', 'extrema_condition_error'] }),
    node({ id: 'trigonometry', name: '三角函数', aliases: ['三角函数', 'trigonometry', 'trigonometric identities', 'sine cosine tangent'], description: '三角函数、恒等变换、图像和解三角形。', prerequisiteIds: ['functions-basic'], relatedIds: ['analytic-geometry'], examWeight: 0.08, defaultStabilityDays: 9, commonErrorCodes: ['trig_identity_error', 'angle_range_error'] }),
    node({ id: 'sequences', name: '数列', aliases: ['数列', 'sequence', 'arithmetic sequence', 'geometric sequence'], description: '等差数列、等比数列、通项和前 n 项和。', prerequisiteIds: [], relatedIds: ['inequalities'], examWeight: 0.09, defaultStabilityDays: 9, commonErrorCodes: ['sequence_index_error', 'sum_formula_error'] }),
    node({ id: 'probability', name: '概率', aliases: ['概率', 'probability', 'conditional probability', 'independent events'], description: '古典概率、条件概率、独立事件和分布。', prerequisiteIds: [], relatedIds: ['statistics'], examWeight: 0.09, defaultStabilityDays: 10, commonErrorCodes: ['sample_space_error', 'conditional_probability_error'] }),
    node({ id: 'statistics', name: '统计', aliases: ['统计', 'statistics', 'sampling', 'variance', 'regression'], description: '抽样、数字特征、统计估计和回归。', prerequisiteIds: [], relatedIds: ['probability'], examWeight: 0.06, defaultStabilityDays: 12, commonErrorCodes: ['variance_calculation_error', 'sampling_bias'] }),
    node({ id: 'analytic-geometry', name: '解析几何', aliases: ['解析几何', 'analytic geometry', 'coordinate geometry', 'conic sections'], description: '直线、圆、椭圆、双曲线和抛物线。', prerequisiteIds: ['functions-basic'], relatedIds: ['solid-geometry'], examWeight: 0.12, defaultStabilityDays: 8, commonErrorCodes: ['coordinate_setup_error', 'conic_parameter_error'] }),
    node({ id: 'solid-geometry', name: '立体几何', aliases: ['立体几何', 'solid geometry', 'space geometry', 'vector geometry'], description: '空间线面关系、空间向量、距离和夹角。', prerequisiteIds: [], relatedIds: ['analytic-geometry'], examWeight: 0.1, defaultStabilityDays: 8, commonErrorCodes: ['spatial_relation_error', 'vector_projection_error'] }),
    node({ id: 'complex-numbers', name: '复数', aliases: ['复数', 'complex numbers', 'complex plane'], description: '复数运算、几何意义和基本性质。', prerequisiteIds: [], relatedIds: ['analytic-geometry'], examWeight: 0.04, defaultStabilityDays: 12, commonErrorCodes: ['complex_operation_error'] }),
    node({ id: 'inequalities', name: '不等式', aliases: ['不等式', 'inequality', 'inequalities', 'basic inequality'], description: '不等式性质、解法、基本不等式和恒成立问题。', prerequisiteIds: ['functions-basic'], relatedIds: ['derivative-applications', 'sequences'], examWeight: 0.04, defaultStabilityDays: 10, commonErrorCodes: ['inequality_direction_error', 'parameter_range_error'] }),
  ],
};
```

- [ ] **Step 5: 创建发布注册表，不允许未知版本回退**

```typescript
// lib/adaptive-learning/curriculum/registry.ts
import type { CurriculumPack } from '@/lib/adaptive-learning/contracts';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import { GAOKAO_MATH_PACK_V1 } from './gaokao-math-v1';
import { validateCurriculumPack } from './validate-pack';

export { GAOKAO_MATH_PACK_V1, validateCurriculumPack };

const validatedV1 = validateCurriculumPack(GAOKAO_MATH_PACK_V1);
const publishedPacks = new Map<string, CurriculumPack>([[validatedV1.id, validatedV1]]);

export function getCurriculumPack(id: string): CurriculumPack {
  const pack = publishedPacks.get(id);
  if (!pack) {
    throw new AdaptiveLearningError({
      code: 'CURRICULUM_VERSION_MISMATCH',
      message: 'Unknown curriculum pack: ' + id,
      retryable: false,
      stage: 'curriculum-registry',
      details: { curriculumPackId: id },
    });
  }
  return pack;
}
```

- [ ] **Step 6: 运行课程包测试**

Run: `npm test -- tests/adaptive-learning/curriculum-pack.test.ts`
Expected: PASS，5 tests passed。

- [ ] **Step 7: 提交课程包**

```bash
git add lib/adaptive-learning/curriculum tests/adaptive-learning/curriculum-pack.test.ts
git commit -m "feat: publish gaokao math curriculum pack"
```

## Task 4: 抓取 Markdown 的严格解析与标准化

**Files:**
- Create: `lib/adaptive-learning/resources/crawled-document.ts`
- Test: `tests/adaptive-learning/crawled-document.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, expect, it } from 'vitest';
import {
  canonicalizeUrl,
  detectLanguage,
  normalizeComparableText,
  parseCrawledMathDocument,
} from '@/lib/adaptive-learning/resources/crawled-document';

const markdown = `---
title: "Introduction to Derivatives"
source: "https://www.mathsisfun.com/calculus/derivatives-introduction.html?utm_source=test"
originalUrl: "https://www.mathsisfun.com/calculus/derivatives-introduction.html"
course: "math"
tags: ["math", "high-school", "college"]
wordCount: 630
depth: 1
crawledAt: "2026-07-21T03:08:50.276Z"
---

## Introduction to Derivatives

It is all about slope and instantaneous rate of change.
`;

describe('crawled math document parser', () => {
  it('parses strict front matter and creates a stable hash', () => {
    const first = parseCrawledMathDocument('data/crawled/math/intro.md', markdown);
    const second = parseCrawledMathDocument('data/crawled/math/intro.md', markdown);
    expect(first.title).toBe('Introduction to Derivatives');
    expect(first.course).toBe('math');
    expect(first.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(second.contentHash).toBe(first.contentHash);
    expect(first.canonicalUrl).toBe(
      'https://www.mathsisfun.com/calculus/derivatives-introduction.html',
    );
  });

  it('normalizes HTML entities and detects language', () => {
    expect(normalizeComparableText('A&nbsp;Function &quot;Rule&quot;')).toBe('a function rule');
    expect(detectLanguage('函数与导数')).toBe('zh-CN');
    expect(detectLanguage('function and derivative')).toBe('en');
    expect(detectLanguage('函数 function')).toBe('mixed');
  });

  it('canonicalizes URLs without tracking parameters or fragments', () => {
    expect(canonicalizeUrl('https://example.com/math/?utm_source=x&ref=y#part')).toBe(
      'https://example.com/math',
    );
  });

  it('rejects malformed front matter and cross-subject files', () => {
    expect(() => parseCrawledMathDocument('bad.md', 'plain text')).toThrow(/front matter/);
    expect(() =>
      parseCrawledMathDocument(
        'biology.md',
        markdown.replace('course: "math"', 'course: "biology"'),
      ),
    ).toThrow(/course must be math/);
  });
});
```

- [ ] **Step 2: 运行测试并确认模块不存在**

Run: `npm test -- tests/adaptive-learning/crawled-document.test.ts`
Expected: FAIL，错误包含 `Cannot find module '@/lib/adaptive-learning/resources/crawled-document'`。

- [ ] **Step 3: 实现解析、URL、语言和哈希**

```typescript
// lib/adaptive-learning/resources/crawled-document.ts
import { createHash } from 'node:crypto';
import yaml from 'js-yaml';
import { z } from 'zod';
import type { MathResourceLanguage } from '@/lib/adaptive-learning/contracts';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';

const frontMatterSchema = z.object({
  title: z.string().min(1),
  source: z.string().url(),
  originalUrl: z.string().url(),
  course: z.string().min(1),
  tags: z.array(z.string().min(1)),
  wordCount: z.number().int().min(0),
  depth: z.number().int().min(0),
  crawledAt: z.string().datetime({ offset: true }),
}).strict();

export interface CrawledMathDocument {
  sourcePath: string;
  title: string;
  sourceUrl: string;
  canonicalUrl: string;
  course: 'math';
  tags: string[];
  declaredWordCount: number;
  depth: number;
  crawledAt: string;
  body: string;
  normalizedTitle: string;
  normalizedBody: string;
  language: MathResourceLanguage;
  contentHash: string;
}

function parserError(message: string, details: Record<string, unknown>): never {
  throw new AdaptiveLearningError({
    code: 'INVALID_SCHEMA',
    message,
    retryable: false,
    stage: 'resource-parse',
    details,
  });
}

export function normalizeComparableText(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&amp;|&#38;/gi, '&')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function canonicalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || /^(ref|source)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  const rendered = url.toString();
  return rendered.endsWith('/') ? rendered.slice(0, -1) : rendered;
}

export function detectLanguage(value: string): MathResourceLanguage {
  const cjk = (value.match(/[\u3400-\u9fff]/g) ?? []).length;
  const latin = (value.match(/[a-z]/gi) ?? []).length;
  if (cjk > 0 && latin > 0) return 'mixed';
  if (cjk > 0) return 'zh-CN';
  return 'en';
}

export function parseCrawledMathDocument(
  sourcePath: string,
  markdown: string,
): CrawledMathDocument {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) parserError('Crawled document is missing front matter', { sourcePath });

  let rawMeta: unknown;
  try {
    rawMeta = yaml.load(match[1]);
  } catch (cause) {
    parserError('Crawled front matter YAML is invalid', { sourcePath, cause: String(cause) });
  }
  const parsed = frontMatterSchema.safeParse(rawMeta);
  if (!parsed.success) {
    parserError('Crawled front matter schema is invalid', {
      sourcePath,
      issues: parsed.error.issues,
    });
  }
  if (parsed.data.course !== 'math') {
    parserError('Crawled document course must be math', {
      sourcePath,
      course: parsed.data.course,
    });
  }

  const body = markdown.slice(match[0].length).trim();
  if (body.length < 50) parserError('Crawled document body is too short', { sourcePath });
  const normalizedBody = normalizeComparableText(body);
  const contentHash = createHash('sha256').update(normalizedBody).digest('hex');

  return {
    sourcePath: sourcePath.replaceAll('\\', '/'),
    title: parsed.data.title.trim(),
    sourceUrl: parsed.data.source,
    canonicalUrl: canonicalizeUrl(parsed.data.originalUrl || parsed.data.source),
    course: 'math',
    tags: parsed.data.tags.map((tag) => tag.trim().toLowerCase()),
    declaredWordCount: parsed.data.wordCount,
    depth: parsed.data.depth,
    crawledAt: parsed.data.crawledAt,
    body,
    normalizedTitle: normalizeComparableText(parsed.data.title),
    normalizedBody,
    language: detectLanguage(body),
    contentHash,
  };
}
```

- [ ] **Step 4: 导出资源语言类型**

在 `lib/adaptive-learning/contracts/resource.ts` 的类型导出区增加：

```typescript
export type MathResourceLanguage = z.infer<typeof mathResourceLanguageSchema>;
```

- [ ] **Step 5: 运行解析测试**

Run: `npm test -- tests/adaptive-learning/crawled-document.test.ts`
Expected: PASS，4 tests passed。

- [ ] **Step 6: 提交解析器**

```bash
git add lib/adaptive-learning/contracts/resource.ts lib/adaptive-learning/resources/crawled-document.ts tests/adaptive-learning/crawled-document.test.ts
git commit -m "feat: parse crawled math resources strictly"
```

## Task 5: 确定性课程映射与重复检测

**Files:**
- Create: `lib/adaptive-learning/resources/mapper.ts`
- Create: `lib/adaptive-learning/resources/duplicate-detector.ts`
- Test: `tests/adaptive-learning/resource-mapping.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, expect, it } from 'vitest';
import { GAOKAO_MATH_PACK_V1 } from '@/lib/adaptive-learning/curriculum/registry';
import type { CrawledMathDocument } from '@/lib/adaptive-learning/resources/crawled-document';
import {
  detectDuplicateDecisions,
} from '@/lib/adaptive-learning/resources/duplicate-detector';
import {
  mapDocumentToCurriculum,
} from '@/lib/adaptive-learning/resources/mapper';

function document(
  sourcePath: string,
  title: string,
  body: string,
  canonicalUrl = 'https://example.com/' + sourcePath,
): CrawledMathDocument {
  return {
    sourcePath,
    title,
    sourceUrl: canonicalUrl,
    canonicalUrl,
    course: 'math',
    tags: ['math', 'high-school'],
    declaredWordCount: body.length,
    depth: 1,
    crawledAt: '2026-07-21T00:00:00.000Z',
    body,
    normalizedTitle: title.toLowerCase(),
    normalizedBody: body.toLowerCase(),
    language: 'en',
    contentHash: sourcePath.padEnd(64, 'a').slice(0, 64).replace(/[^a-f0-9]/g, 'a'),
  };
}

describe('curriculum mapping and duplicate detection', () => {
  it('maps an explicit derivative title without ambiguity', () => {
    const result = mapDocumentToCurriculum(
      document('derivative.md', 'Introduction to Derivatives', 'Derivative is slope at a point.'),
      GAOKAO_MATH_PACK_V1,
    );
    expect(result.ambiguous).toBe(false);
    expect(result.candidates[0]).toEqual(
      expect.objectContaining({ nodeId: 'derivative-concept' }),
    );
  });

  it('marks weak or tied matches as ambiguous', () => {
    const result = mapDocumentToCurriculum(
      document('general.md', 'General Math', 'A broad introduction without a curriculum keyword.'),
      GAOKAO_MATH_PACK_V1,
    );
    expect(result.ambiguous).toBe(true);
    expect(result.candidates).toEqual([]);
  });

  it('chooses a deterministic keeper for URL and hash duplicates', () => {
    const keeper = document('a.md', 'Derivative Rules', 'longer derivative body', 'https://x.test/a');
    keeper.declaredWordCount = 100;
    const duplicate = document('b.md', 'Derivative Rules Copy', 'different body', 'https://x.test/a');
    duplicate.declaredWordCount = 20;
    const hashDuplicate = { ...document('c.md', 'Other', 'same body'), contentHash: keeper.contentHash };

    const decisions = detectDuplicateDecisions([duplicate, hashDuplicate, keeper]);
    expect(decisions.hardDuplicates.get('b.md')).toEqual({
      keeperSourcePath: 'a.md',
      reason: 'duplicate_canonical_url',
    });
    expect(decisions.hardDuplicates.get('c.md')).toEqual({
      keeperSourcePath: 'a.md',
      reason: 'duplicate_content_hash',
    });
  });

  it('records title collisions for review without hard rejecting them', () => {
    const first = document('a.md', 'Functions', 'first body');
    const second = document('b.md', 'Functions', 'second body');
    const decisions = detectDuplicateDecisions([first, second]);
    expect(decisions.hardDuplicates.size).toBe(0);
    expect(decisions.titleCollisions.get('a.md')).toEqual(['b.md']);
    expect(decisions.titleCollisions.get('b.md')).toEqual(['a.md']);
  });
});
```

- [ ] **Step 2: 运行测试并确认模块不存在**

Run: `npm test -- tests/adaptive-learning/resource-mapping.test.ts`
Expected: FAIL，错误指向缺少 `mapper` 或 `duplicate-detector`。

- [ ] **Step 3: 实现候选打分**

```typescript
// lib/adaptive-learning/resources/mapper.ts
import type { CurriculumPack } from '@/lib/adaptive-learning/contracts';
import type { CrawledMathDocument } from './crawled-document';
import { normalizeComparableText } from './crawled-document';

export interface CurriculumCandidate {
  nodeId: string;
  score: number;
  matchedAliases: string[];
}

export interface CurriculumMappingResult {
  candidates: CurriculumCandidate[];
  ambiguous: boolean;
}

export function mapDocumentToCurriculum(
  document: CrawledMathDocument,
  pack: CurriculumPack,
): CurriculumMappingResult {
  const candidates: CurriculumCandidate[] = [];
  for (const node of pack.nodes) {
    let score = 0;
    const matchedAliases: string[] = [];
    for (const rawAlias of [node.name, ...node.aliases]) {
      const alias = normalizeComparableText(rawAlias);
      if (!alias) continue;
      if (document.normalizedTitle.includes(alias)) {
        score += 5;
        matchedAliases.push(rawAlias);
      } else if (document.normalizedBody.includes(alias)) {
        score += 2;
        matchedAliases.push(rawAlias);
      }
    }
    if (score > 0) candidates.push({ nodeId: node.id, score, matchedAliases });
  }
  candidates.sort((a, b) => b.score - a.score || a.nodeId.localeCompare(b.nodeId));
  const top = candidates[0];
  const second = candidates[1];
  const ambiguous = !top || top.score < 5 || (!!second && top.score - second.score < 2);
  return {
    candidates: ambiguous ? candidates.filter((item) => item.score >= 5) : candidates,
    ambiguous,
  };
}
```

- [ ] **Step 4: 实现重复检测**

```typescript
// lib/adaptive-learning/resources/duplicate-detector.ts
import type { CrawledMathDocument } from './crawled-document';

export interface HardDuplicateDecision {
  keeperSourcePath: string;
  reason: 'duplicate_canonical_url' | 'duplicate_content_hash';
}

export interface DuplicateDecisions {
  hardDuplicates: Map<string, HardDuplicateDecision>;
  titleCollisions: Map<string, string[]>;
}

function chooseKeeper(items: CrawledMathDocument[]): CrawledMathDocument {
  return [...items].sort(
    (a, b) =>
      b.declaredWordCount - a.declaredWordCount ||
      a.sourcePath.localeCompare(b.sourcePath),
  )[0];
}

function groupBy(
  documents: CrawledMathDocument[],
  keyOf: (document: CrawledMathDocument) => string,
): Map<string, CrawledMathDocument[]> {
  const groups = new Map<string, CrawledMathDocument[]>();
  for (const document of documents) {
    const key = keyOf(document);
    groups.set(key, [...(groups.get(key) ?? []), document]);
  }
  return groups;
}

export function detectDuplicateDecisions(
  documents: CrawledMathDocument[],
): DuplicateDecisions {
  const hardDuplicates = new Map<string, HardDuplicateDecision>();
  const titleCollisions = new Map<string, string[]>();

  for (const [reason, groups] of [
    ['duplicate_canonical_url', groupBy(documents, (item) => item.canonicalUrl)],
    ['duplicate_content_hash', groupBy(documents, (item) => item.contentHash)],
  ] as const) {
    for (const items of groups.values()) {
      if (items.length < 2) continue;
      const keeper = chooseKeeper(items);
      for (const item of items) {
        if (item.sourcePath === keeper.sourcePath || hardDuplicates.has(item.sourcePath)) continue;
        hardDuplicates.set(item.sourcePath, {
          keeperSourcePath: keeper.sourcePath,
          reason,
        });
      }
    }
  }

  for (const items of groupBy(documents, (item) => item.normalizedTitle).values()) {
    if (items.length < 2) continue;
    for (const item of items) {
      titleCollisions.set(
        item.sourcePath,
        items
          .filter((other) => other.sourcePath !== item.sourcePath)
          .map((other) => other.sourcePath)
          .sort(),
      );
    }
  }

  return { hardDuplicates, titleCollisions };
}
```

- [ ] **Step 5: 运行映射与重复测试**

Run: `npm test -- tests/adaptive-learning/resource-mapping.test.ts`
Expected: PASS，4 tests passed。

- [ ] **Step 6: 提交映射和去重**

```bash
git add lib/adaptive-learning/resources/mapper.ts lib/adaptive-learning/resources/duplicate-detector.ts tests/adaptive-learning/resource-mapping.test.ts
git commit -m "feat: map and deduplicate math resources"
```

## Task 6: 三态治理、人工验证与资源缺口报告

**Files:**
- Create: `lib/adaptive-learning/resources/governance.ts`
- Test: `tests/adaptive-learning/resource-governance.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, expect, it } from 'vitest';
import { GAOKAO_MATH_PACK_V1 } from '@/lib/adaptive-learning/curriculum/registry';
import type { ManualVerificationManifest } from '@/lib/adaptive-learning/contracts';
import { parseCrawledMathDocument } from '@/lib/adaptive-learning/resources/crawled-document';
import { governMathResources } from '@/lib/adaptive-learning/resources/governance';

function markdown(title: string, url: string, body: string): string {
  return [
    '---',
    'title: "' + title + '"',
    'source: "' + url + '"',
    'originalUrl: "' + url + '"',
    'course: "math"',
    'tags: ["math", "high-school", "college"]',
    'wordCount: 500',
    'depth: 1',
    'crawledAt: "2026-07-21T00:00:00.000Z"',
    '---',
    '',
    body.repeat(10),
  ].join('\n');
}

describe('math resource governance', () => {
  it('verifies only manifest-approved resources', () => {
    const approved = parseCrawledMathDocument(
      'data/crawled/math/approved.md',
      markdown('Introduction to Derivatives', 'https://example.com/approved', 'Derivative is slope. '),
    );
    const unreviewed = parseCrawledMathDocument(
      'data/crawled/math/unreviewed.md',
      markdown('Arithmetic Sequences', 'https://example.com/unreviewed', 'Arithmetic sequence rule. '),
    );
    const manifest: ManualVerificationManifest = {
      schemaVersion: '1.0.0',
      curriculumPackId: GAOKAO_MATH_PACK_V1.id,
      entries: [{
        sourcePath: approved.sourcePath,
        status: 'verified',
        nodeIds: ['derivative-concept'],
        resourceType: 'concept',
        difficulty: 3,
        reviewer: 'reviewer-1',
        reviewedAt: '2026-07-28T00:00:00.000Z',
        notes: 'Source and mapping checked.',
      }],
    };

    const result = governMathResources({
      documents: [approved, unreviewed],
      manifest,
      pack: GAOKAO_MATH_PACK_V1,
      indexVersion: '2026-07-28.1',
      now: '2026-07-28T00:00:00.000Z',
      scanned: 2,
      parseFailures: [],
    });

    expect(result.index.resources.find((item) => item.sourcePath === approved.sourcePath)?.status)
      .toBe('verified');
    expect(result.index.resources.find((item) => item.sourcePath === unreviewed.sourcePath)?.status)
      .toBe('needs-review');
    expect(result.report.statusCounts).toEqual({ verified: 1, needsReview: 1, rejected: 0 });
  });

  it('rejects hard duplicates and reports uncovered nodes', () => {
    const first = parseCrawledMathDocument(
      'data/crawled/math/a.md',
      markdown('Functions', 'https://example.com/functions', 'Function definition. '),
    );
    const duplicate = parseCrawledMathDocument(
      'data/crawled/math/b.md',
      markdown('Functions Copy', 'https://example.com/functions', 'Another function text. '),
    );
    const result = governMathResources({
      documents: [first, duplicate],
      manifest: {
        schemaVersion: '1.0.0',
        curriculumPackId: GAOKAO_MATH_PACK_V1.id,
        entries: [],
      },
      pack: GAOKAO_MATH_PACK_V1,
      indexVersion: '2026-07-28.1',
      now: '2026-07-28T00:00:00.000Z',
      scanned: 2,
      parseFailures: [],
    });
    expect(result.index.resources.filter((item) => item.status === 'rejected')).toHaveLength(1);
    expect(result.report.resourceGapNodeIds).toContain('derivative-concept');
  });

  it('fails when a manifest entry is missing or references an unknown node', () => {
    const document = parseCrawledMathDocument(
      'data/crawled/math/a.md',
      markdown('Functions', 'https://example.com/functions', 'Function definition. '),
    );
    const base = {
      schemaVersion: '1.0.0' as const,
      curriculumPackId: GAOKAO_MATH_PACK_V1.id,
      entries: [{
        sourcePath: 'data/crawled/math/missing.md',
        status: 'verified' as const,
        nodeIds: ['functions-basic'],
        resourceType: 'concept' as const,
        difficulty: 2,
        reviewer: 'reviewer-1',
        reviewedAt: '2026-07-28T00:00:00.000Z',
        notes: 'Checked.',
      }],
    };
    expect(() => governMathResources({
      documents: [document],
      manifest: base,
      pack: GAOKAO_MATH_PACK_V1,
      indexVersion: '2026-07-28.1',
      now: '2026-07-28T00:00:00.000Z',
      scanned: 1,
      parseFailures: [],
    })).toThrow(/missing from scanned documents/);

    const unknownNode = structuredClone(base);
    unknownNode.entries[0].sourcePath = document.sourcePath;
    unknownNode.entries[0].nodeIds = ['unknown-node'];
    expect(() => governMathResources({
      documents: [document],
      manifest: unknownNode,
      pack: GAOKAO_MATH_PACK_V1,
      indexVersion: '2026-07-28.1',
      now: '2026-07-28T00:00:00.000Z',
      scanned: 1,
      parseFailures: [],
    })).toThrow(/unknown node/);
  });
});
```

- [ ] **Step 2: 运行测试并确认治理模块不存在**

Run: `npm test -- tests/adaptive-learning/resource-governance.test.ts`
Expected: FAIL，错误包含 `Cannot find module '@/lib/adaptive-learning/resources/governance'`。

- [ ] **Step 3: 实现确定性质量分和资源构造**

```typescript
// lib/adaptive-learning/resources/governance.ts
import { createHash } from 'node:crypto';
import {
  governanceReportSchema,
  mathResourceSchema,
  resourceIndexSchema,
  type CurriculumPack,
  type GovernanceReport,
  type ManualVerificationManifest,
  type MathResource,
  type MathResourceType,
  type ResourceIndex,
} from '@/lib/adaptive-learning/contracts';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import type { CrawledMathDocument } from './crawled-document';
import { detectDuplicateDecisions } from './duplicate-detector';
import { mapDocumentToCurriculum } from './mapper';

export interface ParseFailure {
  sourcePath: string;
  code: string;
  message: string;
}

export interface GovernanceInput {
  documents: CrawledMathDocument[];
  manifest: ManualVerificationManifest;
  pack: CurriculumPack;
  indexVersion: string;
  now: string;
  scanned: number;
  parseFailures: ParseFailure[];
}

export interface GovernanceResult {
  index: ResourceIndex;
  report: GovernanceReport;
}

function fail(message: string, details?: Record<string, unknown>): never {
  throw new AdaptiveLearningError({
    code: 'INVALID_SCHEMA',
    message,
    retryable: false,
    stage: 'resource-governance',
    details,
  });
}

function resourceId(document: CrawledMathDocument): string {
  return 'math_' + createHash('sha256')
    .update(document.canonicalUrl + '\n' + document.contentHash)
    .digest('hex')
    .slice(0, 16);
}

function qualityScore(document: CrawledMathDocument): number {
  let score = 0.2;
  if (document.canonicalUrl.startsWith('https://')) score += 0.15;
  if (document.declaredWordCount >= 300) score += 0.2;
  if (document.declaredWordCount <= 4000) score += 0.1;
  if (document.body.includes('## ') || document.body.includes('h1 ')) score += 0.15;
  if (new URL(document.canonicalUrl).hostname === 'www.mathsisfun.com') score += 0.1;
  if (document.normalizedBody.length >= 300) score += 0.1;
  return Math.min(1, Number(score.toFixed(2)));
}

function inferResourceType(document: CrawledMathDocument): MathResourceType {
  const title = document.normalizedTitle;
  if (title.includes('exercise') || title.includes('activity')) return 'exercise';
  if (title.includes('solution')) return 'solution';
  if (title.includes('example')) return 'worked-example';
  if (title.includes('review') || title.includes('index')) return 'review';
  return 'concept';
}

function excerpt(document: CrawledMathDocument): string {
  return document.body.replace(/\s+/g, ' ').trim().slice(0, 4000);
}
```

- [ ] **Step 4: 完成三态治理和报告**

继续在同一文件追加：

```typescript
export function governMathResources(input: GovernanceInput): GovernanceResult {
  if (input.manifest.curriculumPackId !== input.pack.id) {
    fail('Manual verification curriculum pack mismatch', {
      expected: input.pack.id,
      actual: input.manifest.curriculumPackId,
    });
  }
  const documentsByPath = new Map(input.documents.map((item) => [item.sourcePath, item]));
  const manifestByPath = new Map(input.manifest.entries.map((item) => [item.sourcePath, item]));
  const nodeIds = new Set(input.pack.nodes.map((item) => item.id));
  for (const entry of input.manifest.entries) {
    if (!documentsByPath.has(entry.sourcePath)) {
      fail('Manual verification source is missing from scanned documents', {
        sourcePath: entry.sourcePath,
      });
    }
    if (entry.status === 'verified') {
      for (const nodeId of entry.nodeIds) {
        if (!nodeIds.has(nodeId)) fail('Manual verification references unknown node', { nodeId });
      }
    }
  }

  const duplicateDecisions = detectDuplicateDecisions(input.documents);
  const resources: MathResource[] = [];
  for (const document of [...input.documents].sort((a, b) => a.sourcePath.localeCompare(b.sourcePath))) {
    const duplicate = duplicateDecisions.hardDuplicates.get(document.sourcePath);
    const manual = manifestByPath.get(document.sourcePath);
    if (duplicate && manual?.status === 'verified') {
      fail('A hard duplicate cannot be manually verified', {
        sourcePath: document.sourcePath,
        duplicate,
      });
    }

    const mapping = mapDocumentToCurriculum(document, input.pack);
    const base = {
      id: resourceId(document),
      sourcePath: document.sourcePath,
      canonicalUrl: document.canonicalUrl,
      title: document.title,
      language: document.language,
      subject: 'math' as const,
      stage: 'senior-high' as const,
      examSystem: 'gaokao' as const,
      nodeIds: mapping.ambiguous ? [] : mapping.candidates.slice(0, 3).map((item) => item.nodeId),
      resourceType: inferResourceType(document),
      difficulty: 3,
      qualityScore: qualityScore(document),
      contentHash: document.contentHash,
      excerpt: excerpt(document),
    };

    if (duplicate) {
      resources.push(mathResourceSchema.parse({
        ...base,
        status: 'rejected',
        rejectionReasons: [duplicate.reason + ':' + duplicate.keeperSourcePath],
      }));
      continue;
    }
    if (manual?.status === 'verified') {
      resources.push(mathResourceSchema.parse({
        ...base,
        nodeIds: manual.nodeIds,
        resourceType: manual.resourceType,
        difficulty: manual.difficulty,
        status: 'verified',
        verifiedBy: manual.reviewer,
        verifiedAt: manual.reviewedAt,
        rejectionReasons: [],
      }));
      continue;
    }
    if (manual?.status === 'rejected') {
      resources.push(mathResourceSchema.parse({
        ...base,
        status: 'rejected',
        rejectionReasons: manual.reasons,
      }));
      continue;
    }

    const reasons = ['manual_verification_required'];
    if (mapping.ambiguous) reasons.push('ambiguous_curriculum_mapping');
    if (duplicateDecisions.titleCollisions.has(document.sourcePath)) {
      reasons.push('duplicate_title_collision');
    }
    resources.push(mathResourceSchema.parse({
      ...base,
      status: 'needs-review',
      rejectionReasons: reasons,
    }));
  }

  const statusCounts = {
    verified: resources.filter((item) => item.status === 'verified').length,
    needsReview: resources.filter((item) => item.status === 'needs-review').length,
    rejected: resources.filter((item) => item.status === 'rejected').length,
  };
  const reasonCounts: Record<string, number> = {};
  for (const resource of resources) {
    for (const reason of resource.rejectionReasons) {
      const key = reason.split(':')[0];
      reasonCounts[key] = (reasonCounts[key] ?? 0) + 1;
    }
  }
  const covered = new Set(
    resources.filter((item) => item.status === 'verified').flatMap((item) => item.nodeIds),
  );
  const resourceGapNodeIds = input.pack.nodes
    .map((item) => item.id)
    .filter((nodeId) => !covered.has(nodeId));

  return {
    index: resourceIndexSchema.parse({
      schemaVersion: '1.0.0',
      indexVersion: input.indexVersion,
      curriculumPackId: input.pack.id,
      generatedAt: input.now,
      resources,
    }),
    report: governanceReportSchema.parse({
      schemaVersion: '1.0.0',
      indexVersion: input.indexVersion,
      scanned: input.scanned,
      parsed: input.documents.length,
      statusCounts,
      reasonCounts,
      parseFailures: input.parseFailures,
      resourceGapNodeIds,
    }),
  };
}
```

- [ ] **Step 5: 运行治理测试**

Run: `npm test -- tests/adaptive-learning/resource-governance.test.ts`
Expected: PASS，3 tests passed。

- [ ] **Step 6: 提交治理引擎**

```bash
git add lib/adaptive-learning/resources/governance.ts tests/adaptive-learning/resource-governance.test.ts
git commit -m "feat: govern math resources with explicit states"
```

## Task 7: 可复现资源索引构建器、CLI 与人工验证清单

**Files:**
- Create: `lib/adaptive-learning/resources/index-builder.ts`
- Create: `scripts/build-gaokao-math-resource-index.ts`
- Create: `data/adaptive-learning/gaokao-math/manual-verification.v1.json`
- Generate: `data/adaptive-learning/gaokao-math/resource-index.v1.json`
- Generate: `data/adaptive-learning/gaokao-math/governance-report.v1.json`
- Modify: `package.json:9-22`
- Test: `tests/adaptive-learning/resource-index-builder.test.ts`
- Test: `tests/adaptive-learning/resource-index-cli.test.ts`

- [ ] **Step 1: 写索引构建器的失败测试**

```typescript
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMathResourceIndex } from '@/lib/adaptive-learning/resources/index-builder';

vi.mock('server-only', () => ({}));

const workspaces: string[] = [];

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((item) => rm(item, { recursive: true, force: true })));
});

function markdown(title: string, url: string, body: string): string {
  return [
    '---',
    'title: "' + title + '"',
    'source: "' + url + '"',
    'originalUrl: "' + url + '"',
    'course: "math"',
    'tags: ["math", "high-school"]',
    'wordCount: 500',
    'depth: 1',
    'crawledAt: "2026-07-21T00:00:00.000Z"',
    '---',
    '',
    body.repeat(10),
  ].join('\n');
}

async function createWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'adaptive-index-'));
  workspaces.push(root);
  await mkdir(join(root, 'data/crawled/math'), { recursive: true });
  await mkdir(join(root, 'data/adaptive-learning/gaokao-math'), { recursive: true });
  await writeFile(
    join(root, 'data/crawled/math/approved.md'),
    markdown(
      'Introduction to Derivatives',
      'https://example.com/derivatives',
      'A derivative is an instantaneous rate of change and a tangent slope. ',
    ),
    'utf8',
  );
  await writeFile(
    join(root, 'data/adaptive-learning/gaokao-math/manual-verification.v1.json'),
    JSON.stringify({
      schemaVersion: '1.0.0',
      curriculumPackId: 'gaokao-math-2026.1',
      entries: [{
        sourcePath: 'data/crawled/math/approved.md',
        status: 'verified',
        nodeIds: ['derivative-concept'],
        resourceType: 'concept',
        difficulty: 3,
        reviewer: 'test-reviewer',
        reviewedAt: '2026-07-28T00:00:00.000Z',
        notes: 'Fixture reviewed.',
      }],
    }, null, 2),
    'utf8',
  );
  return root;
}

function input(root: string) {
  return {
    workspaceRoot: root,
    sourceDir: 'data/crawled/math',
    manifestPath: 'data/adaptive-learning/gaokao-math/manual-verification.v1.json',
    indexPath: 'data/adaptive-learning/gaokao-math/resource-index.v1.json',
    reportPath: 'data/adaptive-learning/gaokao-math/governance-report.v1.json',
    curriculumPackId: 'gaokao-math-2026.1',
    indexVersion: '2026-07-28.1',
    generatedAt: '2026-07-28T00:00:00.000Z',
  };
}

describe('math resource index builder', () => {
  it('writes validated deterministic index and report artifacts', async () => {
    const root = await createWorkspace();
    const first = await buildMathResourceIndex(input(root));
    expect(first.report.statusCounts).toEqual({
      verified: 1,
      needsReview: 0,
      rejected: 0,
    });
    expect(first.report.resourceGapNodeIds).toContain('functions-basic');

    const indexFile = join(root, 'data/adaptive-learning/gaokao-math/resource-index.v1.json');
    const reportFile = join(root, 'data/adaptive-learning/gaokao-math/governance-report.v1.json');
    const firstIndexText = await readFile(indexFile, 'utf8');
    const firstReportText = await readFile(reportFile, 'utf8');

    await buildMathResourceIndex(input(root));
    expect(await readFile(indexFile, 'utf8')).toBe(firstIndexText);
    expect(await readFile(reportFile, 'utf8')).toBe(firstReportText);
  });

  it('publishes no artifacts when any crawled document is invalid', async () => {
    const root = await createWorkspace();
    await writeFile(join(root, 'data/crawled/math/broken.md'), 'missing front matter', 'utf8');

    await expect(buildMathResourceIndex(input(root))).rejects.toMatchObject({
      code: 'INVALID_SCHEMA',
      stage: 'resource-index-build',
    });
    await expect(
      access(join(root, 'data/adaptive-learning/gaokao-math/resource-index.v1.json')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(
      access(join(root, 'data/adaptive-learning/gaokao-math/governance-report.v1.json')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects unsafe or colliding output paths', async () => {
    const root = await createWorkspace();
    await expect(buildMathResourceIndex({
      ...input(root),
      indexPath: '../escaped-index.json',
    })).rejects.toMatchObject({
      code: 'INVALID_SCHEMA',
      stage: 'resource-index-build',
    });
    await expect(buildMathResourceIndex({
      ...input(root),
      indexPath: input(root).manifestPath,
    })).rejects.toMatchObject({
      code: 'INVALID_SCHEMA',
      stage: 'resource-index-build',
    });
  });
});
```

- [ ] **Step 2: 运行测试并确认缺少构建器**

Run: `npm test -- tests/adaptive-learning/resource-index-builder.test.ts`
Expected: FAIL，错误包含 `Cannot find module '@/lib/adaptive-learning/resources/index-builder'`。

- [ ] **Step 3: 实现严格扫描、输入校验和单文件原子写入**

```typescript
// lib/adaptive-learning/resources/index-builder.ts
import 'server-only';

import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';
import {
  manualVerificationManifestSchema,
  type ManualVerificationManifest,
} from '@/lib/adaptive-learning/contracts';
import { getCurriculumPack } from '@/lib/adaptive-learning/curriculum/registry';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import {
  parseCrawledMathDocument,
  type CrawledMathDocument,
} from './crawled-document';
import {
  governMathResources,
  type GovernanceResult,
  type ParseFailure,
} from './governance';

export interface BuildMathResourceIndexInput {
  workspaceRoot: string;
  sourceDir: string;
  manifestPath: string;
  indexPath: string;
  reportPath: string;
  curriculumPackId: string;
  indexVersion: string;
  generatedAt: string;
}

function fail(
  code: 'INVALID_SCHEMA' | 'RESOURCE_INDEX_UNAVAILABLE',
  message: string,
  details?: Record<string, unknown>,
  cause?: unknown,
): never {
  throw new AdaptiveLearningError({
    code,
    message,
    retryable: false,
    stage: 'resource-index-build',
    details,
    cause,
  });
}

function resolveWithinWorkspace(rootInput: string, value: string, label: string): string {
  const root = resolve(rootInput);
  const target = resolve(root, value);
  const relativePath = relative(root, target);
  if (
    relativePath === '..' ||
    relativePath.startsWith('..' + sep) ||
    isAbsolute(relativePath)
  ) {
    fail('INVALID_SCHEMA', label + ' must stay inside workspaceRoot', { root, target });
  }
  return target;
}

async function listMarkdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(fullPath);
    return entry.isFile() && entry.name.toLowerCase().endsWith('.md') ? [fullPath] : [];
  }));
  return nested.flat().sort((a, b) => a.localeCompare(b));
}

function normalizedSourcePath(workspaceRoot: string, filePath: string): string {
  return relative(resolve(workspaceRoot), filePath).replaceAll('\\', '/');
}

function parseFailure(sourcePath: string, error: unknown): ParseFailure {
  if (error instanceof AdaptiveLearningError) {
    return { sourcePath, code: error.code, message: error.message };
  }
  return {
    sourcePath,
    code: 'INVALID_SCHEMA',
    message: error instanceof Error ? error.message : String(error),
  };
}

async function readManifest(path: string): Promise<ManualVerificationManifest> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (cause) {
    fail('RESOURCE_INDEX_UNAVAILABLE', 'Unable to read manual verification manifest', {
      path,
    }, cause);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (cause) {
    fail('INVALID_SCHEMA', 'Manual verification manifest is not valid JSON', { path }, cause);
  }
  const parsed = manualVerificationManifestSchema.safeParse(json);
  if (!parsed.success) {
    fail('INVALID_SCHEMA', 'Manual verification manifest schema is invalid', {
      path,
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}

async function writeJsonAtomically(path: string, value: unknown): Promise<void> {
  const temporaryPath = path + '.tmp-' + process.pid + '-' + randomUUID();
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(temporaryPath, JSON.stringify(value, null, 2) + '\n', 'utf8');
    await rename(temporaryPath, path);
  } catch (cause) {
    let cleanupError: string | undefined;
    try {
      await unlink(temporaryPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') cleanupError = String(error);
    }
    fail('RESOURCE_INDEX_UNAVAILABLE', 'Unable to publish generated resource artifact', {
      path,
      cleanupError,
    }, cause);
  }
}

export async function buildMathResourceIndex(
  input: BuildMathResourceIndexInput,
): Promise<GovernanceResult> {
  const workspaceRoot = resolve(input.workspaceRoot);
  const sourceDirectory = resolveWithinWorkspace(workspaceRoot, input.sourceDir, 'sourceDir');
  const manifestPath = resolveWithinWorkspace(workspaceRoot, input.manifestPath, 'manifestPath');
  const indexPath = resolveWithinWorkspace(workspaceRoot, input.indexPath, 'indexPath');
  const reportPath = resolveWithinWorkspace(workspaceRoot, input.reportPath, 'reportPath');
  if (new Set([manifestPath, indexPath, reportPath]).size !== 3) {
    fail('INVALID_SCHEMA', 'Manifest, index, and report paths must be distinct', {
      manifestPath,
      indexPath,
      reportPath,
    });
  }

  let sourceFiles: string[];
  try {
    sourceFiles = await listMarkdownFiles(sourceDirectory);
  } catch (cause) {
    fail('RESOURCE_INDEX_UNAVAILABLE', 'Unable to scan crawled math source directory', {
      sourceDirectory,
    }, cause);
  }
  if (sourceFiles.length === 0) {
    fail('INVALID_SCHEMA', 'Crawled math source directory contains no Markdown files', {
      sourceDirectory,
    });
  }

  const documents: CrawledMathDocument[] = [];
  const failures: ParseFailure[] = [];
  for (const filePath of sourceFiles) {
    const sourcePath = normalizedSourcePath(workspaceRoot, filePath);
    let markdown: string;
    try {
      markdown = await readFile(filePath, 'utf8');
    } catch (cause) {
      fail('RESOURCE_INDEX_UNAVAILABLE', 'Unable to read crawled math document', {
        sourcePath,
      }, cause);
    }
    try {
      documents.push(parseCrawledMathDocument(sourcePath, markdown));
    } catch (error) {
      failures.push(parseFailure(sourcePath, error));
    }
  }
  if (failures.length > 0) {
    fail('INVALID_SCHEMA', 'One or more crawled math documents are invalid', {
      parseFailures: failures,
    });
  }

  const manifest = await readManifest(manifestPath);
  const pack = getCurriculumPack(input.curriculumPackId);
  const result = governMathResources({
    documents,
    manifest,
    pack,
    indexVersion: input.indexVersion,
    now: input.generatedAt,
    scanned: sourceFiles.length,
    parseFailures: [],
  });

  // The report is diagnostic; the runtime index is published last as the commit point.
  await writeJsonAtomically(reportPath, result.report);
  await writeJsonAtomically(indexPath, result.index);
  return result;
}
```

成功构建时 `parseFailures` 必须为空。扫描期间若发现任一非法文件，错误详情中返回完整失败列表，但不得写出部分索引或“跳过坏文件继续成功”。

- [ ] **Step 4: 写 CLI 参数和错误暴露的失败测试**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import {
  parseResourceIndexCliArgs,
  runResourceIndexCli,
} from '@/scripts/build-gaokao-math-resource-index';

vi.mock('server-only', () => ({}));

const validArgs = [
  '--workspace-root', '.',
  '--source-dir', 'data/crawled/math',
  '--manifest', 'data/adaptive-learning/gaokao-math/manual-verification.v1.json',
  '--index', 'data/adaptive-learning/gaokao-math/resource-index.v1.json',
  '--report', 'data/adaptive-learning/gaokao-math/governance-report.v1.json',
  '--pack', 'gaokao-math-2026.1',
  '--index-version', '2026-07-28.1',
  '--generated-at', '2026-07-28T00:00:00.000Z',
];

describe('math resource index CLI', () => {
  it('parses every required argument and rejects unknown flags', () => {
    expect(parseResourceIndexCliArgs(validArgs)).toEqual({
      workspaceRoot: '.',
      sourceDir: 'data/crawled/math',
      manifestPath: 'data/adaptive-learning/gaokao-math/manual-verification.v1.json',
      indexPath: 'data/adaptive-learning/gaokao-math/resource-index.v1.json',
      reportPath: 'data/adaptive-learning/gaokao-math/governance-report.v1.json',
      curriculumPackId: 'gaokao-math-2026.1',
      indexVersion: '2026-07-28.1',
      generatedAt: '2026-07-28T00:00:00.000Z',
    });
    expect(() => parseResourceIndexCliArgs([...validArgs, '--unknown', 'x']))
      .toThrow(/Unknown CLI option/);
  });

  it('returns zero only after a successful build', async () => {
    const output: string[] = [];
    const build = vi.fn().mockResolvedValue({
      report: {
        statusCounts: { verified: 6, needsReview: 884, rejected: 25 },
        resourceGapNodeIds: ['statistics'],
      },
    });
    const code = await runResourceIndexCli(validArgs, {
      build,
      stdout: { write: (value) => output.push(value) },
      stderr: { write: vi.fn() },
    });
    expect(code).toBe(0);
    expect(build).toHaveBeenCalledOnce();
    expect(output.join('')).toContain('"verified":6');
  });

  it('returns nonzero and exposes the structured stage error', async () => {
    const errors: string[] = [];
    const build = vi.fn().mockRejectedValue(new AdaptiveLearningError({
      code: 'INVALID_SCHEMA',
      message: 'broken source',
      retryable: false,
      stage: 'resource-index-build',
      details: { sourcePath: 'broken.md' },
    }));
    const code = await runResourceIndexCli(validArgs, {
      build,
      stdout: { write: vi.fn() },
      stderr: { write: (value) => errors.push(value) },
    });
    expect(code).toBe(1);
    expect(errors.join('')).toContain('"code":"INVALID_SCHEMA"');
    expect(errors.join('')).toContain('"stage":"resource-index-build"');
  });
});
```

- [ ] **Step 5: 运行 CLI 测试并确认脚本不存在**

Run: `npm test -- tests/adaptive-learning/resource-index-cli.test.ts`
Expected: FAIL，错误包含 `Cannot find module '@/scripts/build-gaokao-math-resource-index'`。

- [ ] **Step 6: 实现严格 CLI**

```typescript
// scripts/build-gaokao-math-resource-index.ts
import { pathToFileURL } from 'node:url';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import {
  buildMathResourceIndex,
  type BuildMathResourceIndexInput,
} from '@/lib/adaptive-learning/resources/index-builder';

interface TextWriter {
  write(value: string): unknown;
}

interface CliBuildResult {
  report: {
    statusCounts: {
      verified: number;
      needsReview: number;
      rejected: number;
    };
    resourceGapNodeIds: string[];
  };
}

export interface ResourceIndexCliDependencies {
  build(input: BuildMathResourceIndexInput): Promise<CliBuildResult>;
  stdout: TextWriter;
  stderr: TextWriter;
}

const optionMap: Record<string, keyof BuildMathResourceIndexInput> = {
  '--workspace-root': 'workspaceRoot',
  '--source-dir': 'sourceDir',
  '--manifest': 'manifestPath',
  '--index': 'indexPath',
  '--report': 'reportPath',
  '--pack': 'curriculumPackId',
  '--index-version': 'indexVersion',
  '--generated-at': 'generatedAt',
};

export function parseResourceIndexCliArgs(argv: string[]): BuildMathResourceIndexInput {
  const values: Partial<Record<keyof BuildMathResourceIndexInput, string>> = {};
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const key = optionMap[option];
    if (!key) throw new Error('Unknown CLI option: ' + option);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error('Missing value for CLI option: ' + option);
    }
    if (values[key]) throw new Error('Duplicate CLI option: ' + option);
    values[key] = value;
  }

  const missing = Object.values(optionMap).filter((key) => !values[key]);
  if (missing.length > 0) {
    throw new Error('Missing required CLI options: ' + missing.join(', '));
  }
  return values as unknown as BuildMathResourceIndexInput;
}

function structuredCliError(error: unknown): Record<string, unknown> {
  if (error instanceof AdaptiveLearningError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      stage: error.stage,
      details: error.details ?? {},
    };
  }
  return {
    code: 'RESOURCE_INDEX_UNAVAILABLE',
    message: error instanceof Error ? error.message : String(error),
    retryable: false,
    stage: 'resource-index-cli',
    details: {},
  };
}

export async function runResourceIndexCli(
  argv: string[],
  dependencies: ResourceIndexCliDependencies = {
    build: buildMathResourceIndex,
    stdout: process.stdout,
    stderr: process.stderr,
  },
): Promise<number> {
  try {
    const result = await dependencies.build(parseResourceIndexCliArgs(argv));
    dependencies.stdout.write(JSON.stringify({
      success: true,
      statusCounts: result.report.statusCounts,
      resourceGapNodeIds: result.report.resourceGapNodeIds,
    }) + '\n');
    return 0;
  } catch (error) {
    dependencies.stderr.write(JSON.stringify({
      success: false,
      error: structuredCliError(error),
    }) + '\n');
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runResourceIndexCli(process.argv.slice(2));
}
```

- [ ] **Step 7: 创建六份人工验证记录**

```json
{
  "schemaVersion": "1.0.0",
  "curriculumPackId": "gaokao-math-2026.1",
  "entries": [
    {
      "sourcePath": "data/crawled/math/What-is-a-Function-15e6c608.md",
      "status": "verified",
      "nodeIds": ["functions-basic"],
      "resourceType": "concept",
      "difficulty": 2,
      "reviewer": "project-owner",
      "reviewedAt": "2026-07-28T00:00:00.000Z",
      "notes": "已复核来源、数学学科、函数定义内容和课程节点映射。"
    },
    {
      "sourcePath": "data/crawled/math/Introduction-to-Derivatives-242a8f27.md",
      "status": "verified",
      "nodeIds": ["derivative-concept"],
      "resourceType": "concept",
      "difficulty": 3,
      "reviewer": "project-owner",
      "reviewedAt": "2026-07-28T00:00:00.000Z",
      "notes": "已复核导数定义、瞬时变化率和切线斜率内容。"
    },
    {
      "sourcePath": "data/crawled/math/Finding-Maxima-and-Minima-using-Derivatives-8844c91f.md",
      "status": "verified",
      "nodeIds": ["derivative-applications"],
      "resourceType": "worked-example",
      "difficulty": 4,
      "reviewer": "project-owner",
      "reviewedAt": "2026-07-28T00:00:00.000Z",
      "notes": "已复核导数求极值、最值示例和课程节点映射。"
    },
    {
      "sourcePath": "data/crawled/math/Arithmetic-Sequences-and-Sums-58b77756.md",
      "status": "verified",
      "nodeIds": ["sequences"],
      "resourceType": "worked-example",
      "difficulty": 3,
      "reviewer": "project-owner",
      "reviewedAt": "2026-07-28T00:00:00.000Z",
      "notes": "已复核等差数列通项、求和与示例内容。"
    },
    {
      "sourcePath": "data/crawled/math/Conditional-Probability-97b27e03.md",
      "status": "verified",
      "nodeIds": ["probability"],
      "resourceType": "worked-example",
      "difficulty": 3,
      "reviewer": "project-owner",
      "reviewedAt": "2026-07-28T00:00:00.000Z",
      "notes": "已复核条件概率、独立事件和树状图示例。"
    },
    {
      "sourcePath": "data/crawled/math/Trigonometric-Identities-500b187f.md",
      "status": "verified",
      "nodeIds": ["trigonometry"],
      "resourceType": "concept",
      "difficulty": 3,
      "reviewer": "project-owner",
      "reviewedAt": "2026-07-28T00:00:00.000Z",
      "notes": "已复核三角恒等式、基本关系和课程节点映射。"
    }
  ]
}
```

保存为 `data/adaptive-learning/gaokao-math/manual-verification.v1.json`。任何新增 `verified` 项都必须经过相同人工复核，不允许仅凭关键词打分自动进入该清单。

- [ ] **Step 8: 增加固定输入的可复现构建命令**

在 `package.json` 的 `scripts` 中增加：

```json
"adaptive:resources": "tsx scripts/build-gaokao-math-resource-index.ts --workspace-root . --source-dir data/crawled/math --manifest data/adaptive-learning/gaokao-math/manual-verification.v1.json --index data/adaptive-learning/gaokao-math/resource-index.v1.json --report data/adaptive-learning/gaokao-math/governance-report.v1.json --pack gaokao-math-2026.1 --index-version 2026-07-28.1 --generated-at 2026-07-28T00:00:00.000Z"
```

`index-version` 和 `generated-at` 是版本输入，不在脚本中使用当前时间。清单、课程包或治理算法发生实质变化时必须显式提升版本并更新这两个值。

- [ ] **Step 9: 运行构建器与 CLI 测试**

Run: `npm test -- tests/adaptive-learning/resource-index-builder.test.ts tests/adaptive-learning/resource-index-cli.test.ts`
Expected: PASS，6 tests passed。

- [ ] **Step 10: 生成真实索引和治理报告**

Run: `npm run adaptive:resources`
Expected: exit 0，标准输出包含：

```json
{
  "success": true,
  "statusCounts": {
    "verified": 6,
    "needsReview": 884,
    "rejected": 25
  },
  "resourceGapNodeIds": [
    "functions-properties",
    "statistics",
    "analytic-geometry",
    "solid-geometry",
    "complex-numbers",
    "inequalities"
  ]
}
```

同时确认：

- `resource-index.v1.json` 通过 `resourceIndexSchema`，共 915 条资源。
- `governance-report.v1.json` 的 `scanned = 915`、`parsed = 915`、`parseFailures = []`。
- 六份清单资源为 `verified`；其余状态不得被自动提升。
- 任一输入非法时命令非零退出，且不发布新的运行时索引。
- 当前 915 份 `data/crawled/math` 文档是构建时输入，不在本 Task 的 `git add` 范围内；需要在干净 CI 中重建时，必须先供应字节一致的数据集。运行时只使用已提交索引，不会隐式重新抓取或生成。

- [ ] **Step 11: 提交构建器、清单和生成物**

```bash
git add package.json lib/adaptive-learning/resources/index-builder.ts scripts/build-gaokao-math-resource-index.ts tests/adaptive-learning/resource-index-builder.test.ts tests/adaptive-learning/resource-index-cli.test.ts data/adaptive-learning/gaokao-math
git commit -m "feat: build governed gaokao math resource index"
```

## Task 8: verified-only 文件仓库、嵌套错误响应与认证 API

**Files:**
- Modify: `lib/adaptive-learning/contracts/resource.ts`
- Create: `lib/adaptive-learning/resources/repository.ts`
- Create: `lib/adaptive-learning/api-error.ts`
- Create: `lib/adaptive-learning/index.ts`
- Create: `app/api/sky/math-resources/route.ts`
- Test: `tests/adaptive-learning/resource-repository.test.ts`
- Test: `tests/api/math-resources.test.ts`

- [ ] **Step 1: 写 verified-only 仓库的失败测试**

```typescript
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MathResource, ResourceIndex } from '@/lib/adaptive-learning/contracts';
import { FileMathResourceRepository } from '@/lib/adaptive-learning/resources/repository';

vi.mock('server-only', () => ({}));

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((item) => rm(item, { recursive: true, force: true })));
});

function resource(
  id: string,
  status: MathResource['status'],
  overrides: Partial<MathResource> = {},
): MathResource {
  return {
    id,
    sourcePath: 'data/crawled/math/' + id + '.md',
    canonicalUrl: 'https://example.com/' + id,
    title: id,
    language: 'en',
    subject: 'math',
    stage: 'senior-high',
    examSystem: 'gaokao',
    nodeIds: ['derivative-concept'],
    resourceType: 'concept',
    difficulty: 3,
    qualityScore: 0.9,
    contentHash: id.slice(5).padEnd(64, 'a'),
    excerpt: 'A verified derivative explanation.',
    status,
    ...(status === 'verified' ? {
      verifiedBy: 'reviewer-1',
      verifiedAt: '2026-07-28T00:00:00.000Z',
      rejectionReasons: [],
    } : {
      rejectionReasons: ['manual_verification_required'],
    }),
    ...overrides,
  };
}

async function writeIndex(value: unknown): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'adaptive-repository-'));
  directories.push(directory);
  const path = join(directory, 'resource-index.json');
  await writeFile(path, JSON.stringify(value, null, 2), 'utf8');
  return path;
}

function index(resources: MathResource[]): ResourceIndex {
  return {
    schemaVersion: '1.0.0',
    indexVersion: '2026-07-28.1',
    curriculumPackId: 'gaokao-math-2026.1',
    generatedAt: '2026-07-28T00:00:00.000Z',
    resources,
  };
}

describe('FileMathResourceRepository', () => {
  it('returns only verified resources after applying strict filters', async () => {
    const verified = resource('math_1111111111111111', 'verified');
    const pending = resource('math_2222222222222222', 'needs-review', {
      qualityScore: 1,
    });
    const indexPath = await writeIndex(index([pending, verified]));
    const repository = new FileMathResourceRepository({
      indexPath,
      expectedCurriculumPackId: 'gaokao-math-2026.1',
    });

    const result = await repository.findVerified({
      nodeId: 'derivative-concept',
      resourceType: 'concept',
      maxDifficulty: 3,
      limit: 20,
    });
    expect(result.resources.map((item) => item.id)).toEqual([verified.id]);
    expect(result.resources.every((item) => item.status === 'verified')).toBe(true);
  });

  it('returns RESOURCE_GAP instead of widening the query', async () => {
    const indexPath = await writeIndex(index([
      resource('math_1111111111111111', 'verified'),
    ]));
    const repository = new FileMathResourceRepository({
      indexPath,
      expectedCurriculumPackId: 'gaokao-math-2026.1',
    });

    await expect(repository.findVerified({
      nodeId: 'statistics',
      resourceType: 'worked-example',
      limit: 20,
    })).rejects.toMatchObject({
      code: 'RESOURCE_GAP',
      retryable: false,
      stage: 'resource-query',
      details: {
        nodeIds: ['statistics'],
        expectedResourceType: 'worked-example',
      },
    });
  });

  it('fails explicitly for an invalid or mismatched index', async () => {
    const invalidPath = await writeIndex({ unexpected: true });
    await expect(new FileMathResourceRepository({
      indexPath: invalidPath,
      expectedCurriculumPackId: 'gaokao-math-2026.1',
    }).findVerified({ limit: 20 })).rejects.toMatchObject({
      code: 'RESOURCE_INDEX_UNAVAILABLE',
      stage: 'resource-index-read',
    });

    const mismatchPath = await writeIndex({
      ...index([]),
      curriculumPackId: 'gaokao-math-2027.1',
    });
    await expect(new FileMathResourceRepository({
      indexPath: mismatchPath,
      expectedCurriculumPackId: 'gaokao-math-2026.1',
    }).findVerified({ limit: 20 })).rejects.toMatchObject({
      code: 'CURRICULUM_VERSION_MISMATCH',
      stage: 'resource-index-read',
    });
  });
});
```

- [ ] **Step 2: 运行仓库测试并确认模块不存在**

Run: `npm test -- tests/adaptive-learning/resource-repository.test.ts`
Expected: FAIL，错误包含 `Cannot find module '@/lib/adaptive-learning/resources/repository'`。

- [ ] **Step 3: 增加查询结果契约并实现只读文件仓库**

在 `lib/adaptive-learning/contracts/resource.ts` 中，紧接 `mathResourceQuerySchema` 后增加：

```typescript
export const mathResourceQueryResultSchema = z.object({
  curriculumPackId: z.string().min(1),
  indexVersion: z.string().min(1),
  resources: z.array(mathResourceSchema),
}).strict().superRefine((result, ctx) => {
  for (const resource of result.resources) {
    if (resource.status !== 'verified') {
      ctx.addIssue({
        code: 'custom',
        message: 'resource query results must contain only verified resources',
      });
    }
  }
});

export type MathResourceQueryResult = z.infer<typeof mathResourceQueryResultSchema>;
```

创建仓库：

```typescript
// lib/adaptive-learning/resources/repository.ts
import 'server-only';

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  mathResourceQueryResultSchema,
  mathResourceQuerySchema,
  resourceIndexSchema,
  type MathResourceQuery,
  type MathResourceQueryResult,
  type ResourceIndex,
} from '@/lib/adaptive-learning/contracts';
import {
  AdaptiveLearningError,
  type AdaptiveLearningErrorCode,
} from '@/lib/adaptive-learning/errors';

export interface FileMathResourceRepositoryOptions {
  indexPath: string;
  expectedCurriculumPackId: string;
}

function fail(
  code: AdaptiveLearningErrorCode,
  message: string,
  stage: 'resource-index-read' | 'resource-query',
  details?: Record<string, unknown>,
  cause?: unknown,
): never {
  throw new AdaptiveLearningError({
    code,
    message,
    retryable: false,
    stage,
    details,
    cause,
  });
}

export class FileMathResourceRepository {
  constructor(private readonly options: FileMathResourceRepositoryOptions) {}

  private async readIndex(): Promise<ResourceIndex> {
    let raw: string;
    try {
      raw = await readFile(this.options.indexPath, 'utf8');
    } catch (cause) {
      fail('RESOURCE_INDEX_UNAVAILABLE', 'Verified math resource index cannot be read',
        'resource-index-read', { indexPath: this.options.indexPath }, cause);
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (cause) {
      fail('RESOURCE_INDEX_UNAVAILABLE', 'Verified math resource index is not valid JSON',
        'resource-index-read', { indexPath: this.options.indexPath }, cause);
    }
    const parsed = resourceIndexSchema.safeParse(json);
    if (!parsed.success) {
      fail('RESOURCE_INDEX_UNAVAILABLE', 'Verified math resource index schema is invalid',
        'resource-index-read', {
          indexPath: this.options.indexPath,
          issues: parsed.error.issues,
        });
    }
    if (parsed.data.curriculumPackId !== this.options.expectedCurriculumPackId) {
      fail('CURRICULUM_VERSION_MISMATCH', 'Resource index curriculum pack does not match',
        'resource-index-read', {
          expected: this.options.expectedCurriculumPackId,
          actual: parsed.data.curriculumPackId,
        });
    }
    return parsed.data;
  }

  async findVerified(input: MathResourceQuery): Promise<MathResourceQueryResult> {
    const parsedQuery = mathResourceQuerySchema.safeParse(input);
    if (!parsedQuery.success) {
      fail('INVALID_SCHEMA', 'Math resource query schema is invalid', 'resource-query', {
        issues: parsedQuery.error.issues,
      });
    }
    const query = parsedQuery.data;
    const index = await this.readIndex();
    const resources = index.resources
      .filter((item) => item.status === 'verified')
      .filter((item) => !query.nodeId || item.nodeIds.includes(query.nodeId))
      .filter((item) => !query.resourceType || item.resourceType === query.resourceType)
      .filter((item) => !query.maxDifficulty || item.difficulty <= query.maxDifficulty)
      .sort(
        (a, b) =>
          b.qualityScore - a.qualityScore ||
          a.difficulty - b.difficulty ||
          a.id.localeCompare(b.id),
      )
      .slice(0, query.limit);

    if (resources.length === 0) {
      fail('RESOURCE_GAP', 'No verified math resource matches the requested constraints',
        'resource-query', {
          nodeIds: query.nodeId ? [query.nodeId] : [],
          expectedResourceType: query.resourceType ?? null,
          maxDifficulty: query.maxDifficulty ?? null,
        });
    }

    return mathResourceQueryResultSchema.parse({
      curriculumPackId: index.curriculumPackId,
      indexVersion: index.indexVersion,
      resources,
    });
  }
}

export const DEFAULT_GAOKAO_MATH_RESOURCE_INDEX = resolve(
  process.cwd(),
  'data/adaptive-learning/gaokao-math/resource-index.v1.json',
);

export function createGaokaoMathResourceRepository(): FileMathResourceRepository {
  return new FileMathResourceRepository({
    indexPath: DEFAULT_GAOKAO_MATH_RESOURCE_INDEX,
    expectedCurriculumPackId: 'gaokao-math-2026.1',
  });
}
```

- [ ] **Step 4: 运行仓库测试**

Run: `npm test -- tests/adaptive-learning/resource-repository.test.ts`
Expected: PASS，3 tests passed。

- [ ] **Step 5: 写认证、查询、缺口和索引失败的 API 测试**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findVerified: vi.fn(),
}));

vi.mock('@/lib/server/auth/helpers', () => ({
  requireAuth: mocks.requireAuth,
}));

vi.mock('@/lib/adaptive-learning/resources/repository', () => ({
  createGaokaoMathResourceRepository: () => ({
    findVerified: mocks.findVerified,
  }),
}));

import { GET } from '@/app/api/sky/math-resources/route';

function request(query = ''): NextRequest {
  return new NextRequest('http://localhost/api/sky/math-resources' + query, {
    headers: { 'x-correlation-id': 'correlation-test-1' },
  });
}

describe('GET /api/sky/math-resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('returns a nested UNAUTHENTICATED error', async () => {
    mocks.requireAuth.mockResolvedValue({
      error: NextResponse.json({ success: false }, { status: 401 }),
    });
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Not authenticated',
        retryable: false,
        stage: 'math-resources-api',
        details: {},
        correlationId: 'correlation-test-1',
      },
    });
  });

  it('returns a structured 503 when authentication lookup fails', async () => {
    mocks.requireAuth.mockRejectedValue(new Error('user storage unavailable'));
    const response = await GET(request());
    const payload = await response.json();
    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('SYNC_FAILED');
    expect(payload.error.stage).toBe('math-resources-auth');
  });

  it('rejects unknown or malformed query parameters strictly', async () => {
    const response = await GET(request('?unknown=true'));
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('INVALID_SCHEMA');
    expect(payload.error.stage).toBe('math-resources-api');
    expect(mocks.findVerified).not.toHaveBeenCalled();
  });

  it('returns repository results with the same correlation id', async () => {
    mocks.findVerified.mockResolvedValue({
      curriculumPackId: 'gaokao-math-2026.1',
      indexVersion: '2026-07-28.1',
      resources: [{
        id: 'math_1111111111111111',
        status: 'verified',
      }],
    });
    const response = await GET(request('?nodeId=derivative-concept&limit=5'));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.correlationId).toBe('correlation-test-1');
    expect(payload.data.resources[0].status).toBe('verified');
    expect(mocks.findVerified).toHaveBeenCalledWith({
      nodeId: 'derivative-concept',
      limit: 5,
    });
  });

  it('exposes RESOURCE_GAP without querying another subject or state', async () => {
    mocks.findVerified.mockRejectedValue(new AdaptiveLearningError({
      code: 'RESOURCE_GAP',
      message: 'No verified resource',
      retryable: false,
      stage: 'resource-query',
      details: {
        nodeIds: ['statistics'],
        expectedResourceType: 'worked-example',
      },
    }));
    const response = await GET(request('?nodeId=statistics&resourceType=worked-example'));
    const payload = await response.json();
    expect(response.status).toBe(404);
    expect(payload.error.code).toBe('RESOURCE_GAP');
    expect(payload.error.details.nodeIds).toEqual(['statistics']);
    expect(mocks.findVerified).toHaveBeenCalledOnce();
  });

  it('returns 503 when the trusted index is unavailable', async () => {
    mocks.findVerified.mockRejectedValue(new AdaptiveLearningError({
      code: 'RESOURCE_INDEX_UNAVAILABLE',
      message: 'Index invalid',
      retryable: false,
      stage: 'resource-index-read',
    }));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('RESOURCE_INDEX_UNAVAILABLE');
  });
});
```

- [ ] **Step 6: 运行 API 测试并确认路由不存在**

Run: `npm test -- tests/api/math-resources.test.ts`
Expected: FAIL，错误包含 `Cannot find module '@/app/api/sky/math-resources/route'`。

- [ ] **Step 7: 实现嵌套自适应学习错误响应**

```typescript
// lib/adaptive-learning/api-error.ts
import 'server-only';

import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  AdaptiveLearningError,
  type AdaptiveLearningErrorCode,
} from './errors';

export interface AdaptiveLearningApiErrorBody {
  success: false;
  error: {
    code: AdaptiveLearningErrorCode;
    message: string;
    retryable: boolean;
    stage: string;
    details: Record<string, unknown>;
    correlationId: string;
  };
}

const statusByCode: Record<AdaptiveLearningErrorCode, number> = {
  INVALID_SCHEMA: 400,
  AMBIGUOUS_CURRICULUM_MAPPING: 409,
  RESOURCE_GAP: 404,
  RESOURCE_INDEX_UNAVAILABLE: 503,
  PLAN_CONSTRAINT_VIOLATION: 409,
  DUPLICATE_EVENT: 409,
  SYNC_FAILED: 503,
  UNAUTHENTICATED: 401,
  CURRICULUM_VERSION_MISMATCH: 409,
  RETRY_EXHAUSTED: 503,
};

export function createCorrelationId(requestValue?: string | null): string {
  return requestValue?.trim() || randomUUID();
}

function normalizeError(error: unknown): AdaptiveLearningError {
  if (error instanceof AdaptiveLearningError) return error;
  return new AdaptiveLearningError({
    code: 'RESOURCE_INDEX_UNAVAILABLE',
    message: error instanceof Error ? error.message : 'Unknown adaptive learning error',
    retryable: false,
    stage: 'math-resources-api',
    cause: error,
  });
}

export function adaptiveLearningApiError(
  error: unknown,
  correlationId: string,
): NextResponse<AdaptiveLearningApiErrorBody> {
  const normalized = normalizeError(error);
  return NextResponse.json({
    success: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      retryable: normalized.retryable,
      stage: normalized.stage,
      details: normalized.details ?? {},
      correlationId,
    },
  }, { status: statusByCode[normalized.code] });
}
```

- [ ] **Step 8: 实现认证路由和模块导出**

```typescript
// app/api/sky/math-resources/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { mathResourceQuerySchema } from '@/lib/adaptive-learning/contracts';
import {
  adaptiveLearningApiError,
  createCorrelationId,
} from '@/lib/adaptive-learning/api-error';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import {
  createGaokaoMathResourceRepository,
} from '@/lib/adaptive-learning/resources/repository';
import { requireAuth } from '@/lib/server/auth/helpers';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = createCorrelationId(request.headers.get('x-correlation-id'));
  let auth: Awaited<ReturnType<typeof requireAuth>>;
  try {
    auth = await requireAuth();
  } catch (cause) {
    return adaptiveLearningApiError(new AdaptiveLearningError({
      code: 'SYNC_FAILED',
      message: 'Authentication state could not be loaded',
      retryable: true,
      stage: 'math-resources-auth',
      details: {
        causeType: cause instanceof Error ? cause.name : typeof cause,
      },
      cause,
    }), correlationId);
  }
  if ('error' in auth) {
    return adaptiveLearningApiError(new AdaptiveLearningError({
      code: 'UNAUTHENTICATED',
      message: 'Not authenticated',
      retryable: false,
      stage: 'math-resources-api',
    }), correlationId);
  }

  const query = mathResourceQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  if (!query.success) {
    return adaptiveLearningApiError(new AdaptiveLearningError({
      code: 'INVALID_SCHEMA',
      message: 'Math resource query is invalid',
      retryable: false,
      stage: 'math-resources-api',
      details: { issues: query.error.issues },
    }), correlationId);
  }

  try {
    const repository = createGaokaoMathResourceRepository();
    const result = await repository.findVerified(query.data);
    return NextResponse.json({
      success: true,
      data: result,
      correlationId,
    });
  } catch (error) {
    return adaptiveLearningApiError(error, correlationId);
  }
}
```

```typescript
// lib/adaptive-learning/index.ts
export * from './contracts';
export * from './errors';
export {
  GAOKAO_MATH_PACK_V1,
  getCurriculumPack,
  validateCurriculumPack,
} from './curriculum/registry';
```

文件仓库和 API 错误工具保持显式 server-only 导入，不从通用入口导出，避免客户端 bundle 误引入 `node:fs` 或 `next/server`。

- [ ] **Step 9: 运行仓库与 API 测试**

Run: `npm test -- tests/adaptive-learning/resource-repository.test.ts tests/api/math-resources.test.ts`
Expected: PASS，9 tests passed。

- [ ] **Step 10: 提交 verified-only 查询接口**

```bash
git add lib/adaptive-learning/contracts/resource.ts lib/adaptive-learning/resources/repository.ts lib/adaptive-learning/api-error.ts lib/adaptive-learning/index.ts app/api/sky/math-resources/route.ts tests/adaptive-learning/resource-repository.test.ts tests/api/math-resources.test.ts
git commit -m "feat: expose verified gaokao math resources"
```

## Task 9: 真实索引集成验收、治理文档与两阶段审查

**Files:**
- Create: `tests/integration/adaptive-learning-resource-flow.test.ts`
- Create: `docs/adaptive-learning/resource-governance.md`

- [ ] **Step 1: 增加提交态真实索引集成测试**

```typescript
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  governanceReportSchema,
  resourceIndexSchema,
} from '@/lib/adaptive-learning/contracts';
import { FileMathResourceRepository } from '@/lib/adaptive-learning/resources/repository';

vi.mock('server-only', () => ({}));

const dataDirectory = resolve(
  process.cwd(),
  'data/adaptive-learning/gaokao-math',
);
const indexPath = resolve(dataDirectory, 'resource-index.v1.json');
const reportPath = resolve(dataDirectory, 'governance-report.v1.json');

const verifiedSeedCoverage = new Map<string, string[]>([
  ['data/crawled/math/What-is-a-Function-15e6c608.md', ['functions-basic']],
  ['data/crawled/math/Introduction-to-Derivatives-242a8f27.md', ['derivative-concept']],
  [
    'data/crawled/math/Finding-Maxima-and-Minima-using-Derivatives-8844c91f.md',
    ['derivative-applications'],
  ],
  ['data/crawled/math/Arithmetic-Sequences-and-Sums-58b77756.md', ['sequences']],
  ['data/crawled/math/Conditional-Probability-97b27e03.md', ['probability']],
  ['data/crawled/math/Trigonometric-Identities-500b187f.md', ['trigonometry']],
]);

describe('committed adaptive learning resource flow', () => {
  it('validates the real governed artifacts and their audited baseline', async () => {
    const index = resourceIndexSchema.parse(
      JSON.parse(await readFile(indexPath, 'utf8')),
    );
    const report = governanceReportSchema.parse(
      JSON.parse(await readFile(reportPath, 'utf8')),
    );
    const verified = index.resources.filter((item) => item.status === 'verified');

    expect(index.curriculumPackId).toBe('gaokao-math-2026.1');
    expect(index.indexVersion).toBe('2026-07-28.1');
    expect(index.resources).toHaveLength(915);
    expect(report).toEqual(expect.objectContaining({
      scanned: 915,
      parsed: 915,
      parseFailures: [],
      statusCounts: {
        verified: 6,
        needsReview: 884,
        rejected: 25,
      },
      resourceGapNodeIds: [
        'functions-properties',
        'statistics',
        'analytic-geometry',
        'solid-geometry',
        'complex-numbers',
        'inequalities',
      ],
    }));
    expect(
      verified.map((item) => item.sourcePath).sort(),
    ).toEqual([...verifiedSeedCoverage.keys()].sort());
    for (const item of verified) {
      expect(item.nodeIds).toEqual(verifiedSeedCoverage.get(item.sourcePath));
      expect(item.verifiedBy).toBe('project-owner');
      expect(item.verifiedAt).toBe('2026-07-28T00:00:00.000Z');
    }
  });

  it('serves all and only the verified seed set, then exposes a real gap', async () => {
    const repository = new FileMathResourceRepository({
      indexPath,
      expectedCurriculumPackId: 'gaokao-math-2026.1',
    });
    const all = await repository.findVerified({ limit: 100 });
    expect(all.resources).toHaveLength(6);
    expect(all.resources.every((item) => item.status === 'verified')).toBe(true);
    expect(all.resources.map((item) => item.sourcePath).sort())
      .toEqual([...verifiedSeedCoverage.keys()].sort());

    await expect(repository.findVerified({
      nodeId: 'statistics',
      limit: 20,
    })).rejects.toMatchObject({
      code: 'RESOURCE_GAP',
      retryable: false,
      details: { nodeIds: ['statistics'] },
    });
  });
});
```

- [ ] **Step 2: 运行真实索引集成测试**

Run: `npm test -- tests/integration/adaptive-learning-resource-flow.test.ts`
Expected: PASS，2 tests passed。若数量、状态、验证人、课程节点或缺口发生漂移，测试必须失败并要求提升索引版本，不能放宽断言。

- [ ] **Step 3: 提交真实数据验收测试**

```bash
git add tests/integration/adaptive-learning-resource-flow.test.ts
git commit -m "test: verify trusted math resource flow"
```

- [ ] **Step 4: 编写资源治理运维文档**

````markdown
# 高考数学资源治理与索引运维

## 不变量

- 运行时只查询 `data/adaptive-learning/gaokao-math/resource-index.v1.json`。
- 只有 `status = verified` 的资源可以返回给计划器、RAG 或 API 调用方。
- `needs-review` 和 `rejected` 永远不能通过扩大关键词、跨节点、跨学科或读取旧存储进入结果。
- 没有匹配资源时返回 `RESOURCE_GAP`；索引缺失、JSON 损坏或 Schema 无效时返回 `RESOURCE_INDEX_UNAVAILABLE`。
- 任何生成成功的索引必须对应一个明确的课程包版本、索引版本、生成时间和人工验证清单。

## 三个版本化产物

| 文件 | 谁可以修改 | 作用 |
|---|---|---|
| `manual-verification.v1.json` | 人工审核者 | 批准或拒绝具体源文件，并记录节点、类型、难度、审核者和时间 |
| `resource-index.v1.json` | 仅构建命令 | 保存全部治理状态；运行时仓库严格校验并只返回 `verified` |
| `governance-report.v1.json` | 仅构建命令 | 保存扫描数量、状态数量、原因数量和课程资源缺口 |

不得手工编辑两个生成文件。任何差异都应由源数据、课程包、治理代码或人工清单的显式变化产生。

`data/crawled/math` 是构建时数据集。若某个环境没有这 915 份源文件，可以读取已提交索引提供运行时查询，但不得声称完成了重建；要运行构建命令，必须先供应与索引 `sourcePath` 和 `contentHash` 一致的完整数据集。

## 当前 V1 基线

- 课程包：`gaokao-math-2026.1`。
- 索引版本：`2026-07-28.1`。
- 抓取数学文档：915。
- `verified`：6。
- `needs-review`：884。
- `rejected`：25。
- 当前缺口：函数性质、统计、解析几何、立体几何、复数、不等式。

这组数字由集成测试锁定。若源目录有意变化，先完成人工审核与版本提升，再更新基线。

## 新增或修改资源

1. 阅读完整源文档，确认来源 URL、数学学科、适用阶段和内容完整性。
2. 对照 `gaokao-math-2026.1` 课程节点，确认至少一个准确节点；歧义项保持 `needs-review`。
3. 检查规范 URL、内容哈希和同标题碰撞，不得批准硬重复项。
4. 只有人工确认后，才在 `manual-verification.v1.json` 新增 `verified` 记录。
5. 修改 `package.json` 中 `adaptive:resources` 的 `index-version` 和 `generated-at`。
6. 运行 `npm run adaptive:resources`。
7. 检查命令为零退出、`parseFailures` 为空、状态数量合理、资源缺口符合预期。
8. 运行全部自适应学习测试、lint 和生产构建。
9. 将人工清单、生成索引、治理报告、测试和版本变更放在同一逻辑提交序列中。

## 拒绝和复核规则

- `verified`：来源、学科、课程节点、内容、类型和难度均已人工确认。
- `needs-review`：未进入人工清单、映射歧义、标题碰撞或仍缺少审核证据。
- `rejected`：硬重复、人工拒绝、跨学科、非法结构或明确不适用。
- 关键词候选分只用于复核排序，不是验证证据。
- 人工清单中的源文件不存在、节点不存在或资源属于硬重复时，构建必须失败。

## 失败处理

| 失败 | 必须采取的动作 |
|---|---|
| 抓取文件 Schema 无效 | 修复或移除错误输入后重新构建；不得跳过并发布部分索引 |
| 人工清单 JSON 或字段无效 | 修复清单；不得忽略未知字段 |
| 课程包不匹配 | 使用正确课程包或显式发布新版本 |
| 输出写入失败 | 保留错误阶段和原因，排除文件系统问题后重试 |
| API 返回 `RESOURCE_GAP` | 补充并人工验证目标节点资源，或让上游计划器明确停止该任务 |
| API 返回 `RESOURCE_INDEX_UNAVAILABLE` | 修复或重新发布索引；不得切换到旧关键词脚本或内存数据 |

## 可复现验证

```bash
npm run adaptive:resources
npm test -- tests/adaptive-learning tests/api/math-resources.test.ts tests/integration/adaptive-learning-resource-flow.test.ts
git diff --exit-code -- data/adaptive-learning/gaokao-math/resource-index.v1.json data/adaptive-learning/gaokao-math/governance-report.v1.json
```

相同源目录、课程包、人工清单、索引版本和生成时间必须产生字节一致的两个 JSON 产物。
````

- [ ] **Step 5: 提交治理运维文档**

```bash
git add docs/adaptive-learning/resource-governance.md
git commit -m "docs: document math resource governance"
```

- [ ] **Step 6: 执行第一期全量自动验证**

```bash
npm test -- tests/adaptive-learning/contracts.test.ts tests/adaptive-learning/curriculum-pack.test.ts tests/adaptive-learning/crawled-document.test.ts tests/adaptive-learning/resource-mapping.test.ts tests/adaptive-learning/resource-governance.test.ts tests/adaptive-learning/resource-index-builder.test.ts tests/adaptive-learning/resource-index-cli.test.ts tests/adaptive-learning/resource-repository.test.ts tests/api/math-resources.test.ts tests/integration/adaptive-learning-resource-flow.test.ts
npm run adaptive:resources
git diff --exit-code -- data/adaptive-learning/gaokao-math/resource-index.v1.json data/adaptive-learning/gaokao-math/governance-report.v1.json
npm run lint -- lib/adaptive-learning app/api/sky/math-resources/route.ts scripts/build-gaokao-math-resource-index.ts tests/adaptive-learning tests/api/math-resources.test.ts tests/integration/adaptive-learning-resource-flow.test.ts
npm run build
git diff --check
```

Expected:

- 所有目标测试通过。
- 第二次资源构建不改变两个已提交生成物。
- ESLint 无新增错误。
- Next.js 生产构建通过。
- `git diff --check` 无空白错误。
- 工作树中原有用户文件保持原样，只出现本计划列出的作用域变更。

- [ ] **Step 7: 执行 Spec Compliance 子代理审查**

向独立审查子代理提供：

- `docs/superpowers/specs/2026-07-23-gaokao-math-adaptive-learning-plan-design.md`。
- 本实施计划。
- 第一期开发表达的完整 diff。
- 全量验证输出。

审查必须逐项确认：

1. 严格 Schema、12 节点课程包和版本边界均已落实。
2. 任一非法抓取文件都会终止构建，不存在部分成功。
3. 只有人工清单可以产生 `verified`。
4. API 经过认证，只返回 `verified`。
5. 无结果是 `RESOURCE_GAP`，索引故障是显式错误。
6. 没有调用旧关键词脚本、旧 server storage 或跨学科 fallback。
7. 真实索引、报告、文档和测试均在计划范围内。

若发现遗漏，先写或调整失败测试，再修复、重跑全量验证并以独立原子提交记录。

- [ ] **Step 8: 执行 Code Quality 子代理审查**

Spec Compliance 通过后，再由另一个独立子代理检查：

- Schema 和错误构造是否重复。
- 文件系统路径、临时文件和 Windows 行为是否安全。
- 排序、哈希、ID、输出 JSON 是否确定。
- API 是否泄露未验证内容或内部异常。
- 命名、职责边界、测试夹具和错误详情是否清晰。
- 是否引入超出第一期范围的持久化、规划器或 UI 复杂度。

审查不通过时修复并重新请求该阶段审查；不得用“后续再处理”结束第一期。

- [ ] **Step 9: 审查后重复全量验证并记录最终基线**

重复 Step 6 的全部命令，并在最终交付说明中记录：

- 课程包 ID 和索引版本。
- 915 / 6 / 884 / 25 的治理基线。
- 六个 `RESOURCE_GAP` 节点。
- 两阶段审查结论。
- 测试、lint、构建结果。
- 任何明确属于后续阶段而未在第一期实现的事项。

## Phase 1 验收矩阵

| 要求 | 实现证据 | 验证 |
|---|---|---|
| 阶段输入输出严格 | `lib/adaptive-learning/contracts/*` | `contracts.test.ts` |
| 课程事实源版本化且无环 | `curriculum/gaokao-math-v1.ts`、`validate-pack.ts` | `curriculum-pack.test.ts` |
| 抓取数据严格解析 | `resources/crawled-document.ts` | `crawled-document.test.ts` |
| URL、哈希和标题碰撞治理 | `duplicate-detector.ts` | `resource-mapping.test.ts` |
| 确定性课程候选 | `mapper.ts` | `resource-mapping.test.ts` |
| 三态与人工验证 | `governance.ts`、`manual-verification.v1.json` | `resource-governance.test.ts` |
| 非法输入不发布部分索引 | `index-builder.ts` | `resource-index-builder.test.ts` |
| 索引可复现 | 固定 `index-version` 和 `generated-at` | CLI 重建 + `git diff --exit-code` |
| 只返回已验证资源 | `repository.ts` | `resource-repository.test.ts` |
| 认证和嵌套错误 | `math-resources/route.ts`、`api-error.ts` | `math-resources.test.ts` |
| 无资源不降级 | `RESOURCE_GAP` | 单元、API、真实集成测试 |
| 真实数据基线受保护 | 两个版本化 JSON 生成物 | `adaptive-learning-resource-flow.test.ts` |
| 可持续人工治理 | `resource-governance.md` | 人工审查 + 重建演练 |

## 第一阶段边界

本计划完成后可以安全依赖：

- 严格、版本化的高考数学业务契约。
- 12 节点最小课程包。
- 915 份现有抓取资料的确定性治理结果。
- 六份人工验证资源和六个显式资源缺口。
- 认证的 verified-only 查询 API。

本阶段不实现：

- 用户画像和学习事件的服务端持久化。
- Beta 掌握度、置信度、保持率和遗忘更新。
- 历史试卷、错题和诊断导入确认。
- 计划优先级、约束调度、局部调整与完整重算。
- “智能计划”学生界面和教师审查界面。

这些能力不得绕过第一期契约或重新引入内存 fallback。

## 后续三期

### Phase 2: 证据、持久化与知识状态

- 选择并验证严格服务端持久化方案，不使用 `lib/server/server-storage.ts` 的内存退路。
- 统一写入 `LearningEvent`，实现幂等和重复事件错误。
- 接入试卷、错题、拍照解题、测验、复习和计时证据。
- 实现画像、知识状态、导入确认和补充诊断。

### Phase 3: 确定性计划闭环与界面

- 实现可解释优先级和硬约束调度器。
- 任务只引用第一期 verified 资源 ID。
- 实现计划版本、局部调整、完整重算和调整审计。
- 将“智能计划”设为学习中心首标签并呈现来源与调整原因。

### Phase 4: 教师审查、试点和指标校准

- 教师审核歧义、修正映射和锁定任务。
- 运行高三学生端到端试点。
- 采集完成率、保持率、薄弱点提升和错误召回指标。
- 用版本化真实数据校准权重。

大学生版本复用契约、事件、治理和审计框架，但必须发布独立 `CurriculumPack`、评价方式和目标模型；不复制高考权重、卷种、诊断阈值或先修关系。

## 执行选择

计划获批后有两种执行方式：

1. **Subagent-Driven（推荐）**：当前任务内逐个派发实现子代理，每个 Task 独立完成 RED、GREEN、提交和即时复核；Task 9 再执行规定的两阶段独立审查。
2. **Inline Execution**：由主代理在当前任务内按 Task 1–9 顺序实现和提交；完成后仍必须使用两个独立审查子代理执行 Spec Compliance 与 Code Quality 审查。

两种方式都必须按任务顺序执行，不得跳过失败测试、原子提交、真实索引重建或最终全量验证。
