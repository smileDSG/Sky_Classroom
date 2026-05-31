# 队员3 模块 C + D 实现设计

> 日期：2026-05-31
> 负责人：队员3
> 来源：`docs/OPTIMIZATION-PLAN.md` 模块 C（解题多 Agent 链）+ 模块 D（自适应授课系统）

---

## 1. 概述

队员3 负责两个模块：

- **模块 C · 解题多 Agent 链**（Week 2-5）：C-001 ~ C-006
- **模块 D · 自适应授课系统**（Week 5-7）：D-001 ~ D-005，依赖模块 C 完成

### 核心决策

| 决策 | 选择 | 理由 |
|------|------|------|
| Agent 链框架 | AsyncGenerator 链式调度 | 与现有 `streaming-solver.ts` 模式一致，无额外依赖 |
| 与现有 LangGraph 关系 | 替代 `solve-graph.ts` | 新拓扑（analyze→solve→verify→correct→knowledge→similar）与现有不同 |
| Analyze Agent 模型 | DeepSeek Flash | 轻量快速，与现有 `universal` agent 一致 |
| Verify Agent 模型 | 按学科路由（同 Solve Agent） | 沿用现有模型配置 |
| 学生画像数据源 | mistakes + 知识图谱 | 数据已存在，无需新建表 |
| SSE 兼容性 | 向后兼容 + 扩展 | 旧前端忽略新事件类型，`done` 事件新增可选字段 |

---

## 2. 模块 C · 解题多 Agent 链

### 2.1 整体拓扑

```
用户输入 (problemText + problemImage + userAnswer?)
    │
    ▼
┌─────────────┐
│  Analyze     │  DeepSeek Flash · 轻量分析
│  Agent       │  → { subject, knowledgePoints[], difficulty, questionType, confidence }
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Solve       │  按 subject 路由：science→GLM / humanities→Qwen / universal→DeepSeek
│  Agent       │  → 流式输出 steps + answer（复用现有 streaming-solver 逻辑）
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Verify      │  用不同模型独立解题 + 答案对比
│  Agent       │  → { isCorrect, confidence, suggestedAnswer?, reasoning }
└──────┬──────┘
       │ isCorrect=false?
       ▼
┌─────────────┐
│  Correct     │  用 suggestedAnswer 重新解题（最多 1 次）
│  Agent       │  → 修正后的 steps + answer
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Knowledge   │  复用现有 generateKnowledgePointsParallel
│  Agent       │  → knowledgePoints[]
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Similar     │  复用现有 findSimilarByKnowledgePoints
│  Agent       │  → similarQuestions[]
└──────┴──────┘
```

### 2.2 C-001 · 题目分析 Agent

**文件**：
```
lib/solve/agents/
  analyze-agent.ts        # 题目分析 Agent
  analyze-prompts.ts      # 分析 prompt 模板
  analyze-types.ts        # AnalysisResult 类型
```

**类型定义**（`analyze-types.ts`）：
```typescript
export interface AnalysisResult {
  subject: string;           // 数学/物理/化学/生物/语文/英语/历史/地理/政治
  knowledgePoints: string[]; // 2-4 个相关知识点
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'choice' | 'fill' | 'solve' | 'judge';
  confidence: number;        // 0-1
}
```

**行为**：
- 输入：题目文本 + 可选图片
- 输出：`AnalysisResult` JSON
- 使用 DeepSeek Flash（`resolveSolverModel('universal')`）
- 超时 10s，失败返回默认值 `{ subject: 'unknown', difficulty: 'medium', questionType: 'solve', confidence: 0 }`

**Prompt 设计**（`analyze-prompts.ts`）：
- System prompt 要求输出纯 JSON
- 列出所有支持的学科和题型
- 要求给出 confidence 评分

### 2.3 C-002 · 自校验 Agent + 答案匹配器

**文件**：
```
lib/solve/agents/
  verify-agent.ts         # 自校验 Agent
  verify-prompts.ts       # 校验 prompt 模板
  verify-types.ts         # VerifyResult 类型
  answer-matcher.ts       # 答案格式匹配
```

**类型定义**（`verify-types.ts`）：
```typescript
export interface VerifyResult {
  isCorrect: boolean;
  confidence: number;         // 0-1
  suggestedAnswer?: string;   // isCorrect=false 时提供
  reasoning: string;          // 校验推理过程
}
```

**Verify Agent 行为**：
- 输入：题目 + 原始答案
- 用不同于 Solve Agent 的模型独立解题（同 provider 不同模型，或不同 provider）
- 通过 `answer-matcher` 对比两个答案
- 超时 30s，失败返回 `{ isCorrect: true, confidence: 0, reasoning: 'verify timeout' }`（乐观降级）

**Answer Matcher**（`answer-matcher.ts`）：
- 标准化处理：去除 `$`、空格、换行
- 数值比较：`3` == `$3$` == `3.0`
- 选项比较：`C` == `选项C` == `(C)` == `（C）`
- LaTeX 等价：`\frac{1}{2}` == `\dfrac{1}{2}` == `1/2`
- 集合/区间：`{1,2,3}` == `{1, 2, 3}`
- 返回 `{ match: boolean, confidence: number }`

### 2.4 C-003 · 解题 Agent 链调度器

**文件**：
```
lib/solve/
  solve-chain.ts          # Agent 链调度器
  solve-chain-types.ts    # 链路状态类型
```

**调度器行为**（`solve-chain.ts`）：
- `async function* solveChain(input): AsyncGenerator<SolveChainEvent>`
- 串联各 Agent，每步 `yield` 事件
- 单步超时 30s（AbortController）
- 总链路超时 60s
- 错误降级：单步失败跳过 + 标记，不阻断后续步骤

**链路状态类型**（`solve-chain-types.ts`）：
```typescript
export interface SolveChainInput {
  problemText: string;
  problemImage?: string | null;
  userAnswer?: string | null;
}

export type SolveChainEvent =
  | { type: 'phase'; phase: string }
  | { type: 'analysis'; data: AnalysisResult }
  | { type: 'step'; label: string; content: string; keyPoints?: string[] }
  | { type: 'answer'; answer: string }
  | { type: 'verification'; data: VerifyResult }
  | { type: 'knowledge'; points: KnowledgePoint[] }
  | { type: 'similar'; questions: SimilarQuestion[] }
  | { type: 'done'; metadata: SolveChainMetadata }
  | { type: 'error'; message: string };

export interface SolveChainMetadata {
  agentType: SolverAgentType;
  analysis?: AnalysisResult;
  verification?: VerifyResult;
  corrected: boolean;
  fromQuestionBank: boolean;
  fromSolveCache: boolean;
  totalTimeMs: number;
}
```

**复用策略**：
- Solve Agent：复用 `streaming-solver.ts` 的 `streamSolve()`
- Knowledge Agent：复用 `explain-stream/route.ts` 的 `generateKnowledgePointsParallel()`
- Similar Agent：复用 `question-bank.ts` 的 `findSimilarByKnowledgePoints()`
- Cache/KB 查找：复用 `solve-cache.ts` 和 `question-bank.ts`

### 2.5 C-004 · 解题 SSE 流式事件

**文件**：
```
app/api/sky/solve/
  explain-stream/route.ts   # 重构：使用 solve-chain
```

**重构要点**：
- 将现有 `POST /api/sky/solve/explain-stream` 的内部实现替换为 `solveChain()`
- 保持现有 SSE 事件格式（`step/answer/knowledge/similar/phase/done/error`）
- 新增事件类型（`analysis/verification`）作为扩展
- `done` 事件新增可选字段：`analysis`, `verification`, `corrected`
- 保留 cache/KB 命中的快速路径（不走 Agent 链）

### 2.6 C-005 · 解题页面改造

**文件**：
```
components/sky/solve/
  analysis-card.tsx         # 题目分析卡片
  verification-badge.tsx    # 校验状态标记
  chain-progress.tsx        # Agent 链进度条
```

**组件设计**：

`analysis-card.tsx`：
- 接收 `analysis` SSE 事件
- 展示：学科标签、知识点标签列表、难度徽章、题型标识
- 使用 shadcn Badge + Card 组件

`verification-badge.tsx`：
- 接收 `verification` SSE 事件
- 三种状态：✅ 正确 / ❌ 修正后正确 / ⚠️ 不确定
- 点击展开详细推理过程

`chain-progress.tsx`：
- 接收 `phase` SSE 事件
- 显示阶段进度条：analyzing → solving → verifying → knowledge → similar → done
- 当前阶段高亮 + 动画

**现有组件适配**：
- `solution-panel.tsx`：新增对 `analysis`/`verification` 事件的处理逻辑
- `solve-page.tsx`：集成新组件

---

## 3. 模块 D · 自适应授课系统

### 3.1 整体流程

```
学生请求授课（主题 + 可选科目）
    │
    ▼
┌──────────────┐
│ 学生画像      │  从 mistakes + 知识图谱聚合
│ ProfileBuilder│  → StudentProfile { masteryByKnowledge, weakPoints, strongPoints, errorPatterns }
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 授课规划      │  根据画像 + 主题 → LessonPlan
│ LessonPlanner │  → { sections[], estimatedDuration, focusPoints[] }
│              │  掌握度 <30% → 基础概念 / 30-70% → 重点强化 / >70% → 拓展提升
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 内容生成      │  按 Section 逐段流式生成
│ ContentGen   │  → 讲解文本 / 例题 / 图表描述 / 随堂测
└──────┬───────┘
       │ 每个知识点后
       ▼
┌──────────────┐
│ 随堂检测      │  自动生成 1-2 道检测题
│ QuizInjector │  → 答对率低 → 补充讲解 / 答对率高 → 加速
└──────────────┘
```

### 3.2 D-001 · 学生画像系统

**文件**：
```
lib/student/
  profile-types.ts        # StudentProfile 类型定义
  profile-builder.ts      # 画像聚合引擎

app/api/sky/student/
  profile/route.ts        # GET 画像 API
```

**类型定义**（`profile-types.ts`）：
```typescript
export interface StudentProfile {
  masteryBySubject: Record<string, number>;      // 学科掌握度 0-100
  masteryByKnowledge: Record<string, number>;    // 知识点掌握度 0-100
  weakPoints: string[];                          // 薄弱知识点（掌握度 < 50）
  strongPoints: string[];                        // 强项知识点（掌握度 > 80）
  errorPatterns: ErrorPattern[];                 // 错误模式
  totalProblems: number;
  totalCorrect: number;
  overallAccuracy: number;                       // 总正确率 0-1
}

export interface ErrorPattern {
  cause: MistakeCause;
  count: number;
  percentage: number;
  typicalExample?: string;
}
```

**聚合逻辑**（`profile-builder.ts`）：
- 从 `lib/mistakes/knowledge-graph.ts` 读取 `KnowledgeGraph`（含 `nodes[].mastery`）
- 从 `lib/mistakes/mistake-tracker.ts` 读取 `MistakeRecord[]`
- 计算 `masteryBySubject`：按学科分组，取平均 mastery
- 计算 `masteryByKnowledge`：直接从 KnowledgeNode 读取
- 计算 `weakPoints`/`strongPoints`：按 mastery 阈值筛选
- 计算 `errorPatterns`：按 MistakeCause 分组统计
- 缓存：5 分钟 TTL（内存 Map）

**API**：`GET /api/sky/student/profile`
- 返回 `StudentProfile` JSON
- 支持 query param `?subject=数学` 按学科筛选

### 3.3 D-002 · 授课规划 Agent

**文件**：
```
lib/teaching/
  lesson-planner.ts       # 授课规划 Agent
  lesson-types.ts         # LessonPlan / LessonSection 类型
```

**类型定义**（`lesson-types.ts`）：
```typescript
export interface LessonPlan {
  topic: string;
  sections: LessonSection[];
  estimatedDuration: number;  // 分钟
  focusPoints: string[];      // 重点关注的知识点
}

export interface LessonSection {
  id: string;
  title: string;
  knowledgePoint: string;
  depth: 'basic' | 'normal' | 'advanced';  // 根据掌握度决定
  hasQuiz: boolean;
  estimatedMinutes: number;
}

export type ContentChunkType = 'text' | 'example' | 'diagram' | 'quiz';

export interface ContentChunk {
  sectionId: string;
  type: ContentChunkType;
  content: string;
  isLast: boolean;
}
```

**规划逻辑**（`lesson-planner.ts`）：
- 输入：`StudentProfile` + 授课主题
- LLM 生成 `LessonPlan` JSON
- 掌握度分层策略：
  - < 30%：`depth: 'basic'`，增加例题
  - 30-70%：`depth: 'normal'`，标准讲解
  - \> 70%：`depth: 'advanced'`，拓展提升
- 薄弱知识点优先排序
- 每个 Section 标记 `hasQuiz: true`

### 3.4 D-003 · 动态授课内容生成

**文件**：
```
lib/teaching/
  content-generator.ts    # 内容生成引擎（流式）
  content-types.ts        # ContentChunk 类型（复用 lesson-types.ts）

app/api/sky/teaching/
  generate-stream/route.ts # POST SSE 流式授课 API
```

**内容生成器**（`content-generator.ts`）：
- `async function* generateTeachingContent(plan, profile): AsyncGenerator<TeachingEvent>`
- 按 Section 逐段流式生成
- 内容类型：讲解文本 / 例题 / 图表描述
- LaTeX 支持：复用 `math-postprocessor.ts`
- 每个 Section 生成完毕后，触发 `quiz-injector` 生成随堂测

**SSE 事件格式**：
```typescript
export type TeachingEvent =
  | { type: 'profile'; data: StudentProfileSummary }
  | { type: 'plan'; data: LessonPlan }
  | { type: 'content'; sectionId: string; chunkType: ContentChunkType; content: string; isLast: boolean }
  | { type: 'quiz'; sectionId: string; question: QuizQuestion }
  | { type: 'quiz-result'; isCorrect: boolean; explanation: string; nextAction: string }
  | { type: 'adjustment'; reason: string; newPace: string }
  | { type: 'done'; totalSections: number; quizStats: QuizStats; duration: number }
  | { type: 'error'; message: string };
```

**API**：`POST /api/sky/teaching/generate-stream`
- 请求体：`{ topic: string, subject?: string }`
- 响应：SSE 流
- 内部流程：`buildProfile → planLesson → generateContent → injectQuiz`

### 3.5 D-004 · 随堂检测系统

**文件**：
```
lib/teaching/
  quiz-injector.ts        # 随堂测注入器

components/sky/teaching/
  inline-quiz.tsx         # 内嵌答题组件
```

**Quiz Injector**（`quiz-injector.ts`）：
- 输入：知识点 + 掌握度
- 从 `question_bank` 按知识点匹配题目（优先使用已有题目）
- 无匹配时用 LLM 生成 1-2 道检测题
- 返回 `QuizQuestion { id, question, options?, questionType, answer, explanation }`

**实时调整逻辑**：
- 答对率 ≥ 80%：标记"已掌握"，跳过补充讲解，加速
- 答对率 < 50%：插入补充讲解 Section，降低难度
- 答对率 50-80%：继续原计划，增加例题

**前端组件**（`inline-quiz.tsx`）：
- 嵌入在授课内容流中
- 支持选择题/填空题/判断题
- 答题后立即显示批改结果 + 解析
- 使用 shadcn Card + RadioGroup + Button

---

## 4. 错误处理

### 模块 C

| 场景 | 策略 |
|------|------|
| Analyze Agent 超时/失败 | 跳过分析，用默认值继续 |
| Solve Agent 失败 | 返回 `error` SSE 事件，终止链路 |
| Verify Agent 失败 | 跳过校验，标记 `verification: null`，继续 |
| Correct Agent 失败 | 使用原始答案，标记 `corrected: false` |
| 总链路超时 60s | 强制终止，返回已收集的部分结果 |
| 单步超时 30s | AbortController 取消，该步返回降级结果 |

### 模块 D

| 场景 | 策略 |
|------|------|
| 画像聚合失败 | 使用空画像继续 |
| 授课规划失败 | 使用默认线性计划 |
| 内容生成失败 | 重试 1 次，仍失败跳过该 Section |
| 随堂测生成失败 | 跳过检测，继续下一节 |

---

## 5. 测试策略

### 模块 C（C-006）

```
tests/solve/agents/
  analyze-agent.test.ts     # 多学科/多题型识别准确率
  verify-agent.test.ts      # 正确答案通过 / 错误答案拦截 / 格式差异
  correct-agent.test.ts     # 修正逻辑
  answer-matcher.test.ts    # LaTeX 格式 / 选项格式差异
tests/solve/
  solve-chain.test.ts       # 正常链路 / 修正链路 / 超时降级
  explain-stream.test.ts    # SSE 事件顺序 / 向后兼容性
```

### 模块 D（D-005）

```
tests/teaching/
  profile-builder.test.ts   # 画像聚合正确性
  lesson-planner.test.ts    # 授课规划逻辑（掌握度分层）
  content-generator.test.ts # 内容生成格式
  quiz-injector.test.ts     # 随堂测注入 + 批改逻辑
```

**测试方法**：mock LLM 调用（返回固定 JSON），验证调度逻辑和数据流。不测试 LLM 输出质量。

---

## 6. 依赖关系

```
P1-001 + P1-002（队长已完成）
    │
    ▼
C-001 Analyze Agent ─────────┐
                              │
C-002 Verify Agent + Matcher ─┤
                              ▼
                        C-003 Solve Chain
                              │
                              ▼
                        C-004 SSE 重构
                              │
                              ▼
                        C-005 前端改造
                              │
                              ▼
                        C-006 测试
                              │
                              ▼
                        D-001 学生画像
                              │
                              ▼
                        D-002 授课规划
                              │
                              ▼
                        D-003 内容生成 + API
                              │
                              ▼
                        D-004 随堂检测
                              │
                              ▼
                        D-005 测试
```

- C-001 和 C-002 可并行开发
- C-003 依赖 C-001 + C-002
- C-004 依赖 C-003
- C-005 依赖 C-004
- D-001 依赖模块 C 完成（需要 solve chain 的数据作为画像输入）
- D-002 ~ D-004 顺序依赖

---

## 7. API 端点

| 端点 | 方法 | 模块 | 说明 |
|------|------|------|------|
| `/api/sky/solve/explain-stream` | POST (SSE) | C-004 | 重构：使用 solve-chain |
| `/api/sky/student/profile` | GET | D-001 | 学生画像 API |
| `/api/sky/teaching/generate-stream` | POST (SSE) | D-003 | 流式授课 API |

---

*设计文档结束*
