# Sky Classroom AI 优化开发计划

> 📌 团队编制：队长 + 队员1 + 队员2 + 队员3
> 📌 来源文档：`docs/OPTIMIZATION-PLAN.md`（原始方案）
> 📌 格式约定：每个任务编号格式 `[Phase]-[序号]`，状态标记：🔴 未开始 → 🔵 进行中 → ✅ 已完成

**核心原则：每人独立负责一个模块（含开发 + 测试），无跨人依赖。总前置任务由队长完成。**

---

## 优化方向总览

| 模块 | 方向 | 负责人 | 周期 |
|------|------|--------|------|
| 模块 A | 题库数据导入系统 | 队员1 | Week 2-4 |
| 模块 B | 出题 Agent 增强 + 云端智囊入口 | 队员2 | Week 2-4 |
| 模块 C | 解题多 Agent 链 | 队员3 | Week 2-5 |
| 模块 D | 自适应授课系统 + 授课优化 | 队员3 | Week 5-7 |
| 模块 E | 多智能体协作框架 | 队长 | Week 5-8 |
| 模块 F | 幻灯片优化 | 队员1 | Week 5-7 |
| 模块 G | TTS 语音注入与优化 | 队员2 | Week 5-7 |
| Phase 4 | 集成测试 + 验收 | 队长 | Week 8-9 |

---

## 总前置任务 · 队长负责 (Week 1)

> 所有其他模块必须在队长完成这些任务后才能开始

***

### `P1-001` 题库数据库表 + DAO 层

> 创建 `question_bank` 专用表，实现数据访问层，为三个模块提供统一数据基础

- **前置任务**：无（整个优化的起点）
- **负责人**：队长
- **状态**：✅ 已完成

**检验标准：**

- [x] MySQL 建表 `question_bank`（含 subject/grade/difficulty/questionType/content/answer/explanation/knowledgePoints/image/options/source/tags 字段）
- [x] 索引：idx_subject, idx_difficulty, idx_grade, idx_type, FULLTEXT ft_content
- [x] DAO 层：`insertOne`, `insertBatch`, `findById`, `findByHash`, `search`, `update`, `delete`, `count`, `list` — `lib/question-bank/dao.ts`
- [x] 去重逻辑：基于 `content` 的 hash 去重 — `lib/question-bank/dao.ts`
- [x] 类型定义 — `lib/question-bank/types.ts`
- [x] 迁移脚本 — `lib/question-bank/migration.sql`

**产出文件：**

```
lib/question-bank/
  types.ts              # ImportedQuestion / ImportResult / QuestionBankFilter 类型
  dao.ts                # MySQL CRUD + 批量插入 + 去重
  migration.sql         # CREATE TABLE 语句
```

***

### `P1-002` 总前置 · 单元测试

> 为队长基础设施编写测试

- **前置任务**：`P1-001`
- **负责人**：队长
- **状态**：✅ 已完成
- **产出位置**：`tests/question-bank/`

**检验标准：**

- [x] DAO 插入/查询/更新/删除测试
- [x] 批量插入性能测试（1000 条 ≤ 5s）
- [x] 去重测试：相同 content 不重复插入
- [x] 全文搜索测试：中英文 + LaTeX 混合搜索
- [x] 筛选测试：subject/difficulty/type 组合筛选

**产出文件：**

```
tests/question-bank/
  dao.test.ts           # DAO 层完整测试
```

***

## 模块 A · 题库数据导入 (Week 2-4)

> 📌 负责人：**队员1**
> 目标：JSON/CSV/Excel/PDF 四种导入方式 + 手动录入 + 导入页面 UI + 单元测试

> ⚠️ 本模块前置任务：`P1-001` + `P1-002`（队长基础架构）

***

### `A-001` JSON/CSV 导入器

> 支持 JSON 数组和 CSV 文件批量导入题目

- **前置任务**：`P1-001` + `P1-002`
- **负责人**：队员1
- **状态**：🔴 未开始

**检验标准：**

- [ ] JSON 导入器：解析 `[{...question}]` 数组格式 — `lib/question-bank/importers/json-importer.ts`
- [ ] CSV 导入器：解析 `subject,grade,content,answer,...` 格式 — `lib/question-bank/importers/csv-importer.ts`
- [ ] 字段映射：自动识别中英文列名 — `lib/question-bank/importers/field-mapper.ts`
- [ ] 数据校验：必填字段检查 + 格式校验 — `lib/question-bank/importers/validators.ts`
- [ ] 去重检测：跳过已存在的题目 — 复用 `dao.findByHash`
- [ ] 返回 `ImportResult { total, inserted, duplicates, errors }`

**产出文件：**

```
lib/question-bank/importers/
  json-importer.ts      # JSON 导入器
  csv-importer.ts       # CSV 导入器（使用 PapaParse）
  field-mapper.ts       # 字段映射（中英文列名自动识别）
  validators.ts         # 数据校验规则
  types.ts              # ImportResult / ImportOptions 类型
```

***

### `A-002` Excel 导入器

> 支持 .xlsx 文件导入，自动识别 Sheet 和列名

- **前置任务**：`A-001`（复用 field-mapper 和 validators）
- **负责人**：队员1
- **状态**：🔴 未开始

**检验标准：**

- [ ] Excel 解析：使用 SheetJS 读取 .xlsx — `lib/question-bank/importers/xlsx-importer.ts`
- [ ] 多 Sheet 支持：每个 Sheet 视为一个学科/章节
- [ ] 列名自动识别：支持中英文列名 — 复用 `field-mapper.ts`
- [ ] 大文件处理：流式读取，内存占用 ≤ 100MB
- [ ] 返回 `ImportResult` 与 JSON/CSV 一致

**产出文件：**

```
lib/question-bank/importers/
  xlsx-importer.ts      # Excel 导入器（SheetJS）
```

***

### `A-003` PDF 解析导入器

> 上传 PDF 教材，AI 自动提取题目并结构化入库

- **前置任务**：`A-001`（复用 validators 和 types）
- **负责人**：队员1
- **状态**：🔴 未开始

**检验标准：**

- [ ] PDF 文本提取：使用已有 MinerU 解析 — 复用 `lib/pdf/mineru-parser.ts`
- [ ] AI 题目分割：LLM 识别题目边界 — `lib/question-bank/importers/pdf-question-splitter.ts`
- [ ] AI 结构化提取：从原始文本提取 subject/difficulty/knowledgePoints/answer — `lib/question-bank/importers/pdf-structure-extractor.ts`
- [ ] 置信度评分：高置信度(≥0.8)直接入库，低置信度进审核队列
- [ ] 审核队列 API：`GET /api/sky/question-bank/review` 获取待审核题目
- [ ] 批量确认 API：`POST /api/sky/question-bank/review` 确认/修改后入库

**产出文件：**

```
lib/question-bank/importers/
  pdf-importer.ts             # PDF 导入主流程
  pdf-question-splitter.ts    # AI 题目边界分割
  pdf-structure-extractor.ts  # AI 结构化提取
app/api/sky/question-bank/
  review/route.ts             # 审核队列 API (GET + POST)
```

***

### `A-004` 批量导入 API

> 统一导入端点，支持 JSON/CSV/Excel/PDF 四种格式

- **前置任务**：`A-001`, `A-002`, `A-003`
- **负责人**：队员1
- **状态**：🔴 未开始

**检验标准：**

- [ ] `POST /api/sky/question-bank/import` — 自动识别格式（json/csv/xlsx/pdf）
- [ ] 文件上传：FormData 接收，大小限制 50MB
- [ ] 批量插入：事务保证原子性，失败回滚
- [ ] 进度反馈：SSE 流式返回导入进度
- [ ] 错误报告：返回每条失败记录的原因

**产出文件：**

```
app/api/sky/question-bank/
  import/route.ts       # 统一导入端点
```

***

### `A-005` 题库管理 UI

> 题库列表页 + 导入手动录入 + 题目详情

- **前置任务**：`A-004`
- **负责人**：队员1
- **状态**：🔴 未开始

**检验标准：**

- [ ] 题库列表页：搜索 + 筛选（subject/difficulty/type）+ 分页 — `components/sky/question-bank/question-list.tsx`
- [ ] 导入页面：文件上传区 + PDF 解析区 + 手动录入表单 — `components/sky/question-bank/import-page.tsx`
- [ ] 导入预览：导入前展示数据预览 + 错误标记 — `components/sky/question-bank/import-preview.tsx`
- [ ] 手动录入表单：学科/题型/内容(LaTeX)/选项/答案/知识点 — `components/sky/question-bank/question-form.tsx`
- [ ] 题目详情：查看/编辑/删除 — `components/sky/question-bank/question-detail.tsx`
- [ ] 批量操作：删除/导出/标记已验证

**产出文件：**

```
app/sky/question-bank/
  page.tsx                    # 题库主页
  import/page.tsx             # 导入页
  [id]/page.tsx               # 题目详情页
components/sky/question-bank/
  question-list.tsx           # 题库列表
  import-page.tsx             # 导入页面
  import-preview.tsx          # 导入预览
  question-form.tsx           # 手动录入表单
  question-detail.tsx         # 题目详情
```

***

### `A-006` 模块 A · 单元测试

> 为题库导入系统编写测试

- **前置任务**：`A-001` ~ `A-005`（队员1自有任务，不依赖他人）
- **负责人**：队员1
- **状态**：🔴 未开始
- **产出位置**：`tests/question-bank/importers/`

**检验标准：**

- [ ] JSON 导入测试：正常/异常/空数组/格式错误
- [ ] CSV 导入测试：中英文列名/缺列/多列/编码问题
- [ ] Excel 导入测试：多 Sheet/大文件/空行
- [ ] PDF 导入测试：纯文本/含公式/含图片/多题目
- [ ] 去重测试：相同内容不重复插入
- [ ] 校验测试：必填字段缺失/格式错误被拦截
- [ ] 导入 API 测试：四种格式 + 错误处理

**产出文件：**

```
tests/question-bank/
  importers/
    json-importer.test.ts
    csv-importer.test.ts
    xlsx-importer.test.ts
    pdf-importer.test.ts
    validators.test.ts
  import-api.test.ts
```

***

## 模块 B · 出题 Agent 增强 (Week 2-4)

> 📌 负责人：**队员2**
> 目标：多题型支持、质量校验、流式输出、题库去重、出题页面改造 + 单元测试

> ⚠️ 本模块前置任务：`P1-001` + `P1-002`（队长基础架构）

***

### `B-001` 多题型 Prompt 模板

> 扩展出题 Agent 支持选择题/填空题/解答题/判断题

- **前置任务**：`P1-001` + `P1-002`
- **负责人**：队员2
- **状态**：🔴 未开始

**检验标准：**

- [ ] 填空题 prompt：生成带下划线的题目 + 标准答案 — `lib/agents/cloud-mind/quiz-prompts/fill.ts`
- [ ] 解答题 prompt：生成开放性题目 + 评分标准 + 参考答案 — `lib/agents/cloud-mind/quiz-prompts/solve.ts`
- [ ] 判断题 prompt：生成陈述句 + 正确/错误 + 解析 — `lib/agents/cloud-mind/quiz-prompts/judge.ts`
- [ ] 统一输出格式：所有题型返回 `QuizQuestion` 接口 — `lib/agents/cloud-mind/quiz-types.ts`
- [ ] 题型路由：根据 `questionType` 选择对应 prompt — `lib/agents/cloud-mind/quiz-router.ts`

**产出文件：**

```
lib/agents/cloud-mind/
  quiz-prompts/
    fill.ts               # 填空题 prompt
    solve.ts              # 解答题 prompt
    judge.ts              # 判断题 prompt
  quiz-types.ts           # 统一 QuizQuestion 接口
  quiz-router.ts          # 题型路由
```

***

### `B-002` 质量校验 Agent

> 出题后用另一个模型独立验证答案正确性 + 干扰项合理性

- **前置任务**：`B-001`
- **负责人**：队员2
- **状态**：🔴 未开始

**检验标准：**

- [ ] 独立解题验证：用不同于出题的模型解同一道题 — `lib/agents/cloud-mind/quiz-validator.ts`
- [ ] 答案对比：判断 AI 生成的答案是否正确
- [ ] 干扰项检查（选择题）：干扰项是否有合理性，不能太明显错误
- [ ] 难度匹配：生成的题目是否符合要求的难度
- [ ] 知识点校验：题目是否确实考查了指定知识点
- [ ] 返回 `ValidationResult { isCorrect, distractorScore, difficultyMatch, suggestions }`

**产出文件：**

```
lib/agents/cloud-mind/
  quiz-validator.ts       # 质量校验引擎
  quiz-validation-types.ts # ValidationResult 类型
```

***

### `B-003` 出题流式 API + 题库去重

> SSE 流式返回生成的题目，出题前先查题库避免重复

- **前置任务**：`B-001`, `B-002`
- **负责人**：队员2
- **状态**：🔴 未开始

**检验标准：**

- [ ] `POST /api/sky/quiz/generate-stream` — SSE 流式返回 — `app/api/sky/quiz/generate-stream/route.ts`
- [ ] 逐题生成：每生成一题立即推送，不等全部完成
- [ ] 题库去重：出题前查询 `question_bank`，已有题目直接返回，不足部分再生成
- [ ] 质量校验集成：每题生成后自动调用 validator，不合格重新生成（最多重试 2 次）
- [ ] 新题入库：生成的高质量题目自动保存到 `question_bank`
- [ ] SSE 事件类型：`question`（单题）/ `progress`（进度）/ `done`（完成）/ `error`（错误）

**产出文件：**

```
app/api/sky/quiz/
  generate-stream/route.ts  # 流式出题端点
```

***

### `B-004` 出题页面改造

> 出题 UI 支持多题型选择 + 流式展示 + 质量标记

- **前置任务**：`B-003`
- **负责人**：队员2
- **状态**：🔴 未开始

**检验标准：**

- [ ] 题型选择器：选择题/填空题/解答题/判断题（可多选）— `components/sky/quiz/quiz-config.tsx`
- [ ] 流式展示：逐题显示，带加载动画 — `components/sky/quiz/quiz-stream-viewer.tsx`
- [ ] 质量标记：每题显示校验状态（✅ 已验证 / ⚠️ 待验证）— `components/sky/quiz/quiz-quality-badge.tsx`
- [ ] 题目卡片：统一展示不同题型 — `components/sky/quiz/quiz-card.tsx`
- [ ] 批量操作：保存到题库 / 导出 / 重新生成

**产出文件：**

```
components/sky/quiz/
  quiz-config.tsx           # 出题配置面板
  quiz-stream-viewer.tsx    # 流式展示
  quiz-quality-badge.tsx    # 质量标记
  quiz-card.tsx             # 题目卡片
app/sky/quiz/
  page.tsx                  # 出题页面
```

***

### `B-005` 云端智囊入口整合

> 将智能出题功能添加到云端智囊主页入口

- **前置任务**：`B-003`
- **负责人**：队员2
- **状态**：🔴 未开始

**检验标准：**

- [ ] 云端智囊主页 TOOLS 数组增加「智能出题」入口 — `app/sky/cloud-mind/page.tsx`
- [ ] 入口配置：`{ id: 'quiz', label: '智能出题', description: '...', href: '/sky/cloud-mind/quiz', icon: FileQuestion, gradient: '...', badge: '新' }`
- [ ] 侧边导航：`app/sky/cloud-mind/layout.tsx` 增加子页面导航栏
- [ ] 快捷入口：解题完成后推荐「去出题」按钮 — `components/sky/solve/solution-panel.tsx`
- [ ] 学习页入口：学习统计页增加「薄弱点出题」入口 — `components/sky/learning/weak-points.tsx`

**产出文件：**

```
app/sky/cloud-mind/
  page.tsx                  # 增加智能出题入口卡片
  layout.tsx                # 增加子页面导航栏
components/sky/solve/
  solution-panel.tsx        # 增加「去出题」推荐按钮
components/sky/learning/
  weak-points.tsx           # 薄弱点出题入口
```

***

### `B-006` 模块 B · 单元测试

> 为出题 Agent 增强编写测试

- **前置任务**：`B-001` ~ `B-005`（队员2自有任务，不依赖他人）
- **负责人**：队员2
- **状态**：🔴 未开始
- **产出位置**：`tests/quiz/`

**检验标准：**

- [ ] 多题型测试：选择/填空/解答/判断 四种题型生成正确
- [ ] 质量校验测试：正确答案通过 / 错误答案被拦截
- [ ] 干扰项测试：干扰项合理性评分
- [ ] 流式 API 测试：SSE 事件顺序正确 / 错误处理
- [ ] 去重测试：已有题目不重复生成
- [ ] 入库测试：新题自动保存到 question_bank

**产出文件：**

```
tests/quiz/
  quiz-prompts.test.ts      # 多题型 prompt 测试
  quiz-validator.test.ts    # 质量校验测试
  quiz-stream-api.test.ts   # 流式 API 测试
  quiz-dedup.test.ts        # 去重测试
```

***

## 模块 C · 解题多 Agent 链 (Week 2-5)

> 📌 负责人：**队员3**
> 目标：题目分析、自校验、Agent 链调度、SSE 流式、解题页面改造 + 单元测试

> ⚠️ 本模块前置任务：`P1-001` + `P1-002`（队长基础架构）

***

### `C-001` 题目分析 Agent

> 识别学科、知识点、难度、题型，为后续 Agent 提供上下文

- **前置任务**：`P1-001` + `P1-002`
- **负责人**：队员3
- **状态**：🔴 未开始

**检验标准：**

- [ ] 输入：题目文本 + 可选图片 — `lib/solve/agents/analyze-agent.ts`
- [ ] 输出：`{ subject, knowledgePoints[], difficulty, questionType, confidence }`
- [ ] 学科识别：数学/物理/化学/生物/语文/英语/历史/地理/政治
- [ ] 知识点提取：2-4 个相关知识点
- [ ] 难度评估：easy/medium/hard
- [ ] 题型判断：choice/fill/solve/judge
- [ ] 使用轻量模型（DeepSeek Flash）快速响应

**产出文件：**

```
lib/solve/agents/
  analyze-agent.ts        # 题目分析 Agent
  analyze-prompts.ts      # 分析 prompt
  analyze-types.ts        # 分析结果类型
```

***

### `C-002` 自校验 Agent

> 解题后独立验证答案正确性，错误时触发修正

- **前置任务**：`C-001`
- **负责人**：队员3
- **状态**：🔴 未开始

**检验标准：**

- [ ] 输入：题目 + 原始答案 — `lib/solve/agents/verify-agent.ts`
- [ ] 输出：`{ isCorrect, confidence, suggestedAnswer?, reasoning }`
- [ ] 独立解题：用不同于解题 Agent 的模型重新解题
- [ ] 答案对比：考虑格式差异（如 `$3$` vs `3` vs `C`）
- [ ] 修正触发：`isCorrect=false` 时返回 `suggestedAnswer`
- [ ] 使用高精度模型（如 DeepSeek V4）保证校验质量

**产出文件：**

```
lib/solve/agents/
  verify-agent.ts         # 自校验 Agent
  verify-prompts.ts       # 校验 prompt
  answer-matcher.ts       # 答案格式匹配（处理 LaTeX 等差异）
```

***

### `C-003` 解题 Agent 链调度器

> 串联 analyze → solve → verify → knowledge → similar，含修正逻辑

- **前置任务**：`C-001`, `C-002`
- **负责人**：队员3
- **状态**：🔴 未开始

**检验标准：**

- [ ] 链式调度：`analyze → solve → verify → (correct?) → knowledge → similar` — `lib/solve/solve-chain.ts`
- [ ] 修正逻辑：verify 返回 `isCorrect=false` 时调用 correct agent 重新解题（最多 1 次）
- [ ] 知识点提取：复用现有 `buildKnowledgePointsPrompt`
- [ ] 类似题检索：复用现有 `findSimilarByKnowledgePoints`
- [ ] 超时控制：单步 Agent 超时 30s，总链路超时 60s
- [ ] 错误降级：单步失败不影响后续步骤（跳过 + 标记）

**产出文件：**

```
lib/solve/
  solve-chain.ts          # Agent 链调度器
  agents/
    correct-agent.ts      # 修正 Agent（解题错误时触发）
    correct-prompts.ts    # 修正 prompt
```

***

### `C-004` 解题 SSE 流式事件

> 每个 Agent 完成后立即推送事件到前端

- **前置任务**：`C-003`
- **负责人**：队员3
- **状态**：🔴 未开始

**检验标准：**

- [ ] 重构 `POST /api/sky/solve/explain-stream` 使用新链路 — `app/api/sky/solve/explain-stream/route.ts`
- [ ] SSE 事件类型扩展：
  - `analysis` — 题目分析结果
  - `phase` — 状态转换（analyzing/solving/verifying/knowledge/similar/done）
  - `step` — 解题步骤（流式）
  - `answer` — 答案
  - `verification` — 校验结果（含 isCorrect）
  - `knowledge` — 知识点
  - `similar` — 类似题
  - `done` — 完成（含 metadata）
- [ ] 流式输出：每个 Agent 的输出实时推送，不等全部完成
- [ ] 向后兼容：旧前端仍能解析新事件格式

**产出文件：**

```
app/api/sky/solve/
  explain-stream/route.ts   # 重构：使用 solve-chain
```

***

### `C-005` 解题页面改造

> 前端适配新的 Agent 链事件流

- **前置任务**：`C-004`
- **负责人**：队员3
- **状态**：🔴 未开始

**检验标准：**

- [ ] 题目分析展示：显示识别的学科/知识点/难度 — `components/sky/solve/analysis-card.tsx`
- [ ] 校验状态展示：显示校验结果（✅ 正确 / ❌ 修正后正确 / ⚠️ 不确定）— `components/sky/solve/verification-badge.tsx`
- [ ] 进度指示：显示当前 Agent 阶段 — `components/sky/solve/chain-progress.tsx`
- [ ] 流式步骤：复用现有 `SolutionPanel`，适配新事件格式
- [ ] 错误降级：某步失败时显示降级提示

**产出文件：**

```
components/sky/solve/
  analysis-card.tsx         # 题目分析卡片
  verification-badge.tsx    # 校验状态标记
  chain-progress.tsx        # Agent 链进度条
```

***

### `C-006` 模块 C · 单元测试

> 为解题多 Agent 链编写测试

- **前置任务**：`C-001` ~ `C-005`（队员3自有任务，不依赖他人）
- **负责人**：队员3
- **状态**：🔴 未开始
- **产出位置**：`tests/solve/agents/`

**检验标准：**

- [ ] 题目分析测试：多学科/多题型识别准确
- [ ] 自校验测试：正确答案通过 / 错误答案被拦截 / 格式差异处理
- [ ] Agent 链测试：正常链路 / 修正链路 / 超时降级
- [ ] 流式事件测试：事件顺序正确 / 数据完整
- [ ] 答案匹配测试：LaTeX 格式差异 / 选项格式差异

**产出文件：**

```
tests/solve/
  agents/
    analyze-agent.test.ts
    verify-agent.test.ts
    correct-agent.test.ts
    answer-matcher.test.ts
  solve-chain.test.ts
  explain-stream.test.ts
```

***

## 模块 D · 自适应授课系统 (Week 5-7)

> 📌 负责人：**队员3**
> 目标：学生画像、授课规划 Agent、动态内容生成、随堂检测、学习报告

> ⚠️ 本模块前置任务：模块 C 完成 + `P1-001`（题库数据）

***

### `D-001` 学生画像系统

> 汇总学情数据，构建学生能力模型

- **前置任务**：模块 C 完成
- **负责人**：队员3
- **状态**：🔴 未开始

**检验标准：**

- [ ] 画像数据结构：`masteryBySubject`, `masteryByKnowledge`, `weakPoints`, `strongPoints`, `errorPatterns` — `lib/student/profile-types.ts`
- [ ] 画像聚合：从 `user_stats` + `mistakes` + `question_bank` 汇总 — `lib/student/profile-builder.ts`
- [ ] 掌握度算法：基于答题正确率 + 错误类型 + 复习次数加权计算
- [ ] 画像 API：`GET /api/sky/student/profile` — `app/api/sky/student/profile/route.ts`
- [ ] 画像缓存：5 分钟缓存，避免频繁聚合

**产出文件：**

```
lib/student/
  profile-types.ts        # StudentProfile 类型
  profile-builder.ts      # 画像聚合引擎
app/api/sky/student/
  profile/route.ts        # 画像 API
```

***

### `D-002` 授课规划 Agent

> 根据学生画像规划授课内容和深度

- **前置任务**：`D-001`
- **负责人**：队员3
- **状态**：🔴 未开始

**检验标准：**

- [ ] 输入：StudentProfile + 授课主题 — `lib/teaching/lesson-planner.ts`
- [ ] 输出：`LessonPlan { sections[], estimatedDuration, focusPoints[] }`
- [ ] 内容深度调整：掌握度 < 30 → 基础概念 / 30-70 → 重点强化 / > 70 → 拓展提升
- [ ] 薄弱点优先：优先讲解 weakPoints 相关内容
- [ ] 随堂测规划：每个知识节点插入小测题目

**产出文件：**

```
lib/teaching/
  lesson-planner.ts       # 授课规划 Agent
  lesson-types.ts         # LessonPlan / LessonSection 类型
```

***

### `D-003` 动态授课内容生成

> 按知识点逐段生成授课内容，支持实时调整

- **前置任务**：`D-002`
- **负责人**：队员3
- **状态**：🔴 未开始

**检验标准：**

- [ ] 流式生成：按 Section 逐段生成 — `lib/teaching/content-generator.ts`
- [ ] 内容类型：讲解文本 / 例题 / 图表描述 / 随堂测
- [ ] LaTeX 支持：数学公式正确渲染
- [ ] 实时调整：根据随堂测结果调整后续 Section 内容
- [ ] `POST /api/sky/teaching/generate-stream` — SSE 流式返回 — `app/api/sky/teaching/generate-stream/route.ts`

**产出文件：**

```
lib/teaching/
  content-generator.ts    # 内容生成引擎
  content-types.ts        # ContentChunk 类型
app/api/sky/teaching/
  generate-stream/route.ts # 流式授课 API
```

***

### `D-004` 随堂检测系统

> 授课过程中插入小测，实时检测理解程度

- **前置任务**：`D-003`
- **负责人**：队员3
- **状态**：🔴 未开始

**检验标准：**

- [ ] 小测生成：每个知识点后自动生成 1-2 道检测题 — `lib/teaching/quiz-injector.ts`
- [ ] 答题交互：前端嵌入答题组件 — `components/sky/teaching/inline-quiz.tsx`
- [ ] 实时批改：答题后立即批改 + 解析
- [ ] 掌握度更新：答对/答错更新 StudentProfile
- [ ] 内容调整：答对率低 → 补充讲解 / 答对率高 → 加速

**产出文件：**

```
lib/teaching/
  quiz-injector.ts        # 随堂测注入器
components/sky/teaching/
  inline-quiz.tsx         # 内嵌答题组件
```

***

### `D-005` 模块 D · 单元测试

- **前置任务**：`D-001` ~ `D-004`
- **负责人**：队员3
- **状态**：🔴 未开始
- **产出位置**：`tests/teaching/`

**产出文件：**

```
tests/teaching/
  profile-builder.test.ts
  lesson-planner.test.ts
  content-generator.test.ts
  quiz-injector.test.ts
```

***

## 模块 E · 多智能体协作框架 (Week 5-8)

> 📌 负责人：**队长**
> 目标：Director Agent、Agent 通信协议、MCP 工具注册、共享上下文

> ⚠️ 本模块前置任务：模块 C 完成（解题 Agent 链稳定）

***

### `E-001` Director Agent

> 调度中心，根据任务类型路由到对应 Agent 群

- **前置任务**：模块 C 完成
- **负责人**：队长
- **状态**：🔴 未开始

**检验标准：**

- [ ] 任务分类：解题 / 出题 / 授课 / 批改 / 辅导 — `lib/orchestration/director.ts`
- [ ] Agent 注册表：每个 Agent 注册能力描述 — `lib/orchestration/agent-registry.ts`
- [ ] 路由逻辑：根据用户意图 + 上下文选择 Agent
- [ ] 链路编排：复杂任务拆解为多 Agent 协作链
- [ ] 超时/降级：Agent 不可用时自动切换备选

**产出文件：**

```
lib/orchestration/
  director.ts             # Director Agent
  agent-registry.ts       # Agent 注册表
  routing.ts              # 路由逻辑
```

***

### `E-002` Agent 通信协议 + 共享上下文

> Agent 间消息传递 + 共享学生画像/题库/知识图谱

- **前置任务**：`E-001`
- **负责人**：队长
- **状态**：🔴 未开始

**检验标准：**

- [ ] 消息类型：`request` / `response` / `broadcast` — `lib/orchestration/message-types.ts`
- [ ] 共享上下文：`SharedContext { studentProfile, currentTopic, sessionHistory, knowledgeGraph }` — `lib/orchestration/shared-context.ts`
- [ ] 上下文注入：每个 Agent 收到请求时自动注入相关上下文
- [ ] 结果收集：多 Agent 并行执行时收集结果 + 冲突解决

**产出文件：**

```
lib/orchestration/
  message-types.ts        # 消息类型定义
  shared-context.ts       # 共享上下文管理
  context-injector.ts     # 上下文注入器
```

***

### `E-003` MCP 工具注册

> 将题库/解题/出题/学情等能力注册为 MCP 工具

- **前置任务**：`E-002`
- **负责人**：队长
- **状态**：🔴 未开始

**检验标准：**

- [ ] 题库工具：`kb.search`, `kb.write`, `kb.update` — `lib/orchestration/tools/kb-tools.ts`
- [ ] 解题工具：`solve.problem`, `solve.verify`, `solve.batch` — `lib/orchestration/tools/solve-tools.ts`
- [ ] 出题工具：`quiz.generate`, `quiz.validate` — `lib/orchestration/tools/quiz-tools.ts`
- [ ] 学情工具：`profile.get`, `profile.update`, `profile.analyze` — `lib/orchestration/tools/profile-tools.ts`
- [ ] MCP Server 端点：`/api/sky/mcp` — `app/api/sky/mcp/route.ts`

**产出文件：**

```
lib/orchestration/tools/
  kb-tools.ts             # 题库 MCP 工具
  solve-tools.ts          # 解题 MCP 工具
  quiz-tools.ts           # 出题 MCP 工具
  profile-tools.ts        # 学情 MCP 工具
app/api/sky/mcp/
  route.ts                # MCP Server 端点
```

***

### `E-004` 模块 E · 单元测试

- **前置任务**：`E-001` ~ `E-003`
- **负责人**：队长
- **状态**：🔴 未开始
- **产出位置**：`tests/orchestration/`

**产出文件：**

```
tests/orchestration/
  director.test.ts
  routing.test.ts
  shared-context.test.ts
  tools/
    kb-tools.test.ts
    solve-tools.test.ts
    quiz-tools.test.ts
    profile-tools.test.ts
```

***

## 模块 F · 幻灯片优化 (Week 5-7)

> 📌 负责人：**队员1**
> 目标：主题模板增强、动画改进、LaTeX 渲染优化、PPT 导出质量提升

> ⚠️ 本模块无外部依赖，可独立启动（不需要等模块 A 完成）

***

### `F-001` 主题模板系统增强

> 扩展 PPT 主题模板，支持更多风格和自定义

- **前置任务**：无（可并行开发）
- **负责人**：队员1
- **状态**：🔴 未开始

**检验标准：**

- [ ] 主题 Token 系统：颜色/字体/间距/阴影统一管理 — `lib/slides/theme-tokens.ts`
- [ ] 新增 3 套主题：学术风/科技风/手绘风 — `lib/slides/themes/`
- [ ] 主题预览：选择主题时实时预览效果 — `components/sky/slides/theme-preview.tsx`
- [ ] 自定义主题：用户可调整主色调/字体/背景 — `components/sky/slides/theme-editor.tsx`
- [ ] 主题持久化：用户选择的主题保存到 localStorage

**产出文件：**

```
lib/slides/
  theme-tokens.ts           # 设计 Token 系统
  themes/
    academic.ts             # 学术风主题
    tech.ts                 # 科技风主题
    handdrawn.ts            # 手绘风主题
    index.ts                # 主题注册表
components/sky/slides/
  theme-preview.tsx         # 主题预览组件
  theme-editor.tsx          # 主题编辑器
```

***

### `F-002` 幻灯片动画系统

> 内容分步出现、强调动画、公式逐步推导

- **前置任务**：`F-001`
- **负责人**：队员1
- **状态**：🔴 未开始

**检验标准：**

- [ ] Slide 数据模型增加 `animations` 字段 — `lib/types/slides.ts`
- [ ] 动画类型：`fadeIn` / `slideIn` / `typewriter` / `highlight` / `formulaStep`
- [ ] 动画控制器：管理动画序列和时序 — `components/sky/slides/animation-controller.tsx`
- [ ] 公式逐步推导：LaTeX 公式按步骤逐步渲染 — `components/sky/slides/formula-animation.tsx`
- [ ] 生成时附带动画：SlideGenerator 自动为内容添加动画配置

**产出文件：**

```
lib/types/
  slides.ts                 # 增加 AnimationConfig 类型
lib/slides/
  animation-config.ts       # 动画配置生成
components/sky/slides/
  animation-controller.tsx  # 动画控制器
  formula-animation.tsx     # 公式逐步动画
```

***

### `F-003` LaTeX 渲染优化

> 幻灯片中数学公式的渲染质量和一致性提升

- **前置任务**：`F-001`
- **负责人**：队员1
- **状态**：🔴 未开始

**检验标准：**

- [ ] LaTeX 预处理：统一处理 LLM 输出的 LaTeX 变体 — `lib/slides/latex-normalizer.ts`
- [ ] 渲染引擎升级：KaTeX 版本更新 + 自定义宏支持
- [ ] 公式大小适配：根据幻灯片布局自动调整公式大小
- [ ] 错误降级：LaTeX 渲染失败时显示源码 + 警告
- [ ] 行内/块级公式统一处理

**产出文件：**

```
lib/slides/
  latex-normalizer.ts       # LaTeX 预处理
  latex-renderer.ts         # 统一渲染入口
```

***

### `F-004` PPT 导出质量提升

> 导出的 PPTX 文件质量和兼容性优化

- **前置任务**：`F-001`
- **负责人**：队员1
- **状态**：🔴 未开始

**检验标准：**

- [ ] 公式嵌入：MathML/OMML 转换嵌入 PPTX（非图片） — 复用 `lib/export/latex-to-omml.ts`
- [ ] 字体嵌入：确保 PPTX 在无字体环境下正确显示
- [ ] 布局自适应：内容过多时自动调整字号/间距
- [ ] 封面增强：课程标题/日期/教师信息/Logo
- [ ] 页码/进度指示：每页显示页码和进度条

**产出文件：**

```
lib/slides/
  pptx-quality.ts           # 导出质量优化
  font-embedder.ts          # 字体嵌入
```

***

### `F-005` 模块 F · 单元测试

- **前置任务**：`F-001` ~ `F-004`
- **负责人**：队员1
- **状态**：🔴 未开始
- **产出位置**：`tests/slides/`

**产出文件：**

```
tests/slides/
  theme-tokens.test.ts
  animation-config.test.ts
  latex-normalizer.test.ts
  pptx-quality.test.ts
```

***

## 模块 G · TTS 语音注入与优化 (Week 5-7)

> 📌 负责人：**队员2**
> 目标：TTS 提供商扩展、语音注入幻灯片、语音质量优化、语音配置 UI

> ⚠️ 本模块无外部依赖，可独立启动（不需要等模块 B 完成）

***

### `G-001` TTS 提供商扩展

> 接入更多高质量 TTS 提供商，统一调用接口

- **前置任务**：无（可并行开发）
- **负责人**：队员2
- **状态**：🔴 未开始

**检验标准：**

- [ ] 统一 TTS 接口：`lib/audio/tts-engine.ts` 封装所有提供商
- [ ] 新增提供商：Azure Neural TTS / Fish Audio / CosyVoice — `lib/audio/providers/`
- [ ] 提供商注册机制：新提供商只需实现接口即可注册
- [ ] 自动降级：主提供商失败时切换备选
- [ ] 音色列表 API：`GET /api/sky/tts/voices` — `app/api/sky/tts/voices/route.ts`

**产出文件：**

```
lib/audio/
  tts-engine.ts             # 统一 TTS 引擎
  providers/
    azure-tts.ts            # Azure Neural TTS
    fish-audio.ts           # Fish Audio
    cosyvoice.ts            # CosyVoice
    index.ts                # 提供商注册表
app/api/sky/tts/
  voices/route.ts           # 音色列表 API
```

***

### `G-002` 语音注入幻灯片

> 幻灯片自动生成讲解语音，与内容同步播放

- **前置任务**：`G-001`
- **负责人**：队员2
- **状态**：🔴 未开始

**检验标准：**

- [ ] 讲解词生成优化：基于 slide 内容自动生成自然语言讲解词 — `lib/slides/speech-script.ts`（增强）
- [ ] LaTeX → 口语转换：数学公式转为可读语音 — `lib/audio/latex-to-speech.ts`
- [ ] 语音合成：每张幻灯片的讲解词合成语音 — `lib/audio/slide-tts.ts`
- [ ] 时间轴同步：语音与幻灯片动画同步播放
- [ ] 语音缓存：相同内容不重复合成

**产出文件：**

```
lib/audio/
  latex-to-speech.ts        # LaTeX → 口语转换
  slide-tts.ts              # 幻灯片语音合成
  speech-cache.ts           # 语音缓存
lib/slides/
  speech-script.ts          # 增强：支持 LaTeX 口语化
```

***

### `G-003` 语音质量优化

> 提升 TTS 语音的自然度和表现力

- **前置任务**：`G-001`
- **负责人**：队员2
- **状态**：🔴 未开始

**检验标准：**

- [ ] 语速/音调调节：用户可调整播放速度和音调 — `components/sky/slides/tts-controls.tsx`
- [ ] SSML 支持：使用 SSML 标记控制停顿/重音/情感
- [ ] 多音色切换：同一幻灯片可切换不同音色试听
- [ ] 语音分段优化：按语义分段，避免句子中间断句
- [ ] 背景音乐：可选添加轻音乐背景

**产出文件：**

```
lib/audio/
  ssml-builder.ts           # SSML 构建器
  speech-segmenter.ts       # 语义分段器
  bgm-mixer.ts              # 背景音乐混合
components/sky/slides/
  tts-controls.tsx          # TTS 控制面板（语速/音调/音色）
```

***

### `G-004` 语音配置 UI

> 用户可为不同 Agent/角色配置不同音色

- **前置任务**：`G-001`
- **负责人**：队员2
- **状态**：🔴 未开始

**检验标准：**

- [ ] 音色选择器：按提供商/语言/性别筛选 — `components/sky/tts/voice-picker.tsx`
- [ ] 试听功能：选择音色后可试听样本文本
- [ ] Agent 音色绑定：为每个 Agent 配置专属音色 — `lib/store/settings/agents.ts`
- [ ] 全局默认音色：设置页面配置默认 TTS 音色
- [ ] 音色配置持久化：保存到用户设置

**产出文件：**

```
components/sky/tts/
  voice-picker.tsx          # 音色选择器
  voice-preview.tsx         # 试听组件
lib/store/settings/
  tts.ts                    # TTS 配置持久化
```

***

### `G-005` 模块 G · 单元测试

- **前置任务**：`G-001` ~ `G-004`
- **负责人**：队员2
- **状态**：🔴 未开始
- **产出位置**：`tests/audio/`

**产出文件：**

```
tests/audio/
  tts-engine.test.ts
  latex-to-speech.test.ts
  speech-segmenter.test.ts
  ssml-builder.test.ts
  slide-tts.test.ts
```

***

## Phase 4 · 队长总验收 (Week 8-9)

> 📌 负责人：**队长**
> 目标：全功能端到端测试 + 性能调优

***

### `P4-001` 端到端集成测试

> 覆盖所有优化功能路径，验证全系统协同工作

- **前置任务**：所有模块测试通过
- **负责人**：队长
- **状态**：🔴 未开始
- **产出位置**：`tests/integration/`

**检验标准：**

| #  | 测试路径 | 描述 | 状态 |
| -- | ------- | ---- | ---- |
| 1  | JSON 上传 → 校验 → 入库 → 查询 | 题库导入完整流程 | [ ] |
| 2  | PDF 上传 → AI 提取 → 审核 → 入库 | PDF 导入完整流程 | [ ] |
| 3  | 出题请求 → 题库去重 → 生成 → 校验 → 入库 | 出题完整流程 | [ ] |
| 4  | 解题 → 分析 → 校验 → 修正 → 知识点 | 解题链完整流程 | [ ] |
| 5  | 学生画像 → 授课规划 → 动态生成 → 随堂测 | 自适应授课完整流程 | [ ] |
| 6  | Director → 路由 → Agent 执行 → 结果汇总 | 多智能体协作流程 | [ ] |
| 7  | 主题选择 → 内容生成 → 动画 → PPT 导出 | 幻灯片完整流程 | [ ] |
| 8  | 讲解词生成 → TTS 合成 → 语音播放 → 同步 | TTS 语音注入完整流程 | [ ] |

**产出文件：**

```
tests/integration/
  import-flow.test.ts       # 测试 1, 2
  quiz-flow.test.ts         # 测试 3
  solve-chain-flow.test.ts  # 测试 4
  teaching-flow.test.ts     # 测试 5
  orchestration-flow.test.ts # 测试 6
  slides-flow.test.ts       # 测试 7
  tts-flow.test.ts          # 测试 8
```

***

### `P4-002` 性能调优

- **前置任务**：`P4-001`
- **负责人**：队长
- **状态**：🔴 未开始

**检验标准：**

- [ ] 批量导入 1000 题 ≤ 10s
- [ ] 出题首题响应 ≤ 5s（流式）
- [ ] 解题全链路 ≤ 15s（含校验）
- [ ] 授课内容首段响应 ≤ 3s
- [ ] 学生画像聚合 ≤ 2s
- [ ] Agent 路由决策 ≤ 500ms
- [ ] 幻灯片生成 10 页 ≤ 8s
- [ ] PPT 导出 ≤ 3s
- [ ] TTS 单页语音合成 ≤ 2s

***

## 任务依赖图

```
总前置任务 · 队长 (Week 1)
├── P1-001 题库数据库表 + DAO ──── 队长
│   └── P1-002 总前置测试 ──────── 队长
│
    │
    ├─ 模块 A · 题库数据导入 (队员1, Week 2-4)
    │   ├── A-001 JSON/CSV 导入器
    │   │   ├── A-002 Excel 导入器
    │   │   └── A-003 PDF 解析导入器
    │   ├── A-004 批量导入 API
    │   ├── A-005 题库管理 UI
    │   └── A-006 模块A测试
    │
    ├─ 模块 B · 出题Agent增强 + 入口 (队员2, Week 2-4)
    │   ├── B-001 多题型 Prompt
    │   │   └── B-002 质量校验 Agent
    │   ├── B-003 流式API + 去重
    │   ├── B-004 出题页面改造
    │   ├── B-005 云端智囊入口整合
    │   └── B-006 模块B测试
    │
    └─ 模块 C · 解题多Agent链 (队员3, Week 2-5)
        ├── C-001 题目分析 Agent
        │   └── C-002 自校验 Agent
        ├── C-003 Agent链调度器
        ├── C-004 SSE流式事件
        ├── C-005 解题页面改造
        └── C-006 模块C测试
    │
    │   (Week 5+)
    │
    ├─ 模块 D · 自适应授课 (队员3, Week 5-7) ← 依赖模块 C
    │   ├── D-001 学生画像系统
    │   │   └── D-002 授课规划 Agent
    │   ├── D-003 动态内容生成
    │   ├── D-004 随堂检测系统
    │   └── D-005 模块D测试
    │
    ├─ 模块 E · 多智能体协作 (队长, Week 5-8) ← 依赖模块 C
    │   ├── E-001 Director Agent
    │   │   └── E-002 通信协议 + 共享上下文
    │   ├── E-003 MCP 工具注册
    │   └── E-004 模块E测试
    │
    ├─ 模块 F · 幻灯片优化 (队员1, Week 5-7) ← 独立，无外部依赖
    │   ├── F-001 主题模板增强
    │   │   ├── F-002 动画系统
    │   │   └── F-003 LaTeX渲染优化
    │   ├── F-004 PPT导出质量
    │   └── F-005 模块F测试
    │
    └─ 模块 G · TTS语音优化 (队员2, Week 5-7) ← 独立，无外部依赖
        ├── G-001 TTS提供商扩展
        │   ├── G-002 语音注入幻灯片（软依赖 F-001 的 slide 数据模型）
        │   └── G-003 语音质量优化
        ├── G-004 语音配置UI
        └── G-005 模块G测试
    │
    ↓
Phase 4 · 队长总验收 (Week 8-9)
├── P4-001 端到端集成测试 ──────── 队长
└── P4-002 性能调优 ────────────── 队长
```

***

## 队员分工总览

| 角色      | 任务编号   | 任务名                                        | 周期         |
| --------- | ---------- | --------------------------------------------- | ------------ |
| **队长**  | P1-001     | 题库数据库表 + DAO 层                          | Week 1       |
| **队长**  | P1-002     | 总前置 · 单元测试                               | Week 1       |
| **队长**  | E-001      | Director Agent                                | Week 5-8     |
| **队长**  | E-002      | Agent 通信协议 + 共享上下文                     | Week 5-8     |
| **队长**  | E-003      | MCP 工具注册                                   | Week 5-8     |
| **队长**  | E-004      | 模块E · 单元测试                               | Week 5-8     |
| **队长**  | P4-001     | 端到端集成测试                                  | Week 8-9     |
| **队长**  | P4-002     | 性能调优                                       | Week 8-9     |
| **队员1** | A-001      | JSON/CSV 导入器                                | Week 2-4     |
| **队员1** | A-002      | Excel 导入器                                   | Week 2-4     |
| **队员1** | A-003      | PDF 解析导入器                                  | Week 2-4     |
| **队员1** | A-004      | 批量导入 API                                   | Week 2-4     |
| **队员1** | A-005      | 题库管理 UI                                    | Week 2-4     |
| **队员1** | A-006      | 模块A · 单元测试                               | Week 2-4     |
| **队员1** | F-001      | 主题模板系统增强                                | Week 5-7（独立）|
| **队员1** | F-002      | 幻灯片动画系统                                  | Week 5-7（独立）|
| **队员1** | F-003      | LaTeX 渲染优化                                  | Week 5-7（独立）|
| **队员1** | F-004      | PPT 导出质量提升                                | Week 5-7（独立）|
| **队员1** | F-005      | 模块F · 单元测试                               | Week 5-7（独立）|
| **队员2** | B-001      | 多题型 Prompt 模板                              | Week 2-4     |
| **队员2** | B-002      | 质量校验 Agent                                  | Week 2-4     |
| **队员2** | B-003      | 出题流式 API + 题库去重                         | Week 2-4     |
| **队员2** | B-004      | 出题页面改造                                    | Week 2-4     |
| **队员2** | B-005      | 云端智囊入口整合                                | Week 2-4     |
| **队员2** | B-006      | 模块B · 单元测试                               | Week 2-4     |
| **队员2** | G-001      | TTS 提供商扩展                                  | Week 5-7（独立）|
| **队员2** | G-002      | 语音注入幻灯片                                  | Week 5-7（独立）|
| **队员2** | G-003      | 语音质量优化                                    | Week 5-7（独立）|
| **队员2** | G-004      | 语音配置 UI                                     | Week 5-7（独立）|
| **队员2** | G-005      | 模块G · 单元测试                               | Week 5-7（独立）|
| **队员3** | C-001      | 题目分析 Agent                                  | Week 2-5     |
| **队员3** | C-002      | 自校验 Agent                                    | Week 2-5     |
| **队员3** | C-003      | 解题 Agent 链调度器                             | Week 2-5     |
| **队员3** | C-004      | 解题 SSE 流式事件                               | Week 2-5     |
| **队员3** | C-005      | 解题页面改造                                    | Week 2-5     |
| **队员3** | C-006      | 模块C · 单元测试                               | Week 2-5     |
| **队员3** | D-001      | 学生画像系统                                    | Week 5-7     |
| **队员3** | D-002      | 授课规划 Agent                                  | Week 5-7     |
| **队员3** | D-003      | 动态授课内容生成                                | Week 5-7     |
| **队员3** | D-004      | 随堂检测系统                                    | Week 5-7     |
| **队员3** | D-005      | 模块D · 单元测试                               | Week 5-7     |

**关键设计：**
- **Week 2-4**：模块 A/B/C 可同时启动（只需队长总前置任务完成），模块间无交叉依赖
- **Week 5-7**：模块 D/F/G 可同时启动（队员1 做幻灯片、队员2 做 TTS、队员3 做授课）
- **Week 5-8**：队长做多智能体框架，与队员并行
- **模块 F 和 G 无外部依赖**：不需要等 A/B 完成，Week 5 即可独立启动
- **唯一跨模块软依赖**：G-002（语音注入幻灯片）参考 F-001 的 slide 数据模型，但不阻塞开发
- 每人独立负责自己的开发和测试

***

## API 端点总览

| 模块      | 端点                                     | 方法         | 负责人  |
| --------- | ---------------------------------------- | ------------ | ------- |
| 题库导入  | `/api/sky/question-bank/import`          | POST         | 队员1   |
| 题库审核  | `/api/sky/question-bank/review`          | GET, POST    | 队员1   |
| 出题      | `/api/sky/quiz/generate-stream`          | POST (SSE)   | 队员2   |
| 解题      | `/api/sky/solve/explain-stream`          | POST (SSE)   | 队员3   |
| 学生画像  | `/api/sky/student/profile`               | GET          | 队员3   |
| 授课      | `/api/sky/teaching/generate-stream`      | POST (SSE)   | 队员3   |
| TTS 音色  | `/api/sky/tts/voices`                    | GET          | 队员2   |
| MCP       | `/api/sky/mcp`                           | POST         | 队长    |

***

## 成功指标

| 指标 | 当前 | 目标 |
|------|------|------|
| 题库题目数 | ~100 (缓存) | 10,000+ |
| 出题准确率 | ~70% | 90%+ |
| 解题准确率 | ~80% | 95%+ |
| 解题平均耗时 | 8-15s | 5-10s (流式) |
| 出题平均耗时 | 5-10s | 3-5s (流式) |
| 支持题型 | 选择题 | 选择/填空/解答/判断 |
| 导入方式 | 无 | JSON/CSV/Excel/PDF/手动 |
| 幻灯片主题数 | 1 套 | 4+ 套（含自定义） |
| PPT 导出公式兼容性 | 图片嵌入 | MathML/OMML 原生嵌入 |
| TTS 提供商 | 浏览器原生 | 3+ 提供商（Azure/Fish/CosyVoice） |
| 云端智囊工具数 | 3 个 | 4+ 个（含智能出题） |

***

*文档结束*
