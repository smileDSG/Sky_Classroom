# 星际试炼场体验优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为星际试炼场增加快捷配置、知识点推荐、练习目标、配置记忆和按需真实样题预览，同时保持现有后台生成与答题流程稳定。

**Architecture:** 将练习目标定义为 quiz agent 的共享领域类型，并沿正式生成任务与独立预览接口传递。配置态页面继续使用现有单页状态，新增小型纯函数模块处理预设、持久化、建议和配置签名，避免继续膨胀页面文件。真实预览固定生成一题，前后端双层缓存，响应不暴露答案。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Vitest、Tailwind CSS 4、现有 quiz agent 与配额系统。

---

## 文件结构

- Create: `lib/cloud-mind/quiz-experience.ts` — 练习目标、快捷包、配置校验、配置签名和知识点建议纯函数。
- Create: `app/api/sky/cloud-mind/quiz-preview/route.ts` — 一题真实预览接口。
- Create: `tests/cloud-mind/quiz-experience.test.ts` — 纯函数与持久化数据校验测试。
- Create: `tests/api/cloud-mind-quiz-preview.test.ts` — 预览接口输出裁剪与 goal 校验测试。
- Modify: `lib/agents/cloud-mind/quiz-agent.ts` — goal 类型、提示词和缓存键。
- Modify: `lib/server/cloud-mind-quiz-job-store.ts` — 正式任务保存 goal。
- Modify: `lib/server/cloud-mind-quiz-job-runner.ts` — 将 goal 传给 agent。
- Modify: `app/api/sky/cloud-mind/quiz/route.ts` — 正式生成接口校验 goal。
- Modify: `app/sky/cloud-mind/quiz/page.tsx` — 快捷包、建议、目标、配置记忆、动态摘要与预览状态。
- Modify: `tests/agents/cloud-mind-quiz-agent.test.ts` — 三种 goal 的 prompt 测试。
- Modify: `tests/sky/cloud-mind-quiz-page.test.tsx` — 页面交互和请求载荷测试。

### Task 1: 建立练习体验领域模型

**Files:**
- Create: `lib/cloud-mind/quiz-experience.ts`
- Test: `tests/cloud-mind/quiz-experience.test.ts`

- [ ] **Step 1: 写失败测试**

覆盖：非法 goal 回退为 `practice`；四个快捷包的完整配置；损坏 localStorage 数据返回 null；配置签名在任一字段变化时改变；建议列表合并去重并按输入过滤。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/cloud-mind/quiz-experience.test.ts`

Expected: FAIL，因为模块尚不存在。

- [ ] **Step 3: 实现纯函数模块**

导出以下契约：

```ts
export type QuizGoal = 'practice' | 'diagnose' | 'mock';
export type QuizMode = 'ai' | 'bank';
export interface StoredQuizConfig {
  mode: QuizMode;
  subject: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
  questionType: 'choice' | 'fill' | 'judge';
  goal: QuizGoal;
}
export const QUIZ_PRESETS: readonly QuizPreset[];
export function normalizeQuizGoal(value: unknown): QuizGoal;
export function parseStoredQuizConfig(value: string | null): StoredQuizConfig | null;
export function buildQuizConfigSignature(config: PreviewQuizConfig): string;
export function buildKnowledgeSuggestions(input: {
  query: string;
  personalized: string[];
  common: string[];
  limit?: number;
}): string[];
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run tests/cloud-mind/quiz-experience.test.ts`

Expected: PASS。

### Task 2: 让练习目标真正影响正式出题

**Files:**
- Modify: `lib/agents/cloud-mind/quiz-agent.ts`
- Modify: `lib/server/cloud-mind-quiz-job-store.ts`
- Modify: `lib/server/cloud-mind-quiz-job-runner.ts`
- Modify: `app/api/sky/cloud-mind/quiz/route.ts`
- Test: `tests/agents/cloud-mind-quiz-agent.test.ts`

- [ ] **Step 1: 写 prompt 失败测试**

断言：

```ts
expect(buildQuizUserPrompt({ ...base, goal: 'practice' })).toContain('覆盖核心概念和常见题型');
expect(buildQuizUserPrompt({ ...base, goal: 'diagnose' })).toContain('易错点、边界条件和常见误区');
expect(buildQuizUserPrompt({ ...base, goal: 'mock' })).toContain('接近正式考试表达');
```

- [ ] **Step 2: 运行 agent 测试确认失败**

Run: `pnpm vitest run tests/agents/cloud-mind-quiz-agent.test.ts`

- [ ] **Step 3: 扩展 agent 契约**

为 `buildQuizUserPrompt` 和 `generateQuiz` 增加 `goal: QuizGoal = 'practice'`，追加目标约束，并把 goal 写入缓存键。

- [ ] **Step 4: 接通正式后台任务**

正式 API 使用 `normalizeQuizGoal(body.goal)`；job store 增加 `goal`；runner 调用：

```ts
await generateQuiz(
  input.subject,
  input.difficulty,
  input.topic,
  input.count,
  input.profile,
  input.questionType ?? 'choice',
  input.goal,
);
```

- [ ] **Step 5: 运行 agent 与 API 相关测试**

Run: `pnpm vitest run tests/agents/cloud-mind-quiz-agent.test.ts tests/agents/cloud-mind-quiz-backfill.test.ts`

Expected: PASS。

### Task 3: 新增真实样题预览接口

**Files:**
- Create: `app/api/sky/cloud-mind/quiz-preview/route.ts`
- Create: `tests/api/cloud-mind-quiz-preview.test.ts`

- [ ] **Step 1: 写接口失败测试**

Mock `generateQuiz`，断言接口固定传入 `count = 1`，传递 goal，并且成功响应只包含：

```ts
{
  signature: string;
  question: {
    questionType: 'choice' | 'fill' | 'judge';
    question: string;
    options?: string[];
  };
}
```

断言响应中没有 `answer`、`answerText` 和 `explanation`。

- [ ] **Step 2: 运行接口测试确认失败**

Run: `pnpm vitest run tests/api/cloud-mind-quiz-preview.test.ts`

- [ ] **Step 3: 实现 POST 接口**

复用 `requireQuota('llmCalls')`、`recordUsage`、`safeErrorMessage` 和 agent。校验 subject、difficulty、topic、questionType、goal；topic 为空时允许 agent 自动选核心考点。服务端 Map 缓存键包含 userId 与配置签名，TTL 为 10 分钟。

- [ ] **Step 4: 运行接口测试确认通过**

Run: `pnpm vitest run tests/api/cloud-mind-quiz-preview.test.ts`

Expected: PASS。

### Task 4: 增加快捷试炼包、目标与知识点建议

**Files:**
- Modify: `app/sky/cloud-mind/quiz/page.tsx`
- Modify: `tests/sky/cloud-mind-quiz-page.test.tsx`

- [ ] **Step 1: 写页面失败测试**

覆盖：点击“考前速练”后选中进阶、10 题、选择题和限时模考；点击知识点建议填入主题；切换练习目标后右侧摘要同步变化。

- [ ] **Step 2: 运行页面测试确认失败**

Run: `pnpm vitest run tests/sky/cloud-mind-quiz-page.test.tsx`

- [ ] **Step 3: 实现快捷包 UI**

在出题模式前增加四个按钮。使用现有 Lucide 图标、淡紫选中态和 `motion` 的 150–200ms 反馈。点击时调用单一 `applyPreset()` 更新 difficulty、count、questionType 和 goal。

- [ ] **Step 4: 实现练习目标 UI**

知识点后增加三选一控件，标签为“单纯刷题”“查漏补缺”“限时模考”。AI 模式显示；题库模式保留摘要但不向题库请求附加 goal 行为。

- [ ] **Step 5: 实现知识点建议**

从 personalization context 收集薄弱点与学习路径节点，与常见知识点数组合并。输入获得焦点时显示建议，点击写入主题；点击外部或 Escape 关闭。

- [ ] **Step 6: 更新正式生成请求**

POST body 增加 `goal`，任务 label 和 phase 文案保持现有后台任务机制。

- [ ] **Step 7: 运行页面测试确认通过**

Run: `pnpm vitest run tests/sky/cloud-mind-quiz-page.test.tsx`

Expected: PASS。

### Task 5: 配置记忆与优先级恢复

**Files:**
- Modify: `app/sky/cloud-mind/quiz/page.tsx`
- Modify: `tests/sky/cloud-mind-quiz-page.test.tsx`

- [ ] **Step 1: 写恢复优先级失败测试**

测试 localStorage 配置会在无 URL 参数时恢复；URL topic 和 difficulty 覆盖本地值；非法 JSON 不导致渲染失败。

- [ ] **Step 2: 实现一次性本地恢复**

客户端挂载后读取固定键 `sky-cloud-mind-quiz-config-v1`，用 `parseStoredQuizConfig` 校验。对有 URL 参数的字段不应用本地值，并将相应 userEdited ref 设为 true，防止画像推荐覆盖。

- [ ] **Step 3: 实现配置保存**

完成首次恢复后，在配置字段变化时序列化 `StoredQuizConfig`。捕获 SecurityError 和 QuotaExceededError，静默忽略。

- [ ] **Step 4: 运行页面测试确认通过**

Run: `pnpm vitest run tests/sky/cloud-mind-quiz-page.test.tsx`

Expected: PASS。

### Task 6: 动态试炼摘要与真实预览状态机

**Files:**
- Modify: `app/sky/cloud-mind/quiz/page.tsx`
- Modify: `tests/sky/cloud-mind-quiz-page.test.tsx`

- [ ] **Step 1: 写预览状态失败测试**

覆盖：点击“预览 1 道样题”发送当前配置；成功时不显示答案；配置变化后显示“预览已过期”；旧请求响应不会覆盖新配置；失败后可以重试。

- [ ] **Step 2: 实现预览状态与会话缓存**

使用：

```ts
type PreviewState =
  | { status: 'idle' }
  | { status: 'loading'; signature: string }
  | { status: 'ready'; signature: string; question: QuizPreviewQuestion }
  | { status: 'stale'; signature: string; question: QuizPreviewQuestion }
  | { status: 'error'; signature: string; message: string };
```

用 `useRef(new Map<string, QuizPreviewQuestion>())` 保存当前会话缓存。

- [ ] **Step 3: 实现预览请求竞争保护**

发起请求时保存签名和 AbortController。响应返回后重新计算当前签名；相同则 ready，不同则 stale。新请求取消旧请求，组件卸载时取消请求。

- [ ] **Step 4: 改造右侧摘要**

标题改为“试炼摘要”，显示主题、难度、题量、题型和练习目标。样题区域展示题干与选项或填空/判断提示。按钮支持生成、重新生成和重试。

- [ ] **Step 5: 移动快捷键提示**

在主按钮下或同一操作区显示 `Ctrl/Cmd + Enter 快速生成`，右侧保留简短提示但不重复强调。

- [ ] **Step 6: 运行页面测试确认通过**

Run: `pnpm vitest run tests/sky/cloud-mind-quiz-page.test.tsx`

Expected: PASS。

### Task 7: 完整回归验证

**Files:**
- Verify all files above

- [ ] **Step 1: 格式检查**

Run: `pnpm exec prettier --check app/sky/cloud-mind/quiz/page.tsx app/api/sky/cloud-mind/quiz/route.ts app/api/sky/cloud-mind/quiz-preview/route.ts lib/cloud-mind/quiz-experience.ts lib/agents/cloud-mind/quiz-agent.ts lib/server/cloud-mind-quiz-job-store.ts lib/server/cloud-mind-quiz-job-runner.ts tests/cloud-mind/quiz-experience.test.ts tests/api/cloud-mind-quiz-preview.test.ts tests/sky/cloud-mind-quiz-page.test.tsx tests/agents/cloud-mind-quiz-agent.test.ts`

- [ ] **Step 2: ESLint**

Run: `pnpm exec eslint app/sky/cloud-mind/quiz/page.tsx app/api/sky/cloud-mind/quiz/route.ts app/api/sky/cloud-mind/quiz-preview/route.ts lib/cloud-mind/quiz-experience.ts lib/agents/cloud-mind/quiz-agent.ts lib/server/cloud-mind-quiz-job-store.ts lib/server/cloud-mind-quiz-job-runner.ts`

Expected: 0 errors。原有警告需单独列出，新增代码不增加警告。

- [ ] **Step 3: TypeScript**

Run: `npx tsc --noEmit`

Expected: PASS。

- [ ] **Step 4: 相关 Vitest**

Run: `pnpm vitest run tests/cloud-mind/quiz-experience.test.ts tests/api/cloud-mind-quiz-preview.test.ts tests/agents/cloud-mind-quiz-agent.test.ts tests/sky/cloud-mind-quiz-page.test.tsx`

Expected: PASS。

- [ ] **Step 5: 现有出题回归**

Run: `pnpm vitest run tests/agents/cloud-mind-quiz-backfill.test.ts tests/cloud-mind/tool-policies.test.ts`

Expected: PASS。

- [ ] **Step 6: 差异检查**

Run: `git diff --check`

Expected: 无空白错误。确认生成后的答题、评分、错题保存和画像更新代码未被结构性重写。
