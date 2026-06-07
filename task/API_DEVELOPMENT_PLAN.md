# 天空课堂 API 开发计划

> 📌 团队编制：队长 + 队员1 + 队员2 + 队员3
> 📌 来源文档：`task/api-reference.md`
> 📌 格式约定：每个任务编号格式 `[Phase]-[序号]`，状态标记：🔴 未开始 → 🔵 进行中 → ✅ 已完成

**核心原则：每人独立负责一个模块（含开发 + 测试），无跨人依赖。总前置任务由队长完成。**

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

### `P1-003` 总前置 · 单元测试

> 为队长基础设施编写测试

- **前置任务**：`P1-001`, `P1-002`（队长自有任务，不依赖他人）
- **负责人**：队长
- **状态**：✅ 已完成
- **产出位置**：`tests/server/`, `tests/storage/`

**检验标准：**

- [x] 统一错误响应测试：各类错误返回 `{ success, data, error }` 格式
- [x] 速率限制测试：超限请求被正确拒绝
- [x] 请求日志测试：每条请求记录包含时间/路径/状态码/耗时
- [x] CORS 测试：预检请求正确响应，跨域头正确设置
- [x] Zod 验证测试：非法输入被拦截并返回清晰错误信息
- [x] 存储工厂测试：IndexedDB → localStorage → memory 降级链路
- [x] DAO 层测试：题库/错题本/知识图谱 CRUD 操作
- [x] 数据迁移测试：v0 → v1 → v2 升级正确

**产出文件：**

```
tests/
  server/
    error-response.test.ts
    rate-limiter.test.ts
    request-logger.test.ts
    cors.test.ts
    validator.test.ts
  storage/
    storage-factory.test.ts
    dao-question-bank.test.ts
    dao-mistakes.test.ts
    dao-knowledge-graph.test.ts
    migration.test.ts
```

***

## 模块 A · 解题 + 题库 (Week 3-5)

> 📌 负责人：**队员1**
> 目标：图片识别、解题讲解、批改、题库管理 + 单元测试 + Phase 3 优化

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
app/api/sky/solve/explain/
  route.ts            # 解题端点
lib/solve/
  solve-graph.ts      # LangGraph 流程定义
  solver-agent.ts     # 解题 Agent
  solver-prompts.ts   # 解题提示词
  four-part-output.ts # 四段式输出格式化
  types.ts            # 解题类型定义
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
app/api/sky/solve/grade/
  route.ts            # 批改端点
lib/solve/
  grader.ts           # 批改引擎
  error-classifier.ts # 错误类型分类
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
app/api/sky/question-bank/
  route.ts            # GET 查询 + POST 入库
lib/storage/dao/
  question-bank.ts    # 题库数据访问（复用 P1-002 产出）
```

***

### `A-005` 模块 A · 单元测试

> 为解题 + 题库 API 编写测试

- **前置任务**：`A-001` ~ `A-004`（队员1自有任务，不依赖他人）
- **负责人**：队员1
- **状态**：🔴 未开始
- **产出位置**：`tests/solve/`, `tests/recognition/`

**检验标准：**

- [ ] 图片识别测试：多格式/多尺寸图片输入，LaTeX 提取正确
- [ ] 图片校验测试：非法格式/超大文件被拒绝
- [ ] 解题流程测试：四段式输出结构完整，Agent 路由正确
- [ ] 题库缓存测试：相同题目命中缓存，未命中走 LLM
- [ ] 批改测试：正确/部分正确/完全错误场景打分正确
- [ ] 错误分类测试：calculation / concept / reasoning 分类准确
- [ ] 题库管理测试：搜索/入库/去重/分页/筛选功能正确

**产出文件：**

```
tests/
  recognition/
    image-validator.test.ts
    formula-extractor.test.ts
    recognize-api.test.ts
  solve/
    solve-graph.test.ts
    solver-agent.test.ts
    four-part-output.test.ts
    grader.test.ts
    error-classifier.test.ts
    question-bank.test.ts
```

***

### `A-006` Phase 3 · 模块 A 优化

> Phase 3 中归属队员1的优化任务

> ⚠️ 本组任务前置任务：模块 A 主功能 + 测试完成

***

#### `O-001` 多模态交互 — 语音搜题 + 手写公式识别（P0）

> 语音输入提问 + 手写板拍照识别，优化非标准排版手写体 OCR

- **前置任务**：`A-001`（图片识别 API 已稳定）
- **负责人**：队员1
- **状态**：🔴 未开始

**检验标准：**

- [ ] 搜题页面增加语音输入按钮 — `components/sky/solve/multimodal-input.tsx`
- [ ] 语音通过 Web Speech API 转文本 — `components/sky/solve/multimodal-input.tsx`
- [ ] 手写板 canvas 组件 — `components/sky/solve/handwriting-canvas.tsx`
- [ ] OCR_PROMPT 增加手写识别指令分支 — `app/api/sky/solve/recognize/route.ts`
- [ ] 手写提交后进入正常解题流程 — `components/sky/solve/solve-page.tsx`

**产出文件：**

```
components/sky/solve/
  multimodal-input.tsx  # 多模态输入（语音+手写+图片）
  handwriting-canvas.tsx # 手写板组件
app/api/sky/solve/recognize/
  route.ts              # 扩展 OCR_PROMPT 支持手写
```

***

#### `O-002` 智能追问链 — 对话式解题（P0）

> 解题结果页增加"继续追问"，保持题目上下文进行多轮对话讲解

- **前置任务**：`A-002`（解题讲解 API）
- **负责人**：队员1
- **状态**：🔴 未开始

**检验标准：**

- [ ] Store 中为每道题增加 followUpMessages 数组 — `lib/store/use-sky-classroom-store.ts`
- [ ] 解题 API 支持可选 conversationId + history 参数 — `app/api/sky/solve/explain/route.ts`
- [ ] 前端 FollowUpChat 组件嵌入 SolutionPanel — `components/sky/solve/followup-chat.tsx`
- [ ] 追问记录与原题解绑定形成对话树 — `lib/store/use-sky-classroom-store.ts`

**产出文件：**

```
lib/store/
  use-sky-classroom-store.ts  # 增加追问对话状态
app/api/sky/solve/explain/
  route.ts                     # 支持上下文追问
components/sky/solve/
  followup-chat.tsx            # 追问组件
```

***

#### `O-005` 解题进度保存（P0）

> 自动保存搜题过程到 IndexedDB，退出后可恢复

- **前置任务**：`P1-002`（数据库层）
- **负责人**：队员1
- **状态**：🔴 未开始

**检验标准：**

- [ ] Zustand persist 中间件 + Dexie 存储解题历史 — `lib/store/dexie-db.ts`
- [ ] Solve 状态机增加 sessionId 字段 — `lib/store/use-sky-classroom-store.ts`
- [ ] "历史记录"侧边栏 — `components/sky/solve/solve-history.tsx`
- [ ] 页面刷新后自动恢复最近解题会话 — `components/sky/solve/solve-page.tsx`

**产出文件：**

```
lib/store/
  dexie-db.ts              # Dexie 数据库 schema
  use-sky-classroom-store.ts # 增加解题会话持久化
components/sky/solve/
  solve-history.tsx        # 解题历史侧边栏
```

***

#### `O-017` 语义缓存层（P1）

> 相同/相似题目语义匹配缓存，减少重复 API 调用

- **前置任务**：`P1-002`（数据库层）+ `A-001`（图片识别 API）
- **负责人**：队员1
- **状态**：🔴 未开始

**检验标准：**

- [ ] 语义缓存引擎 — `lib/cache/semantic-cache.ts`
- [ ] 文本嵌入模型转换题目为向量 — `lib/cache/embedding.ts`
- [ ] 向量存入 IndexedDB — `lib/store/dexie-db.ts`
- [ ] 余弦相似度超过阈值命中缓存 — `lib/cache/semantic-cache.ts`
- [ ] 解题 API / OCR API 查询缓存 — 对应 route.ts
- [ ] 缓存数据结构：{ embedding, result, timestamp, hitCount } — `lib/cache/semantic-cache.ts`

**产出文件：**

```
lib/cache/
  semantic-cache.ts     # 语义缓存引擎
  embedding.ts          # 文本嵌入转换
lib/store/
  dexie-db.ts           # 缓存存储 schema
app/api/sky/solve/
  explain/route.ts      # 查询缓存
  recognize/route.ts    # OCR 结果缓存
```

***

## 模块 B · 幻灯片 + 形象 (Week 3-6)

> 📌 负责人：**队员2**
> 目标：幻灯片生成、虚拟形象讲解、PPTX 导出 + 单元测试 + Phase 3 优化

> ⚠️ 本模块前置任务：`P1-001` + `P1-002`（队长基础架构）

***

### `B-001` 幻灯片生成 API

> `POST /api/sky/slides/generate` — 按主题/难度生成幻灯片内容

- **前置任务**：`P1-001` + `P1-002`
- **负责人**：队员2
- **状态**：✅ 已完成

**检验标准：**

- [x] 接收 topic / difficulty / slideCount 参数 — `app/api/sky/slides/generate/route.ts`
- [x] LLM 生成幻灯片大纲 + 内容 — `lib/slides/slide-generator.ts`
- [x] 支持多种布局（title-content / quiz / image-caption）— `lib/slides/layouts.ts`
- [x] 返回结构化 slide 数组 — `lib/slides/types.ts`

**产出文件：**

```
app/api/sky/slides/generate/
  route.ts            # 生成端点
lib/slides/
  slide-generator.ts  # 幻灯片生成引擎
  layouts.ts          # 布局模板
  types.ts            # 幻灯片类型定义
```

***

### `B-002` 虚拟形象讲解 API

> `POST /api/sky/slides/avatar-speak` — 为幻灯片生成语音讲解脚本

- **前置任务**：`B-001`
- **负责人**：队员2
- **状态**：✅ 已完成

**检验标准：**

- [x] 接收 slides 数组 + avatarId — `app/api/sky/slides/avatar-speak/route.ts`
- [x] 为每张幻灯片生成讲解词 — `lib/slides/speech-script.ts`
- [x] TTS 合成（调用语音提供商）— `lib/slides/avatar-speech.ts`
- [x] 返回 audioUrl + 高亮标记 — `lib/slides/avatar-speech.ts`
- [x] 支持多种虚拟形象风格 — `lib/slides/avatar-config.ts`

**产出文件：**

```
app/api/sky/slides/avatar-speak/
  route.ts            # 讲解端点
lib/slides/
  avatar-speech.ts    # 形象讲解引擎
  speech-script.ts    # 讲解词生成（含 LaTeX→口语 转换）
```

***

### `B-003` PPTX 导出 API

> `POST /api/sky/slides/export-pptx` — 导出为 PowerPoint 文件

- **前置任务**：`B-001`
- **负责人**：队员2
- **状态**：✅ 已完成

**检验标准：**

- [x] 接收 slides + 可选 avatar 演讲备注 — `app/api/sky/slides/export-pptx/route.ts`
- [x] 生成 .pptx 文件（使用 pptxgenjs 或类似库）— `lib/slides/pptx-exporter.ts`
- [x] 支持演讲备注写入 — `lib/slides/pptx-exporter.ts`
- [x] 返回 blob URL 供下载 — `app/api/sky/slides/export-pptx/route.ts`

**产出文件：**

```
app/api/sky/slides/export-pptx/
  route.ts            # 导出端点（生成 .pptx → 返回二进制下载）
lib/slides/
  pptx-exporter.ts    # PPTX 导出引擎（封面+内容+结束页+演讲备注）
```

***

### `B-004` NPC 头像系统

> 预定义 7 个角色的统一虚拟形象设计

- **前置任务**：无（可独立开发）
- **负责人**：队员2
- **状态**：✅ 已完成

**检验标准：**

- [x] 7 个角色头像资源就绪 — `public/avatars/`（30个图片文件）
- [x] 头像配置数据 — `lib/slides/avatar-presets.ts`
- [x] 头像展示组件 — 已有 `avatar-player.tsx` + `avatar-selector.tsx`

**产出文件：**

```
public/avatars/         # 头像资源（30个 SVG/PNG）
lib/slides/
  avatar-presets.ts     # 7 个预设形象数据
  avatar-config.ts      # 7 个头像配置（含 TTS）
```

***

### `B-005` 形象列表 API

> `GET /api/sky/slides/avatars` — 获取可用虚拟形象列表

- **前置任务**：`B-004`（头像资源就绪）
- **负责人**：队员2
- **状态**：✅ 已完成

**检验标准：**

- [x] 返回预定义的虚拟形象列表 — `app/api/sky/slides/avatars/route.ts`
- [x] 每个形象包含 id / name / description / style — `lib/slides/avatar-presets.ts`
- [x] 支持扩展新形象 — `lib/slides/avatar-config.ts`（7个形象，添加新的一行即可）

**产出文件：**

```
app/api/sky/slides/avatars/
  route.ts            # 形象列表端点
lib/slides/
  avatar-presets.ts   # 预设形象数据
```

***

### `B-006` 模块 B · 单元测试

> 为幻灯片 + 形象 API 编写测试

- **前置任务**：`B-001` ~ `B-005`（队员2自有任务，不依赖他人）
- **负责人**：队员2
- **状态**：✅ 已完成
- **产出位置**：`tests/slides/`

**检验标准：**

- [x] 幻灯片生成测试：14 tests — 多主题/难度输入，输出结构完整
- [x] 布局模板测试：20 tests — title-content / quiz / image-caption 布局正确
- [x] 虚拟形象讲解测试：35 + 9 tests — 讲解词生成、TTS 调用、audioUrl 返回
- [x] PPTX 导出测试：跳过 — pptxgenjs workspace 包不兼容 vitest
- [x] 形象列表测试：5 tests — 返回数据完整，扩展性验证
- [x] NPC 头像测试：8 tests — 7 个角色头像加载正确

**产出文件：**

```
tests/slides/
  slide-generator.test.ts    (14 tests)
  layouts.test.ts            (20 tests)
  avatar-speech.test.ts      (35 tests)
  speech-script.test.ts      (9 tests)   ← 新建
  avatar-presets.test.ts     (8 tests)   ← 新建
  avatars-api.test.ts        (5 tests)   ← 新建
  sky-classroom-integration.test.ts (9 tests)
  总计: 7 files, 100 tests
```

***

### `B-007` Phase 3 · 模块 B 优化

> Phase 3 中归属队员2的优化任务

> ⚠️ 本组任务前置任务：模块 B 主功能 + 测试完成

***

#### `O-008` PPT 导出质量提升（P0）

> 多种专业 PPT 主题模板、自动排版、公式渲染、封面页信息

- **前置任务**：`B-003`（PPTX 导出 API）
- **负责人**：队员2
- **状态**：✅ 已完成

**检验标准：**

- [x] 重写 pptx-generator 引入设计 token 系统 — `lib/slides/pptx-themes.ts`
- [x] 多种 PPT 主题模板（天空蓝/极简白/学术风）— `lib/slides/pptx-themes.ts`
- [x] 公式通过 MathML/OMML 转换嵌入 — 复用 `latexToOmml`，已有
- [x] 封面页加入课程标题/日期/教师信息 — `lib/slides/pptx-exporter.ts`
- [x] 内容页加入页码/进度指示 — `lib/slides/pptx-exporter.ts`
- [x] 用户可选择主题 — `components/sky/slides/theme-picker.tsx`

**产出文件：**

```
lib/slides/
  pptx-themes.ts        # 3 套主题 token
  pptx-exporter.ts      # 重构：主题参数、页码、封面增强
app/api/sky/slides/export-pptx/
  route.ts              # 接收 theme 字段
components/sky/slides/
  theme-picker.tsx      # 主题选择器
```

***

#### `O-009` 虚拟形象创建（P0）

> 用户自定义虚拟形象：头像上传/AI 生成/预设选择

- **前置任务**：`B-004`（NPC 头像系统）
- **负责人**：队员2
- **状态**：🔴 未开始

**检验标准：**

- [ ] AvatarSelector 扩展到全局 — `components/sky/slides/avatar-selector.tsx`
- [ ] AI 生成头像功能（文生图 API）— `components/avatar-creator.tsx`
- [ ] 形象数据存入 UserProfile Store — `lib/store/user-profile.ts`
- [ ] AgentProfile 增加 avatarUrl 字段 — `lib/store/settings/agents.ts`
- [ ] 形象在课堂回放/讨论区/搜题讲解中统一展示 — 各组件适配

**产出文件：**

```
components/sky/slides/
  avatar-selector.tsx   # 扩展到全局
components/
  avatar-creator.tsx    # AI 生成头像
lib/store/
  user-profile.ts       # 用户头像字段
  settings/agents.ts    # Agent 头像
```

***

#### `O-011` 样式优化（P1）

> 统一天空蓝主题色系、设计 Token、暗色模式完善、移动端响应式

- **前置任务**：无（可独立开发）
- **负责人**：队员2
- **状态**：🔴 未开始

**检验标准：**

- [ ] 设计 Token 系统 — `lib/theme/tokens.ts`
- [ ] Tailwind CSS v4 @theme 指令定义统一色板 — `app/globals.css`
- [ ] 暗色模式审计：逐个组件检查 dark: 变体 — 各组件样式文件
- [ ] 移动端 375px 宽度可用性测试 — 各页面响应式
- [ ] 动画过渡统一（framer-motion 时长/缓动函数）— `lib/theme/animations.ts`

**产出文件：**

```
lib/theme/
  tokens.ts              # 设计 Token
  animations.ts          # 动画统一配置
app/globals.css          # 统一色板定义
（各组件样式文件全面审计修改）
```

***

#### `O-015` 幻灯片动画改进（P1）

> 内容分步出现、强调动画、过渡动画、公式逐步推导

- **前置任务**：`B-001`（幻灯片生成 API）
- **负责人**：队员2
- **状态**：🔴 未开始

**检验标准：**

- [ ] Slide 数据模型增加 animations 字段 — `lib/types/slide.ts`
- [ ] framer-motion 实现复杂动画序列 — `components/sky/slides/animation-controller.tsx`
- [ ] SlideViewer 新增动画控制器 — `components/sky/slides/slide-viewer.tsx`
- [ ] 生成幻灯片时附带动画信息 — `lib/slides/slide-generator.ts`
- [ ] 公式逐步推导动画（步骤数组逐步渲染）— `components/sky/slides/formula-step-animation.tsx`

**产出文件：**

```
lib/types/
  slide.ts               # 增加 animation 字段
lib/slides/
  slide-generator.ts     # 生成时附带动画信息
components/sky/slides/
  animation-controller.tsx   # 动画控制器
  formula-step-animation.tsx # 公式逐步动画
  slide-viewer.tsx       # 增强动画
```

***

#### `O-016` TTS 语音导入（P1）

> 更多高质量 TTS 提供商、音色选择、速度/音调调节

- **前置任务**：`B-002`（虚拟形象讲解 API）
- **负责人**：队员2
- **状态**：🔴 未开始

**检验标准：**

- [ ] TTS 提供商注册机制 — `lib/tts/providers/`
- [ ] 统一 TTS 调用接口 — `lib/tts/tts-engine.ts`
- [ ] 接入 Azure Neural TTS / ElevenLabs / Fish Audio — `lib/tts/providers/`
- [ ] 设置页面增加 TTS 配置面板 — `lib/store/settings/audio.ts`
- [ ] 语音播放速度/音调调节 — `components/sky/slides/tts-controls.tsx`

**产出文件：**

```
lib/tts/
  tts-engine.ts          # 统一 TTS 调用接口
  providers/
    azure.ts             # Azure Neural TTS
    elevenlabs.ts        # ElevenLabs
    fish-audio.ts        # Fish Audio
lib/store/settings/
  audio.ts               # TTS 配置
components/sky/slides/
  tts-controls.tsx       # TTS 控制面板
```

***

## 模块 C · 错题本 + 知识图谱 + AI 助手 (Week 3-6)

> 📌 负责人：**队员3**
> 目标：错题本管理、知识图谱可视化、AI 助手对话 + 单元测试 + Phase 3 优化

> ⚠️ 本模块前置任务：`P1-001` + `P1-002`（队长基础架构）

***

### `C-001` 错题本管理 API

> `GET/POST/PATCH/DELETE /api/sky/mistakes` — 错题本的增删改查

- **前置任务**：`P1-002`
- **负责人**：队员3
- **状态**：🔴 未开始

**检验标准：**

- [ ] 查询错题（按错误类型筛选 / 分页）— `app/api/sky/mistakes/route.ts`
- [ ] 新增错题（自动从批改结果入库）— `lib/storage/dao/mistakes.ts`
- [ ] 标记已复习（reviewed = true）— `lib/storage/dao/mistakes.ts`
- [ ] 删除错题 — `app/api/sky/mistakes/route.ts`
- [ ] 复习次数统计 — `lib/mistakes/review-tracker.ts`

**产出文件：**

```
app/api/sky/mistakes/
  route.ts            # 统一端点（GET/POST/PATCH/DELETE）
lib/storage/dao/
  mistakes.ts         # 错题本数据访问（复用 P1-002 产出）
lib/mistakes/
  mistake-types.ts    # 错题类型定义
  review-tracker.ts   # 复习追踪
```

***

### `C-002` 知识图谱 API

> `GET /api/sky/knowledge-graph` — 基于错题/题库数据构建知识图谱

- **前置任务**：`C-001`
- **负责人**：队员3
- **状态**：🔴 未开始

**检验标准：**

- [ ] 读取错题/题库数据构建图谱 — `lib/graph/builder.ts`
- [ ] 知识点掌握度计算 — `lib/graph/mastery.ts`
- [ ] 返回节点 + 边 JSON 结构 — `lib/graph/types.ts`
- [ ] 薄弱点高亮标记 — `lib/graph/highlight.ts`

**产出文件：**

```
app/api/sky/knowledge-graph/
  route.ts            # 图谱端点
lib/graph/
  builder.ts          # 图谱构建
  mastery.ts          # 掌握度计算
  highlight.ts        # 薄弱点高亮
  types.ts            # 图谱类型定义
```

***

### `C-003` AI 助手对话 API

> `POST /api/sky/assistant/chat` — 基于错题上下文的 AI 对话

- **前置任务**：`C-001` + `C-002`
- **负责人**：队员3
- **状态**：🔴 未开始

**检验标准：**

- [ ] 接收用户消息 + 可选错题上下文 — `app/api/sky/assistant/chat/route.ts`
- [ ] 注入错题/知识图谱上下文到系统提示词 — `lib/assistant/context-injector.ts`
- [ ] 流式响应支持 — `lib/assistant/stream.ts`
- [ ] 对话历史维护 — `lib/assistant/conversation.ts`

**产出文件：**

```
app/api/sky/assistant/chat/
  route.ts            # 对话端点
lib/assistant/
  context-injector.ts # 上下文注入
  stream.ts           # 流式响应
  conversation.ts     # 对话历史
  types.ts            # 助手类型定义
```

***

### `C-004` 模块 C · 单元测试

> 为错题本 + 知识图谱 + AI 助手 API 编写测试

- **前置任务**：`C-001` ~ `C-003`（队员3自有任务，不依赖他人）
- **负责人**：队员3
- **状态**：🔴 未开始
- **产出位置**：`tests/mistakes/`, `tests/graph/`, `tests/assistant/`

**检验标准：**

- [ ] 错题本 CRUD 测试：增删改查/筛选/分页/标记复习正确
- [ ] 复习追踪测试：次数统计、状态更新正确
- [ ] 知识图谱测试：图谱构建、掌握度计算、薄弱点高亮正确
- [ ] AI 助手测试：上下文注入、流式响应、对话历史维护正确
- [ ] 数据一致性测试：错题/图谱/助手间数据驱动链路正确

**产出文件：**

```
tests/
  mistakes/
    mistakes-api.test.ts
    review-tracker.test.ts
  graph/
    builder.test.ts
    mastery.test.ts
    highlight.test.ts
  assistant/
    context-injector.test.ts
    stream.test.ts
    conversation.test.ts
    assistant-api.test.ts
```

***

### `C-005` Phase 3 · 模块 C 优化

> Phase 3 中归属队员3的优化任务

> ⚠️ 本组任务前置任务：模块 C 主功能 + 测试完成

***

#### `O-003` 个性化推荐引擎 — 基于错题的薄弱点推荐（P0）

> 分析错题知识点标记薄弱领域，自动推荐练习题

- **前置任务**：`C-001`（错题本管理）+ `A-004`（题库管理）
- **负责人**：队员3
- **状态**：🔴 未开始

**检验标准：**

- [ ] MistakeBook 增加 knowledgeTags 字段 — `lib/store/use-sky-classroom-store.ts`
- [ ] `/api/sky/recommend` 端点 — `app/api/sky/recommend/route.ts`
- [ ] 读取错题标签 → 匹配题库 → 返回推荐 — `lib/recommendation/engine.ts`
- [ ] 首页增加"今日推荐练习"卡片 — `components/sky/learning/recommendation-card.tsx`
- [ ] KnowledgeGraphView 增加薄弱点热力图高亮 — `components/sky/learning/knowledge-graph-view.tsx`

**产出文件：**

```
app/api/sky/recommend/
  route.ts               # 推荐引擎 API
lib/recommendation/
  engine.ts              # 推荐逻辑
components/sky/learning/
  recommendation-card.tsx # 推荐卡片
  knowledge-graph-view.tsx # 热力图增强
```

***

#### `O-004` AI 助教记忆机制 — 连贯对话（P1）

> Agent 短期记忆（当前课堂讨论摘要）+ 长期记忆（跨课堂学习偏好）

- **前置任务**：`C-003`（AI 助手对话）
- **负责人**：队员3
- **状态**：🔴 未开始

**检验标准：**

- [ ] Agent memory 模块（滑动窗口 + 摘要压缩）— `lib/ai/agent-memory.ts`
- [ ] AgentProfile 增加 memory 字段 — `lib/store/settings/agents.ts`
- [ ] 课堂结束后提取讨论关键信息 — `lib/orchestration/session-summary.ts`
- [ ] 生成 Agent 发言时注入记忆摘要到系统提示词 — `lib/ai/agent-memory.ts`

**产出文件：**

```
lib/ai/
  agent-memory.ts        # Agent 记忆引擎
lib/store/settings/
  agents.ts              # AgentProfile 增加 memory 字段
lib/orchestration/
  session-summary.ts     # 课堂讨论摘要提取
```

***

#### `O-006` 错题复习计划 — 艾宾浩斯遗忘曲线（P1）

> 自动安排复习时间（1d/2d/4d/7d/15d/30d），推送变式题检验掌握度

- **前置任务**：`C-001`（错题本管理）
- **负责人**：队员3
- **状态**：🔴 未开始

**检验标准：**

- [ ] Mistake 增加 lastReview/nextReview/reviewCount/masteryLevel 字段 — `lib/storage/dao/mistakes.ts`
- [ ] 复习计划计算引擎 — `lib/schedule/review-scheduler.ts`
- [ ] 首页通知系统增加复习提醒 — `app/page.tsx`
- [ ] `/api/sky/review/due` 查询待复习题目 — `app/api/sky/review/due/route.ts`
- [ ] 复习结果自动更新 masteryLevel — `lib/schedule/review-scheduler.ts`

**产出文件：**

```
lib/storage/dao/
  mistakes.ts            # 错题增加复习计划字段
lib/schedule/
  review-scheduler.ts    # 复习计划计算
app/api/sky/review/due/
  route.ts               # 查询待复习题目
```

***

#### `O-010` AI 全局可用（P0）

> 全局 AI 助手悬浮按钮，快捷键唤起，选中文字即可提问

- **前置任务**：无（可独立开发）
- **负责人**：队员3
- **状态**：🔴 未开始

**检验标准：**

- [ ] 全局 AIProvider 上下文 — `lib/ai/global-ai-context.tsx`
- [ ] 全局悬浮 AI 按钮 + 对话面板 — `components/ai/global-ai-panel.tsx`
- [ ] 页面选中文字后出现"AI 解释"浮动按钮 — `components/ai/text-selection-ai.tsx`
- [ ] 快捷键注册（Ctrl+Shift+A）— `lib/store/keyboard.ts`
- [ ] app/layout.tsx 注入全局 AI 组件 — `app/layout.tsx`

**产出文件：**

```
components/ai/
  global-ai-panel.tsx     # 全局 AI 面板
  text-selection-ai.tsx   # 选中文字 AI 解释
lib/ai/
  global-ai-context.tsx   # AI 全局上下文
lib/store/
  keyboard.ts             # 快捷键
app/layout.tsx            # 注入全局 AI 组件
```

***

## Phase 4 · 队长总验收 (Week 7-8)

> 📌 负责人：**队长**
> 目标：全功能端到端测试 + 性能调优 + 文档完善

***

### `P4-001` 端到端集成测试（队长总测试）

> 覆盖所有 API 功能路径，验证全系统协同工作

- **前置任务**：`A-005`, `B-006`, `C-004`（所有模块单元测试完成）
- **状态**：🔴 未开始
- **负责人**：队长
- **产出位置**：`tests/integration/`

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
tests/integration/
  solve-flow.test.ts         # 测试 1
  question-bank-flow.test.ts # 测试 2
  slides-flow.test.ts        # 测试 3
  mistakes-flow.test.ts      # 测试 4
  assistant-flow.test.ts     # 测试 5
  provider-failover.test.ts  # 测试 6
  agent-routing.test.ts      # 测试 7
  rate-limiter.test.ts       # 测试 8
  error-format.test.ts       # 测试 9
  knowledge-consistency.test.ts # 测试 10
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
lib/monitoring/
  performance.ts      # 性能指标采集
  cache/
    response-cache.ts # 响应缓存
    slide-cache.ts    # 幻灯片缓存
    graph-cache.ts    # 图谱缓存
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
docs/
  api-reference.md    # API 参考文档（更新版）
  api-error-codes.md  # 错误码手册
  openapi/
    spec.json         # OpenAPI 规范
```

***

## Phase 5 · 大规模测试 + v4.0 规划 (Week 9-10)

> 📌 负责人：**全员**
> 目标：大规模人工 + 自动化测试，评分标注，集体讨论 v4.0 修改方向

> ⚠️ 本阶段前置任务：所有 API 功能开发完成 + 集成测试通过

***

### `P5-001` 大规模人工测试

> 每个队员对自己负责的模块进行大规模人工测试

- **前置任务**：`P4-001`（集成测试通过，系统可用）
- **状态**：🔴 未开始
- **负责人**：按模块分工分配（见下表）

**任务分配：**

| 队员 | 重点测试模块 | 测试场景 |
| ---- | ----------- | ------- |
| **队员1** | 解题 + 题库 | 图片识别（多科目/多图片质量）→ 解题讲解 → 批改 → 题库查询/入库 |
| **队员2** | 幻灯片 + NPC 形象 | PPT 生成（多主题/难度）→ 形象讲解 → PPTX 导出 → NPC 头像展示 |
| **队员3** | 错题本 + 知识图谱 + AI 助手 | 错题录入 → 知识图谱生成 → AI 助手对话（带上下文注入） |

> 每人每天对自己负责的模块测试 **10+ 个不同场景**，发现 bug 必须记录：复现步骤 + 截图 + 预期行为。

**评分维度（每项 1-5 分，1=差，5=优秀）：**

| 维度 | 说明 | 权重 |
| ---- | ---- | ---- |
| PPT 内容质量 | 生成的幻灯片内容准确性、完整性、教学逻辑 | 20% |
| PPT 排版美观 | 布局合理、配色舒适、字体清晰 | 15% |
| 教学过程评分 | 多智能体对话流畅度、讲解清晰度、互动感 | 25% |
| 个性化内容 | AI 助手回答是否贴合学生薄弱点 / 错题记录 | 20% |
| 解题准确度 | 解题步骤是否正确、知识点是否准确 | 20% |

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
tests/user-evaluation/
  evaluation-form.md      # 评分表模板（维度 + 1-5 分）
  logs/
    member1/              # 每人一个目录
      2026-05-20.md       # 每日测试记录
      2026-05-21.md
    member2/
    member3/
  issues/                 # 测试中发现的 bug 列表
    bug-001.md
    bug-002.md
```

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

***

## Phase 6 · 队长专属任务池

> 📌 说明：以下任务归属队长，按优先级独立开发

***

### `O-007` 课堂模板库（P1）

> 预置学科模板（数学/物理/化学/英语等），一键选择后微调生成

- **前置任务**：无（可独立开发）
- **负责人**：队长
- **状态**：✅ 已完成

**检验标准：**

- [x] `lib/templates/` 目录存放预设模板 JSON — `lib/templates/`
- [x] 首页输入区增加"从模板创建"按钮 — `app/page.tsx`
- [x] 模板选择器弹出组件 — `components/template-picker.tsx`
- [x] 用户自定义模板存入 localStorage — `lib/templates/user-templates.ts`
- [x] 模板可编辑，修改后作为新课程生成 — `components/template-picker.tsx`

**产出文件：**

```
lib/templates/
  types.ts              # 类型定义
  registry.ts           # 模板注册表
  builtin/
    math.ts             # 数学模板（3个）
    physics.ts          # 物理模板（2个）
    chemistry.ts        # 化学模板（2个）
    english.ts          # 英语模板（2个）
  user-templates.ts     # 用户自定义模板 CRUD
components/
  templates/
    template-picker.tsx # 模板选择器 Modal
```

***

### `O-012` 课堂场景 UI 布局重构（P1）

> 左侧讲解区 + 右侧 PPT 展示，PPT 全屏切换，讨论区消息筛选

- **前置任务**：无（可独立开发）
- **负责人**：队长
- **状态**：✅ 已完成

**检验标准：**

- [x] stage.tsx 实现新 flex/grid 布局 — PPT 面板集成 + 浮动切换按钮
- [x] CanvasArea 增加全屏模式 — `components/classroom/ppt-viewer.tsx`
- [x] ChatArea 增加消息过滤逻辑 — `components/classroom/message-filters.tsx`（已启用）
- [x] Scene Sidebar 增加缩略图网格 — 列表/网格双视图切换
- [x] classroom-complete.tsx 布局适配 — 已有 absolute inset-0 自适应 CanvasArea

**产出文件：**

```
components/
  classroom/
    ppt-viewer.tsx         # PPT 全屏查看器 + 缩略图导航
    message-filters.tsx    # 消息类型/Agent 过滤
  stage/
    scene-sidebar.tsx      # 列表/网格双视图切换
  chat/
    chat-area.tsx          # 集成消息过滤栏
  stage.tsx                # 集成 PPT 面板 + 浮动切换按钮
```

***

### `O-013` 用户登录注册系统（P0）

> 用户注册/登录、JWT 认证、云端数据同步、访客模式

- **前置任务**：`P1-002`（数据库层）
- **负责人**：队长
- **状态**：✅ 已完成

**检验标准：**

- [ ] `/api/auth/register` 端点 — `app/api/auth/register/route.ts`
- [ ] `/api/auth/login` 端点 — `app/api/auth/login/route.ts`
- [ ] `/api/auth/refresh` 端点 — `app/api/auth/refresh/route.ts`
- [ ] bcrypt 加密密码 + JWT 签发 — `lib/auth/`
- [ ] AuthProvider 全局上下文 — `components/auth/auth-provider.tsx`
- [ ] 登录/注册页面 — `app/auth/login/page.tsx` + `app/auth/register/page.tsx`
- [ ] 现有本地 Store 增加云端同步逻辑 — 各 Store 文件
- [ ] 访客模式：未登录使用基础功能，数据存本地 — `lib/store/`

**产出文件：**

```
app/api/auth/
  register/route.ts     # 注册
  login/route.ts        # 登录
  refresh/route.ts      # Token 刷新
app/auth/
  login/page.tsx        # 登录页
  register/page.tsx     # 注册页
lib/auth/
  index.ts              # 认证工具
  jwt.ts                # JWT 处理
  password.ts           # 密码加密
components/auth/
  auth-provider.tsx     # 全局认证上下文
（各 Store 增加云端同步逻辑）
```

***

### `O-014` 使用限制与付费系统（P0）

> 免费用户每日 AI 使用次数限制、超限提示、支付接入

- **前置任务**：`O-013`（用户登录注册系统）
- **负责人**：队长
- **状态**：✅ 已完成

**检验标准：**

- [ ] 用户模型增加 dailyUsage/usageLimit/planType 字段 — `lib/store/user-profile.ts`
- [ ] 每日零点重置使用计数 — `lib/usage/usage-tracker.ts`
- [ ] `/api/usage/check` 检查是否超限 — `app/api/usage/check/route.ts`
- [ ] `/api/billing/` 创建订单/查询状态 — `app/api/billing/`
- [ ] 支付回调处理（支付宝/微信 Webhook）— `app/api/billing/webhook/route.ts`
- [ ] 付费升级弹窗 + 使用次数进度条 — `components/billing/`

**产出文件：**

```
lib/usage/
  usage-tracker.ts      # 使用计数
app/api/usage/check/
  route.ts              # 检查使用次数
app/api/billing/
  create/route.ts       # 创建订单
  status/route.ts       # 查询订单状态
  webhook/route.ts      # 支付回调
components/billing/
  upgrade-dialog.tsx    # 付费升级弹窗
  usage-progress.tsx    # 使用次数进度条
```

***

### `O-018` PWA 离线支持（P2）

> 错题本/搜题历史离线浏览、离线查看已加载课堂、网络恢复后同步

- **前置任务**：`P1-002`（数据库层）
- **负责人**：队长
- **状态**：✅ 已完成

**检验标准：**

- [x] Service Worker — `public/sw.js`
- [x] 离线数据管理 — `lib/offline/`
- [x] PWA manifest 注入 — `public/manifest.json`
- [x] 静态资源缓存策略（shell + API 响应缓存）— `public/sw.js`
- [x] 网络状态检测 + 自动重试队列 — `lib/offline/sync-queue.ts`

**产出文件：**

```
public/
  sw.js                   # Service Worker (install/activate/fetch)
  manifest.json           # PWA manifest
lib/offline/
  network-status.ts       # useNetworkStatus() hook + SW registration
  sync-queue.ts           # 自动重试队列 (localStorage + retry logic)
```

***

### `O-019` 性能监控 Dashboard（P2）

> 实时展示 LLM 调用延迟/成功率/token 消耗、页面加载指标、API 调用统计

- **前置任务**：`P1-001`（API 基础架构）
- **负责人**：队长
- **状态**：✅ 已完成

**检验标准：**

- [x] 扩展 lib/monitoring/web-vitals.ts 增加 Web Vitals 采集 — `lib/monitoring/web-vitals.ts`
- [x] `/admin/performance` 管理页面 — `app/admin/performance/page.tsx`
- [x] echarts 数据可视化 — `app/admin/performance/page.tsx`
- [x] 指标数据存入 IndexedDB 定期聚合 — `lib/monitoring/web-vitals.ts`
- [x] 页面加载性能指标（FCP/LCP/CLS/TTFB）— `lib/monitoring/web-vitals.ts`

**产出文件：**

```
lib/monitoring/
  web-vitals.ts          # Web Vitals 采集 (PerformanceObserver)
app/api/admin/
  performance/route.ts   # 服务器健康检查 API
app/admin/performance/
  page.tsx               # 性能监控面板 (echarts 图表 + 指标卡片)
```

***

## 任务依赖图

```
总前置任务 · 队长 (Week 1-2)
├── P1-001 API 基础架构 ─────────────── 队长
│   └── P1-002 数据库层 + 存储抽象 ──── 队长
│       └── P1-003 总前置测试 ───────── 队长
│
    │
    ├─ 模块 A · 解题 + 题库 (队员1, Week 3-5)
    │   ├── A-001 图片识别 API
    │   │   ├── A-002 解题讲解 API
    │   │   └── A-003 批改 API
    │   ├── A-004 题库管理 API
    │   │   └── A-005 模块A测试
    │   └── A-006 Phase3优化
    │       ├── O-001 多模态交互
    │       ├── O-002 智能追问链
    │       ├── O-005 解题进度保存
    │       └── O-017 语义缓存层
    │
    ├─ 模块 B · 幻灯片 + 形象 (队员2, Week 3-6)
    │   ├── B-004 NPC 头像系统 ──┐
    │   │   └── B-005 形象列表 ←─┘
    │   ├── B-001 幻灯片生成 API ──┐
    │   │   ├── B-002 虚拟形象讲解  │
    │   │   └── B-003 PPTX 导出   │
    │   │   └── B-006 模块B测试 ←─┘
    │   └── B-007 Phase3优化
    │       ├── O-008 PPT导出质量
    │       ├── O-009 虚拟形象创建
    │       ├── O-011 样式优化
    │       ├── O-015 幻灯片动画
    │       └── O-016 TTS语音导入
    │
    └─ 模块 C · 错题本 + 图谱 + 助手 (队员3, Week 3-6)
        ├── C-001 错题本管理 API
        │   ├── C-002 知识图谱 API
        │   └── C-003 AI 助手对话
        │       └── C-004 模块C测试
        └── C-005 Phase3优化
            ├── O-003 个性化推荐
            ├── O-004 AI助教记忆
            ├── O-006 错题复习计划
            └── O-010 AI全局可用
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
    │
    ↓
Phase 6 · 队长专属任务池
├── O-007 课堂模板库
├── O-012 课堂场景 UI 布局重构
├── O-013 用户登录注册系统 ──┐
│   └── O-014 付费系统     ←┘
├── O-018 PWA 离线支持
└── O-019 性能监控 Dashboard
```

***

## 队员分工总览

| 角色      | 任务编号   | 任务名                                        | 周期         |
| --------- | ---------- | --------------------------------------------- | ------------ |
| **队长**  | P1-001     | API 基础架构（错误处理/速率限制/认证）            | Week 1-2     |
| **队长**  | P1-002     | 数据库层 + 存储抽象                             | Week 1-2     |
| **队长**  | P1-003     | 总前置 · 单元测试                               | Week 1-2     |
| **队长**  | P4-001     | 端到端集成测试（10 项全功能测试）                 | Week 7-8     |
| **队长**  | P4-002     | 性能调优（7 项指标优化）                        | Week 7-8     |
| **队长**  | P4-003     | API 文档完善                                    | Week 7-8     |
| **队长**  | P5-002     | 自动化批量测试（50+ 主题自动生成评分）            | Week 9-10    |
| **队长**  | P5-003     | 测试结果分析（报告 + 图表）                     | Week 9-10    |
| **队长**  | O-007      | 课堂模板库                                      | Phase 3      |
| **队长**  | O-012      | 课堂场景 UI 布局重构                            | Phase 3      |
| **队长**  | O-013      | 用户登录注册系统                                | Phase 3      |
| **队长**  | O-014      | 使用限制与付费系统                              | Phase 3      |
| **队长**  | O-018      | PWA 离线支持                                    | Phase 3      |
| **队长**  | O-019      | 性能监控 Dashboard                              | Phase 3      |
| **队员1** | A-001      | 图片识别 API（视觉 LLM + LaTeX）                | Week 3-5     |
| **队员1** | A-002      | 解题讲解 API（四段式输出 + Agent 路由）           | Week 3-5     |
| **队员1** | A-003      | 批改 API（错误归因 + 分步打分）                 | Week 3-5     |
| **队员1** | A-004      | 题库管理 API（搜索 + 入库）                     | Week 3-5     |
| **队员1** | A-005      | 模块A · 单元测试                                | Week 3-5     |
| **队员1** | A-006      | Phase 3 · 模块A 优化（O-001/002/005/017）       | Week 3-5     |
| **队员1** | P5-001-A   | 大规模测试 — 解题 + 题库模块                    | Week 9-10    |
| **队员2** | B-001      | 幻灯片生成 API（LLM 内容生成）                  | Week 3-6     |
| **队员2** | B-002      | 虚拟形象讲解 API（TTS + 讲解词）                | Week 3-6     |
| **队员2** | B-003      | PPTX 导出 API                                   | Week 3-6     |
| **队员2** | B-004      | NPC 头像系统（7 个角色统一设计）                | Week 3-4     |
| **队员2** | B-005      | 形象列表 API                                    | Week 3-4     |
| **队员2** | B-006      | 模块B · 单元测试                                | Week 3-6     |
| **队员2** | B-007      | Phase 3 · 模块B 优化（O-008/009/011/015/016）   | Week 3-6     |
| **队员2** | P5-001-B   | 大规模测试 — 幻灯片 + NPC 形象模块              | Week 9-10    |
| **队员3** | C-001      | 错题本管理 API（增删改查）                      | Week 3-6     |
| **队员3** | C-002      | 知识图谱 API（图谱构建 + 掌握度）               | Week 3-6     |
| **队员3** | C-003      | AI 助手对话 API（上下文注入）                   | Week 3-6     |
| **队员3** | C-004      | 模块C · 单元测试                                | Week 3-6     |
| **队员3** | C-005      | Phase 3 · 模块C 优化（O-003/004/006/010）       | Week 3-6     |
| **队员3** | P5-001-C   | 大规模测试 — 错题本 + 图谱 + 助手模块           | Week 9-10    |
| **全员**  | P5-004     | v4.0 规划会议 + 需求文档                        | Week 9-10    |

**关键设计：三个模块可同时启动（只需队长总前置任务完成），模块间无交叉依赖。每人独立负责自己的开发和测试。**

***

## API 端点总览

| 模块      | 端点                             | 方法                       | 负责人  |
| --------- | -------------------------------- | -------------------------- | ------- |
| 解题      | `/api/sky/solve/recognize`       | POST                       | 队员1   |
| 解题      | `/api/sky/solve/explain`         | POST                       | 队员1   |
| 解题      | `/api/sky/solve/grade`           | POST                       | 队员1   |
| 题库      | `/api/sky/question-bank`         | GET, POST                  | 队员1   |
| 幻灯片    | `/api/sky/slides/generate`       | POST                       | 队员2   |
| 幻灯片    | `/api/sky/slides/avatar-speak`   | POST                       | 队员2   |
| 幻灯片    | `/api/sky/slides/export-pptx`    | POST                       | 队员2   |
| 幻灯片    | `/api/sky/slides/avatars`        | GET                        | 队员2   |
| 错题本    | `/api/sky/mistakes`              | GET, POST, PATCH, DELETE   | 队员3   |
| 知识图谱  | `/api/sky/knowledge-graph`       | GET                        | 队员3   |
| AI 助手   | `/api/sky/assistant/chat`        | POST                       | 队员3   |
| 推荐      | `/api/sky/recommend`             | GET                        | 队员3   |
| 复习      | `/api/sky/review/due`            | GET                        | 队员3   |
| 认证      | `/api/auth/register`             | POST                       | 队长    |
| 认证      | `/api/auth/login`                | POST                       | 队长    |
| 认证      | `/api/auth/refresh`              | POST                       | 队长    |
| 使用限制  | `/api/usage/check`               | GET                        | 队长    |
| 付费      | `/api/billing/create`            | POST                       | 队长    |
| 付费      | `/api/billing/status`            | GET                        | 队长    |
| 付费      | `/api/billing/webhook`           | POST                       | 队长    |
| 管理      | `/admin/performance`             | GET                        | 队长    |
