# 动画讲解（Animation Explainer）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户输入话题（如"二叉堆的插入与上浮"），系统生成一份声明式分镜脚本（AnimationScript），在独立页面 `/sky/animation` 上以 SVG 动画 + TTS 旁白逐步讲解，支持顺播、单步回溯、进度条跳转与倍速。

**Architecture:** 声明式分镜 DSL（8 种图元演员 + 全量快照分步状态，严格 Zod 校验 + autoFix）→ 两段式生成（Plan Agent → Script Agent，复用 `callLLM` + key pool）→ 文件式 job 持久化（照搬 slides job store 模式）→ SVG + motion/react 渲染器（状态即步骤的纯函数，回溯免费）→ 轻量播放 hook（TTS 驱动步进）。

**Tech Stack:** Next.js 16 App Router、Zod、`callLLM`（`@/lib/ai/llm`）、motion/react 12、SVG、vitest（jsdom）。

**Spec:** `docs/superpowers/specs/2026-10-04-animation-explainer-design.md`

**与 spec 的两处刻意细化（不改变设计意图）：**
1. spec 说"脚本持久化存 DB（复用现有模式）"——现有生成产物的持久化模式是 slides 的文件式 job store（`data/slides-jobs/*.json`），动画脚本沿用该模式存 `data/animation-scripts/*.json`，不新增 SQL 迁移。
2. spec 说"阅读时长估算逻辑抽成共用工具复用"——课堂 `lib/playback/engine.ts` 与多智能体耦合，本计划将同参数估算实现为独立工具 `lib/animation/playback/duration.ts`（CJK ~150ms/字、非 CJK ~240ms/词，与 engine 一致），不改课堂 engine，保持本 feature diff 聚焦。

---

## 关键集成点速查（实现者必读）

| 用途 | 用法 |
| --- | --- |
| LLM 调用 | `callLLM({ model, system, prompt, maxOutputTokens, temperature }, label, { retries, timeoutMs, validate? }, { mode: 'disabled', enabled: false })` → `{ text }`，来自 `@/lib/ai/llm`（参考 `lib/slides/agent/planning-agent.ts:211`） |
| 模型解析 | `getModel(config: ModelConfig)` → `{ model }`，来自 `@/lib/ai/providers`；`ModelConfig = { providerId, modelId, apiKey, baseUrl?, providerType? }`（`lib/types/provider.ts:172`） |
| JSON 解析修复 | `parseJsonResponse<T>(text)` 来自 `@/lib/generation/json-repair` |
| Prompt 加载 | `loadPrompt('generators/xxx')` → `{ systemPrompt, userPromptTemplate }`，来自 `@/lib/prompts/loader`；PromptId 联合类型在 `lib/prompts/types.ts:143` |
| API 响应 | `apiSuccess({ ... })` / `apiError(msg, status?)` 来自 `@/lib/server/api-response`（先读 `lib/server/api-response.ts:29-52` 确认返回体包裹结构，前端取值路径以实际为准） |
| 后台任务 UI | `use-task-store`（`lib/store/use-task-store.ts`），TaskType 联合类型第 11 行 |
| Job 持久化参考 | `lib/slides/agent/slides-job-store.ts`（`data/slides-jobs/` 文件式，stale 30min/保留 24h） |
| 动画库 | `import { motion } from 'motion/react'`（已在栈内，勿新增依赖） |
| 测试 | vitest，jsdom；放 `tests/animation/*`；单文件跑 `pnpm vitest run tests/animation/xxx.test.ts` |

**路径别名**：`@/*` → 仓库根目录。**代码风格**：prettier 100 字符、单引号、LF；未用变量前缀 `_`。

---

### Task 1: DSL 类型 + Zod schema + autoFix

**Files:**
- Create: `lib/animation/types.ts`
- Create: `lib/animation/schema.ts`
- Test: `tests/animation/schema.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// tests/animation/schema.test.ts
import { describe, it, expect } from 'vitest';
import { scriptSchema, autoFixScript } from '@/lib/animation/schema';

const validScript = {
  id: 's1',
  title: '二叉堆的插入与上浮',
  topic: '二叉堆',
  subjectArea: 'data-structure',
  stage: { width: 1200, height: 675 },
  actors: [
    { kind: 'node', id: 'a1', label: '4', shape: 'circle', color: '#4f8ef7', r: 28 },
    { kind: 'array-cell', id: 'c1', label: '4', w: 90, h: 60, color: '#4f8ef7' },
    { kind: 'arrow', id: 'arr1', fromActorId: 'a1', toActorId: 'c1' },
    { kind: 'pointer', id: 'p1', label: 'i', targetActorId: 'c1' },
    { kind: 'text', id: 't1', content: '初始状态', size: 24, color: '#333333' },
    { kind: 'highlight', id: 'h1', targetActorId: 'a1', color: '#f76e4f' },
    { kind: 'bar', id: 'b1', label: '3', w: 60, color: '#4f8ef7' },
    { kind: 'axes', id: 'ax1', xmin: 0, xmax: 10, ymin: 0, ymax: 10 },
  ],
  steps: [
    {
      id: 'st1',
      title: '初始状态',
      narration: '数组 [4, 7, 2] 已经是一个完全二叉树。',
      actorStates: [{ actorId: 'a1', x: 600, y: 200 }],
    },
  ],
};

describe('scriptSchema', () => {
  it('接受合法脚本', () => {
    expect(scriptSchema.safeParse(validScript).success).toBe(true);
  });

  it('拒绝未知演员 kind', () => {
    const bad = { ...validScript, actors: [{ kind: 'dragon', id: 'x' }] };
    expect(scriptSchema.safeParse(bad).success).toBe(false);
  });

  it('拒绝空 steps', () => {
    const bad = { ...validScript, steps: [] };
    expect(scriptSchema.safeParse(bad).success).toBe(false);
  });
});

describe('autoFixScript', () => {
  it('剔除指向未知演员的状态并 clamp 越界坐标', () => {
    const dirty = {
      ...validScript,
      steps: [
        {
          id: 'st1',
          title: 't',
          narration: 'n',
          actorStates: [
            { actorId: 'a1', x: 5000, y: -100 }, // 越界
            { actorId: 'ghost', x: 10, y: 10 }, // 未知演员
          ],
        },
      ],
    };
    const { script, fixes } = autoFixScript(dirty);
    expect(fixes.length).toBeGreaterThan(0);
    const st = script.steps[0].actorStates;
    expect(st.find((s) => s.actorId === 'ghost')).toBeUndefined();
    expect(st.find((s) => s.actorId === 'a1')!.x).toBeLessThanOrEqual(script.stage.width);
    expect(scriptSchema.safeParse(script).success).toBe(true);
  });

  it('截断超长 narration', () => {
    const dirty = {
      ...validScript,
      steps: [{ ...validScript.steps[0], narration: '长'.repeat(600) }],
    };
    const { script } = autoFixScript(dirty);
    expect(script.steps[0].narration.length).toBeLessThanOrEqual(500);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/animation/schema.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 types.ts**

```ts
// lib/animation/types.ts
/** 动画讲解 DSL —— 声明式分镜脚本（spec §3） */

export type SubjectArea = 'algorithm' | 'data-structure' | 'math' | 'physics';

export interface StageSpec {
  /** 逻辑坐标系宽（SVG viewBox），如 1200 */
  width: number;
  /** 逻辑坐标系高，如 675 */
  height: number;
  showGrid?: boolean;
  showAxes?: boolean;
}

export type NodeShape = 'circle' | 'rect';

interface BaseActor {
  id: string;
}

export interface NodeActor extends BaseActor {
  kind: 'node';
  label: string;
  shape: NodeShape;
  /** hex 颜色，如 #4f8ef7 */
  color: string;
  /** circle 半径 */
  r?: number;
  /** rect 宽高 */
  w?: number;
  h?: number;
}

export interface ArrayCellActor extends BaseActor {
  kind: 'array-cell';
  label: string;
  w: number;
  h: number;
  color: string;
}

export interface ArrowActor extends BaseActor {
  kind: 'arrow';
  fromActorId: string;
  toActorId: string;
  label?: string;
  curved?: boolean;
}

export interface PointerActor extends BaseActor {
  kind: 'pointer';
  label: string;
  targetActorId: string;
}

export interface TextActor extends BaseActor {
  kind: 'text';
  content: string;
  size: number;
  color: string;
}

export interface HighlightActor extends BaseActor {
  kind: 'highlight';
  targetActorId: string;
  color: string;
}

export interface BarActor extends BaseActor {
  kind: 'bar';
  label: string;
  w: number;
  color: string;
}

export interface AxesActor extends BaseActor {
  kind: 'axes';
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

export type Actor =
  | NodeActor
  | ArrayCellActor
  | ArrowActor
  | PointerActor
  | TextActor
  | HighlightActor
  | BarActor
  | AxesActor;

export type ActorKind = Actor['kind'];

/** 单步内某演员的完整状态（全量快照，spec §3.2） */
export interface ActorState {
  actorId: string;
  /** 舞台逻辑坐标（中心点） */
  x: number;
  y: number;
  opacity?: number;
  scale?: number;
  labelOverride?: string;
  colorOverride?: string;
  entering?: boolean;
  exiting?: boolean;
}

export interface AnimationStep {
  id: string;
  title: string;
  /** 该步旁白 → TTS；音频时长即该步停留时长 */
  narration: string;
  actorStates: ActorState[];
}

export interface AnimationScript {
  id: string;
  title: string;
  topic: string;
  subjectArea: SubjectArea;
  stage: StageSpec;
  actors: Actor[];
  steps: AnimationStep[];
}

export interface ScriptMeta {
  scriptId: string;
  title: string;
  topic: string;
  subjectArea: SubjectArea;
  stepCount: number;
  createdAt: string;
}
```

- [ ] **Step 4: 实现 schema.ts**

```ts
// lib/animation/schema.ts
import { z } from 'zod';
import type { AnimationScript } from './types';

export const NARRATION_MAX_LENGTH = 500;
export const LABEL_MAX_LENGTH = 20;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be #rrggbb');

const actorSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('node'),
    id: z.string().min(1),
    label: z.string().max(LABEL_MAX_LENGTH),
    shape: z.enum(['circle', 'rect']),
    color: hexColor,
    r: z.number().positive().optional(),
    w: z.number().positive().optional(),
    h: z.number().positive().optional(),
  }),
  z.object({
    kind: z.literal('array-cell'),
    id: z.string().min(1),
    label: z.string().max(LABEL_MAX_LENGTH),
    w: z.number().positive(),
    h: z.number().positive(),
    color: hexColor,
  }),
  z.object({
    kind: z.literal('arrow'),
    id: z.string().min(1),
    fromActorId: z.string().min(1),
    toActorId: z.string().min(1),
    label: z.string().max(LABEL_MAX_LENGTH).optional(),
    curved: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('pointer'),
    id: z.string().min(1),
    label: z.string().max(LABEL_MAX_LENGTH),
    targetActorId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('text'),
    id: z.string().min(1),
    content: z.string().max(200),
    size: z.number().positive(),
    color: hexColor,
  }),
  z.object({
    kind: z.literal('highlight'),
    id: z.string().min(1),
    targetActorId: z.string().min(1),
    color: hexColor,
  }),
  z.object({
    kind: z.literal('bar'),
    id: z.string().min(1),
    label: z.string().max(LABEL_MAX_LENGTH),
    w: z.number().positive(),
    color: hexColor,
  }),
  z.object({
    kind: z.literal('axes'),
    id: z.string().min(1),
    xmin: z.number(),
    xmax: z.number(),
    ymin: z.number(),
    ymax: z.number(),
  }),
]);

const actorStateSchema = z.object({
  actorId: z.string().min(1),
  x: z.number(),
  y: z.number(),
  opacity: z.number().min(0).max(1).optional(),
  scale: z.number().positive().optional(),
  labelOverride: z.string().max(LABEL_MAX_LENGTH).optional(),
  colorOverride: hexColor.optional(),
  entering: z.boolean().optional(),
  exiting: z.boolean().optional(),
});

const stepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(60),
  narration: z.string().min(1).max(NARRATION_MAX_LENGTH),
  actorStates: z.array(actorStateSchema).min(1),
});

// 步数下限取 1 而非 5：autoFix 可能丢弃坏步骤，硬卡 5 会误伤；
// 5~20 步的目标由 plan-agent 的 planSchema 约束。
export const scriptSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(80),
  topic: z.string().min(1).max(120),
  subjectArea: z.enum(['algorithm', 'data-structure', 'math', 'physics']),
  stage: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    showGrid: z.boolean().optional(),
    showAxes: z.boolean().optional(),
  }),
  actors: z.array(actorSchema),
  steps: z.array(stepSchema).min(1).max(30),
});

export type ScriptInput = z.input<typeof scriptSchema>;

/**
 * 对 LLM 产出的脏 JSON 做尽力修复：剔除未知演员状态、clamp 越界坐标、
 * 截断超长字段、丢弃无法修复的 step。返回修复后的脚本与修复清单。
 * 修复后仍不合法则抛错（调用方重试，spec §6 fail hard）。
 */
export function autoFixScript(dirty: unknown): { script: AnimationScript; fixes: string[] } {
  const parsed = scriptSchema.safeParse(dirty);
  if (parsed.success) return { script: parsed.data, fixes: [] };

  const d = (dirty ?? {}) as Record<string, unknown>;
  const fixes: string[] = [];
  const stage = (d.stage ?? {}) as Record<string, unknown>;
  const width = typeof stage.width === 'number' && stage.width > 0 ? stage.width : 1200;
  const height = typeof stage.height === 'number' && stage.height > 0 ? stage.height : 675;

  const actors = Array.isArray(d.actors) ? d.actors : [];
  const knownIds = new Set(
    actors
      .map((a) => (a && typeof a === 'object' ? (a as Record<string, unknown>).id : null))
      .filter((v): v is string => typeof v === 'string'),
  );

  const rawSteps = Array.isArray(d.steps) ? d.steps : [];
  const steps = rawSteps
    .map((raw, i) => {
      const s = (raw ?? {}) as Record<string, unknown>;
      const narration =
        typeof s.narration === 'string' ? s.narration.slice(0, NARRATION_MAX_LENGTH) : '';
      if (!narration.trim()) {
        fixes.push(`step[${i}]: narration 缺失，已丢弃该步`);
        return null;
      }
      const rawStates = Array.isArray(s.actorStates) ? s.actorStates : [];
      const actorStates = rawStates
        .filter((st) => {
          const id = (st as Record<string, unknown>)?.actorId;
          if (typeof id === 'string' && knownIds.has(id)) return true;
          fixes.push(`step[${i}]: 剔除未知演员状态 ${String(id)}`);
          return false;
        })
        .map((st) => {
          const o = (st as Record<string, unknown>) ?? {};
          const clamp = (v: unknown, max: number) => Math.min(Math.max(Number(v) || 0, 0), max);
          return {
            actorId: String(o.actorId),
            x: clamp(o.x, width),
            y: clamp(o.y, height),
          };
        });
      if (actorStates.length === 0) {
        fixes.push(`step[${i}]: 修复后无有效状态，已丢弃该步`);
        return null;
      }
      return {
        id: typeof s.id === 'string' && s.id ? s.id : `step-${i + 1}`,
        title:
          typeof s.title === 'string' && s.title.trim() ? s.title.slice(0, 60) : `第 ${i + 1} 步`,
        narration,
        actorStates,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  if (steps.length === 0) throw new Error('autoFix 后仍无有效步骤');

  const candidate = {
    id: typeof d.id === 'string' && d.id ? d.id : `anim-${Date.now()}`,
    title: typeof d.title === 'string' && d.title.trim() ? d.title.slice(0, 80) : '动画讲解',
    topic: typeof d.topic === 'string' && d.topic.trim() ? d.topic.slice(0, 120) : '未提供话题',
    subjectArea: ['algorithm', 'data-structure', 'math', 'physics'].includes(d.subjectArea as string)
      ? d.subjectArea
      : 'algorithm',
    stage: { width, height },
    actors,
    steps,
  };

  const reparsed = scriptSchema.safeParse(candidate);
  if (!reparsed.success) {
    throw new Error(`autoFix 后仍不合法: ${reparsed.error.issues[0]?.message ?? 'unknown'}`);
  }
  return { script: reparsed.data, fixes };
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm vitest run tests/animation/schema.test.ts`
Expected: PASS（5 个用例）

- [ ] **Step 6: Commit**

```bash
git add lib/animation/types.ts lib/animation/schema.ts tests/animation/schema.test.ts
git commit -m "feat(animation): DSL 类型与 Zod schema + autoFix"
```

---

### Task 2: validate.ts（引用完整性 / 几何 / 位移校验）

**Files:**
- Create: `lib/animation/validate.ts`
- Test: `tests/animation/validate.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// tests/animation/validate.test.ts
import { describe, it, expect } from 'vitest';
import { validateScript } from '@/lib/animation/validate';
import type { AnimationScript } from '@/lib/animation/types';

function makeScript(overrides: Partial<AnimationScript> = {}): AnimationScript {
  return {
    id: 's1',
    title: 't',
    topic: 'tp',
    subjectArea: 'algorithm',
    stage: { width: 1200, height: 675 },
    actors: [
      { kind: 'node', id: 'a', label: 'A', shape: 'circle', color: '#4f8ef7', r: 28 },
      { kind: 'node', id: 'b', label: 'B', shape: 'circle', color: '#4f8ef7', r: 28 },
      { kind: 'arrow', id: 'arr', fromActorId: 'a', toActorId: 'b' },
    ],
    steps: [
      {
        id: 'st1',
        title: 's1',
        narration: 'n1',
        actorStates: [
          { actorId: 'a', x: 300, y: 300 },
          { actorId: 'b', x: 800, y: 300 },
          { actorId: 'arr', x: 0, y: 0 },
        ],
      },
    ],
    ...overrides,
  };
}

describe('validateScript', () => {
  it('合法脚本零错误', () => {
    const r = validateScript(makeScript());
    expect(r.errors).toHaveLength(0);
  });

  it('未知 actorId 报错', () => {
    const s = makeScript();
    s.steps[0].actorStates.push({ actorId: 'ghost', x: 1, y: 1 });
    const r = validateScript(s);
    expect(r.errors.some((e) => e.code === 'unknown-actor')).toBe(true);
  });

  it('箭头端点不存在报错', () => {
    const s = makeScript();
    (s.actors[2] as { fromActorId: string }).fromActorId = 'ghost';
    const r = validateScript(s);
    expect(r.errors.some((e) => e.code === 'arrow-endpoint-missing')).toBe(true);
  });

  it('坐标越界报错', () => {
    const s = makeScript();
    s.steps[0].actorStates[0] = { actorId: 'a', x: 5000, y: 300 };
    const r = validateScript(s);
    expect(r.errors.some((e) => e.code === 'out-of-bounds')).toBe(true);
  });

  it('相邻步位移过大产生 warning', () => {
    const s = makeScript({
      steps: [
        { id: 'st1', title: 's1', narration: 'n1', actorStates: [{ actorId: 'a', x: 100, y: 100 }] },
        {
          id: 'st2',
          title: 's2',
          narration: 'n2',
          actorStates: [{ actorId: 'a', x: 1100, y: 600 }],
        },
      ],
    });
    const r = validateScript(s);
    expect(r.warnings.some((w) => w.code === 'large-displacement')).toBe(true);
  });

  it('高亮/指针目标不存在报错', () => {
    const s = makeScript();
    s.actors.push({ kind: 'highlight', id: 'h', targetActorId: 'ghost', color: '#f76e4f' });
    const r = validateScript(s);
    expect(r.errors.some((e) => e.code === 'target-missing')).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/animation/validate.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 validate.ts**

```ts
// lib/animation/validate.ts
import type { Actor, AnimationScript, ActorState } from './types';

export interface ValidationIssue {
  code:
    | 'unknown-actor'
    | 'arrow-endpoint-missing'
    | 'target-missing'
    | 'out-of-bounds'
    | 'large-displacement';
  message: string;
  stepId?: string;
  actorId?: string;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/** 相邻步之间单演员位移超过该值（对角线比例）视为跳变，给 warning */
const DISPLACEMENT_WARNING_RATIO = 0.6;

/**
 * 0-LLM 结构校验（spec §6）。errors 阻断（触发 Script Agent 重试），
 * warnings 仅提示（如位移过大建议加中间步）。
 */
export function validateScript(script: AnimationScript): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const { width, height } = script.stage;

  const byId = new Map<string, Actor>(script.actors.map((a) => [a.id, a]));
  const POSITIONED = new Set(['node', 'array-cell', 'text', 'bar', 'axes']);

  for (const actor of script.actors) {
    if (actor.kind === 'arrow') {
      for (const end of [actor.fromActorId, actor.toActorId]) {
        const target = byId.get(end);
        if (!target) {
          errors.push({
            code: 'arrow-endpoint-missing',
            message: `箭头 ${actor.id} 端点 ${end} 不存在`,
            actorId: actor.id,
          });
        } else if (!POSITIONED.has(target.kind)) {
          errors.push({
            code: 'arrow-endpoint-missing',
            message: `箭头 ${actor.id} 端点 ${end} 不是可定位演员（${target.kind}）`,
            actorId: actor.id,
          });
        }
      }
    }
    if (actor.kind === 'pointer' || actor.kind === 'highlight') {
      const target = byId.get(actor.targetActorId);
      if (!target) {
        errors.push({
          code: 'target-missing',
          message: `${actor.kind} ${actor.id} 的目标 ${actor.targetActorId} 不存在`,
          actorId: actor.id,
        });
      } else if (!POSITIONED.has(target.kind)) {
        errors.push({
          code: 'target-missing',
          message: `${actor.kind} ${actor.id} 的目标 ${actor.targetActorId} 不是可定位演员`,
          actorId: actor.id,
        });
      }
    }
  }

  const diag = Math.hypot(width, height);
  let prev: Map<string, ActorState> | null = null;

  for (const step of script.steps) {
    for (const st of step.actorStates) {
      if (!byId.has(st.actorId)) {
        errors.push({
          code: 'unknown-actor',
          message: `步骤 ${step.id} 引用未知演员 ${st.actorId}`,
          stepId: step.id,
          actorId: st.actorId,
        });
        continue;
      }
      if (st.x < 0 || st.x > width || st.y < 0 || st.y > height) {
        errors.push({
          code: 'out-of-bounds',
          message: `步骤 ${step.id} 演员 ${st.actorId} 坐标 (${st.x}, ${st.y}) 越界`,
          stepId: step.id,
          actorId: st.actorId,
        });
      }
      if (prev) {
        const before = prev.get(st.actorId);
        if (
          before &&
          Math.hypot(st.x - before.x, st.y - before.y) > diag * DISPLACEMENT_WARNING_RATIO
        ) {
          warnings.push({
            code: 'large-displacement',
            message: `步骤 ${step.id} 演员 ${st.actorId} 位移过大，建议增加中间过渡步`,
            stepId: step.id,
            actorId: st.actorId,
          });
        }
      }
    }
    prev = new Map(step.actorStates.map((st) => [st.actorId, st]));
  }

  return { errors, warnings };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/animation/validate.test.ts`
Expected: PASS（6 个用例）

- [ ] **Step 5: Commit**

```bash
git add lib/animation/validate.ts tests/animation/validate.test.ts
git commit -m "feat(animation): 分镜脚本结构校验 validate.ts"
```

---

### Task 3: interpolate.ts（箭头几何 + 步视图解析）

**Files:**
- Create: `lib/animation/interpolate.ts`
- Test: `tests/animation/interpolate.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// tests/animation/interpolate.test.ts
import { describe, it, expect } from 'vitest';
import { resolveStepView, buildArrowPath, approxActorRadius } from '@/lib/animation/interpolate';
import type { AnimationScript } from '@/lib/animation/types';

const script: AnimationScript = {
  id: 's',
  title: 't',
  topic: 'tp',
  subjectArea: 'algorithm',
  stage: { width: 1200, height: 675 },
  actors: [
    { kind: 'node', id: 'a', label: 'A', shape: 'circle', color: '#4f8ef7', r: 28 },
    { kind: 'node', id: 'b', label: 'B', shape: 'rect', color: '#4f8ef7', w: 80, h: 40 },
    { kind: 'arrow', id: 'arr', fromActorId: 'a', toActorId: 'b' },
  ],
  steps: [
    {
      id: 'st1',
      title: 's1',
      narration: 'n1',
      actorStates: [
        { actorId: 'a', x: 200, y: 300 },
        { actorId: 'b', x: 800, y: 300 },
        { actorId: 'arr', x: 0, y: 0 },
      ],
    },
    {
      id: 'st2',
      title: 's2',
      narration: 'n2',
      actorStates: [
        { actorId: 'a', x: 200, y: 300 },
        { actorId: 'arr', x: 0, y: 0 },
      ],
    },
  ],
};

describe('resolveStepView', () => {
  it('返回当步可见演员及其状态', () => {
    const view = resolveStepView(script, 0);
    expect(view.visible).toHaveLength(3);
    const a = view.visible.find((v) => v.actor.id === 'a')!;
    expect(a.state.x).toBe(200);
    expect(a.actor.kind).toBe('node');
  });

  it('上一步有、本步没有的演员标记为 exiting（隐式推导）', () => {
    const view = resolveStepView(script, 1);
    expect(view.exiting.map((v) => v.actor.id)).toEqual(['b']);
    expect(view.visible.find((v) => v.actor.id === 'b')).toBeUndefined();
  });

  it('第一步所有可见演员视为 entering', () => {
    const view = resolveStepView(script, 0);
    expect(view.visible.every((v) => v.isEntering)).toBe(true);
  });
});

describe('approxActorRadius', () => {
  it('circle 用 r，rect 用 min(w,h)/2', () => {
    const view = resolveStepView(script, 0);
    const a = view.visible.find((v) => v.actor.id === 'a')!;
    const b = view.visible.find((v) => v.actor.id === 'b')!;
    expect(approxActorRadius(a.actor)).toBe(28);
    expect(approxActorRadius(b.actor)).toBe(20);
  });
});

describe('buildArrowPath', () => {
  it('直线箭头返回 M..L.. 且端点按半径收缩', () => {
    // from (200,300) r=28 → 起点 200+(28+6)=234；to (800,300) r=20 → 终点 800-(20+6+10)=764
    const d = buildArrowPath({ x1: 200, y1: 300, x2: 800, y2: 300, r1: 28, r2: 20, curved: false });
    expect(d).toMatch(/^M 234(\.0)? 300(\.0)? L 764(\.0)? 300(\.0)?$/);
  });

  it('曲线箭头返回 Q 命令', () => {
    const d = buildArrowPath({ x1: 200, y1: 300, x2: 800, y2: 300, r1: 28, r2: 20, curved: true });
    expect(d).toContain('Q');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/animation/interpolate.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 interpolate.ts**

```ts
// lib/animation/interpolate.ts
import type { Actor, AnimationScript, ActorState } from './types';

export interface ActorView {
  actor: Actor;
  state: ActorState;
  /** 是否应做入场动画（第一步、或上一步不可见） */
  isEntering: boolean;
}

export interface StepView {
  visible: ActorView[];
  /** 上一步可见、本步不可见的演员（做出场动画） */
  exiting: ActorView[];
}

/**
 * 全量快照解析（spec §3.2）：演员是否入场/出场由相邻步状态隐式推导，
 * LLM 显式给的 entering/exiting 标记仅作补充（隐式推导优先，全量快照必然自洽）。
 */
export function resolveStepView(script: AnimationScript, stepIndex: number): StepView {
  const byId = new Map(script.actors.map((a) => [a.id, a]));
  const current = script.steps[Math.max(0, Math.min(stepIndex, script.steps.length - 1))];
  const prev = stepIndex > 0 ? script.steps[stepIndex - 1] : null;

  const currentIds = new Set(current.actorStates.map((s) => s.actorId));
  const visible: ActorView[] = current.actorStates
    .filter((s) => byId.has(s.actorId))
    .map((state) => ({
      actor: byId.get(state.actorId)!,
      state,
      isEntering: !prev || !prev.actorStates.some((p) => p.actorId === state.actorId),
    }));

  const exiting: ActorView[] = prev
    ? prev.actorStates
        .filter((s) => byId.has(s.actorId) && !currentIds.has(s.actorId))
        .map((state) => ({ actor: byId.get(state.actorId)!, state, isEntering: false }))
    : [];

  return { visible, exiting };
}

/** 演员的近似包围半径，用于箭头端点收缩 */
export function approxActorRadius(actor: Actor): number {
  switch (actor.kind) {
    case 'node':
      return actor.shape === 'circle'
        ? (actor.r ?? 28)
        : Math.min(actor.w ?? 60, actor.h ?? 40) / 2;
    case 'array-cell':
      return Math.min(actor.w, actor.h) / 2;
    case 'bar':
      return actor.w / 2;
    case 'text':
      return actor.size * 0.7;
    default:
      return 0;
  }
}

export interface ArrowGeometry {
  /** from 演员中心坐标 */
  x1: number;
  y1: number;
  /** to 演员中心坐标 */
  x2: number;
  y2: number;
  r1: number;
  r2: number;
  curved: boolean;
}

/**
 * 箭头路径：从 from 中心指向 to 中心，两端各收缩 半径+6px（尾部再 +10px 给箭头 marker）。
 * 直线返回 "M x1 y1 L x2 y2"；曲线返回 "M x1 y1 Q cx cy x2 y2"
 * （控制点取中点法向偏移，偏移量 = 距离 * 0.18）。
 */
export function buildArrowPath(g: ArrowGeometry): string {
  const dx = g.x2 - g.x1;
  const dy = g.y2 - g.y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const x1 = g.x1 + ux * (g.r1 + 6);
  const y1 = g.y1 + uy * (g.r1 + 6);
  const x2 = g.x2 - ux * (g.r2 + 6 + 10);
  const y2 = g.y2 - uy * (g.r2 + 6 + 10);
  if (!g.curved) return `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const cx = mx - uy * len * 0.18;
  const cy = my + ux * len * 0.18;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/animation/interpolate.test.ts`
Expected: PASS（6 个用例）

- [ ] **Step 5: Commit**

```bash
git add lib/animation/interpolate.ts tests/animation/interpolate.test.ts
git commit -m "feat(animation): 步视图解析与箭头几何 interpolate.ts"
```

---

### Task 4: 播放状态机 + 语音时长估算

**Files:**
- Create: `lib/animation/playback/player-machine.ts`
- Create: `lib/animation/playback/duration.ts`
- Create: `lib/animation/playback/speech.ts`
- Test: `tests/animation/player-machine.test.ts`
- Test: `tests/animation/duration.test.ts`

- [ ] **Step 1: 写失败测试（状态机）**

```ts
// tests/animation/player-machine.test.ts
import { describe, it, expect } from 'vitest';
import { initialPlayerState, reducePlayer } from '@/lib/animation/playback/player-machine';

describe('player machine', () => {
  it('idle → play → playing（第一步）', () => {
    let s = initialPlayerState(5);
    s = reducePlayer(s, { type: 'play' });
    expect(s.status).toBe('playing');
    expect(s.stepIndex).toBe(0);
  });

  it('ended 推进到下一步，最后一步结束后 finished', () => {
    let s = reducePlayer(initialPlayerState(2), { type: 'play' });
    s = reducePlayer(s, { type: 'ended' });
    expect(s).toMatchObject({ status: 'playing', stepIndex: 1 });
    s = reducePlayer(s, { type: 'ended' });
    expect(s).toMatchObject({ status: 'finished', stepIndex: 1 });
  });

  it('next/prev 有边界 clamp，prev 在第一步保持在 0', () => {
    let s = initialPlayerState(3);
    s = reducePlayer(s, { type: 'prev' });
    expect(s.stepIndex).toBe(0);
    s = reducePlayer(s, { type: 'next' });
    expect(s.stepIndex).toBe(1);
    s = reducePlayer(s, { type: 'next' });
    s = reducePlayer(s, { type: 'next' });
    expect(s).toMatchObject({ status: 'finished', stepIndex: 2 });
  });

  it('seek 任意步（回溯）并暂停播放', () => {
    let s = reducePlayer(initialPlayerState(5), { type: 'play' });
    s = reducePlayer(s, { type: 'ended' });
    s = reducePlayer(s, { type: 'ended' });
    s = reducePlayer(s, { type: 'seek', index: 0 });
    expect(s).toMatchObject({ status: 'paused', stepIndex: 0 });
  });

  it('pause/replay 与 setSpeed', () => {
    let s = reducePlayer(initialPlayerState(3), { type: 'play' });
    s = reducePlayer(s, { type: 'pause' });
    expect(s.status).toBe('paused');
    s = reducePlayer(s, { type: 'play' });
    expect(s.status).toBe('playing');
    s = reducePlayer(s, { type: 'speed', value: 1.5 });
    expect(s.speed).toBe(1.5);
  });

  it('finished 状态下 play 从头开始', () => {
    let s = reducePlayer(initialPlayerState(2), { type: 'play' });
    s = reducePlayer(s, { type: 'ended' });
    s = reducePlayer(s, { type: 'ended' });
    expect(s.status).toBe('finished');
    s = reducePlayer(s, { type: 'play' });
    expect(s).toMatchObject({ status: 'playing', stepIndex: 0 });
  });
});
```

- [ ] **Step 2: 写失败测试（时长估算）**

```ts
// tests/animation/duration.test.ts
import { describe, it, expect } from 'vitest';
import { estimateSpeechDurationMs } from '@/lib/animation/playback/duration';

describe('estimateSpeechDurationMs', () => {
  it('中文按 ~150ms/字', () => {
    expect(estimateSpeechDurationMs('一二三四五')).toBe(5 * 150);
  });

  it('英文按 ~240ms/词', () => {
    expect(estimateSpeechDurationMs('hello world foo')).toBe(3 * 240);
  });

  it('混合文本按 CJK 占比判定且为正', () => {
    const mixed = '这是混合文本 with english words';
    expect(estimateSpeechDurationMs(mixed)).toBeGreaterThan(0);
  });

  it('speed 倍速生效', () => {
    const base = estimateSpeechDurationMs('一二三');
    expect(estimateSpeechDurationMs('一二三', 2)).toBe(base / 2);
  });

  it('空文本返回最小停留时长', () => {
    expect(estimateSpeechDurationMs('')).toBe(800);
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm vitest run tests/animation/player-machine.test.ts tests/animation/duration.test.ts`
Expected: FAIL

- [ ] **Step 4: 实现 player-machine.ts**

```ts
// lib/animation/playback/player-machine.ts
/** 播放状态机（纯函数，spec §5）。UI 层（useAnimationPlayer）负责副作用。 */

export type PlayerStatus = 'idle' | 'playing' | 'paused' | 'finished';

export type PlayerEvent =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'seek'; index: number }
  | { type: 'speed'; value: number }
  /** 当前步旁白播放完毕 → 推进 */
  | { type: 'ended' };

export interface PlayerState {
  status: PlayerStatus;
  stepIndex: number;
  speed: number;
  totalSteps: number;
}

export const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5] as const;

export function initialPlayerState(totalSteps: number): PlayerState {
  return { status: 'idle', stepIndex: 0, speed: 1, totalSteps };
}

function isLast(s: PlayerState): boolean {
  return s.stepIndex >= s.totalSteps - 1;
}

export function reducePlayer(state: PlayerState, event: PlayerEvent): PlayerState {
  switch (event.type) {
    case 'play':
      // finished 后重播从头开始
      if (state.status === 'finished') {
        return { ...state, status: 'playing', stepIndex: 0 };
      }
      return { ...state, status: 'playing' };
    case 'pause':
      return { ...state, status: 'paused' };
    case 'next': {
      if (isLast(state)) return { ...state, status: 'finished' };
      return { ...state, stepIndex: state.stepIndex + 1, status: 'paused' };
    }
    case 'prev':
      return { ...state, stepIndex: Math.max(0, state.stepIndex - 1), status: 'paused' };
    case 'seek':
      return {
        ...state,
        stepIndex: Math.max(0, Math.min(event.index, state.totalSteps - 1)),
        status: 'paused',
      };
    case 'speed':
      return { ...state, speed: event.value };
    case 'ended': {
      if (state.status !== 'playing') return state;
      if (isLast(state)) return { ...state, status: 'finished' };
      return { ...state, stepIndex: state.stepIndex + 1 };
    }
    default:
      return state;
  }
}
```

- [ ] **Step 5: 实现 duration.ts 与 speech.ts**

```ts
// lib/animation/playback/duration.ts
/** 旁白阅读时长估算。速率与课堂 playback engine 一致：CJK ~150ms/字，非 CJK ~240ms/词。 */
export const CJK_CHAR_MS = 150;
export const LATIN_WORD_MS = 240;
export const MIN_STEP_MS = 800;

export function estimateSpeechDurationMs(text: string, speed = 1): number {
  const trimmed = text.trim();
  if (!trimmed) return MIN_STEP_MS;
  const cjkChars = (trimmed.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) ?? []).length;
  const isCJK = cjkChars > trimmed.length * 0.3;
  const rawMs = isCJK
    ? cjkChars * CJK_CHAR_MS + (trimmed.length - cjkChars) * 30
    : trimmed.split(/\s+/).filter(Boolean).length * LATIN_WORD_MS;
  return Math.max(MIN_STEP_MS, rawMs / speed);
}
```

```ts
// lib/animation/playback/speech.ts
/**
 * 浏览器 TTS 适配器（spec §5：v1 用 SpeechSynthesis，接口留出后续接
 * 服务端 TTS 的空间）。speak 返回的 Promise 在朗读结束/失败时 resolve；
 * 无 TTS 环境回退为阅读时长定时器。
 */
import { estimateSpeechDurationMs } from './duration';

export interface SpeakOptions {
  speed?: number;
  signal?: AbortSignal;
}

export function isSpeechSynthesisAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function cancelSpeech(): void {
  if (isSpeechSynthesisAvailable()) window.speechSynthesis.cancel();
}

export async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  const speed = opts.speed ?? 1;
  if (!isSpeechSynthesisAvailable()) {
    await delay(estimateSpeechDurationMs(text, speed), opts.signal);
    return;
  }
  return new Promise<void>((resolve) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length > text.length * 0.3;
    utterance.lang = cjk ? 'zh-CN' : 'en-US';
    utterance.rate = speed;
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        opts.signal?.removeEventListener('abort', onAbort);
        resolve();
      }
    };
    const onAbort = () => {
      synth.cancel();
      finish();
    };
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    // 某些浏览器 end 事件不触发：以估算时长 + 2s 兜底
    const fallback = setTimeout(finish, estimateSpeechDurationMs(text, speed) + 2000);
    utterance.onend = () => {
      clearTimeout(fallback);
      finish();
    };
    utterance.onerror = () => {
      clearTimeout(fallback);
      finish();
    };
    synth.speak(utterance);
  });
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm vitest run tests/animation/player-machine.test.ts tests/animation/duration.test.ts`
Expected: PASS（11 个用例）

- [ ] **Step 7: Commit**

```bash
git add lib/animation/playback tests/animation/player-machine.test.ts tests/animation/duration.test.ts
git commit -m "feat(animation): 播放状态机、时长估算与 TTS 适配器"
```

---

### Task 5: Prompt 模板 + 模型解析器

**Files:**
- Create: `lib/prompts/generators/animation-plan.md`
- Create: `lib/prompts/generators/animation-script.md`
- Modify: `lib/prompts/types.ts`（PromptId 联合类型末尾追加两项）
- Create: `lib/animation/generate/model.ts`
- Test: `tests/animation/model.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// tests/animation/model.test.ts
import { describe, it, expect } from 'vitest';
import { resolveAnimationModel } from '@/lib/animation/generate/model';

describe('resolveAnimationModel', () => {
  it('DEFAULT_MODEL=provider:model 优先', () => {
    const cfg = resolveAnimationModel({
      env: { DEFAULT_MODEL: 'deepseek:deepseek-flash', DEEPSEEK_API_KEY: 'sk-test' },
    });
    expect(cfg).toMatchObject({
      providerId: 'deepseek',
      modelId: 'deepseek-flash',
      apiKey: 'sk-test',
    });
  });

  it('无 DEFAULT_MODEL 时回退到第一个配置了 key 的候选', () => {
    const cfg = resolveAnimationModel({ env: { GLM_API_KEY: 'k' } });
    expect(cfg?.apiKey).toBe('k');
  });

  it('全未配置返回 null', () => {
    expect(resolveAnimationModel({ env: {} })).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/animation/model.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 model.ts**

```ts
// lib/animation/generate/model.ts
import type { ModelConfig } from '@/lib/types/provider';

/**
 * 候选 provider → 环境变量 key 名（与 lib/solve/solver-constants.ts 的
 * ENV_KEY_MAP 同源约定）。候选 modelId 须与 lib/ai/providers-registry.ts
 * 中实际注册的一致——实现前先 grep 校正：
 * grep -n "modelId" lib/ai/providers-registry.ts | head -20
 */
const CANDIDATES: {
  providerId: string;
  modelId: string;
  envKey: string;
  baseUrlEnv?: string;
}[] = [
  {
    providerId: 'deepseek',
    modelId: 'deepseek-flash',
    envKey: 'DEEPSEEK_API_KEY',
    baseUrlEnv: 'DEEPSEEK_BASE_URL',
  },
  { providerId: 'glm', modelId: 'glm-4.6-flash', envKey: 'GLM_API_KEY', baseUrlEnv: 'GLM_BASE_URL' },
  { providerId: 'qwen', modelId: 'qwen3-max', envKey: 'QWEN_API_KEY', baseUrlEnv: 'QWEN_BASE_URL' },
];

export interface ResolveEnv {
  DEFAULT_MODEL?: string;
  [key: string]: string | undefined;
}

/** 动画讲解用模型：DEFAULT_MODEL=provider:model-id 优先，否则第一个有 key 的候选。 */
export function resolveAnimationModel(opts?: { env?: ResolveEnv }): ModelConfig | null {
  const env = opts?.env ?? process.env;

  const def = env.DEFAULT_MODEL;
  if (def && def.includes(':')) {
    const [providerId, modelId] = def.split(':', 2);
    const cand = CANDIDATES.find((c) => c.providerId === providerId);
    const envKey = cand?.envKey ?? `${providerId.toUpperCase()}_API_KEY`;
    const key = env[envKey];
    if (key) {
      return {
        providerId: providerId as ModelConfig['providerId'],
        modelId,
        apiKey: key,
        baseUrl: cand?.baseUrlEnv ? env[cand.baseUrlEnv] || undefined : undefined,
        providerType: 'openai',
      };
    }
  }

  for (const c of CANDIDATES) {
    const key = env[c.envKey];
    if (key) {
      return {
        providerId: c.providerId as ModelConfig['providerId'],
        modelId: c.modelId,
        apiKey: key,
        baseUrl: c.baseUrlEnv ? env[c.baseUrlEnv] || undefined : undefined,
        providerType: 'openai',
      };
    }
  }
  return null;
}
```

- [ ] **Step 4: 创建 prompt 模板并注册 PromptId**

`lib/prompts/generators/animation-plan.md`：

````markdown
# 角色

你是教学动画导演，为"可结构化学科"（算法/数据结构/数学/物理）设计分步动画讲解大纲。

# 任务

用户会给出一个话题。请把它拆解为 5~20 个动画步骤，每步聚焦一个教学意图，逐步推进。

# 硬规则

- 第一阶段必须建立初始场景（介绍数据/坐标/初始状态），最后一步必须给出结论或完整图景。
- 每步只引入 1~2 个新变化（新元素出现 / 元素移动 / 状态高亮），避免一步内发生太多事情。
- 步骤之间要有因果衔接：上一步的结果是下一步的起点。
- 优先使用经典教学路径（如堆排序：建堆 → 插入上浮 → 取堆顶 → 下沉）。
- 输出语言与用户话题语言一致。

# 输出格式（纯 JSON，不要 markdown 代码块）

{
  "title": "讲解标题（≤20字）",
  "subjectArea": "algorithm | data-structure | math | physics 之一",
  "steps": [
    { "title": "步骤名（≤12字）", "intent": "这一步视觉上发生什么、观众应该理解什么（40~80字）" }
  ]
}
````

`lib/prompts/generators/animation-script.md`：

````markdown
# 角色

你是动画分镜工程师，把讲解大纲转换为严格合法的 AnimationScript JSON。

# 舞台

- 逻辑坐标系 1200 x 675（SVG viewBox），左上角 (0,0)，所有坐标必须在界内。
- 数组：array-cell 演员并排摆放，格宽 90、高 60，建议从 x=350 起水平排列，间距即格宽。
- 树/图：node 演员分层摆放，层间距 ≥140，同层间距 ≥120，circle 半径 28。
- 坐标系问题（函数/物理）：先放 axes 演员（如居中 x∈[150,1050], y∈[120,560]），曲线用一系列 node 点近似。
- 指针/高亮跟随目标演员：pointer 与 highlight 需与目标演员同帧出现。
- 箭头端点会自动跟随演员移动，只需声明 fromActorId/toActorId，不需给坐标。

# 演员与状态（严格按此 schema 输出）

- actors[] 声明所有演员（全局一次）：kind ∈ node | array-cell | arrow | pointer | text | highlight | bar | axes
  - node: { kind, id, label, shape: "circle"|"rect", color: "#rrggbb", r } 或 rect 用 { w, h }
  - array-cell: { kind, id, label, w, h, color }
  - arrow: { kind, id, fromActorId, toActorId, label?, curved? }
  - pointer: { kind, id, label, targetActorId }
  - text: { kind, id, content, size, color }
  - highlight: { kind, id, targetActorId, color }
  - bar: { kind, id, label, w, color }
  - axes: { kind, id, xmin, xmax, ymin, ymax }
- steps[] 每步：{ id, title, narration, actorStates[] }
  - actorStates 是全量快照：列出该步**所有**可见演员的状态 { actorId, x, y }（中心点坐标）。
  - 被高亮的演员当步可加 colorOverride；新出场元素位置照常给出（渲染器自动做入场动画）。
  - narration 是该步旁白（30~80 字），将用 TTS 朗读，要口语化、与画面变化一一对应。

# 硬规则

- 每步 actorStates 必须包含该步所有可见演员，漏写会导致元素消失。
- 相邻步之间同一演员位移不要超过舞台对角线的 60%，大移动拆成中间步。
- color 一律 #rrggbb 六位格式。
- id 用语义化英文短名（如 cell-0, node-left, ptr-i）。
- 输出纯 JSON，不要 markdown 代码块，不要解释。

# 输出格式

{
  "id": "anim-<8位随机>",
  "title": "标题",
  "topic": "话题",
  "subjectArea": "algorithm",
  "stage": { "width": 1200, "height": 675, "showGrid": true },
  "actors": [ ... ],
  "steps": [ { "id": "step-1", "title": "...", "narration": "...", "actorStates": [ { "actorId": "...", "x": 0, "y": 0 } ] } ]
}
````

Modify `lib/prompts/types.ts`（PromptId 联合类型末尾，`'generators/visualization3d-content';` 处改为）：

```ts
  | 'generators/visualization3d-content'
  // Animation explainer
  | 'generators/animation-plan'
  | 'generators/animation-script';
```

- [ ] **Step 5: 跑测试确认通过 + typecheck**

Run: `pnpm vitest run tests/animation/model.test.ts`
Expected: PASS（3 个用例）

Run: `npx tsc --noEmit`
Expected: 无新增错误

- [ ] **Step 6: Commit**

```bash
git add lib/prompts/generators/animation-plan.md lib/prompts/generators/animation-script.md lib/prompts/types.ts lib/animation/generate/model.ts tests/animation/model.test.ts
git commit -m "feat(animation): 分镜生成 prompt 模板与模型解析器"
```

---

### Task 6: Plan Agent + Script Agent + 生成管线

**Files:**
- Create: `lib/animation/generate/plan-agent.ts`
- Create: `lib/animation/generate/script-agent.ts`
- Create: `lib/animation/generate/pipeline.ts`
- Test: `tests/animation/pipeline.test.ts`

- [ ] **Step 1: 写失败测试（管线编排，mock callLLM）**

```ts
// tests/animation/pipeline.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const planJson = JSON.stringify({
  title: '快速排序的 partition 过程',
  subjectArea: 'algorithm',
  steps: Array.from({ length: 6 }, (_, i) => ({ title: `第${i + 1}步`, intent: `意图${i}` })),
});

const validScriptJson = JSON.stringify({
  id: 'anim-abc',
  title: '快速排序',
  topic: '快排',
  subjectArea: 'algorithm',
  stage: { width: 1200, height: 675 },
  actors: [{ kind: 'array-cell', id: 'c0', label: '3', w: 90, h: 60, color: '#4f8ef7' }],
  steps: [
    { id: 's1', title: '初始', narration: '数组如下。', actorStates: [{ actorId: 'c0', x: 400, y: 300 }] },
    { id: 's2', title: '结束', narration: '排序完成。', actorStates: [{ actorId: 'c0', x: 400, y: 300 }] },
  ],
});

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn(),
}));
vi.mock('@/lib/prompts/loader', () => ({
  loadPrompt: vi.fn((id: string) => ({ id, systemPrompt: 'sys', userPromptTemplate: 'user' })),
}));

import { callLLM } from '@/lib/ai/llm';
import {
  runAnimationGeneration,
  AnimationGenerationError,
} from '@/lib/animation/generate/pipeline';

const mockedCallLLM = vi.mocked(callLLM);

const defaultImpl = async (_params: unknown, label: string) => ({
  text: label === 'animation-plan' ? planJson : validScriptJson,
});

describe('animation pipeline', () => {
  beforeEach(() => {
    mockedCallLLM.mockReset();
    mockedCallLLM.mockImplementation(defaultImpl as never);
  });

  it('runAnimationGeneration 报告进度并产出脚本', async () => {
    const progress: string[] = [];
    const result = await runAnimationGeneration('快排', {
      onProgress: (stage, pct) => progress.push(`${stage}:${pct}`),
    });
    expect(result.script.id).toBe('anim-abc');
    expect(result.script.steps).toHaveLength(2);
    expect(progress).toContain('planning:10');
    expect(progress).toContain('done:100');
  });

  it('script 阶段失败时抛出携带 plan 的 AnimationGenerationError（spec §8.1 降级）', async () => {
    mockedCallLLM.mockImplementation(async (_params: unknown, label: string) => {
      if (label === 'animation-plan') return { text: planJson } as never;
      throw new Error('boom');
    });
    try {
      await runAnimationGeneration('快排');
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AnimationGenerationError);
      const err = e as AnimationGenerationError;
      expect(err.message).toContain('boom');
      expect(err.plan?.steps).toHaveLength(6);
    }
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/animation/pipeline.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 plan-agent.ts**

```ts
// lib/animation/generate/plan-agent.ts
import { z } from 'zod';
import { callLLM } from '@/lib/ai/llm';
import { loadPrompt } from '@/lib/prompts/loader';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { resolveAnimationModel } from './model';
import { createLogger } from '@/lib/logger';

const log = createLogger('AnimationPlanAgent');

const planSchema = z.object({
  title: z.string().min(1),
  subjectArea: z.enum(['algorithm', 'data-structure', 'math', 'physics']),
  steps: z
    .array(z.object({ title: z.string().min(1), intent: z.string().min(1) }))
    .min(5)
    .max(20),
});

export interface AnimationPlan {
  title: string;
  subjectArea: 'algorithm' | 'data-structure' | 'math' | 'physics';
  steps: { title: string; intent: string }[];
}

export async function planAnimation(topic: string): Promise<AnimationPlan> {
  const modelConfig = resolveAnimationModel();
  if (!modelConfig) {
    throw new Error('未配置任何可用的 LLM provider（检查 .env 中的 API key 或 DEFAULT_MODEL）');
  }
  const { getModel } = await import('@/lib/ai/providers');
  const { model } = getModel(modelConfig);
  const prompt = loadPrompt('generators/animation-plan');
  if (!prompt) throw new Error('加载 prompt generators/animation-plan 失败');

  const result = await callLLM(
    {
      model,
      system: prompt.systemPrompt,
      prompt: `话题：${topic}`,
      maxOutputTokens: 4096,
      temperature: 0.6,
    },
    'animation-plan',
    {
      retries: 2,
      timeoutMs: 180000,
      validate: (text: string) => {
        const parsed = parseJsonResponse(text);
        return !!parsed && planSchema.safeParse(parsed).success;
      },
    },
    { mode: 'disabled', enabled: false },
  );

  const parsed = planSchema.safeParse(parseJsonResponse(result.text));
  if (!parsed.success) {
    log.error('plan 解析失败', parsed.error);
    throw new Error('讲解大纲生成失败：LLM 输出不符合 schema');
  }
  log.info(`plan ok: ${parsed.data.steps.length} 步`);
  return parsed.data;
}
```

- [ ] **Step 4: 实现 script-agent.ts**

```ts
// lib/animation/generate/script-agent.ts
import { callLLM } from '@/lib/ai/llm';
import { loadPrompt } from '@/lib/prompts/loader';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { autoFixScript } from '@/lib/animation/schema';
import { validateScript } from '@/lib/animation/validate';
import type { AnimationScript } from '@/lib/animation/types';
import type { AnimationPlan } from './plan-agent';
import { resolveAnimationModel } from './model';
import { createLogger } from '@/lib/logger';

const log = createLogger('AnimationScriptAgent');

const MAX_RETRIES = 3;

/** 大纲 → 完整分镜脚本。校验失败带错误反馈重试（指数退避），耗尽后 fail hard（spec §6）。 */
export async function generateAnimationScript(
  topic: string,
  plan: AnimationPlan,
): Promise<{ script: AnimationScript; warnings: string[] }> {
  const modelConfig = resolveAnimationModel();
  if (!modelConfig) throw new Error('未配置任何可用的 LLM provider');
  const { getModel } = await import('@/lib/ai/providers');
  const { model } = getModel(modelConfig);
  const prompt = loadPrompt('generators/animation-script');
  if (!prompt) throw new Error('加载 prompt generators/animation-script 失败');

  const baseUser = `话题：${topic}\n\n讲解大纲（严格按此推进）：\n${JSON.stringify(plan, null, 2)}`;
  let lastError = '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // 重试时把上一轮的校验错误反馈给模型
    const attemptUser =
      attempt > 1 ? `${baseUser}\n\n上一次输出存在以下校验错误，务必修复：${lastError}` : baseUser;
    try {
      const result = await callLLM(
        {
          model,
          system: prompt.systemPrompt,
          prompt: attemptUser,
          maxOutputTokens: 8192,
          temperature: 0.4,
        },
        'animation-script',
        { retries: 1, timeoutMs: 240000 },
        { mode: 'disabled', enabled: false },
      );

      const { script, fixes } = autoFixScript(parseJsonResponse(result.text));
      const { errors, warnings } = validateScript(script);
      if (fixes.length) log.warn(`autoFix 修复 ${fixes.length} 处`, fixes);

      if (errors.length === 0) {
        return { script, warnings: warnings.map((w) => w.message) };
      }
      lastError = errors.map((e) => e.message).join('；');
      log.warn(`attempt ${attempt}: ${errors.length} 个校验错误，将重试`, lastError);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      log.warn(`attempt ${attempt} 抛错: ${lastError}`);
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
  }

  throw new Error(`分镜脚本生成失败（已重试 ${MAX_RETRIES} 次）：${lastError}`);
}
```

- [ ] **Step 5: 实现 pipeline.ts**

```ts
// lib/animation/generate/pipeline.ts
import { nanoid } from 'nanoid';
import { planAnimation, type AnimationPlan } from './plan-agent';
import { generateAnimationScript } from './script-agent';
import type { AnimationScript } from '@/lib/animation/types';

export type GenerationStage = 'planning' | 'scripting' | 'validating' | 'done' | 'failed';

export type ProgressCallback = (
  stage: GenerationStage,
  progress: number,
  message?: string,
) => void;

export interface GenerationResult {
  script: AnimationScript;
  warnings: string[];
}

/**
 * script 阶段失败时携带已成功的 plan 上抛——调用方（API route）把它存进
 * job，前端降级展示大纲文字版（spec §8.1）。
 */
export class AnimationGenerationError extends Error {
  plan?: AnimationPlan;
  constructor(message: string, plan?: AnimationPlan) {
    super(message);
    this.name = 'AnimationGenerationError';
    this.plan = plan;
  }
}

/**
 * 完整生成流程（spec §6）：plan → script（内含校验+重试）→ 完成。
 * 进度点：planning:10 → planning:30 → scripting:40 → scripting:70 → done:100。
 */
export async function runAnimationGeneration(
  topic: string,
  opts: { onProgress?: ProgressCallback } = {},
): Promise<GenerationResult> {
  const onProgress = opts.onProgress ?? (() => {});

  onProgress('planning', 10, '正在规划讲解步骤');
  const plan: AnimationPlan = await planAnimation(topic);
  onProgress('planning', 30, `已规划 ${plan.steps.length} 个步骤`);

  onProgress('scripting', 40, '正在编写分镜脚本');
  let scriptResult: Awaited<ReturnType<typeof generateAnimationScript>>;
  try {
    scriptResult = await generateAnimationScript(topic, plan);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AnimationGenerationError(msg, plan);
  }
  onProgress('scripting', 70, '分镜脚本完成，正在校验');

  const finalScript: AnimationScript = {
    ...scriptResult.script,
    id: scriptResult.script.id || `anim-${nanoid(8)}`,
  };
  onProgress('done', 100, '完成');
  return { script: finalScript, warnings: scriptResult.warnings };
}

export { planAnimation, generateAnimationScript };
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm vitest run tests/animation/pipeline.test.ts`
Expected: PASS（2 个用例）

Run: `npx tsc --noEmit`
Expected: 无新增错误

- [ ] **Step 7: Commit**

```bash
git add lib/animation/generate tests/animation/pipeline.test.ts
git commit -m "feat(animation): Plan/Script agent 与两段式生成管线"
```

---

### Task 7: Job store + Script store + API 路由

**Files:**
- Create: `lib/animation/animation-job-store.ts`
- Create: `lib/animation/script-store.ts`
- Create: `app/api/animation/generate/route.ts`
- Create: `app/api/animation/jobs/[jobId]/route.ts`
- Create: `app/api/animation/scripts/route.ts`
- Create: `app/api/animation/scripts/[scriptId]/route.ts`
- Test: `tests/animation/job-store.test.ts`
- Test: `tests/animation/script-store.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// tests/animation/job-store.test.ts
// 说明：store 通过 path.join(process.cwd(), 'data', 'animation-jobs') 定位目录，
// 并优先读环境变量 ANIMATION_JOBS_DIR / ANIMATION_SCRIPTS_DIR —— 测试用它指向临时目录。
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  createAnimationJob,
  readAnimationJob,
  markAnimationJobRunning,
  updateAnimationJob,
  markAnimationJobSucceeded,
  markAnimationJobFailed,
} from '@/lib/animation/animation-job-store';

describe('animation job store', () => {
  beforeEach(() => {
    process.env.ANIMATION_JOBS_DIR = mkdtempSync(join(tmpdir(), 'anim-jobs-'));
  });

  it('创建 → running → succeeded 全生命周期', async () => {
    const job = await createAnimationJob('二叉堆');
    expect(job.status).toBe('queued');

    await markAnimationJobRunning(job.jobId, 'planning');
    let read = await readAnimationJob(job.jobId);
    expect(read?.status).toBe('running');
    expect(read?.stage).toBe('planning');

    await updateAnimationJob(job.jobId, { stage: 'scripting', progress: 40, message: '编写分镜' });
    read = await readAnimationJob(job.jobId);
    expect(read?.progress).toBe(40);

    await markAnimationJobSucceeded(job.jobId, { scriptId: 'anim-1', title: 't', stepCount: 8 });
    read = await readAnimationJob(job.jobId);
    expect(read?.status).toBe('succeeded');
    expect(read?.result?.scriptId).toBe('anim-1');
  });

  it('failed 记录错误，planOutline 可随 job 保存（spec §8.1 降级）', async () => {
    const job = await createAnimationJob('快排');
    await updateAnimationJob(job.jobId, {
      status: 'failed',
      stage: 'failed',
      message: '分镜生成失败，已保留讲解大纲',
      error: 'LLM 超时',
      planOutline: {
        title: '快排大纲',
        steps: [{ title: '建堆', intent: '介绍初始数组' }],
      },
    });
    const read = await readAnimationJob(job.jobId);
    expect(read?.status).toBe('failed');
    expect(read?.error).toBe('LLM 超时');
    expect(read?.planOutline?.steps).toHaveLength(1);
  });
});
```

```ts
// tests/animation/script-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  saveAnimationScript,
  readAnimationScript,
  listAnimationScripts,
} from '@/lib/animation/script-store';
import type { AnimationScript } from '@/lib/animation/types';

const script: AnimationScript = {
  id: 'anim-test1',
  title: '堆的插入',
  topic: '二叉堆',
  subjectArea: 'data-structure',
  stage: { width: 1200, height: 675 },
  actors: [{ kind: 'node', id: 'n1', label: '4', shape: 'circle', color: '#4f8ef7', r: 28 }],
  steps: [{ id: 's1', title: 't', narration: 'n', actorStates: [{ actorId: 'n1', x: 600, y: 300 }] }],
};

describe('script store', () => {
  beforeEach(() => {
    process.env.ANIMATION_SCRIPTS_DIR = mkdtempSync(join(tmpdir(), 'anim-scripts-'));
  });

  it('保存后可读取并列出元数据', async () => {
    await saveAnimationScript(script);
    const read = await readAnimationScript('anim-test1');
    expect(read?.title).toBe('堆的插入');

    const list = await listAnimationScripts();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ scriptId: 'anim-test1', stepCount: 1 });
  });

  it('读取不存在的脚本返回 null', async () => {
    expect(await readAnimationScript('nope')).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/animation/job-store.test.ts tests/animation/script-store.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 animation-job-store.ts（照搬 slides 模式）**

```ts
// lib/animation/animation-job-store.ts
/**
 * 动画生成 job 的文件式持久化（模式与 lib/slides/agent/slides-job-store.ts 一致）：
 * data/animation-jobs/{jobId}.json，stale 30 分钟、终态保留 24 小时。
 * 测试可通过 ANIMATION_JOBS_DIR 覆盖目录。
 */
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';
import { createLogger } from '@/lib/logger';

const log = createLogger('AnimationJobStore');

export type AnimationJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type AnimationJobStage = 'planning' | 'scripting' | 'validating' | 'done' | 'failed';

export interface AnimationJob {
  jobId: string;
  topic: string;
  status: AnimationJobStatus;
  stage: AnimationJobStage;
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  result?: { scriptId: string; title: string; stepCount: number };
  error?: string;
  /** script 失败但 plan 成功时保留大纲，前端降级展示（spec §8.1） */
  planOutline?: { title: string; steps: { title: string; intent: string }[] };
}

const STALE_JOB_TIMEOUT_MS = 30 * 60 * 1000;
const TERMINAL_JOB_RETENTION_MS = 24 * 60 * 60 * 1000;

function jobsDir(): string {
  return process.env.ANIMATION_JOBS_DIR ?? path.join(process.cwd(), 'data', 'animation-jobs');
}

function jobFilePath(jobId: string): string {
  return path.join(jobsDir(), `${jobId}.json`);
}

export function isValidAnimationJobId(jobId: string): boolean {
  return /^[A-Za-z0-9_-]{6,64}$/.test(jobId);
}

function markStaleIfNeeded(job: AnimationJob): AnimationJob {
  if (job.status !== 'running' && job.status !== 'queued') return job;
  if (Date.now() - new Date(job.updatedAt).getTime() < STALE_JOB_TIMEOUT_MS) return job;
  const stale: AnimationJob = {
    ...job,
    status: 'failed',
    stage: 'failed',
    error: '任务超时（可能因进程重启中断）',
    completedAt: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(jobFilePath(job.jobId), JSON.stringify(stale, null, 2));
  } catch (err) {
    log.error('标记 stale 失败', err);
  }
  return stale;
}

async function cleanupTerminalJobs(): Promise<void> {
  try {
    const names = await fsp.readdir(jobsDir());
    const now = Date.now();
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      try {
        const raw = await fsp.readFile(path.join(jobsDir(), name), 'utf-8');
        const job = JSON.parse(raw) as AnimationJob;
        if (
          (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') &&
          job.completedAt &&
          now - new Date(job.completedAt).getTime() > TERMINAL_JOB_RETENTION_MS
        ) {
          await fsp.unlink(path.join(jobsDir(), name));
        }
      } catch {
        // 单个文件损坏不影响清理
      }
    }
  } catch {
    // 目录不存在等
  }
}

export async function createAnimationJob(topic: string): Promise<AnimationJob> {
  await fsp.mkdir(jobsDir(), { recursive: true });
  const now = new Date().toISOString();
  const job: AnimationJob = {
    jobId: `animjob-${nanoid(12)}`,
    topic,
    status: 'queued',
    stage: 'planning',
    progress: 0,
    message: '排队中',
    createdAt: now,
    updatedAt: now,
  };
  await fsp.writeFile(jobFilePath(job.jobId), JSON.stringify(job, null, 2));
  void cleanupTerminalJobs();
  return job;
}

export async function readAnimationJob(jobId: string): Promise<AnimationJob | null> {
  if (!isValidAnimationJobId(jobId)) return null;
  try {
    const raw = await fsp.readFile(jobFilePath(jobId), 'utf-8');
    return markStaleIfNeeded(JSON.parse(raw) as AnimationJob);
  } catch {
    return null;
  }
}

export async function updateAnimationJob(
  jobId: string,
  update: Partial<Omit<AnimationJob, 'jobId' | 'createdAt'>>,
): Promise<AnimationJob | null> {
  const job = await readAnimationJob(jobId);
  if (!job) return null;
  const next: AnimationJob = { ...job, ...update, updatedAt: new Date().toISOString() };
  await fsp.writeFile(jobFilePath(jobId), JSON.stringify(next, null, 2));
  return next;
}

export async function markAnimationJobRunning(
  jobId: string,
  stage: AnimationJobStage,
): Promise<AnimationJob | null> {
  return updateAnimationJob(jobId, { status: 'running', stage, progress: 5, message: '开始生成' });
}

export async function markAnimationJobSucceeded(
  jobId: string,
  result: { scriptId: string; title: string; stepCount: number },
): Promise<AnimationJob | null> {
  return updateAnimationJob(jobId, {
    status: 'succeeded',
    stage: 'done',
    progress: 100,
    message: '生成完成',
    completedAt: new Date().toISOString(),
    result,
  });
}

export async function markAnimationJobFailed(
  jobId: string,
  error: string,
): Promise<AnimationJob | null> {
  return updateAnimationJob(jobId, {
    status: 'failed',
    stage: 'failed',
    message: '生成失败',
    error,
    completedAt: new Date().toISOString(),
  });
}
```

- [ ] **Step 4: 实现 script-store.ts**

```ts
// lib/animation/script-store.ts
/** 生成完成的分镜脚本持久化：data/animation-scripts/{scriptId}.json（spec §7） */
import fsp from 'fs/promises';
import path from 'path';
import type { AnimationScript, ScriptMeta } from './types';

function scriptsDir(): string {
  return (
    process.env.ANIMATION_SCRIPTS_DIR ??
    path.join(process.cwd(), 'data', 'animation-scripts')
  );
}

function scriptFilePath(scriptId: string): string {
  return path.join(scriptsDir(), `${scriptId}.json`);
}

export function isValidScriptId(scriptId: string): boolean {
  return /^[A-Za-z0-9_-]{4,64}$/.test(scriptId);
}

export async function saveAnimationScript(script: AnimationScript): Promise<void> {
  const dir = scriptsDir();
  await fsp.mkdir(dir, { recursive: true });
  const payload = { ...script, savedAt: new Date().toISOString() };
  await fsp.writeFile(scriptFilePath(script.id), JSON.stringify(payload, null, 2));
}

export async function readAnimationScript(scriptId: string): Promise<AnimationScript | null> {
  if (!isValidScriptId(scriptId)) return null;
  try {
    const raw = await fsp.readFile(scriptFilePath(scriptId), 'utf-8');
    const parsed = JSON.parse(raw) as AnimationScript & { savedAt?: string };
    const { savedAt: _savedAt, ...script } = parsed;
    return script;
  } catch {
    return null;
  }
}

export async function listAnimationScripts(): Promise<ScriptMeta[]> {
  try {
    const names = await fsp.readdir(scriptsDir());
    const metas: ScriptMeta[] = [];
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      try {
        const raw = await fsp.readFile(path.join(scriptsDir(), name), 'utf-8');
        const s = JSON.parse(raw) as AnimationScript & { savedAt?: string };
        metas.push({
          scriptId: s.id,
          title: s.title,
          topic: s.topic,
          subjectArea: s.subjectArea,
          stepCount: s.steps.length,
          createdAt: s.savedAt ?? new Date().toISOString(),
        });
      } catch {
        // 跳过损坏文件
      }
    }
    return metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}
```

- [ ] **Step 5: 实现 4 个 API 路由**

```ts
// app/api/animation/generate/route.ts
import { after, type NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  createAnimationJob,
  markAnimationJobRunning,
  markAnimationJobSucceeded,
  markAnimationJobFailed,
  updateAnimationJob,
} from '@/lib/animation/animation-job-store';
import { saveAnimationScript } from '@/lib/animation/script-store';
import {
  runAnimationGeneration,
  AnimationGenerationError,
} from '@/lib/animation/generate/pipeline';
import { createLogger } from '@/lib/logger';

const log = createLogger('AnimationGenerateAPI');

const bodySchema = z.object({ topic: z.string().trim().min(2).max(120) });

export async function POST(request: NextRequest) {
  let topic: string;
  try {
    const body = bodySchema.parse(await request.json());
    topic = body.topic;
  } catch {
    return apiError('话题长度需在 2~120 字符之间', 400);
  }

  const job = await createAnimationJob(topic);

  after(async () => {
    try {
      await markAnimationJobRunning(job.jobId, 'planning');
      const { script, warnings } = await runAnimationGeneration(topic, {
        onProgress: (stage, progress, message) => {
          void updateAnimationJob(job.jobId, {
            stage: stage === 'done' ? 'validating' : stage,
            progress,
            message: message ?? '',
          });
        },
      });
      await saveAnimationScript(script);
      if (warnings.length) log.warn('生成完成但有警告', warnings);
      await markAnimationJobSucceeded(job.jobId, {
        scriptId: script.id,
        title: script.title,
        stepCount: script.steps.length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`生成失败: ${msg}`);
      // plan 成功而 script 失败：保留大纲供前端降级展示（spec §8.1）
      if (err instanceof AnimationGenerationError && err.plan) {
        await updateAnimationJob(job.jobId, {
          status: 'failed',
          stage: 'failed',
          message: '分镜生成失败，已保留讲解大纲',
          error: msg,
          completedAt: new Date().toISOString(),
          planOutline: { title: err.plan.title, steps: err.plan.steps },
        });
      } else {
        await markAnimationJobFailed(job.jobId, msg);
      }
    }
  });

  return apiSuccess({ jobId: job.jobId });
}
```

```ts
// app/api/animation/jobs/[jobId]/route.ts
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { readAnimationJob } from '@/lib/animation/animation-job-store';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const job = await readAnimationJob(jobId);
  if (!job) return apiError('任务不存在', 404);
  return apiSuccess({ job });
}
```

```ts
// app/api/animation/scripts/route.ts
import { apiSuccess } from '@/lib/server/api-response';
import { listAnimationScripts } from '@/lib/animation/script-store';

export async function GET() {
  const scripts = await listAnimationScripts();
  return apiSuccess({ scripts });
}
```

```ts
// app/api/animation/scripts/[scriptId]/route.ts
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { readAnimationScript } from '@/lib/animation/script-store';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ scriptId: string }> },
) {
  const { scriptId } = await params;
  const script = await readAnimationScript(scriptId);
  if (!script) return apiError('脚本不存在', 404);
  return apiSuccess({ script });
}
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm vitest run tests/animation/job-store.test.ts tests/animation/script-store.test.ts`
Expected: PASS（4 个用例）

- [ ] **Step 7: Commit**

```bash
git add lib/animation/animation-job-store.ts lib/animation/script-store.ts app/api/animation tests/animation/job-store.test.ts tests/animation/script-store.test.ts
git commit -m "feat(animation): job/script 持久化与生成 API 路由"
```

---

### Task 8: 渲染器组件

**Files:**
- Create: `components/animation/renderer/actors.tsx`
- Create: `components/animation/renderer/animation-canvas.tsx`
- Test: `tests/animation/renderer.test.tsx`

- [ ] **Step 1: 写失败测试（结构性断言）**

```tsx
// tests/animation/renderer.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AnimationCanvas } from '@/components/animation/renderer/animation-canvas';
import type { AnimationScript } from '@/lib/animation/types';

const script: AnimationScript = {
  id: 's',
  title: 't',
  topic: 'tp',
  subjectArea: 'algorithm',
  stage: { width: 1200, height: 675, showGrid: true },
  actors: [
    { kind: 'node', id: 'n1', label: '4', shape: 'circle', color: '#4f8ef7', r: 28 },
    { kind: 'array-cell', id: 'c1', label: '7', w: 90, h: 60, color: '#4f8ef7' },
    { kind: 'arrow', id: 'a1', fromActorId: 'n1', toActorId: 'c1' },
    { kind: 'pointer', id: 'p1', label: 'i', targetActorId: 'c1' },
    { kind: 'text', id: 't1', content: '标题', size: 24, color: '#333333' },
    { kind: 'highlight', id: 'h1', targetActorId: 'n1', color: '#f76e4f' },
    { kind: 'bar', id: 'b1', label: '3', w: 60, color: '#4f8ef7' },
    { kind: 'axes', id: 'ax1', xmin: 0, xmax: 10, ymin: 0, ymax: 10 },
  ],
  steps: [
    {
      id: 's1',
      title: '第1步',
      narration: 'n',
      actorStates: [
        { actorId: 'n1', x: 300, y: 200 },
        { actorId: 'c1', x: 300, y: 500 },
        { actorId: 'a1', x: 0, y: 0 },
        { actorId: 'p1', x: 0, y: 0 },
        { actorId: 't1', x: 600, y: 60 },
        { actorId: 'h1', x: 0, y: 0 },
        { actorId: 'b1', x: 800, y: 500 },
        { actorId: 'ax1', x: 600, y: 337 },
      ],
    },
  ],
};

describe('AnimationCanvas', () => {
  it('渲染 SVG 且每种演员都出现', () => {
    const { container } = render(<AnimationCanvas script={script} stepIndex={0} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 1200 675');
    for (const id of ['n1', 'c1', 'a1', 'p1', 't1', 'h1', 'b1', 'ax1']) {
      expect(container.querySelector(`[data-actor-id="${id}"]`)).not.toBeNull();
    }
  });

  it('渲染演员标签文本', () => {
    const { container } = render(<AnimationCanvas script={script} stepIndex={0} />);
    expect(container.textContent).toContain('4');
    expect(container.textContent).toContain('7');
    expect(container.textContent).toContain('i');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/animation/renderer.test.tsx`
Expected: FAIL

- [ ] **Step 3: 实现 actors.tsx（每种演员一个组件）**

```tsx
// components/animation/renderer/actors.tsx
'use client';

import { motion } from 'motion/react';
import { buildArrowPath, approxActorRadius } from '@/lib/animation/interpolate';
import type { Actor, ActorState } from '@/lib/animation/types';

/** 公共补间配置（spec §4：~700ms 弹簧） */
export const STEP_TRANSITION = { type: 'spring' as const, stiffness: 120, damping: 20 };

interface ActorProps {
  actor: Actor;
  state: ActorState;
  stateOf: (actorId: string) => ActorState | undefined;
  actorOf: (actorId: string) => Actor | undefined;
  /** exiting=true：该演员本步已退场，挂载时即以 opacity 1 渲染再淡出 */
  mode?: 'visible' | 'exiting';
}

/** 取演员显示标签（状态可覆写） */
function labelOf(actor: Actor, state: ActorState): string {
  return state.labelOverride ?? ('label' in actor ? actor.label : '');
}

function colorOf(actor: Actor, state: ActorState): string {
  return state.colorOverride ?? ('color' in actor ? actor.color : '#4f8ef7');
}

function enterInitial(mode: 'visible' | 'exiting' | undefined) {
  return mode === 'exiting' ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 };
}

export function NodeActorView({ actor, state, mode }: ActorProps) {
  if (actor.kind !== 'node') return null;
  const color = colorOf(actor, state);
  const fill = `${color}26`; // 14% 透明底
  return (
    <motion.g
      data-actor-id={actor.id}
      initial={enterInitial(mode)}
      animate={{
        x: state.x,
        y: state.y,
        opacity: state.exiting ? 0 : (state.opacity ?? 1),
        scale: state.scale ?? 1,
      }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={STEP_TRANSITION}
    >
      {actor.shape === 'circle' ? (
        <circle r={actor.r ?? 28} fill={fill} stroke={color} strokeWidth={3} />
      ) : (
        <rect
          x={-(actor.w ?? 80) / 2}
          y={-(actor.h ?? 40) / 2}
          width={actor.w ?? 80}
          height={actor.h ?? 40}
          rx={8}
          fill={fill}
          stroke={color}
          strokeWidth={3}
        />
      )}
      <text textAnchor="middle" dominantBaseline="central" fontSize={20} fill={color} fontWeight={600}>
        {labelOf(actor, state)}
      </text>
    </motion.g>
  );
}

export function ArrayCellActorView({ actor, state, mode }: ActorProps) {
  if (actor.kind !== 'array-cell') return null;
  const color = colorOf(actor, state);
  return (
    <motion.g
      data-actor-id={actor.id}
      initial={enterInitial(mode)}
      animate={{
        x: state.x,
        y: state.y,
        opacity: state.exiting ? 0 : (state.opacity ?? 1),
        scale: state.scale ?? 1,
      }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={STEP_TRANSITION}
    >
      <rect
        x={-actor.w / 2}
        y={-actor.h / 2}
        width={actor.w}
        height={actor.h}
        rx={6}
        fill={`${color}1a`}
        stroke={color}
        strokeWidth={2.5}
      />
      <text textAnchor="middle" dominantBaseline="central" fontSize={22} fill={color} fontWeight={600}>
        {labelOf(actor, state)}
      </text>
    </motion.g>
  );
}

export function BarActorView({ actor, state, mode }: ActorProps) {
  if (actor.kind !== 'bar') return null;
  const color = colorOf(actor, state);
  return (
    <motion.g
      data-actor-id={actor.id}
      initial={{ opacity: mode === 'exiting' ? 1 : 0 }}
      animate={{ x: state.x, y: state.y, opacity: state.exiting ? 0 : (state.opacity ?? 1) }}
      exit={{ opacity: 0 }}
      transition={STEP_TRANSITION}
    >
      {/* v1 柱高固定 200，高低差异用 state.scale 表达 */}
      <rect x={-actor.w / 2} y={-200} width={actor.w} height={200} rx={4} fill={color} />
      <text textAnchor="middle" y={-210} fontSize={18} fill={color} fontWeight={600}>
        {labelOf(actor, state)}
      </text>
    </motion.g>
  );
}

export function TextActorView({ actor, state, mode }: ActorProps) {
  if (actor.kind !== 'text') return null;
  return (
    <motion.text
      data-actor-id={actor.id}
      textAnchor="middle"
      fontSize={actor.size}
      fontWeight={600}
      initial={{ opacity: mode === 'exiting' ? 1 : 0 }}
      animate={{ x: state.x, y: state.y, opacity: state.exiting ? 0 : (state.opacity ?? 1) }}
      exit={{ opacity: 0 }}
      transition={STEP_TRANSITION}
      fill={colorOf(actor, state)}
    >
      {state.labelOverride ?? actor.content}
    </motion.text>
  );
}

export function PointerActorView({ actor, state, mode, stateOf, actorOf }: ActorProps) {
  if (actor.kind !== 'pointer') return null;
  const target = stateOf(actor.targetActorId);
  const targetActor = actorOf(actor.targetActorId);
  const tx = target?.x ?? state.x;
  const ty = target?.y ?? state.y;
  const r = targetActor ? approxActorRadius(targetActor) : 24;
  return (
    <motion.g
      data-actor-id={actor.id}
      initial={{ opacity: mode === 'exiting' ? 1 : 0 }}
      animate={{ x: tx, y: ty + r + 22, opacity: state.exiting ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={STEP_TRANSITION}
    >
      <path d="M -8 -14 L 8 -14 L 0 0 Z" fill="#e8590c" />
      <text textAnchor="middle" y={16} fontSize={18} fontWeight={700} fill="#e8590c">
        {state.labelOverride ?? actor.label}
      </text>
    </motion.g>
  );
}

export function HighlightActorView({ actor, state, mode, stateOf, actorOf }: ActorProps) {
  if (actor.kind !== 'highlight') return null;
  const target = stateOf(actor.targetActorId);
  const targetActor = actorOf(actor.targetActorId);
  const r = (targetActor ? approxActorRadius(targetActor) : 24) + 12;
  return (
    <motion.rect
      data-actor-id={actor.id}
      width={r * 2}
      height={r * 2}
      x={-r}
      y={-r}
      rx={12}
      fill="none"
      stroke={state.colorOverride ?? actor.color}
      strokeWidth={3.5}
      initial={{ opacity: mode === 'exiting' ? 1 : 0 }}
      animate={{
        x: (target?.x ?? state.x) - r,
        y: (target?.y ?? state.y) - r,
        opacity: state.exiting ? 0 : 1,
      }}
      exit={{ opacity: 0 }}
      transition={STEP_TRANSITION}
    />
  );
}

export function ArrowActorView({ actor, state, mode, stateOf, actorOf }: ActorProps) {
  if (actor.kind !== 'arrow') return null;
  const from = stateOf(actor.fromActorId);
  const to = stateOf(actor.toActorId);
  const fromActor = actorOf(actor.fromActorId);
  const toActor = actorOf(actor.toActorId);
  if (!from || !to || !fromActor || !toActor) return null;
  // 箭头端点从演员状态实时计算（spec §3.2：节点移动时箭头自动跟随）
  const d = buildArrowPath({
    x1: from.x,
    y1: from.y,
    x2: to.x,
    y2: to.y,
    r1: approxActorRadius(fromActor),
    r2: approxActorRadius(toActor),
    curved: actor.curved ?? false,
  });
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  return (
    <g data-actor-id={actor.id}>
      <motion.path
        d={d}
        initial={{ opacity: mode === 'exiting' ? 1 : 0, d }}
        animate={{ opacity: state.exiting ? 0 : 1, d }}
        exit={{ opacity: 0 }}
        transition={STEP_TRANSITION}
        fill="none"
        stroke="#495057"
        strokeWidth={2.5}
        markerEnd="url(#anim-arrowhead)"
      />
      {actor.label ? (
        <motion.text
          initial={{ opacity: mode === 'exiting' ? 1 : 0 }}
          animate={{ x: midX, y: midY - 10, opacity: state.exiting ? 0 : 1 }}
          exit={{ opacity: 0 }}
          fontSize={16}
          fill="#495057"
          textAnchor="middle"
        >
          {actor.label}
        </motion.text>
      ) : null}
    </g>
  );
}

export function AxesActorView({ actor, state, mode }: ActorProps) {
  if (actor.kind !== 'axes') return null;
  return (
    <motion.g
      data-actor-id={actor.id}
      initial={{ opacity: mode === 'exiting' ? 1 : 0 }}
      animate={{ x: state.x, y: state.y, opacity: state.exiting ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={STEP_TRANSITION}
      stroke="#868e96"
      strokeWidth={1.5}
    >
      <line x1={-450} y1={0} x2={450} y2={0} markerEnd="url(#anim-arrowhead)" />
      <line x1={0} y1={220} x2={0} y2={-220} markerEnd="url(#anim-arrowhead)" />
    </motion.g>
  );
}
```

- [ ] **Step 4: 实现 animation-canvas.tsx**

```tsx
// components/animation/renderer/animation-canvas.tsx
'use client';

import { useMemo, type ReactNode } from 'react';
import type { Actor, AnimationScript, ActorState } from '@/lib/animation/types';
import { resolveStepView } from '@/lib/animation/interpolate';
import {
  NodeActorView,
  ArrayCellActorView,
  BarActorView,
  TextActorView,
  PointerActorView,
  HighlightActorView,
  ArrowActorView,
  AxesActorView,
} from './actors';

interface AnimationCanvasProps {
  script: AnimationScript;
  stepIndex: number;
}

interface ActorSwitchProps {
  actor: Actor;
  state: ActorState;
  stateOf: (actorId: string) => ActorState | undefined;
  actorOf: (actorId: string) => Actor | undefined;
  mode?: 'visible' | 'exiting';
}

function ActorSwitch({ actor, state, stateOf, actorOf, mode }: ActorSwitchProps) {
  const props = { actor, state, stateOf, actorOf, mode };
  switch (actor.kind) {
    case 'node':
      return <NodeActorView {...props} />;
    case 'array-cell':
      return <ArrayCellActorView {...props} />;
    case 'bar':
      return <BarActorView {...props} />;
    case 'text':
      return <TextActorView {...props} />;
    case 'pointer':
      return <PointerActorView {...props} />;
    case 'highlight':
      return <HighlightActorView {...props} />;
    case 'arrow':
      return <ArrowActorView {...props} />;
    case 'axes':
      return <AxesActorView {...props} />;
    default:
      return null;
  }
}

export function AnimationCanvas({ script, stepIndex }: AnimationCanvasProps) {
  const view = useMemo(() => resolveStepView(script, stepIndex), [script, stepIndex]);

  const stateMap = useMemo(() => {
    const m = new Map<string, ActorState>();
    for (const v of view.visible) m.set(v.actor.id, v.state);
    return m;
  }, [view]);
  const actorMap = useMemo(() => new Map(script.actors.map((a) => [a.id, a])), [script.actors]);
  const stateOf = (actorId: string): ActorState | undefined => stateMap.get(actorId);
  const actorOf = (actorId: string): Actor | undefined => actorMap.get(actorId);

  const { width, height, showGrid } = script.stage;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full max-w-full rounded-xl border bg-white dark:bg-zinc-900"
      role="img"
      aria-label={script.title}
    >
      <defs>
        <marker id="anim-arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#495057" />
        </marker>
      </defs>
      {showGrid ? <GridPattern width={width} height={height} /> : null}
      {/* 退场演员先渲染（垫底），以 exiting 模式挂载后立即淡出 */}
      {view.exiting.map((v) => (
        <ActorSwitch
          key={`exit-${v.actor.id}`}
          actor={v.actor}
          state={{ ...v.state, exiting: true }}
          stateOf={stateOf}
          actorOf={actorOf}
          mode="exiting"
        />
      ))}
      {view.visible.map((v) => (
        <ActorSwitch
          key={v.actor.id}
          actor={v.actor}
          state={v.state}
          stateOf={stateOf}
          actorOf={actorOf}
        />
      ))}
    </svg>
  );
}

function GridPattern({ width, height }: { width: number; height: number }) {
  const lines: ReactNode[] = [];
  for (let x = 0; x <= width; x += 60) {
    lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={height} stroke="#e9ecef" strokeWidth={1} />);
  }
  for (let y = 0; y <= height; y += 60) {
    lines.push(<line key={`h${y}`} x1={0} y1={y} x2={width} y2={y} stroke="#e9ecef" strokeWidth={1} />);
  }
  return <g aria-hidden>{lines}</g>;
}
```

实现提示：箭头/指针/高亮的 `stateOf` 查询只覆盖当步可见演员——若其目标演员同帧退场，查询落空，`PointerActorView`/`HighlightActorView` 已用 `state.x/y` 兜底（元素在 (0,0) 附近淡出，视觉可接受）；`ArrowActorView` 直接返回 null。这是有意的取舍，退场分支只负责淡出。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm vitest run tests/animation/renderer.test.tsx`
Expected: PASS（2 个用例）

- [ ] **Step 6: Commit**

```bash
git add components/animation/renderer tests/animation/renderer.test.tsx
git commit -m "feat(animation): SVG 渲染器与 8 种演员组件"
```

---

### Task 9: 播放 hook + 控制条 + 字幕

**Files:**
- Create: `components/animation/player/use-animation-player.ts`
- Create: `components/animation/player/animation-controls.tsx`
- Create: `components/animation/player/subtitle-bar.tsx`
- Test: `tests/animation/use-animation-player.test.ts`

- [ ] **Step 1: 写失败测试**

```tsx
// tests/animation/use-animation-player.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const speakMock = vi.fn(async () => {});
vi.mock('@/lib/animation/playback/speech', () => ({
  speak: (...args: unknown[]) => speakMock(...(args as [])),
  cancelSpeech: vi.fn(),
  isSpeechSynthesisAvailable: vi.fn(() => false),
}));

import { useAnimationPlayer } from '@/components/animation/player/use-animation-player';
import type { AnimationScript } from '@/lib/animation/types';

const script: AnimationScript = {
  id: 's',
  title: 't',
  topic: 'tp',
  subjectArea: 'algorithm',
  stage: { width: 1200, height: 675 },
  actors: [],
  steps: [
    { id: 's1', title: '一', narration: '第一句', actorStates: [{ actorId: 'x', x: 1, y: 1 }] },
    { id: 's2', title: '二', narration: '第二句', actorStates: [{ actorId: 'x', x: 2, y: 2 }] },
    { id: 's3', title: '三', narration: '第三句', actorStates: [{ actorId: 'x', x: 3, y: 3 }] },
  ],
};

describe('useAnimationPlayer', () => {
  beforeEach(() => {
    speakMock.mockClear();
  });

  it('初始 idle，play 后 playing 且朗读第一步', async () => {
    const { result } = renderHook(() => useAnimationPlayer(script));
    expect(result.current.status).toBe('idle');
    act(() => result.current.toggle());
    expect(result.current.status).toBe('playing');
    await act(async () => {});
    expect(speakMock).toHaveBeenCalledWith('第一句', expect.anything());
  });

  it('朗读结束后自动推进；最后一步结束后 finished', async () => {
    const { result } = renderHook(() => useAnimationPlayer(script));
    act(() => result.current.toggle());
    await act(async () => {}); // step1 speak 完成 → 推进
    expect(result.current.stepIndex).toBe(1);
    await act(async () => {});
    await act(async () => {});
    expect(result.current.status).toBe('finished');
  });

  it('seek 回溯并暂停；再次 play 重新朗读当前步', async () => {
    const { result } = renderHook(() => useAnimationPlayer(script));
    act(() => result.current.toggle());
    await act(async () => {});
    act(() => result.current.seek(0));
    expect(result.current).toMatchObject({ status: 'paused', stepIndex: 0 });
    speakMock.mockClear();
    act(() => result.current.toggle());
    await act(async () => {});
    expect(speakMock).toHaveBeenCalledWith('第一句', expect.anything());
  });

  it('setSpeed 调整倍速', () => {
    const { result } = renderHook(() => useAnimationPlayer(script));
    act(() => result.current.setSpeed(1.5));
    expect(result.current.speed).toBe(1.5);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/animation/use-animation-player.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 use-animation-player.ts**

```ts
// components/animation/player/use-animation-player.ts
'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  initialPlayerState,
  reducePlayer,
  SPEED_OPTIONS,
} from '@/lib/animation/playback/player-machine';
import { speak, cancelSpeech } from '@/lib/animation/playback/speech';
import type { AnimationScript } from '@/lib/animation/types';

export type UseAnimationPlayerReturn = ReturnType<typeof useAnimationPlayer>;

/**
 * 播放 hook（spec §5）：playing 状态下朗读当前步旁白，结束后由
 * reducePlayer({type:'ended'}) 推进。seek/next/prev 会中断当前朗读
 * （effect cleanup abort）。倍速变更会重读当前步（v1 接受的行为）。
 */
export function useAnimationPlayer(script: AnimationScript) {
  const [state, dispatch] = useReducer(
    reducePlayer,
    script.steps.length,
    initialPlayerState,
  );
  const abortRef = useRef<AbortController | null>(null);

  const currentStep = script.steps[Math.min(state.stepIndex, script.steps.length - 1)];

  useEffect(() => {
    if (state.status !== 'playing') return;
    const controller = new AbortController();
    abortRef.current = controller;
    let cancelled = false;
    (async () => {
      await speak(currentStep.narration, { speed: state.speed, signal: controller.signal });
      if (!cancelled) dispatch({ type: 'ended' });
    })();
    return () => {
      cancelled = true;
      controller.abort();
      if (abortRef.current === controller) abortRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.stepIndex, state.speed, currentStep.narration]);

  useEffect(() => () => cancelSpeech(), []);

  const toggle = useCallback(() => {
    dispatch({ type: state.status === 'playing' ? 'pause' : 'play' });
  }, [state.status]);

  const next = useCallback(() => dispatch({ type: 'next' }), []);
  const prev = useCallback(() => dispatch({ type: 'prev' }), []);
  const seek = useCallback((index: number) => dispatch({ type: 'seek', index }), []);
  const setSpeed = useCallback((value: number) => dispatch({ type: 'speed', value }), []);

  return {
    status: state.status,
    stepIndex: state.stepIndex,
    speed: state.speed,
    totalSteps: script.steps.length,
    currentStep,
    speedOptions: SPEED_OPTIONS,
    toggle,
    next,
    prev,
    seek,
    setSpeed,
  };
}
```

- [ ] **Step 4: 实现 animation-controls.tsx 与 subtitle-bar.tsx**

```tsx
// components/animation/player/animation-controls.tsx
'use client';

import { Pause, Play, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UseAnimationPlayerReturn } from './use-animation-player';

export function AnimationControls({ player }: { player: UseAnimationPlayerReturn }) {
  const { status, stepIndex, totalSteps, speed, speedOptions } = player;
  const playing = status === 'playing';
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-card p-2">
      <Button variant="ghost" size="icon" onClick={player.prev} disabled={stepIndex === 0} aria-label="上一步">
        <SkipBack className="h-4 w-4" />
      </Button>
      <Button variant="default" size="icon" onClick={player.toggle} aria-label={playing ? '暂停' : '播放'}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={player.next}
        disabled={stepIndex >= totalSteps - 1 && status === 'finished'}
        aria-label="下一步"
      >
        <SkipForward className="h-4 w-4" />
      </Button>
      {status === 'finished' ? (
        <Button variant="ghost" size="icon" onClick={player.toggle} aria-label="重播">
          <RotateCcw className="h-4 w-4" />
        </Button>
      ) : null}
      <input
        type="range"
        min={0}
        max={Math.max(0, totalSteps - 1)}
        step={1}
        value={stepIndex}
        onChange={(e) => player.seek(Number(e.target.value))}
        className="mx-2 flex-1 accent-primary"
        aria-label="进度"
      />
      <span className="min-w-16 text-center text-sm text-muted-foreground">
        {stepIndex + 1} / {totalSteps}
      </span>
      <div className="flex gap-1">
        {speedOptions.map((s) => (
          <button
            key={s}
            onClick={() => player.setSpeed(s)}
            className={cn(
              'rounded-md px-2 py-1 text-xs',
              speed === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
```

```tsx
// components/animation/player/subtitle-bar.tsx
'use client';

import type { AnimationStep } from '@/lib/animation/types';

export function SubtitleBar({ step }: { step: AnimationStep }) {
  return (
    <div className="rounded-xl border bg-muted/40 px-4 py-3 text-center">
      <p className="mb-1 text-sm font-medium text-primary">{step.title}</p>
      <p className="text-sm leading-relaxed text-foreground/90">{step.narration}</p>
    </div>
  );
}
```

（`@/components/ui/button` 为项目现有 shadcn 组件；实现前 `grep -n "export" components/ui/button.tsx` 确认导出名。）

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm vitest run tests/animation/use-animation-player.test.ts`
Expected: PASS（4 个用例）

- [ ] **Step 6: Commit**

```bash
git add components/animation/player tests/animation/use-animation-player.test.ts
git commit -m "feat(animation): 播放 hook 与控制条/字幕组件"
```

---

### Task 10: 页面 + 入口卡片 + 后台任务接入

**Files:**
- Create: `app/sky/animation/page.tsx`
- Create: `app/sky/animation/[scriptId]/page.tsx`
- Modify: `lib/store/use-task-store.ts:11`（TaskType 加 `'animation'`）
- Modify: `components/sky/home/quick-access-grid.tsx`（加卡片）

- [ ] **Step 1: TaskType 加 'animation'**

修改 `lib/store/use-task-store.ts` 第 11 行的联合类型，在 `'teaching'` 后追加：

```ts
export type TaskType =
  | 'solve'
  | 'slides'
  | 'pptx'
  | 'general'
  | 'quiz'
  | 'write'
  | 'memory'
  | 'teaching'
  | 'animation';
```

- [ ] **Step 2: quick-access-grid 加卡片**

先读 `components/sky/home/quick-access-grid.tsx` 确认项结构字段名，然后在 lucide 导入中加入 `Clapperboard`，并在 `quickAccessItems` 数组（`课程资源` 项之后）追加（字段名与现有项保持一致，下例按常见结构）：

```ts
  {
    icon: Clapperboard,
    title: '动画讲解',
    description: '输入话题，生成动画演示',
    href: '/sky/animation',
  },
```

- [ ] **Step 3: 实现生成页**

```tsx
// app/sky/animation/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, PlayCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTaskStore } from '@/lib/store/use-task-store';
import type { ScriptMeta } from '@/lib/animation/types';
import type { AnimationJob } from '@/lib/animation/animation-job-store';

const EXAMPLES = [
  '二叉堆的插入与上浮',
  '快速排序的 partition 过程',
  '梯度下降为什么能收敛',
  '单摆的运动规律',
];

// apiSuccess 的响应包裹结构以 lib/server/api-response.ts 实际实现为准；
// 下面的 unwrap 假设 data 在 res.data —— 如实际是顶层平铺，调整 unwrap 即可。
async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json()) as { data?: T } & Record<string, unknown>;
  return (json.data ?? (json as unknown)) as T;
}

export default function AnimationPage() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [history, setHistory] = useState<ScriptMeta[]>([]);
  const [activeJob, setActiveJob] = useState<AnimationJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const addTask = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);

  useEffect(() => {
    fetch('/api/animation/scripts')
      .then((r) => unwrap<{ scripts: ScriptMeta[] }>(r))
      .then((d) => setHistory(d.scripts ?? []))
      .catch(() => {});
  }, []);

  const startGeneration = useCallback(async () => {
    const t = topic.trim();
    if (t.length < 2 || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/animation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: t }),
      });
      if (!res.ok) return;
      const { jobId } = await unwrap<{ jobId: string }>(res);
      addTask({
        id: jobId,
        type: 'animation',
        label: t,
        status: 'running',
        progress: 0,
        phase: '排队中',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        jobId,
      });
      for (;;) {
        const r = await fetch(`/api/animation/jobs/${jobId}`);
        const { job } = await unwrap<{ job: AnimationJob }>(r);
        setActiveJob(job);
        updateTask(jobId, {
          progress: job.progress,
          phase: job.message,
          status: job.status === 'failed' ? 'failed' : job.status === 'succeeded' ? 'completed' : 'running',
        });
        if (job.status === 'succeeded' && job.result) {
          router.push(`/sky/animation/${job.result.scriptId}`);
          return;
        }
        if (job.status === 'failed') return;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } finally {
      setSubmitting(false);
    }
  }, [topic, submitting, addTask, updateTask, router]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-6 w-6 text-primary" />
          动画讲解
        </h1>
        <p className="text-sm text-muted-foreground">
          输入算法、数据结构、数学或物理话题，AI 生成逐步动画 + 语音讲解。
        </p>
      </header>

      <div className="flex gap-2">
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && startGeneration()}
          placeholder="例如：二叉堆的插入与上浮"
          maxLength={120}
        />
        <Button onClick={startGeneration} disabled={topic.trim().length < 2 || submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          生成
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <button
            key={e}
            onClick={() => setTopic(e)}
            className="rounded-full border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {e}
          </button>
        ))}
      </div>

      {activeJob ? (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-medium">{activeJob.message}</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${activeJob.progress}%` }} />
          </div>
          {activeJob.status === 'failed' ? (
            <div className="mt-3 space-y-2">
              {activeJob.planOutline ? (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    讲解大纲（分镜生成失败，仅供参考）
                  </p>
                  <ol className="list-decimal space-y-0.5 pl-5 text-sm">
                    {activeJob.planOutline.steps.map((s, i) => (
                      <li key={i}>
                        {s.title}：{s.intent}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-destructive">{activeJob.error}</p>
                <Button variant="outline" size="sm" onClick={startGeneration}>
                  重试
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {history.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">历史记录</h2>
          <ul className="divide-y rounded-xl border">
            {history.map((h) => (
              <li key={h.scriptId}>
                <button
                  onClick={() => router.push(`/sky/animation/${h.scriptId}`)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50"
                >
                  <span className="text-sm">{h.title}</span>
                  <span className="text-xs text-muted-foreground">{h.stepCount} 步</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: 实现播放页**

```tsx
// app/sky/animation/[scriptId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimationCanvas } from '@/components/animation/renderer/animation-canvas';
import { AnimationControls } from '@/components/animation/player/animation-controls';
import { SubtitleBar } from '@/components/animation/player/subtitle-bar';
import { useAnimationPlayer } from '@/components/animation/player/use-animation-player';
import { unwrap } from '../page';
import type { AnimationScript } from '@/lib/animation/types';

// script 未加载前给 hook 一个空壳避免条件调用 hook——此时页面处于 loading 分支
const FALLBACK_SCRIPT: AnimationScript = {
  id: 'loading',
  title: '',
  topic: '',
  subjectArea: 'algorithm',
  stage: { width: 1200, height: 675 },
  actors: [],
  steps: [{ id: 's0', title: '', narration: '', actorStates: [{ actorId: 'none', x: 0, y: 0 }] }],
};

export default function AnimationPlayerPage({
  params,
}: {
  params: Promise<{ scriptId: string }>;
}) {
  const [scriptId, setScriptId] = useState<string | null>(null);
  const [script, setScript] = useState<AnimationScript | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    params.then((p) => setScriptId(p.scriptId));
  }, [params]);

  useEffect(() => {
    if (!scriptId) return;
    fetch(`/api/animation/scripts/${scriptId}`)
      .then(async (r) => {
        if (r.status === 404) {
          setNotFound(true);
          return;
        }
        const { script: s } = await unwrap<{ script: AnimationScript }>(r);
        setScript(s);
      })
      .catch(() => setNotFound(true));
  }, [scriptId]);

  const player = useAnimationPlayer(script ?? FALLBACK_SCRIPT);

  if (notFound) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">讲解不存在或已被清理</p>
        <Button asChild variant="outline">
          <Link href="/sky/animation">返回动画讲解</Link>
        </Button>
      </div>
    );
  }

  if (!script) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-svh w-full max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/sky/animation" aria-label="返回">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">{script.title}</h1>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center">
        <AnimationCanvas script={script} stepIndex={player.stepIndex} />
      </main>

      <SubtitleBar step={player.currentStep} />
      <AnimationControls player={player} />
    </div>
  );
}
```

注意：从 `'../page'` 导入 `unwrap` 依赖该文件确实导出了它——为避免页面模块间耦合，更稳妥的做法是把 `unwrap` 提取到 `lib/animation/client-api.ts`（4 行小工具），两页都从这里导入。实现时优先用独立文件方案。

- [ ] **Step 5: 手动验证（dev server）**

Run: `pnpm dev`（另一个终端）
浏览器打开 `http://localhost:3000/sky/animation`：
- 输入"二叉堆的插入与上浮"→ 生成 → 进度推进 → 跳转播放页 → 动画播放、控制条可用、单步回溯正常。
（需要 `.env.local` 配置了至少一个 LLM key；无 key 时应看到明确的失败信息与错误原因。）

- [ ] **Step 6: 全量检查**

Run: `pnpm check && pnpm lint && npx tsc --noEmit && pnpm vitest run tests/animation`
Expected: 全部通过

- [ ] **Step 7: Commit**

```bash
git add app/sky/animation lib/animation/client-api.ts lib/store/use-task-store.ts components/sky/home/quick-access-grid.tsx
git commit -m "feat(animation): 动画讲解独立入口（生成页 + 播放页 + 首页卡片）"
```

---

### Task 11: Eval 测试（真实 LLM 回归网）

**Files:**
- Create: `tests/animation/animation.eval.test.ts`

- [ ] **Step 1: 写 eval 测试（默认跳过，需显式开启）**

```ts
// tests/animation/animation.eval.test.ts
/**
 * Eval：真实 LLM 生成 → 校验通过率回归网（vitest.eval.config.ts 专用，pnpm test 不跑）。
 * 运行：ANIMATION_EVAL=1 pnpm vitest --config vitest.eval.config.ts tests/animation/animation.eval.test.ts
 * 需要 .env.local 配置 LLM key。单个用例超时 10 分钟。
 */
import { describe, it, expect } from 'vitest';
import { runAnimationGeneration } from '@/lib/animation/generate/pipeline';
import { scriptSchema } from '@/lib/animation/schema';
import { validateScript } from '@/lib/animation/validate';

const maybe = process.env.ANIMATION_EVAL === '1' ? describe : describe.skip;

const TOPICS = ['二叉堆的插入与上浮', '快速排序的 partition 过程', '单摆的运动规律'];

maybe('animation eval', () => {
  it.each(TOPICS)(
    '"%s" 生成的脚本通过 schema 与结构校验',
    async (topic) => {
      const { script } = await runAnimationGeneration(topic);
      expect(scriptSchema.safeParse(script).success).toBe(true);
      const { errors } = validateScript(script);
      expect(errors).toEqual([]);
      expect(script.steps.length).toBeGreaterThanOrEqual(5);
      expect(script.steps.length).toBeLessThanOrEqual(20);
    },
    600_000,
  );
});
```

先确认 `vitest.eval.config.ts` 的 include 规则覆盖 `tests/animation/*.eval.test.ts`（现有约定为 `**/*.eval.test.ts`）；若不覆盖，把该 pattern 补进 include。

- [ ] **Step 2: 本地跑一次 eval（可选，需要 key 与较长时间）**

Run: `ANIMATION_EVAL=1 pnpm vitest --config vitest.eval.config.ts tests/animation/animation.eval.test.ts`
Expected: 3 个主题全部通过；若个别主题校验失败，根据失败信息迭代 `animation-script.md` prompt（这是 prompt 回归网的用途）。

- [ ] **Step 3: Commit**

```bash
git add tests/animation/animation.eval.test.ts
git commit -m "test(animation): 真实 LLM 分镜生成 eval 回归网"
```

---

## 依赖关系与顺序

Task 1 最先（types/schema 是一切的地基）。之后 Task 2、3、4 可并行（各自独立，仅依赖 Task 1 的类型）。Task 5 依赖 1；Task 6 依赖 5 + 2（validate）；Task 7 依赖 6（pipeline）+ 1（types）；Task 8 依赖 3（interpolate）；Task 9 依赖 4（machine/speech）；Task 10 依赖 7、8、9；Task 11 依赖 6。

## 完成标准

- `pnpm check && pnpm lint && npx tsc --noEmit && pnpm test` 全绿。
- 手动流程可用：输入话题 → 后台生成（进度可见）→ 播放页顺播/暂停/单步/回溯/倍速/进度条。
- 生成失败时有明确错误与重试路径；plan 成功而 script 失败时展示大纲文字版（spec §8.1）。
- 播放页 404 有兜底。
