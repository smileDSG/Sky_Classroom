# 天空课堂 API 开发计划

> 📌 团队编制：队长 + 队员1 + 队员2 + 队员3
> 📌 来源文档：`task/api-reference.md`
> 📌 格式约定：每个任务编号格式 `[Phase]-[序号]`，状态标记：🔴 未开始 → 🔵 进行中 → ✅ 已完成

**核心原则：每人独立负责一个模块，无跨人依赖。总前置任务由队长完成。**

***

## 总前置任务 · 队长负责 (Week 1-2)

> 所有其他模块必须在队长完成这些任务后才能开始

***

### `P1-001` API 基础架构

> 建立统一的 API 中间件层：错误处理、速率限制、认证框架

- **前置任务**：无（整个项目的起点）
- **负责人**：队长
- **状态**：✅ 已完成

**检验标准：**

- [x] 统一错误响应格式 `{ success, data, error }`
- [x] API 错误码常量定义（`API_ERROR_CODES`）— `lib/server/api-error-codes.ts`
- [x] 请求速率限制中间件 — `lib/server/middleware/sky-rate-limiters.ts` + 复用 `lib/api/middleware/rate-limiter.ts`
- [x] 请求日志中间件 — `lib/server/middleware/request-logger.ts`
- [x] CORS 配置 — `lib/server/middleware/cors.ts`
- [x] Zod schema 验证层 — `lib/server/middleware/validator.ts`

**产出文件：**

```
lib/server/
  api-response.ts     # apiSuccess / apiError 统一响应（已更新）
  api-error-codes.ts  # 错误码常量（新增）
  middleware/         # 中间件目录（新增）
    index.ts           # barrel exports
    request-logger.ts  # 请求日志
    validator.ts       # Zod 验证
    cors.ts            # CORS 配置
    sky-rate-limiters.ts  # 天空课堂速率限制器
```

app/api/
health/
route.ts          # 健康检查端点

```

***

### `P1-002` 数据库层 + 存储抽象

> 统一 IndexedDB / 本地存储的访问抽象，为各模块提供持久化支持

- **前置任务**：`P1-001`
- **负责人**：队长
- **状态**：✅ 已完成

**检验标准：**

- [x] 统一存储接口（支持 IndexedDB / localStorage / 内存回退）— `lib/storage/storage-types.ts` + 3 providers
- [x] 题库存储 DAO 层 — `lib/storage/dao/question-bank.ts`
- [x] 错题本存储 DAO 层 — `lib/storage/dao/mistakes.ts`
- [x] 知识图谱存储 DAO 层 — `lib/storage/dao/knowledge-graph.ts`
- [x] 数据迁移系统（版本升级）— `lib/storage/migration.ts`

**产出文件：**

```

lib/storage/
index.ts              # barrel exports（已更新）
storage-types.ts      # 存储接口定义（新增）
indexeddb-provider.ts # IndexedDB 适配器（新增）
local-storage-provider.ts # localStorage 适配器（新增）
memory-provider.ts    # 内存回退（新增）
storage-factory.ts    # 工厂函数 + 自动降级（新增）
migration.ts          # 数据迁移管理器（新增）
dao/                  # 数据访问对象（新增）
question-bank.ts    # 题库数据访问
mistakes.ts         # 错题本数据访问
knowledge-graph.ts  # 知识图谱数据访问

```

***

## 模块 A · 解题 + 题库 (Week 3-5)

> 📌 负责人：**队员1**
> 目标：图片识别、解题讲解、批改、题库管理

> ⚠️ 本模块前置任务：`P1-001` + `P1-002`（队长基础架构）

***

### `A-001` 图片识别 API

> `POST /api/sky/solve/recognize` — 视觉 LLM 识别图片中的数学题目

- **前置任务**：`P1-001` + `P1-002`
- **负责人**：队员1
- **状态**：🔴 未开始

**检验标准：**

- [ ] 接收 `FormData` 图片上传 — `app/api/sky/solve/recognize/route.ts`
- [ ] 调用视觉 LLM（GLM / Qwen / Anthropic 多提供商）— `lib/ai/providers.ts` + `lib/ai/llm.ts`
- [ ] 返回识别文本 + LaTeX 公式 — `lib/recognition/formula-extractor.ts`
- [ ] 图片格式校验（JPEG / PNG / WebP）— `lib/recognition/image-validator.ts`
- [ ] 图片大小限制（≤ 10MB）— `lib/recognition/image-validator.ts`

**产出文件：**

```

app/api/sky/solve/recognize/
route.ts            # 图片识别端点
lib/recognition/
formula-extractor.ts# LaTeX 公式提取
image-validator.ts  # 图片格式/大小校验

```

***

### `A-002` 解题讲解 API

> `POST /api/sky/solve/explain` — 四段式解题输出（答案、步骤、知识点、相似题）

- **前置任务**：`A-001`
- **负责人**：队员1
- **状态**：🔴 未开始

**检验标准：**

- [ ] LangGraph 解题流程（checkQuestionBank → routeToAgent → solveWithAgent → generateOutput）— `lib/solve/solve-graph.ts`
- [ ] 四段式 JSON 输出格式 — `lib/solve/four-part-output.ts`
- [ ] 多 Agent 路由（science / humanities / universal）— `lib/solve/solver-agent.ts`
- [ ] 题库缓存命中检测 — `lib/storage/dao/question-bank.ts`
- [ ] 解题时间统计 — `lib/solve/solve-graph.ts`

**产出文件：**

```

<br />

```

***

### `A-003` 批改 API

> `POST /api/sky/solve/grade` — 用户答案批改 + 错误归因

- **前置任务**：`A-001`
- **负责人**：队员1
- **状态**：🔴 未开始

**检验标准：**

- [ ] 接收 problem + correctAnswer + userAnswer — `app/api/sky/solve/grade/route.ts`
- [ ] LLM 判断正误 + 错误类型分类 — `lib/solve/grader.ts`
- [ ] 分步打分（partial credit）— `lib/solve/grader.ts`
- [ ] 错误原因分析（calculation / concept / reasoning）— `lib/solve/error-classifier.ts`
- [ ] 批改结果存入错题本 — `lib/storage/dao/mistakes.ts`

**产出文件：**

```

<br />

```

***

### `A-004` 题库管理 API

> `GET/POST /api/sky/question-bank` — 题库查询与入库

- **前置任务**：`P1-002`
- **负责人**：队员1
- **状态**：🔴 未开始

**检验标准：**

- [ ] 模糊搜索（问题文本相似度匹配）— `lib/storage/dao/question-bank.ts`
- [ ] 按知识点 / Agent 类型筛选 — `lib/storage/dao/question-bank.ts`
- [ ] 新题目入库（去重检测）— `app/api/sky/question-bank/route.ts`
- [ ] 已验证题目标记 — `lib/storage/dao/question-bank.ts`
- [ ] 分页 + 计数 — `lib/storage/dao/question-bank.ts`

**产出文件：**

```

<br />

```

***

## 模块 B · 幻灯片 + 形象 (Week 3-6)

> 📌 负责人：**队员2**
> 目标：幻灯片生成、虚拟形象讲解、PPTX 导出

> ⚠️ 本模块前置任务：`P1-001` + `P1-002`（队长基础架构）

***

### `B-001` 幻灯片生成 API

> `POST /api/sky/slides/generate` — 按主题/难度生成幻灯片内容

- **前置任务**：`P1-001` + `P1-002`
- **负责人**：队员2
- **状态**：🔴 未开始

**检验标准：**

- [ ] 接收 topic / difficulty / slideCount 参数 — `app/api/sky/slides/generate/route.ts`
- [ ] LLM 生成幻灯片大纲 + 内容 — `lib/slides/slide-generator.ts`
- [ ] 支持多种布局（title-content / quiz / image-caption）— `lib/slides/layouts.ts`
- [ ] 返回结构化 slide 数组 — `lib/slides/types.ts`

**产出文件：**

```

<br />

```

***

### `B-002` 虚拟形象讲解 API

> `POST /api/sky/slides/avatar-speak` — 为幻灯片生成语音讲解脚本

- **前置任务**：`B-001`
- **负责人**：队员2
- **状态**：🔴 未开始

**检验标准：**

- [ ] 接收 slides 数组 + avatarId — `app/api/sky/slides/avatar-speak/route.ts`
- [ ] 为每张幻灯片生成讲解词 — `lib/slides/speech-script.ts`
- [ ] TTS 合成（调用语音提供商）— `lib/slides/avatar-speech.ts`
- [ ] 返回 audioUrl + 高亮标记 — `lib/slides/avatar-speech.ts`
- [ ] 支持多种虚拟形象风格 — `lib/slides/avatar-config.ts`

**产出文件：**

```

<br />

```

***

### `B-003` PPTX 导出 API

> `POST /api/sky/slides/export-pptx` — 导出为 PowerPoint 文件

- **前置任务**：`B-001`
- **负责人**：队员2
- **状态**：🔴 未开始

**检验标准：**

- [ ] 接收 slides + 可选 avatar 演讲备注 — `app/api/sky/slides/export-pptx/route.ts`
- [ ] 生成 .pptx 文件（使用 pptxgenjs 或类似库）— `lib/slides/pptx-exporter.ts`
- [ ] 支持演讲备注写入 — `lib/slides/pptx-exporter.ts`
- [ ] 返回 blob URL 供下载 — `app/api/sky/slides/export-pptx/route.ts`

**产出文件：**

```

<br />

```

***

### `B-004` 形象列表 API

> `GET /api/sky/slides/avatars` — 获取可用虚拟形象列表

- **前置任务**：`B-005`（头像资源就绪）
- **负责人**：队员2
- **状态**：🔴 未开始

**检验标准：**

- [ ] 返回预定义的虚拟形象列表 — `app/api/sky/slides/avatars/route.ts`
- [ ] 每个形象包含 id / name / description / style — `lib/slides/avatar-presets.ts`
- [ ] 支持扩展新形象 — `lib/slides/avatar-config.ts`

**产出文件：**

```

<br />

```

***

## 模块 C · 错题本 + 知识图谱 + AI 助手 (Week 3-6)

> 📌 负责人：**队员3**
> 目标：错题本管理、知识图谱可视化、AI 助手对话

> ⚠️ 本模块前置任务：`P1-001` + `P1-002`（队长基础架构）

***

### `C-001` 错题本管理 API

> `GET/POST/PATCH/DELETE /api/sky/mistakes` — 错题本的增删改查

- **前置任务**：`P1-002`
- **负责人**：队员3
- **状态**：🔴 未开始

**检验标准：**

- [ ] 查询错题（按错误类型筛选 / 分页）
- [ ] 新增错题（自动从批改结果入库）
- [ ] 标记已复习（reviewed = true）
- [ ] 删除错题
- [ ] 复习次数统计

**产出文件：**

```

<br />

```

***

## Phase 4 · 集成测试 + 总验收 (Week 7-8)

> 📌 负责人：**队长**
> 目标：全功能端到端测试 + 性能调优 + 文档完善

***

### `P4-001` 端到端集成测试

> 覆盖所有 API 功能路径，验证全系统协同工作

- **前置任务**：`A-001` ~ `A-004`, `B-001` ~ `B-004`, `C-001` ~ `C-003`
- **状态**：🔴 未开始
- **负责人**：队长

**检验标准：**

| #  | 测试路径 | 描述 | 状态 |
| -- | ------- | ---- | ---- |
| 1  | 图片上传 → 识别 → 解题 → 批改 | 完整解题流程 | [ ] |
| 2  | 解题 → 入库 → 查询 | 题库缓存命中 | [ ] |
| 3  | 主题输入 → 生成幻灯片 → 形象讲解 → 导出 PPTX | 完整幻灯片流程 | [ ] |
| 4  | 批改 → 错题入库 → 查询错题 → 标记复习 | 完整错题本流程 | [ ] |
| 5  | 错题 + 知识图谱 → AI 助手对话 | 智能推荐流程 | [ ] |
| 6  | 图片识别多提供商 fallback | 主提供商失败自动切换 | [ ] |
| 7  | 解题多 Agent 路由 | science/humanities/universal | [ ] |
| 8  | 速率限制触发 | 超限请求被拒绝 | [ ] |
| 9  | 错误处理统一格式 | 各 API 错误响应一致 | [ ] |
| 10 | 知识图谱数据一致性 | 题库/错题本数据驱动图谱 | [ ] |

**产出文件：**

```

<br />

```

***

### `P4-002` 性能调优

> 根据监控数据优化各 API 端点

- **前置任务**：`P4-001`
- **状态**：🔴 未开始
- **负责人**：队长

**检验标准：**

- [ ] 图片识别响应时间 ≤ 15s
- [ ] 解题响应时间 ≤ 30s
- [ ] 幻灯片生成 ≤ 20s
- [ ] 知识图谱构建 ≤ 5s
- [ ] AI 助手首字响应 ≤ 3s（流式）
- [ ] 错题本查询 ≤ 500ms
- [ ] 内存占用优化（大数据集分页）

**产出文件：**

```

<br />

```

***

### `P4-003` API 文档完善

> 为所有 API 端点编写完整文档

- **前置任务**：`P4-002`
- **状态**：🔴 未开始
- **负责人**：队长

**检验标准：**

- [ ] 所有端点的请求/响应示例
- [ ] 错误码说明
- [ ] 认证要求
- [ ] 速率限制说明
- [ ] OpenAPI / Swagger 规范生成

**产出文件：**

```

<br />

```

***

## Phase 5 · 大规模测试 + v4.0 规划 (Week 9-10)

> 📌 负责人：**全员**
> 目标：大规模人工 + 自动化测试，评分标注，集体讨论 v4.0 修改方向

> ⚠️ 本阶段前置任务：所有 API 功能开发完成 + 集成测试通过

***

### `P5-001` 大规模人工测试

> 每个队员对自己负责的模块进行大规模人工测试，同时交叉测试其他模块

- **前置任务**：`P4-001`（集成测试通过，系统可用）
- **状态**：🔴 未开始
- **负责人**：按模块分工分配（见下表）

**任务分配：**

| 队员 | 重点测试模块 | 测试场景 |
| ---- | ----------- | ------- |
| **队员1** | 解题 + 题库 | 图片识别（多科目/多图片质量）→ 解题讲解 → 批改 → 题库查询/入库 |
| **队员2** | 幻灯片 + NPC 形象 | PPT 生成（多主题/难度）→ 形象讲解 → PPTX 导出 → NPC 头像展示 |
| **队员3** | 错题本 + 知识图谱 + AI 助手 | 错题录入 → 知识图谱生成 → AI 助手对话（带上下文注入） |
| **全员交叉** | 全功能 | 每人每天测试其他队员负责模块 3+ 次 |

**评分维度（每项 1-5 分，1=差，5=优秀）：**

| 维度 | 说明 | 权重 |
| ---- | ---- | ---- |
| PPT 内容质量 | 生成的幻灯片内容准确性、完整性、教学逻辑 | 20% |
| PPT 排版美观 | 布局合理、配色舒适、字体清晰 | 15% |
| 教学过程评分 | 多智能体对话流畅度、讲解清晰度、互动感 | 25% |
| 个性化内容 | AI 助手回答是否贴合学生薄弱点 / 错题记录 | 20% |
| 解题准确度 | 解题步骤是否正确、知识点是否准确 | 20% |

**测试要求：**

- [ ] **重点测试**：每人每天对自己负责的模块测试 **10+ 个不同场景**
- [ ] **交叉测试**：每人每天测试其他队员负责模块 **3+ 次**
- [ ] 覆盖多科目：数学、物理、化学、历史、语文等
- [ ] 覆盖多难度：小学、初中、高中、大学
- [ ] 每次使用记录：主题 + 维度评分 + 具体问题描述
- [ ] 发现 bug 必须记录：复现步骤 + 截图 + 预期行为

**各队员测试场景示例：**

**队员1（解题 + 题库）：**
- 图片识别：清晰手写体 / 模糊照片 / 印刷体 / 含公式 / 含图表
- 解题讲解：代数 / 几何 / 物理 / 化学 / 文史
- 批改：正确答案 / 部分正确 / 完全错误 / 步骤错误
- 题库：搜索 / 入库 / 分页 / 去重

**队员2（幻灯片 + NPC 形象）：**
- PPT 生成：数学定理推导 / 历史事件 / 文学赏析 / 物理实验
- 形象讲解：3 种形象 + 多科目组合
- PPTX 导出：不同布局 / 含备注 / 不含备注
- NPC 头像：各场景下头像展示是否正常 / 清晰

**队员3（错题本 + 知识图谱 + AI 助手）：**
- 错题本：添加 / 筛选 / 标记 / 删除 / 批量操作
- 知识图谱：不同科目知识点关联 / 薄弱点识别准确性
- AI 助手：带错题上下文 / 不带错题上下文 / 多轮对话

**产出文件：**

```

<br />

````

**评分表模板：**

```markdown
## 测试记录 · YYYY-MM-DD

| #  | 主题 | 科目 | 难度 | PPT内容 | PPT美观 | 教学过程 | 个性化 | 解题 | 备注 |
| -- | ---- | ---- | ---- | ------- | ------- | ------- | ------ | ---- | ---- |
| 1  | 一元一次方程 | 数学 | 初中 | 4 | 3 | 5 | 4 | 5 | 教学过程流畅 |
| 2  | ... | ... | ... | ... | ... | ... | ... | ... | ... |

**Bug 记录：**
- [ ] Bug 描述：
  - 复现步骤：
  - 截图：
  - 预期行为：
````

***

### `P5-002` 自动化批量测试

> 编写脚本对高频场景进行自动化测试 + 质量评分

- **前置任务**：`P4-001`（集成测试通过）
- **状态**：🔴 未开始
- **负责人**：队长

**检验标准：**

- [ ] 自动生成 50+ 不同主题的教学内容
- [ ] 对生成的 PPT 内容进行 LLM 自动评分（准确性、完整性）
- [ ] 对教学过程对话进行 LLM 自动评分（流畅度、教学感）
- [ ] 对解题结果进行正确性验证（已知答案对比）
- [ ] 性能基准测试：每个端点响应时间、成功率统计
- [ ] 测试数据写入 CSV 文件，便于后续分析

**产出文件：**

```
tests/automation/
  batch-generator.ts     # 批量生成教学内容
  auto-scorer.ts         # LLM 自动评分引擎
  correctness-checker.ts # 解题正确性验证
  benchmarks/
    response-time.ts     # 响应时间基准
    success-rate.ts      # 成功率统计
  output/
    scores.csv           # 自动评分结果
    benchmarks.csv       # 性能基准数据
```

***

### `P5-003` 测试结果分析

> 汇总人工 + 自动化测试数据，生成分析报告

- **前置任务**：`P5-001` + `P5-002`
- **状态**：🔴 未开始
- **负责人**：队长

**检验标准：**

- [ ] 统计每个维度的平均分（人工标注）
- [ ] 统计自动评分的平均分（自动化）
- [ ] 对比人工 vs 自动评分的一致性
- [ ] 识别得分最低的功能模块（优先级改进）
- [ ] 统计 bug 数量和分类
- [ ] 生成可视化图表（雷达图、柱状图等）

**产出文件：**

```
tests/analysis/
  report.md              # 测试分析报告
  charts/                # 可视化图表
    radar-score.png      # 五维雷达图
    bar-chart.png        # 各模块得分对比
  summary.csv            # 汇总数据
```

***

### `P5-004` v4.0 规划会议

> 全员基于测试分析报告，集体讨论第四版本的修改方向

- **前置任务**：`P5-003`（测试分析报告完成）
- **状态**：🔴 未开始
- **负责人**：全员

**会议流程：**

- [ ] 队长主持测试分析报告分享会
- [ ] 每位队员分享自己发现的最重要的 3 个问题
- [ ] 讨论 v4.0 核心目标：提升哪些维度的用户体验？
- [ ] 确定 v4.0 开发优先级（按影响最大 → 开发成本最低排序）
- [ ] 产出 v4.0 需求文档 + 任务分配

**产出文件：**

```
task/
  v4-roadmap.md          # v4.0 开发路线图
  v4-tasks.md            # v4.0 任务分解（编号/负责人/周期）
docs/
  v4-design-goals.md     # v4.0 设计目标
```

**v4.0 规划会议模板：**

```markdown
## 天空课堂 v4.0 规划会议

**日期**: YYYY-MM-DD
**参会**: 队长 + 队员1 + 队员2 + 队员3

### 测试结果摘要
- 五维平均分: PPT内容 x.x / PPT美观 x.x / 教学过程 x.x / 个性化 x.x / 解题 x.x
- 总测试数: xxx
- Bug 数量: xx

### 每人 Top 3 问题
**队员1:**
1. 问题描述 → 建议方案
2. ...
3. ...

**队员2:**
1. 问题描述 → 建议方案
2. ...
3. ...

**队员3:**
1. 问题描述 → 建议方案
2. ...
3. ...

### v4.0 开发优先级
| 优先级 | 问题 | 建议方案 | 预估工作量 | 负责人 |
| ------ | ---- | ------- | --------- | ------ |
| P0     |      |         |           |        |
| P1     |      |         |           |        |
| P2     |      |         |           |        |
```

***

## 任务依赖图

```
总前置任务 · 队长 (Week 1-2)
├── P1-001 API 基础架构 ─────────────── 队长
│   └── P1-002 数据库层 + 存储抽象 ──── 队长
│
    │
    ├─ 模块 A · 解题 + 题库 (队员1, Week 3-5)
    │   ├── A-001 图片识别 API
    │   │   ├── A-002 解题讲解 API
    │   │   └── A-003 批改 API
    │   └── A-004 题库管理 API ──────────┘
    │
    ├─ 模块 B · 幻灯片 + 形象 (队员2, Week 3-6)
    │   │
    │   ├── B-005 NPC 头像系统 ──┐
    │   │   │                   │
    │   ├── B-004 形象列表 API ←─┘ (独立)
    │   │
    │   └── B-001 幻灯片生成 API ──┐
    │       ├── B-002 虚拟形象讲解 API
    │       └── B-003 PPTX 导出 API
    │
    └─ 模块 C · 错题本 + 图谱 + 助手 (队员3, Week 3-6)
        ├── C-001 错题本管理 API
        │   ├── C-002 知识图谱 API ──┐
        │   └── C-003 AI 助手对话 ←──┘
    │
    ↓
Phase 4 · 队长总验收 (Week 7-8)
├── P4-001 端到端集成测试 ───────────── 队长
│   │
├── P4-002 性能调优 ─────────────────── 队长
│   │
└── P4-003 API 文档完善 ─────────────── 队长
    │
    ↓
Phase 5 · 大规模测试 + v4.0 规划 (Week 9-10)
├── P5-001-A 大规模测试（队员1：解题 + 题库）   队员1
├── P5-001-B 大规模测试（队员2：幻灯片 + 形象）  队员2
├── P5-001-C 大规模测试（队员3：错题本 + 图谱）  队员3
├── P5-002 自动化批量测试 ───────────── 队长
│   │
├── P5-003 测试结果分析 ─────────────── 队长
│   │
└── P5-004 v4.0 规划会议 ────────────── 全员
```

***

## 队员分工总览

| 角色      | 任务编号     | 任务名                        | 周期        |   |
| ------- | -------- | -------------------------- | --------- | - |
| **队长**  | P1-001   | API 基础架构（错误处理/速率限制/认证）     | Week 1-2  | ✅ |
| **队长**  | P1-002   | 数据库层 + 存储抽象                | Week 1-2  | ✅ |
| **队长**  | P4-001   | 端到端集成测试（10 项全功能测试）         | Week 7-8  |   |
| **队长**  | P4-002   | 性能调优（7 项指标优化）              | Week 7-8  |   |
| **队长**  | P4-003   | API 文档完善                   | Week 7-8  |   |
| **队长**  | P5-002   | 自动化批量测试（50+ 主题自动生成评分）      | Week 9-10 |   |
| **队长**  | P5-003   | 测试结果分析（报告 + 图表）            | Week 9-10 |   |
| **队员1** | P5-001-A | 大规模测试 — 解题 + 题库模块          | Week 9-10 |   |
| **队员2** | P5-001-B | 大规模测试 — 幻灯片 + NPC 形象模块     | Week 9-10 |   |
| **队员3** | P5-001-C | 大规模测试 — 错题本 + 图谱 + 助手模块    | Week 9-10 |   |
| **全员**  | P5-004   | v4.0 规划会议 + 需求文档           | Week 9-10 |   |
| **队员1** | A-001    | 图片识别 API（视觉 LLM + LaTeX）   | Week 3-5  |   |
| **队员1** | A-002    | 解题讲解 API（四段式输出 + Agent 路由） | Week 3-5  |   |
| **队员1** | A-003    | 批改 API（错误归因 + 分步打分）        | Week 3-5  |   |
| **队员1** | A-004    | 题库管理 API（搜索 + 入库）          | Week 3-5  |   |
| **队员2** | B-001    | 幻灯片生成 API（LLM 内容生成）        | Week 3-6  |   |
| **队员2** | B-002    | 虚拟形象讲解 API（TTS + 讲解词）      | Week 3-6  |   |
| **队员2** | B-003    | PPTX 导出 API                | Week 3-6  |   |
| **队员2** | B-004    | 形象列表 API（需 B-005 头像就绪）     | Week 3-4  |   |
| **队员2** | B-005    | NPC 头像系统（7 个角色统一设计）        | Week 3-4  |   |
| **队员3** | C-001    | 错题本管理 API（增删改查）            | Week 3-6  |   |
| **队员3** | C-002    | 知识图谱 API（图谱构建 + 掌握度）       | Week 3-6  |   |
| **队员3** | C-003    | AI 助手对话 API（上下文注入）         | Week 3-6  |   |

**关键设计：三个模块可同时启动（只需队长总前置任务完成），模块间无交叉依赖。**

***

## API 端点总览

| 模块    | 端点                             | 方法                       | 负责人 |
| ----- | ------------------------------ | ------------------------ | --- |
| 解题    | `/api/sky/solve/recognize`     | POST                     | 队员1 |
| 解题    | `/api/sky/solve/explain`       | POST                     | 队员1 |
| 解题    | `/api/sky/solve/grade`         | POST                     | 队员1 |
| 题库    | `/api/sky/question-bank`       | GET, POST                | 队员1 |
| 幻灯片   | `/api/sky/slides/generate`     | POST                     | 队员2 |
| 幻灯片   | `/api/sky/slides/avatar-speak` | POST                     | 队员2 |
| 幻灯片   | `/api/sky/slides/export-pptx`  | POST                     | 队员2 |
| 幻灯片   | `/api/sky/slides/avatars`      | GET                      | 队员2 |
| 错题本   | `/api/sky/mistakes`            | GET, POST, PATCH, DELETE | 队员3 |
| 知识图谱  | `/api/sky/knowledge-graph`     | GET                      | 队员3 |
| AI 助手 | `/api/sky/assistant/chat`      | POST                     | 队员3 |

