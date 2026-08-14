# Agent 能力升级方案

> 生成时间：2026-08-13
> 目标：在现有智眸无界课堂中加入记忆反思、反事实决策、虚拟学生测试和因果行为数据闭环。

## 1. 方案结论

本项目采用“当前仓库技术栈优先、目标技术栈兼容”的方案：

- Agent 编排：继续使用 TypeScript + LangGraph。
- 结构化输出：继续使用 Zod；它承担 Pydantic 在当前项目中的角色。
- 业务数据：继续使用现有 MySQL 存储抽象，不额外维护一套 PostgreSQL 业务库。
- 原始学习证据：继续使用 `recordLearningEvent()` 和学习画像仓库。
- 反思任务：先做 Node/Next.js 可触发任务，再按部署环境接入外部定时器；不立即引入 APScheduler。
- 向量记忆：原型阶段暂不强制引入 Qdrant/Milvus，优先使用已有结构化画像和学习证据；需要语义检索时再接 Qdrant。
- 虚拟学生：复用现有学生 Agent 模板和 LangGraph，测试框架使用 Vitest；不为此引入 AutoGen 和 pytest。
- 因果分析：先落数据，不上 DoWhy、不做模型微调。

这四个模块不是四套孤立系统，而是一条闭环：

```text
原始学习事件
    -> 反思画像
    -> Director 生成候选干预方案
    -> 执行教学动作
    -> 记录学生结果
    -> 形成动作-结果数据
    -> 支持下一轮反思和策略评估
```

## 2. 当前基础与复用边界

| 能力 | 当前实现 | 本方案处理 |
|---|---|---|
| Agent 短期记忆 | `lib/ai/agent-memory.ts`、`lib/orchestration/agent-memory.ts` | 保留，增加反思画像入口 |
| 学习事件 | `lib/adaptive-learning/profile/event-recorder.ts` | 作为统一事件入口，扩充动作/结果事件 |
| 知识掌握状态 | `lib/adaptive-learning/profile/knowledge-state-engine.ts` | 保留，作为反事实输入 |
| 学习决策 | `lib/adaptive-learning/decision/learner-decision.ts` | 保留为规则基线和 LLM 失败兜底 |
| Director | `lib/orchestration/director-node.ts` | 在多 Agent 决策前增加推演节点 |
| LangGraph | `lib/orchestration/graph-definition.ts` | 复用现有图，不新增编排框架 |
| 学生画像 | `lib/adaptive-learning/profile/` | 增加带证据的行为反思层 |
| 虚拟学生 | `lib/orchestration/registry/templates/students/` | 扩充人设和行为参数 |
| 数据存储 | `StorageProvider` + MySQL migration | 增加专用表或保持事件表扩展 |
| 自动化测试 | Vitest | 增加模拟学生回归测试 |

## 3. 模块一：记忆与反思

### 3.1 功能

分为三层：

1. 原始记忆：保存对话、答题、错题、提示请求、学习时长、退出和复习行为。
2. 结构化学习事实：从原始事件中提炼主题、错误模式、偏好和学习状态。
3. 反思画像：定期生成高层学习行为假设，并提供置信度、证据和有效期。

反思画像不能替代知识掌握度。掌握度使用已验证答题证据；反思画像只描述“适合怎样干预”。

### 3.2 目标技术栈

- 原始记忆：MySQL / PostgreSQL。
- 结构化画像：PostgreSQL JSONB 或 MySQL JSON。
- 语义记忆：原型阶段可省略；需要时接 Qdrant，规模化后再考虑 Milvus。
- 反思执行：APScheduler 是 Python 方案；当前仓库先用 Node 任务入口或外部 cron 调用 API。
- LLM：沿用项目现有 provider/model abstraction。
- 可选 Mem0：只作为底层记忆实现，不负责最终学习画像决策。

### 3.3 当前项目实现

建议新增：

```ts
interface LearnerReflection {
  id: string;
  userId: string;
  windowStart: string;
  windowEnd: string;
  hypotheses: Array<{
    dimension:
      | 'goal'
      | 'knowledge'
      | 'error-pattern'
      | 'pace'
      | 'format-preference'
      | 'explanation-preference'
      | 'persistence'
      | 'intervention-response';
    statement: string;
    confidence: number;
    evidenceEventIds: string[];
    expiresAt: string;
  }>;
  sourceEventIds: string[];
  modelId: string;
  createdAt: string;
}
```

触发条件：

- 每累计 10 个相关学习事件触发一次。
- 或距离上次反思超过 24 小时且有新事件。
- 同一用户、同一时间窗口必须幂等。

### 3.4 可以偷懒的地方

- 不重写短期记忆。
- 不把所有聊天记录塞进 LLM，只传事件摘要和相关证据。
- 不立即引入 Mem0；现有 memory + profile repository 已够做原型。
- 不把画像存向量库；结构化画像必须可查询、可解释、可过期。

## 4. 模块二：反事实推演决策

### 4.1 功能

Director 在执行教学动作前生成 2-3 个干预方案，并比较：

- 预期学习效果。
- 学生继续学习的可能性。
- 对当前知识状态的适配度。
- 失败风险和副作用。
- 是否需要更多诊断证据。

原型阶段将其定义为“反事实方案预演”，不宣称是真实因果推断。

### 4.2 决策链

```text
读取知识状态、反思画像、最近事件
    -> 读取 learner-decision 规则基线
    -> 生成 2-3 个候选方案
    -> Zod 校验结构化输出
    -> 计算方案分数/应用硬规则
    -> 选择一个方案
    -> 执行原有 teaching/review/quiz/diagnostic
    -> 记录候选方案和最终选择
```

### 4.3 数据结构

```ts
interface InterventionPlan {
  id: string;
  action: 'teach' | 'review' | 'quiz' | 'diagnostic';
  topic: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  format: 'worked-example' | 'diagram' | 'interactive';
  expectedEffects: string[];
  risks: string[];
  rationale: string[];
  score: number;
}

interface CounterfactualDecision {
  decisionId: string;
  stateSummary: string;
  plans: InterventionPlan[];
  selectedPlanId: string;
  confidence: number;
  fallbackUsed: boolean;
  modelId?: string;
}
```

### 4.4 技术栈与复用

- LangGraph：复用现有 Director graph。
- Pydantic：当前项目使用 Zod 等价实现。
- 强模型：通过现有语言模型适配器配置，不绑定某一个供应商。
- `getLearnerDecision()`：保留为基线和 fallback。
- DoWhy、因果图、强化学习：明确不在原型范围。

硬约束：

- 用户明确指定主题时，推演只能调整教学方式和难度，不能偷偷换主题。
- 推演失败、超时或输出不合规时，必须回退到规则决策。
- 不允许将 LLM 生成的“预期效果”直接当作真实结果。

## 5. 模块三：虚拟学生 Agent 测试

### 5.1 功能

让不同学生人设自动跑课堂链路，用于发现流程漏洞和回归问题：

- 连续答错后是否降低难度。
- 学生请求提示后是否给出分层提示。
- 厌学/低耐心学生是否被持续说教。
- 学霸是否被过度重复基础内容。
- 多 Agent 是否死循环或超出回合上限。
- 每次动作是否产生可关联的学习事件。

### 5.2 学生人设

第一批固定 6 类：

| 人设 | 核心行为 |
|---|---|
| 冷启动型 | 没有历史证据，等待诊断 |
| 畏难型 | 难度升高时请求提示或中断 |
| 粗心型 | 概念会，但审题/计算错误多 |
| 厌学型 | 解释过长或连续失败时退出概率上升 |
| 学霸型 | 快速答对，要求更高难度 |
| 追问型 | 频繁询问为什么，偏好原理解释 |

### 5.3 技术栈

- Agent：现有 LangGraph + 学生模板。
- 测试：Vitest；不引入 AutoGen 和 pytest。
- 模型：低成本模型、mock provider 或固定响应。
- 结果：测试断言结构化事件、动作序列和终止原因，不断言自然语言逐字一致。

### 5.4 测试接口

建议提供纯服务接口：

```ts
interface SimulationRunInput {
  profileId: string;
  topic: string;
  maxTurns: number;
  seed?: number;
  modelMode: 'mock' | 'cheap-llm';
}

interface SimulationRunResult {
  runId: string;
  profileId: string;
  actions: string[];
  events: string[];
  completed: boolean;
  exited: boolean;
  failureReasons: string[];
  metrics: {
    turns: number;
    correctRate: number;
    hintsRequested: number;
    repeatedActions: number;
  };
}
```

### 5.5 可以偷懒的地方

- 复用现有学生模板，不重写多 Agent 协议。
- 先做 mock 模式保证稳定，再接低价 LLM。
- 不做大规模并行压测，先覆盖 6 个人设和核心链路。
- 不把虚拟学生结果混入真实用户画像，必须标记 `source=simulation`。

## 6. 模块四：因果行为数据集

### 6.1 功能

记录“Agent 做了什么”和“学生之后发生了什么”，为后续策略评估提供原始数据。

### 6.2 推荐数据模型

不使用两张互不关联的宽表，而使用决策、行为、结果三层：

```text
intervention_decisions
    1 -> N learner_behavior_events
    1 -> 1 learner_outcomes
```

建议字段：

```text
intervention_decisions
- decision_id
- user_id
- session_id
- state_snapshot JSON
- reflection_snapshot JSON
- candidate_plans JSON
- selected_plan JSON
- fallback_used
- model_id
- correlation_id
- created_at

learner_outcomes
- outcome_id
- decision_id
- user_id
- window_start
- window_end
- correct_count
- question_count
- correct_rate
- duration_seconds
- completed
- exited
- error_types JSON
- next_decision_id
- created_at
```

原始行为继续进入 `learning_events` 体系，并通过 `correlationId` 关联到 `decision_id`。

### 6.3 事件类型

至少覆盖：

```text
intervention-planned
intervention-selected
question-presented
answer-submitted
hint-requested
explanation-viewed
review-completed
session-completed
session-exited
```

### 6.4 技术栈与后期路线

- 当前：MySQL JSON + 现有 StorageProvider/DAO。
- 分析：先用 SQL 聚合；需要离线分析时导出 Pandas/Polars。
- 数据量增长后：PostgreSQL 或分析型数据库。
- 样本量足够后：DoWhy 做因果估计。
- 策略稳定后：再评估 LLaMA-Factory SFT；不把原始日志直接拿去微调。

## 7. 实施阶段

### Phase 1：事件与决策数据基础（基础闭环完成）

- [x] 扩展学习事件类型和 payload schema。
- [x] 建立 `intervention_decisions` 和 `learner_outcomes` DAO。
- [x] 为一次 Director 决策生成稳定 `decisionId/correlationId`。
- [x] 接通 Chat 决策上下文、结果提交 API、完成事件。
- [x] 增加用户归属校验和 outcome 幂等约束。
- [x] 在具体测验/复习前端接入结果提交和退出事件。

验收：Chat、quiz、memory 均能创建并关联 `decisionId/correlationId`；`/api/learning-outcomes` 可写入、查询、幂等保护 outcome；未完成 session 写入 `session-exited`。

### Phase 2：记忆反思画像（基础闭环完成）

- [x] 建立反思输入摘要器。
- [x] 建立 Zod 画像 schema。
- [x] 实现每 10 个事件/24 小时触发规则。
- [x] 接入 LLM 反思调用和失败重试；无 key/失败时规则 fallback。
- [x] 将画像合并到 teaching projection，并保留证据。
- [ ] 接入部署环境外部 cron/APScheduler（当前 Chat 请求触发 + API 手动触发已覆盖原型）。

验收：反思画像不会覆盖已验证知识状态；每条画像能追溯事件；低置信度结论不直接改变难度。已由 service/API/Chat 回归测试覆盖。

### Phase 3：反事实决策（基础闭环完成）

- [x] 新增候选方案生成服务。
- [x] 在 Chat Director 前读取画像和历史动作结果。
- [x] Zod 校验、方案评分、硬规则过滤。
- [x] 失败回退现有 `getLearnerDecision()`。
- [x] 记录候选方案、最终方案、模型和 fallback 状态。

验收：每次推演都有 2-3 个候选方案；异常时课堂仍能正常执行；用户指定主题不被改写。已由 counterfactual service + Chat 回归覆盖。

### Phase 4：虚拟学生回归测试

- [x] 增加 6 类行为人设。
- [x] 实现 mock 学生和 mock LLM 模式。
- [x] 为每个人设增加完整课堂链路测试。
- [x] 增加死循环、重复动作、超时、错误事件关联检查。
- [x] 将模拟结果与真实数据严格隔离。

验收：每次运行能输出统一指标；关键场景失败时能指出具体动作和事件；测试运行不依赖外部 LLM key。Phase 4 已完成。

### Phase 5：Shadow 与小范围启用

- [x] 新旧决策并行计算，默认不改变真实用户行为。
- [x] 记录新旧方案差异和后续结果。
- [x] 收集至少 20 条可验证答题链路后才具备灰度资格。
- [x] 比较完成率、正确率、提示请求率、退出率。
- [x] 达标后按稳定用户/会话 cohort 灰度开启，默认关闭。

验收：新策略在关键指标不明显退化、异常回退正常、数据链路可回放。Phase 5 基础闭环已完成；正式放量需先观察报告中的 baseline/newModel 指标。

## 8. 依赖关系

```text
Phase 1 数据基础
    ├──> Phase 2 记忆反思
    ├──> Phase 3 反事实决策
    └──> Phase 4 虚拟学生测试

Phase 2 + Phase 3
    └──> Phase 5 Shadow/灰度
```

Phase 1 必须先做，因为没有决策 ID 和结果数据，后面两个模块无法验证。

## 9. 不在本期范围

- Mem0 深度改造。
- Qdrant/Milvus 集群化。
- APScheduler 独立 Python 服务。
- AutoGen 多 Agent 重写。
- DoWhy 因果推断。
- LLaMA-Factory 微调。
- 基于行为信号给学生贴人格标签。
- 让 LLM 直接覆盖 verified mastery。

## 10. 风险与处理

| 风险 | 处理 |
|---|---|
| LLM 推演输出不稳定 | Zod 校验、限时、重试、规则 fallback |
| 反思画像误判学生 | 置信度、证据、有效期、用户可见解释 |
| 预测结果被误当真实因果 | 字段命名明确区分 `expected` 和 `observed` |
| 数据量快速膨胀 | 原始事件和摘要分层，限制上下文窗口，定期归档 |
| 模拟学生污染真实数据 | 所有模拟数据带 `source=simulation` 和独立 runId |
| 新策略影响真实学习 | 先 Shadow，再小流量灰度，保留旧决策回退 |
| 当前 MySQL 不适合分析 | 先业务库落地，后续导出分析库，不阻塞原型 |

## 11. 验收指标

1. 一次真实或模拟学习流程可以按 `decisionId` 回放完整链路。
2. 反思画像的每条结论至少包含一个证据事件和置信度。
3. 反事实决策成功生成 2-3 个候选方案；失败时 100% 回退规则决策。
4. 虚拟学生覆盖 6 类人设，测试不依赖真实 LLM key。
5. 模拟数据和真实用户数据查询结果完全隔离。
6. 用户指定主题时，最终决策主题与用户输入一致。
7. 已验证答题证据仍由现有知识状态引擎处理，不被 LLM 画像覆盖。
8. 新增能力不降低现有学习决策、错题、复习和教学流程的测试通过率。

## 12. 交付物

- 数据库迁移和 DAO。
- 学习事件 schema 扩展。
- 反思画像 schema、服务和任务入口。
- 反事实方案 schema、生成器、评分器和 fallback。
- 虚拟学生行为配置和 Vitest 回归套件。
- Shadow 对比日志和基础指标查询。
- 开发文档、运行配置和测试说明。

## 13. 执行建议

先实施 Phase 1，再分别实现 Phase 2、Phase 3、Phase 4，最后进入 Phase 5。每个阶段独立提交、独立测试；不要先安装所有候选框架。只有当现有结构化检索无法满足实际上下文检索需求时，才增加 Qdrant；只有当累积了可比较的动作-结果数据后，才引入 DoWhy 或微调。
