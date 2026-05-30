# A-001 解题引擎 Design Spec

> Date: 2026-05-18
> Module: Sky Classroom - Solve Graph (解题引擎)
> Reference: `task/zhimo-design.md` section A-001

---

## 1. Purpose

基于 LangGraph `StateGraph` 构建解题编排流程，实现：**题库查重 → 路由到 Agent → 解题 → 批改**。
采用**混合策略**：默认单模型快速解题，置信度低时自动触发多模型投票。

---

## 2. Architecture

### 2.1 State Definition

使用 `Annotation.Root()` 模式定义 LangGraph 状态，基于 `lib/solve/types.ts` 的 `SolveState` 扩展：

```
SolveGraphState (extends SolveState):
  - problemText: string           # 题目文本
  - problemImage: string | null   # 题目图片 (base64/data URL)
  - userAnswer: string | null     # 用户答案（可选，用于批改模式）
  - agentId: string               # 当前使用的 Agent ID
  - solution: string | null       # 解题结果
  - gradeResult: GradeResult | null # 批改结果
  - votingResults: VotingResult[]  # 多模型投票结果
  - fourPartOutput: FourPartOutput | null # 四段式输出
  - fromQuestionBank: boolean      # 是否来自题库
  - selectedAgentId: string | null # 路由选定的 Agent
  - agentRoute: SolverAgentType | null # 'universal' | 'science' | 'humanities'
  - error: string | null           # 错误信息
```

### 2.2 Graph Topology

```
START → checkQuestionBank → routeToAgent → solveWithAgent → gradeAnswer → generateOutput → END
              │                   │              │              │
              ├─(hit)─────────────┘              │              │
              │                                  │              │
              │                                  ├─(fallback)───┘
              │                                                   │
              └───────────────────────────────────────────────────┘
```

条件边：
- `checkQuestionBank` → 命中题库 → 跳到 `generateOutput`；未命中 → `routeToAgent`
- `routeToAgent` → 路由到 `solveWithAgent`
- `solveWithAgent` → 成功 → `gradeAnswer`；失败 → failover 重试 → `gradeAnswer`
- `gradeAnswer` → 有用户答案 → 执行批改；无 → 跳过 → `generateOutput`

### 2.3 Nodes

| 节点 | 输入 | 输出 | 说明 |
|------|------|------|------|
| `checkQuestionBank` | `problemText` | `solution`, `fromQuestionBank` | 查题库，命中直接返回 |
| `routeToAgent` | `problemText` | `selectedAgentId`, `agentRoute` | 规则路由（题目分类→Agent选择） |
| `solveWithAgent` | `problemText`, `agentRoute` | `solution` | 调用 LLM 解题 |
| `gradeAnswer` | `solution`, `userAnswer` | `gradeResult` | 对比答案批改 |
| `generateOutput` | `solution`, `gradeResult` | `fourPartOutput` | 四段式格式化 |

### 2.4 Hybrid Strategy

```
solveWithAgent:
  1. 调用主 Agent (默认 universal / DeepSeek-V3)
  2. 解析返回结果的 confidence 字段
  3. if confidence < 0.7:
       触发 fallback 到第二模型 (science / GLM-4-Plus)
       if 两模型答案差异大:
         触发第三模型 (humanities / Qwen-Max) 投票
         按多数票决定最终答案
     else:
       直接使用主模型结果
```

### 2.5 Failover

- 主模型调用失败 → 使用 `lib/ai/failover.ts` 自动切换备用模型
- 所有模型均失败 → 返回错误状态，`error` 字段记录原因

---

## 3. File Structure

```
lib/
└── solve/
    ├── types.ts                 # 已有，不变
    ├── index.ts                 # 已有，扩展导出
    ├── solve-graph.ts           # NEW: StateGraph 定义 + 节点实现
    └── solver-agent.ts          # NEW: 解题 Agent 节点（LLM 调用）
```

### 3.1 `lib/solve/solve-graph.ts` (~200 lines)

- `SolveGraphAnnotation` — LangGraph 状态注解
- `createSolveGraph()` — 创建 StateGraph 并 compile
- 节点实现：`checkQuestionBankNode`, `routeToAgentNode`, `gradeAnswerNode`, `generateOutputNode`
- 条件边函数：`afterCheckBank`, `afterSolve`

### 3.2 `lib/solve/solver-agent.ts` (~150 lines)

- `solveWithAgent(state)` — 核心解题节点
  - 解析 `agentRoute` 选择模型
  - 调用 `getModel()` from `lib/ai/providers.ts`
  - 使用 `callLLM()` from `lib/ai/llm.ts`
  - 解析返回 JSON，提取 solution + confidence
  - 混合策略：confidence < 0.7 触发 fallback
- `resolveSolverModel(agentRoute)` — Agent 路由到具体 provider/model
- `parseSolutionResponse(content)` — 解析 LLM 返回的结构化解题结果

---

## 4. Dependencies

- `@langchain/langgraph` — StateGraph 框架
- `lib/ai/providers.ts` — 模型工厂 (`getModel`)
- `lib/ai/llm.ts` — 统一 LLM 调用层 (`callLLM`)
- `lib/ai/failover.ts` — 故障降级
- `lib/solve/types.ts` — 类型定义
- `lib/solve/question-bank.ts` — 题库（A-004，预留接口 mock）
- `lib/logger` — 日志（复用现有）

---

## 5. Error Handling

| 错误场景 | 处理方式 |
|----------|----------|
| 题库查询异常 | 跳过题库，直接解题 |
| 主模型超时/失败 | failover 切换备用模型 |
| 所有模型失败 | 返回 `error` 状态，不抛异常 |
| JSON 解析失败 | 使用 `lib/generation/json-repair.ts` 修复 |
| 路由规则不匹配 | 默认使用 `universal` Agent |

---

## 6. Testing Strategy

- 单元测试：每个节点函数独立测试（mock LLM）
- 集成测试：START → END 全链路（mock providers）
- 混合策略测试：confidence 阈值触发 fallback 的行为验证
