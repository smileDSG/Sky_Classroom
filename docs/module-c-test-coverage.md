# 模块 C 测试覆盖文档

> **模块 C (Module C)** — Sky Classroom (天空课堂) 测试文档  
> 项目: 智眸无界  
> 更新日期: 2026-06-03

---

## 目录

1. [测试架构](#1-测试架构)
2. [测试覆盖矩阵](#2-测试覆盖矩阵)
3. [测试环境配置](#3-测试环境配置)
4. [运行测试](#4-运行测试)
5. [已知限制](#5-已知限制)
6. [测试统计摘要](#6-测试统计摘要)
7. [CI 集成](#7-ci-集成)

---

## 1. 测试架构

模块 C 采用三层测试架构，按照依赖关系和运行环境分层：

| 层级 | 目录 | 类型 | 运行环境 | 说明 |
|------|------|------|----------|------|
| **单元测试** | `tests/mistakes/`、`tests/graph/`、`tests/assistant/` (部分) | 纯函数测试 | Node.js | 测试库函数逻辑，无 DOM 依赖，不涉及 IndexedDB（除 mistake-tracker 外） |
| **API 路由测试** | `tests/assistant/assistant-api.test.ts`、`tests/sky/knowledge-graph-api.test.ts`、`tests/mistakes/mistakes-api.test.ts` | 集成测试 | Node.js | 测试 Next.js API Route Handler，mock DAO 层 |
| **组件测试** | `tests/sky/*.tsx` | React 组件测试 | jsdom + @testing-library/react | 测试 UI 组件渲染与交互，mock hooks 与外部依赖 |

### 1.1 单元测试

单元测试覆盖以下核心库模块（纯函数，不依赖 DOM/IndexedDB）：

```
lib/mistakes/
  ├── cause-analyzer.ts      → tests/mistakes/cause-analyzer.test.ts
  ├── knowledge-graph.ts     → tests/mistakes/knowledge-graph.test.ts
  ├── db.ts                  → tests/mistakes/mistake-tracker.test.ts (IndexedDB CRUD)
  ├── mistake-tracker.ts     → tests/mistakes/mistake-tracker.test.ts
  └── review-tracker.ts      → tests/mistakes/review-tracker.test.ts

lib/graph/
  ├── builder.ts             → tests/graph/builder.test.ts
  ├── mastery.ts             → tests/graph/mastery.test.ts
  └── highlight.ts           → tests/graph/highlight.test.ts

lib/assistant/
  ├── context-injector.ts    → tests/assistant/context-injector.test.ts
  ├── stream.ts              → tests/assistant/stream.test.ts
  └── conversation.ts        → tests/assistant/conversation.test.ts
```

### 1.2 API 路由测试

API 路由测试使用 `NextRequest` 直接调用 Route Handler，mock 底层 DAO：

```
app/api/sky/mistakes/route.ts       → tests/mistakes/mistakes-api.test.ts
app/api/sky/assistant/route.ts      → tests/assistant/assistant-api.test.ts
app/api/sky/knowledge-graph/route.ts → tests/sky/knowledge-graph-api.test.ts
```

### 1.3 组件测试

组件测试使用 `@testing-library/react` + jsdom 渲染组件，mock 所有外部依赖：

```
components/sky/assistant/assistant-fab.tsx    ┐
components/sky/assistant/assistant-panel.tsx   ├── tests/sky/assistant.test.tsx
components/sky/assistant/assistant-config.tsx ┘
components/sky/dashboard/stat-cards.tsx        ── tests/sky/dashboard.test.tsx
components/sky/learning/learning-stats.tsx     ── tests/sky/learning-stats.test.tsx
components/sky/learning/mistake-book.tsx       ── tests/sky/mistake-book.test.tsx
```

---

## 2. 测试覆盖矩阵

### 2.1 错题本 (Mistake Book)

| 源模块 | 测试文件 | 测试数 | 覆盖函数 | 备注 |
|--------|----------|--------|----------|------|
| `lib/mistakes/cause-analyzer.ts` | `tests/mistakes/cause-analyzer.test.ts` | 21 | `extractNumbers` (6), `analyzeMistakeCause` (15) | 纯函数测试；覆盖 6 种错因（concept-unclear / calculation-error / method-wrong / misreading / format-error / careless），含精确匹配→careless 边界情况 |
| `lib/mistakes/knowledge-graph.ts` | `tests/mistakes/knowledge-graph.test.ts` | 15 | `buildKnowledgeGraph` (8), `getMasterySummary` (3), `recommendLearningPath` (4) | 纯函数测试；覆盖空图、related/prerequisite 边、weakPoints 检测、mastery 底线 (0)、学习路径推荐 |
| `lib/mistakes/db.ts` + `lib/mistakes/mistake-tracker.ts` | `tests/mistakes/mistake-tracker.test.ts` | 33 | `getDB` / `addMistake` / `getAllMistakes` / `updateMistake` / `deleteMistake` / `clearAll` (7), `trackMistake` (2), `getMistakes` 筛选 (7), `markReviewed` (5), `getMistakeStats` (5), `exportMistakes` (5), 集成场景 (2) | 使用 fake-indexeddb/auto polyfill；覆盖 IndexedDB CRUD、筛选（cause / knowledgePoint / dateRange / reviewed）、统计、导出、完整流程 |
| `app/api/sky/mistakes/route.ts` | `tests/mistakes/mistakes-api.test.ts` | 16 | `GET` (5), `POST` (4), `PATCH` (4), `DELETE` (2), CRUD 集成 (1) | Next.js API Route 集成测试；覆盖完整 CRUD 流程、筛选、分页、复习标记 |
| `lib/mistakes/review-tracker.ts` | `tests/mistakes/review-tracker.test.ts` | 11 | `calculateNextReview` (5), `getDueForReview` (3), `getReviewStats` (3) | 纯函数测试；覆盖艾宾浩斯间隔、复习到期筛选、统计（含 mastered 边界 masteryLevel=6） |

### 2.2 知识图谱 (Knowledge Graph)

| 源模块 | 测试文件 | 测试数 | 覆盖函数 | 备注 |
|--------|----------|--------|----------|------|
| `lib/graph/builder.ts` | `tests/graph/builder.test.ts` | 15 | `buildGraphFromMistakes` | 纯函数测试；覆盖空图、节点去重、related/prerequisite 边、mastery 计算与边界 (0-100)、weakPoints 检测、分类推断（代数/几何/概率/综合）、GraphResponse 结构 |
| `lib/graph/mastery.ts` | `tests/graph/mastery.test.ts` | 12 | `calculateMastery` (4), `getWeakPoints` (3), `buildRecommendations` (3), `overallMastery` (2) | 纯函数测试；覆盖 mastery 计算公式、自定义阈值、优先级推荐（high/medium）、整体掌握度 |
| `lib/graph/highlight.ts` | `tests/graph/highlight.test.ts` | 10 | `getHighlightedNodes` (3), `getNodeSummary` (3), `getGraphRecommendation` (4) | 纯函数测试；覆盖 weak/normal/strong 三级高亮、各等级摘要文本、空数据/无弱点/少量弱点/大量弱点推荐 |

### 2.3 AI 助手 (AI Assistant)

| 源模块 | 测试文件 | 测试数 | 覆盖函数 | 备注 |
|--------|----------|--------|----------|------|
| `lib/assistant/context-injector.ts` | `tests/assistant/context-injector.test.ts` | 23 | `injectMistakeContext` (7), `injectGraphContext` (5), `buildSystemPrompt` (5), `injectSolveHistory` (6) | 纯函数测试；覆盖错题上下文注入（含频率排序、空/边界）、图谱上下文注入（强弱节点分类）、System Prompt 构建（含学科/难度/风格/双上下文）、解题历史注入（含截断/5条限制/长度上限） |
| `lib/assistant/stream.ts` | `tests/assistant/stream.test.ts` | 10 | `formatSSE` (4), `streamSSE` (6) | 纯函数 + 异步迭代器测试；覆盖 text_delta/done/error 事件格式化、SSE 响应头、流式输出顺序、空迭代器、异常中断 |
| `lib/assistant/conversation.ts` | `tests/assistant/conversation.test.ts` | 16 | `estimateTokens` (3), `estimateMessageTokens` (1), `trimMessages` (4), `getRecentContext` (3), `summarizeConversation` (5) | 纯函数测试；覆盖 token 估算、消息裁剪（超预算/保留最后一条/空）、最近上下文提取、会话摘要（含过滤 system 消息、截断 80 字符、限制轮次） |
| `app/api/sky/assistant/route.ts` | `tests/assistant/assistant-api.test.ts` | 9 | `POST` 验证 (6), `POST` 响应 (3) | API Route 集成测试；mock `streamLLM` 和 `resolveModel`；覆盖缺失/空/非数组 messages 的 400 验证、SSE Content-Type、可选 subject/difficulty/style 参数 |

### 2.4 学习数据 UI (Learning Data UI)

| 源模块 | 测试文件 | 测试数 | 覆盖函数/组件 | 备注 |
|--------|----------|--------|---------------|------|
| `components/sky/assistant/assistant-fab.tsx` | `tests/sky/assistant.test.tsx` | 2 | `AssistantFab` | 组件测试；覆盖默认关闭状态、点击打开后渲染面板和配置 |
| `components/sky/assistant/assistant-panel.tsx` | `tests/sky/assistant.test.tsx` | 8 | `AssistantPanel` | 组件测试；覆盖欢迎消息、快捷提示按钮（3个）、textarea 输入、空输入不发请求、loading 状态（按钮禁用）、API 错误显示 |
| `components/sky/assistant/assistant-config.tsx` | `tests/sky/assistant.test.tsx` | 3 | `AssistantConfig` | 组件测试；覆盖 5 门学科按钮、3 种风格按钮、3 种难度按钮 |
| `lib/store/use-sky-classroom-store.ts` + `components/sky/dashboard/stat-cards.tsx` | `tests/sky/dashboard.test.tsx` | 5 | `StatCards` (2), `QuickActions` (1), `ActivityTimeline` (2) | 组件测试；mock `useAnimatedNumber` 绕过动画；覆盖空数据 0 值、有数据时统计计算（今日搜题/待复习/掌握度）、4 个快捷入口 Link、空/有数据时间线（最近 5 条截断） |
| `components/sky/learning/learning-stats.tsx` | `tests/sky/learning-stats.test.tsx` | 3 | `LearningStats` | 组件测试；覆盖空状态提示、有数据统计卡片（总错题数/已复习率/薄弱知识点）、错因分布条形图（6 种错因标签与计数） |
| `components/sky/learning/mistake-book.tsx` | `tests/sky/mistake-book.test.tsx` | 4 | `MistakeBook` | 组件测试；覆盖空状态提示、错题列表卡片（题目/我的答案/正确答案/知识点 badge）、7 个错因筛选按钮（全部 + 6 种）、3 个复习状态切换按钮（全部/未复习/已复习） |

### 2.5 API 路由

| 源模块 | 测试文件 | 测试数 | 覆盖端点 | 备注 |
|--------|----------|--------|----------|------|
| `app/api/sky/knowledge-graph/route.ts` | `tests/sky/knowledge-graph-api.test.ts` | 4 | `GET /api/sky/knowledge-graph` | mock `createMistakeBookDAO` 和 `getServerStorage`；覆盖正常返回 nodes/edges/weakPoints、空数据返回空图、overallMastery 字段、JSON Content-Type |

### 2.6 编排模板 (Orchestration Templates)

| 源模块 | 测试文件 | 测试数 | 覆盖函数/组件 | 备注 |
|--------|----------|--------|---------------|------|
| `lib/orchestration/registry/templates/solvers/universal.ts` | `tests/orchestration/solver-templates.test.ts` | 1 | `universalSolverTemplate` | 验证模板必填字段（id / name / persona / guidelines / subjects / style）及类型 |
| `lib/orchestration/registry/templates/solvers/science.ts` | `tests/orchestration/solver-templates.test.ts` | 1 | `scienceSolverTemplate` | 验证理科科目列表（数学/物理/化学）与 style='detailed' |
| `lib/orchestration/registry/templates/solvers/humanities.ts` | `tests/orchestration/solver-templates.test.ts` | 1 | `humanitiesSolverTemplate` | 验证 style='heuristic' |
| 跨模板验证 | `tests/orchestration/solver-templates.test.ts` | 3 | id 唯一性, guidelines 非空, 文理科目无重叠 | 全局约束验证 |

---

## 3. 测试环境配置

### 3.1 `tests/setup-vitest.ts` — 全局 Mock 配置

该文件在所有测试之前加载（在 `vitest.config.ts` 中配置为 `setupFiles`），提供 jsdom 中不可用的浏览器 API mock：

```typescript
/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest';
```

| Mock | 说明 |
|------|------|
| `next/navigation` | Mock `useRouter` (push/replace/back)、`usePathname` (返回 `/`)、`useSearchParams` (返回空 URLSearchParams)；组件中几乎必用 |
| `next-themes` | Mock `useTheme` (固定返回 `{ theme: 'light', setTheme: vi.fn() }`) 和 `ThemeProvider` (透传 children)；Sonner toaster 依赖 |
| `ResizeObserver` | 空实现（observe / unobserve / disconnect 均为 `vi.fn()`）；Radix Popover 和 canvas 组件依赖 |
| `PointerEvent` | FakePointerEvent 类（继承 Event，pointerType 固定为 'mouse'）；Radix 组件依赖，jsdom 不支持原生 PointerEvent |
| `scrollTo` / `scrollIntoView` | Mock 为 `vi.fn()`，避免 jsdom 无布局引擎的错误 |
| `matchMedia` | 返回 `{ matches: false, media: query, addEventListener: vi.fn(), ... }`；响应式组件测试需要 |
| `requestAnimationFrame` | 使用 `setTimeout(() => cb(performance.now()), 16)` 实现，**传递真实的 `performance.now()` 时间戳**，确保 `useAnimatedNumber` 等 hook 中 `animate(now)` 能正确计算 elapsed 时间，避免 NaN 问题 |
| `cancelAnimationFrame` | 通过 `clearTimeout` 实现取消 |
| `URL.createObjectURL` | 返回固定 `'blob:mock-url'`；媒体相关测试需要 |
| `URL.revokeObjectURL` | 空实现 `vi.fn()`；媒体相关测试需要 |

### 3.2 `tests/setup-env.ts` — 环境变量加载

```typescript
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(__dirname, '..', '.env.local');
try {
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  // .env.local 未找到，跳过
}
```

该文件在测试启动时从项目根目录的 `.env.local` 加载环境变量（如 API Key），仅在变量未设置时写入 `process.env`，不覆盖已有值。若文件不存在则静默跳过。

---

## 4. 运行测试

### 4.1 运行全部模块 C 测试

```bash
pnpm test -- --run tests/mistakes tests/graph tests/assistant tests/sky tests/orchestration
```

### 4.2 运行单个测试文件

```bash
npx vitest run tests/sky/dashboard.test.tsx
npx vitest run tests/mistakes/cause-analyzer.test.ts
npx vitest run tests/graph/builder.test.ts
```

### 4.3 Watch 模式（开发时使用）

```bash
pnpm test tests/mistakes/
pnpm test tests/graph/
pnpm test tests/sky/
```

### 4.4 运行全部项目测试（CI）

```bash
pnpm test
```

---

## 5. 已知限制

### 5.1 `useAnimatedNumber` Hook Mock

在 Dashboard 组件测试（`tests/sky/dashboard.test.tsx`）中，`useAnimatedNumber` hook 被 mock 为直接返回目标值，绕过动画时序。这是因为该 hook 依赖 `requestAnimationFrame` 进行数字递增动画，在 fake timers 下可能产生不确定行为：

```typescript
vi.mock('@/lib/hooks/use-animated-number', () => ({
  useAnimatedNumber: (target: number) => ({ value: target, raw: target }),
}));
```

### 5.2 SSE 流式行为

`streamSSE` 的逻辑可以在 jsdom 中测试（读取 ReadableStream body），已覆盖事件格式化、顺序、异常处理。但**真实的 SSE 连接建立、断线重连、浏览器 EventSource API 行为**无法在 jsdom 中完整验证，需手动测试。

### 5.3 Canvas 渲染

知识图谱的可视化渲染组件（`knowledge-graph-view.tsx`）使用 Canvas API 绘制节点和边。jsdom 不支持 Canvas 2D 上下文，因此**图谱的视觉渲染效果需手动验证**（节点位置、连线样式、动画效果等）。图谱的数据构建逻辑（`buildGraphFromMistakes`）已有完整的单元测试覆盖。

### 5.4 Fake Timers 与 motion/react 动画

由于 `motion/react`（framer-motion）在内部使用 `requestAnimationFrame` 驱动动画，使用 `vi.useFakeTimers()` 可能导致动画卡住、组件状态异常。当前策略：
- `setup-vitest.ts` 中使用 `setTimeout` 实现 `requestAnimationFrame`（非 fake timers）
- 如必须使用 fake timers，需在测试结束后恢复 real timers

### 5.5 IndexedDB Polyfill

`tests/mistakes/mistake-tracker.test.ts` 使用 `fake-indexeddb/auto` polyfill 模拟 IndexedDB。该 polyfill 在内存中运行，无法完全模拟持久化存储、large data 性能、事务冲突等真实 IndexedDB 行为。当前测试覆盖所有 CRUD 操作，但极端并发场景建议在真实浏览器中验证。

### 5.6 API Route 测试中的 Mock 层次

Assistant API 测试 mock 了 `streamLLM` 和 `resolveModel`，Knowledge Graph API 测试 mock 了 `createMistakeBookDAO`。这意味着：
- 测试验证了 Route Handler 的请求验证、响应格式、参数传递
- **未验证**实际 LLM 调用、真实数据库查询、网络层行为
- 端到端流程（前端 → API → LLM → 响应流）需在集成/手动测试中覆盖

---

## 6. 测试统计摘要

### 6.1 总体数据

| 指标 | 数值 |
|------|------|
| 测试文件总数 | 18 |
| 测试用例总数 | 226 |
| 通过率 | 100% |
| 测试框架 | Vitest + @testing-library/react |
| 组件测试环境 | jsdom |

### 6.2 按子模块分布

| 子模块 | 测试文件数 | 测试用例数 |
|--------|-----------|-----------|
| 错题本 (mistakes) | 5 | 96 |
| 知识图谱 (graph) | 3 | 37 |
| AI 助手 (assistant) | 4 | 58 |
| 学习数据 UI (sky components) | 4 | 25 |
| API 路由 (sky API) | 1 | 4 |
| 编排模板 (orchestration) | 1 | 6 |
| **合计** | **18** | **226** |

### 6.3 本 session 新增测试（2026-06-03）

| 测试文件 | 新增用例数 | 新增内容 |
|----------|-----------|----------|
| `context-injector.test.ts` | +6 | `injectSolveHistory` describe 块：含条目计数、知识点注入、空数组/空值边界、5 条截断、上下文长度截断 |
| `knowledge-graph-api.test.ts` | +4 | `GET /api/sky/knowledge-graph` 完整 describe 块：正常返回、空数据、overallMastery、Content-Type |
| `assistant-api.test.ts` | +3 | 补充验证：missing messages 错误信息、empty array 错误信息、not an array 错误信息 |
| `cause-analyzer.test.ts` | +2 | 精确/归一化匹配 → careless 边界：exact match、whitespace/case normalization |
| `solver-templates.test.ts` | +6 | 完整测试文件：universal/science/humanities 模板验证、id 唯一性、guidelines 非空、文理科目无重叠 |
| `assistant.test.tsx` | +5 | AssistantPanel 交互测试：textarea typing、empty send 不触发 fetch、loading 状态、API error 显示、send button 禁用 |
| `review-tracker.test.ts` | +1 | mastered 边界：masteryLevel=6 exactly counted as mastered |
| `stream.test.ts` | +1 | 异常中断：async iterable throws mid-stream → error event |
| **合计** | **28** | |

### 6.4 测试文件详细统计

| 测试文件 | 用例数 |
|----------|--------|
| `tests/mistakes/cause-analyzer.test.ts` | 21 |
| `tests/mistakes/knowledge-graph.test.ts` | 15 |
| `tests/mistakes/mistake-tracker.test.ts` | 33 |
| `tests/mistakes/mistakes-api.test.ts` | 16 |
| `tests/mistakes/review-tracker.test.ts` | 11 |
| `tests/graph/builder.test.ts` | 15 |
| `tests/graph/mastery.test.ts` | 12 |
| `tests/graph/highlight.test.ts` | 10 |
| `tests/assistant/context-injector.test.ts` | 23 |
| `tests/assistant/stream.test.ts` | 10 |
| `tests/assistant/conversation.test.ts` | 16 |
| `tests/assistant/assistant-api.test.ts` | 9 |
| `tests/sky/assistant.test.tsx` | 13 |
| `tests/sky/dashboard.test.tsx` | 5 |
| `tests/sky/learning-stats.test.tsx` | 3 |
| `tests/sky/mistake-book.test.tsx` | 4 |
| `tests/sky/knowledge-graph-api.test.ts` | 4 |
| `tests/orchestration/solver-templates.test.ts` | 6 |
| **总计** | **226** |

---

## 7. CI 集成

模块 C 的所有测试已集成到项目的主 vitest 测试套件中：

- **CI 命令**: `pnpm test` 自动包含所有 `tests/` 目录下的 `.test.ts` 和 `.test.tsx` 文件
- **测试框架**: Vitest（兼容 Vite 的快速测试运行器）
- **覆盖率**: 可通过 `pnpm test -- --coverage` 生成覆盖率报告
- **环境隔离**: 每个测试文件独立运行；IndexedDB 测试使用 `beforeEach` + `clearAll` 保证隔离
- **无外部依赖**: API 测试 mock 全部外部服务（LLM、存储层），不需要真实 API Key 或数据库连接即可运行

---