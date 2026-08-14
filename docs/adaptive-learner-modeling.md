# 实时学习者建模与自适应方案调整 · 设计文档

> 目标：在课堂运行时持续估计学习者状态（需求、薄弱点、待提升项），并据此动态调整教学方案。
> 原则：**所有 mastery / θ 都是模型内潜变量估计（model-based），不等同于"学生真的掌握了"的经验事实。**

---

## 0. 现状盘点

### 已有（可直接复用）

| 能力 | 路径 | 说明 |
|---|---|---|
| 知识状态贝叶斯引擎 | `lib/adaptive-learning/profile/knowledge-state-engine.ts` | Beta(α,β) + 指数遗忘 + 证据质量加权 |
| 学习者契约 | `lib/adaptive-learning/contracts/learner.ts` | `KnowledgeState` / `LearningEvent`（9 类）/ `LearnerPreferences` |
| 画像投影 | `lib/adaptive-learning/contracts/profile-projection.ts` | teaching / assessment / retrieval / planning / dashboard 五视图 |
| 决策函数 | `lib/adaptive-learning/decision/learner-decision.ts` | 输出 action + difficulty + reasonCodes |
| 答题证据映射 | `lib/adaptive-learning/profile/quiz-evidence-recorder.ts` | 答题 → 知识点证据 |
| 编排状态 | `lib/orchestration/state-manager.ts` (`OrchestratorState.teachingProjection`) | 画像已能注入编排层 |
| 知识图谱 | `lib/knowledge-graph/` | 节点与关系（**尚未参与状态更新**） |
| 提示词占位符 | `lib/prompts/templates/requirements-to-outlines/user.md` | 已有 `{{userProfile}}` / `{{teacherContext}}` |
| 用户体系 | `lib/server/auth/helpers.ts` | 所有画像 API 按 `userId` 关联 |
| 存储 | `lib/storage/storage-factory.ts` + `storage_entries` 通用 KV 表 | **新增逻辑表无需 migration** |

### 三个缺口

1. **L0 证据太窄** —— 只有答题正误落库（`app/api/sky/cloud-mind/quiz-attempts`、`app/api/sky/solve/grade`）。
   课堂行为信号（回放、暂停、停留、提问）没有出口。`lib/monitoring/telemetry.ts::trackEvent` 目前是死代码。
2. **L1 状态丢信息** —— 不建模题目难度（答对难题 = 答对水题）；不做前置依赖传播（错在表象，根因在上游）。
3. **L2 决策是 if-else** —— 阈值瀑布，无不确定性感知、无探索、无重排闸门。
   且 `getLearnerDecision` 只被 `lib/cloud-mind/personalization-context.ts:401` 调用，**未接入 director graph**。

---

## 1. L0 · 证据层

### 1.1 事件 schema 扩展

在 `lib/adaptive-learning/contracts/learner.ts` 的 `LearningEvent` 枚举中补充学生侧事件：

| 事件 | 触发点 | 承载信息 | 默认 evidenceQuality |
|---|---|---|---|
| `segment-replayed` | `lib/playback/engine.ts` | segmentId, 回放次数 | `inferred` (w=0.4) |
| `segment-paused` | 同上 | segmentId, 暂停时长 | `inferred` |
| `dwell-recorded` | 前端 slide 组件 | slideId, 停留秒数, 相对基线倍率 | `inferred` |
| `question-asked` | `app/api/chat/route.ts` | 原文 + LLM 打的意图标签 + 命中 nodeIds | `inferred` |
| `self-reported` | UI「没听懂 / 懂了」按钮 | nodeId, 主观等级 | `self-reported` (w=0.6) |
| `answer-submitted` | 已有 | + **itemId**（新增，用于 IRT） | `verified` (w=1.0) |

现有 `QUALITY_WEIGHTS` 已经能覆盖这套强弱分级，**无需改权重表**。

### 1.2 隐式信号 → 证据的映射

隐式信号不能直接当"答错"。用一个软映射折算成虚拟 β 增量：

```
β_delta = w_inferred × clip( (dwell / baseline_dwell - 1), 0, 1 ) × 0.5
```

代入：某页基线停留 40s，学生停了 76s → 倍率 1.9 → clip 后 1.0 → β_delta = 0.4 × 1.0 × 0.5 = **0.2**。
相当于"四分之一次答错"，不会因为学生走神喝了口水就判定不会。

回放同理：回放 1 次 → 0.2，2 次 → 0.35，3 次以上封顶 0.5（次线性，避免刷屏）。

### 1.3 落地

- 统一出口：`lib/adaptive-learning/profile/event-recorder.ts`（已存在）
- 新增 `app/api/learning-events/route.ts`（批量提交，前端 5s 或 20 条 flush 一次）
- 客户端缓冲，失败静默丢弃 —— **埋点绝不能阻塞教学主流程**（现有引擎已是这个防御风格，保持一致）

---

## 2. L1 · 状态估计层

### 2.1 双轨状态

保留现有 Beta 作为**知识点掌握度**，新增 Elo/IRT 作为**跨题目能力标尺**。两者职责不同，不要合并。

| 量 | 语义 | 更新时机 |
|---|---|---|
| `KnowledgeState.alpha/beta` | 某个知识点的掌握度与不确定性 | 所有证据事件 |
| `AbilityState.theta` | 学习者在某学科维度的整体能力（logit） | 仅 `answer-submitted`（有 itemId） |
| `ItemState.b` | 题目难度（logit，与 theta 同尺度） | 同上 |

### 2.2 1PL / Rasch + 在线 Elo

```
p̂ = σ(θ_u − b_i) = 1 / (1 + exp(−(θ_u − b_i)))

θ_u ← θ_u + K_u · (y − p̂)
b_i ← b_i − K_i · (y − p̂)

K_u = K0 / (1 + n_u / n0)      K0 = 0.6,  n0 = 10
K_i = K0 / (1 + n_i / n0)      同上（题目侧独立计数）
```

**符号词典**：`θ_u` 学生能力，`b_i` 题目难度，同为 logit 尺度、0 = 群体平均；`σ` sigmoid；
`y` 实际结果 0/1；`p̂` 预测答对概率；`K` 学习率（卡尔曼增益的简化版，证据越多越保守）。

**参考值**：θ−b = 0 → 50%；0.5 → 62%；1.0 → 73%；1.5 → 82%；2.0 → 88%。

**代入数字**：θ=0 的学生做 b=1.0 的题 → p̂ = 0.269。
- 答对：θ ← 0 + 0.6×(1−0.269) = **+0.439**
- 答错：θ ← 0 + 0.6×(0−0.269) = **−0.161**

同一学生做 b=−1.0 的题（p̂ = 0.731）：
- 答对：**+0.161**　- 答错：**−0.439**

对照现有 Beta 模型：这四种情况全部记 ±1.0，信息量完全一样。这就是升级的直接收益。

> 暂不上 2PL（区分度 a_i）。区分度需要更多数据才稳，等单题作答量 ≥ 200 再考虑。

### 2.3 知识图谱软传播

```
Δα_j += λ^d(i,j) · Δα_i        λ = 0.4,  d ≥ 3 截断
```

- **负证据往前驱传**（不会分式方程 → 可能不会通分）
- **正证据往后继传**（会解二次方程 → 大概率会配方）
- 单事件传播节点数上限 8，防止图上爆炸

**代入**：直接前驱 d=1 → 传 40%，隔一层 d=2 → 16%，d=3 起忽略。

### 2.4 薄弱根因归因（blame assignment）

给定近期错题命中的节点集合 E，候选 = `ancestors(E) ∪ E`，打分：

```
score(j) = (1 − mastery_j) × confidence_j × coverage_j(E)
```

`coverage_j(E)` = E 中有多少节点以 j 为祖先 / |E|。取 top-2 作为"薄弱根因"输出到画像的 `growthAreas`。

**为什么要乘 confidence**：不加这项的话，一个完全没证据的节点（mastery=0.5, conf=0）会莫名其妙被当成根因。

### 2.5 不确定性 —— 什么时候可以下结论

```
Var[mastery] = αβ / ((α+β)² (α+β+1))
```

**代入**：Beta(2,1) → Var = 2/(9×4) = 0.0556 → sd = **0.236**。
mastery = 0.667 ± 0.24，**这时候说"掌握了"是不负责任的**。
Beta(8,2) → sd = 0.121，才勉强能下结论。

判定规则：
- `sd > 0.20` → 状态不可用于决策，只能触发 `diagnostic`
- `sd ≤ 0.12 且 mastery ≥ 0.8` → 可以标"已掌握"
- `sd ≤ 0.12 且 mastery ≤ 0.45` → 可以标"薄弱点"

---

## 3. L2 · 决策策略层

### 3.1 效用函数

```
U(j) = w1·E[Δm_j] + w2·I(θ,b_j) + w3·(1 − R_j) − w4·max(0, p* − p̂_j) − w5·Cost_j
```

| 项 | 含义 | 计算 |
|---|---|---|
| `E[Δm_j]` | 预期掌握度增益 | `(1 − mastery_j) × p_learn`，`p_learn` 取 0.3 先验 |
| `I(θ,b_j)` | Fisher 信息（测量价值） | `p̂(1−p̂)`，p̂=0.5 时最大 0.25 |
| `1 − R_j` | 遗忘紧迫度 | `R_j = exp(−Δt / S_j)`，已有实现 |
| `max(0, p*−p̂)` | 挫败风险 | 目标成功率之下的缺口 |
| `Cost_j` | 时间成本 | 归一化到 [0,1] |

初始权重 `w = (0.40, 0.20, 0.25, 0.10, 0.05)`，**必须靠 §5 离线回放调参，不要拍脑袋定死**。

### 3.2 目标难度（ZPD）

```
b* = θ − logit(p*) = θ − ln(p* / (1 − p*))
```

取 `p* = 0.8` → `logit(0.8) = 1.386` → `b* = θ − 1.386`。

**代入**：θ = 0.44 → 目标出题难度 b ≈ **−0.95**。

> 为什么不取 p*=0.5？纯测量最优确实在 0.5（Fisher 信息 0.25 最大），
> 但一半题目做不出来的体验会直接劝退。p*=0.8 时信息量 0.16，损失 36%，换来可持续的学习节奏。
> 诊断阶段可临时把 p* 降到 0.6 加速收敛，正式教学阶段回到 0.8。

### 3.3 汤普森采样（探索）

对每个候选节点采样 `m̃_j ~ Beta(α_j, β_j)`，按 `U(j)` 中的 mastery 项用采样值而非均值，再排序取 top-1。

**代入**：
- 节点 A：Beta(8,2)，均值 0.800，sd 0.121
- 节点 B：Beta(2,1)，均值 0.667，sd 0.236

B 的不确定性是 A 的近 2 倍，采样时更容易抽到极低值 → 自动被优先探测。
**这取代了手写的"证据不足优先诊断"规则，且不会陷在局部最优。**

### 3.4 重排触发器（CUSUM）—— 防抖动的核心

```
S⁺_t = max(0, S⁺_{t-1} + (p̂_t − y_t) − k)     # 检测"比预期差" → 降难度 / 补概念
S⁻_t = max(0, S⁻_{t-1} + (y_t − p̂_t) − k)     # 检测"比预期好" → 升难度 / 跳过

k = 0.15,  h = 1.0
```

**代入**：p̂ = 0.8 但答错 → 增量 = 0.8 − 0 − 0.15 = **+0.65**；连续两题 → S = 1.30 > 1.0 **触发**。
中途答对一次 → 增量 = 0.8 − 1 − 0.15 = **−0.35**，S 回落到 0.30。

配套阻尼：
- 冷却期 `MIN_REPLAN_INTERVAL_MS = 90_000`
- 单次重排作用域 ≤ 后续 2 个场景
- 触发后 `S` 归零
- 每节课全局重排上限 3 次

### 3.5 保留旧逻辑做兜底

`getLearnerDecision()` 不删除，降级为 `policy.ts` 内部的 fallback：新策略计算失败或数据不足时回退到原阈值瀑布，保证不开天窗。

---

## 4. L3 · 执行层：三级延迟预算

| 级别 | 延迟 | 触发条件 | 改什么 | 实现位置 |
|---|---|---|---|---|
| **L1 参数级** | < 50ms | 每个事件 | 语速、停顿、是否插例子、提示强度、字幕详略 | 纯 TS 计算，直接改 `lib/action/` 的 action params |
| **L2 场景级** | 1–3s | CUSUM 触发 或 场景边界 | 下一场景讲解深度、插一道题、换表征形式（图/例/交互） | 小模型单次调用，挂在 `lib/orchestration/director-node.ts` |
| **L3 大纲级** | 10–30s 后台 | 累计 ≥2 次 L2 触发 或 章节边界 | 重排剩余大纲、增删章节 | 后台 job + prefetch，绝不阻塞播放 |

**关键约束**：L2/L3 都必须在后台预生成，**播放线程永远只消费已就绪的内容**。
用户永远不该看到"正在为你调整方案…"的转圈。

### 注入点

| 位置 | 改法 |
|---|---|
| `lib/types/generation.ts:49 UserRequirements` | 加 `learnerProfile?: PlanningProjection` 字段 |
| `lib/generation/outline-generator.ts:92-105` | `buildPrompt` 传入 profile → 走已有的 `{{userProfile}}` 占位符 |
| `lib/generation/scene-generator.ts:87` | 场景级注入 teaching projection |
| `lib/server/classroom-generation.ts:1481 generateClassroom()` | 目前完全未接画像，需补 |
| `lib/orchestration/rule-engine.ts:181 makeRoutingDecision()` | 接入新 policy 的输出 |
| `lib/orchestration/director-node.ts` `directorCondition` | 增加 `replan` 分支 |

---

## 5. 评估闭环（必须先建，再调参）

### 5.1 离线回放 harness

用真实答题日志做 **next-answer prediction**，位置：`tests/adaptive-learning/replay.eval.test.ts`。

| 指标 | 公式 | 及格线 |
|---|---|---|
| AUC | ROC 曲线下面积 | > 0.70 |
| Brier score | `(1/N)Σ(p̂ − y)²`，越小越好 | 显著低于 base-rate baseline |
| ECE | 分 10 桶的 \|平均预测 − 实际正确率\| 加权均值 | < 0.05 |

**Brier baseline 代入**：若整体正确率 0.7，无脑常数预测的 Brier = 0.7×0.3 = **0.21**。
模型必须明显低于 0.21 才算有用。

**校准比准确率更重要**：决策层用的是 `p̂` 的绝对值（目标难度反解、CUSUM 残差），
一个 AUC 高但系统性高估的模型会让 CUSUM 天天误触发。

### 5.2 在线 A/B

- 实验组：自适应策略；对照组：固定序列
- **主指标**：后测（post-test）分数
- 次指标：完课率、单位时间掌握节点数、主动提问频次
- 护栏指标：挫败率（连续 3 题错的会话占比）、平均等待时长

### 5.3 结论口径（严格遵守）

> - `mastery` / `θ` 是**模型内潜变量估计**，只能表述为"模型估计该学习者在 X 上掌握度较低"。
> - **不得**把模型内的相关性说成关于真人的经验发现——那是循环论证（模型自己生成的数，再用模型自己验证）。
> - 要主张"自适应带来了学习增益"，**必须**有前测/后测 + 对照组的实测数据，且报告时标注 empirical。
> - 任何写进论文/答辩材料的数字，都要标清是 model-based 还是 empirical。

---

## 6. 冷启动

### 学生侧

```
θ_u^(0) ~ N(μ_g, σ_g²)
```

`μ_g` = 同年级同科目群体均值（有数据时），无数据则 `μ=0, σ=1`。
这是分层先验，比现在的 Beta(1,1) 无信息先验收敛快得多。

### 题目侧

LLM 出题时同步给 1–5 星难度 → 映射到 logit：

| 星级 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| `b_i^(0)` | −1.4 | −0.7 | 0.0 | +0.7 | +1.4 |

先验权重等价于 5 次观测（即 `n_i` 初值设 5），之后 Elo 在线校准逐步覆盖。

---

## 7. 落地路线

| 期 | 内容 | 关键文件 | 验收 |
|---|---|---|---|
| **P1** | 打通证据回路 | `lib/playback/engine.ts`、`lib/action/engine.ts` 加学生侧事件出口；新增 `app/api/learning-events/route.ts`；接 `event-recorder.ts` | 一节课能采到 ≥50 条事件，画像 dashboard 有变化 |
| **P2** | 状态估计升级 | 新增 `profile/ability-engine.ts`（Elo/IRT）、`profile/graph-propagation.ts`；`answer-submitted` 事件加 `itemId` | 离线回放 AUC > 0.70，ECE < 0.05 |
| **P3** | 决策层重构 | 新增 `decision/policy.ts`（效用+汤普森）、`decision/replan-trigger.ts`（CUSUM）；接入 `rule-engine.ts:181` | 重排频次落在每节课 1–3 次，无抖动 |
| **P4** | 执行层接线 | `UserRequirements` 加字段；`outline-generator` / `scene-generator` / `director-node` 注入；三级延迟预算 | 播放无卡顿，方案调整对用户不可见地完成 |

**P1 必须先做完**。没有证据流，后面三期全是在空气上建模。

---

## 8. 风险清单

| 风险 | 缓解 |
|---|---|
| 隐式信号噪声大（走神、切窗口） | 证据质量 `inferred` 权重仅 0.4；停留时长做 clip 上限；用相对基线而非绝对值 |
| 方案抖动 | CUSUM + 冷却期 + 作用域限制 + 每课上限 3 次 |
| LLM 重生成延迟拖垮播放 | L2/L3 一律后台 prefetch，播放线程只消费就绪内容 |
| 冷启动误判 | 分层先验 + `sd > 0.20` 时禁止下"掌握/薄弱"结论，只允许 diagnostic |
| 过拟合单个学生 | `K_u` 随证据数衰减；效用函数保留探索项 |
| 权重拍脑袋 | 所有 `w1..w5`、`k`、`h`、`λ`、`p*` 集中到一个 config 常量文件，靠离线回放网格搜索确定 |
| 结论口径失守 | §5.3 三条硬规则，写进 code review checklist |

---

## 9. 参数速查表

```
# L0 证据
QUALITY_WEIGHTS      verified 1.0 / teacher-verified 1.2 / self-reported 0.6 / inferred 0.4 / unverified 0.2
DWELL_BETA_SCALE     0.5          停留超时折算的 β 上限系数
REPLAY_BETA          [0.2, 0.35, 0.5]   回放 1/2/3+ 次

# L1 状态
ELO_K0               0.6
ELO_N0               10
GRAPH_LAMBDA         0.4          图传播衰减
GRAPH_MAX_DEPTH      2
GRAPH_MAX_NODES      8
SD_UNRELIABLE        0.20         超过则禁止下结论
SD_CONFIDENT         0.12

# L2 决策
UTILITY_W            [0.40, 0.20, 0.25, 0.10, 0.05]
TARGET_P             0.80         教学阶段；诊断阶段 0.60
CUSUM_K              0.15
CUSUM_H              1.0
MIN_REPLAN_INTERVAL  90_000 ms
MAX_REPLAN_PER_CLASS 3

# 冷启动
PRIOR_THETA          N(0, 1)
PRIOR_B_BY_STAR      [-1.4, -0.7, 0.0, 0.7, 1.4]
PRIOR_ITEM_N         5
```

所有参数**必须**集中在 `lib/adaptive-learning/config.ts`，禁止散落在各处硬编码。
每个非默认值都要写行内注释说明为什么改。
