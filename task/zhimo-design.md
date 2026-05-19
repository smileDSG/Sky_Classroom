# 天空课堂（Sky Classroom）V1.0 开发方案

> 基于 OpenMAIC 架构能力，由 1 名队长统筹前置任务 + 3 名队员独立并行开发
> 日期：2026 年 5 月 17 日

---

## 一、产品定位与分工总览

### 1.1 产品定位

**天空课堂** —— AI 驱动的智能教学平台，两大核心功能 + 三个公共模块：

| 模块 | 功能 | 独立性 |
|------|------|--------|
| **模块 A** | 搜题批改（拍照/语音/文字输入 → 智能解题 → 自动批改 → 四段式输出） | 独立 |
| **模块 B** | 幻灯片讲解（输入教学主题 → AI 生成幻灯片 → 虚拟形象语音讲解 → PPT 导出） | 独立 |
| **公共模块** | 错题本 + 知识图谱 + AI 助手浮窗 + 全新 UI 外壳 | 共享 |

### 1.2 不做功能（V1.0 范围外）

- ~~会员体系~~（用户注册/付费，留到 V2.0）
- ~~多平台接入~~（小程序/App，专注 Web 端）

### 1.3 队员分工总览

| 角色 | 负责模块 | 核心任务 | 依赖队长前置项 |
|------|----------|----------|---------------|
| **队长** | 基础设施 | 类型系统、多模态识别基础、全新 UI 外壳、API 路由层、集成测试 | — |
| **队员 1** | 模块 A · 搜题批改 | 解题引擎、批改引擎、四段式输出、题库系统、模块 A 测试 | P1-001, P1-002, P5-001 |
| **队员 2** | 模块 B · 幻灯片讲解 | 幻灯片生成、虚拟形象讲解、PPT 导出、模块 B 测试 | P1-001, P5-001 |
| **队员 3** | 模块 C · 学习数据 | 错题本、知识图谱、AI 助手、学习数据页 UI、模块 C 测试 | P1-001, P2-001, P5-001 |

### 1.4 任务依赖图

```
                    ┌─────────────┐
                    │  P1-001     │  类型系统 (shared types)
                    │  P1-002     │  多模态识别基础
                    │  P2-001     │  全新 UI 外壳 (app-shell)
                    │  P5-001     │  API 路由层 (all sky routes)
                    └──┬────┬─────┘
               ┌───────┘    │    └─────────┐
               ▼            ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  队员 1   │  │  队员 2   │  │  队员 3   │
        │ 模块 A    │  │ 模块 B    │  │ 模块 C    │
        │ 搜题批改  │  │ 幻灯片讲解 │  │ 学习数据  │
        └────┬─────┘  └────┬─────┘  └────┬─────┘
             │             │             │
             ▼             ▼             ▼
        A-001~005      B-001~004      C-001~005
             │             │             │
             └──────┬──────┘             │
                    ▼                    ▼
              ┌──────────┐         ┌──────────┐
              │  队长     │         │  队长     │
              │ P6-001   │         │ P6-002   │
              │ 集成测试  │         │ 文档完善  │
              └──────────┘         └──────────┘
```

---

## 二、总前置任务 · 队长负责

> 所有队员在开发前必须等待这些任务完成。队长完成后各队员即可并行开发。

### `P1-001` 共享类型系统

> 定义搜题批改、幻灯片、错题本、知识图谱的 TypeScript 类型，确保三个模块类型安全、互不冲突。

- **前置任务**: 无
- **负责人**: 队长
- **状态**: 🟢 已完成
- **涉及文件**: `lib/solve/types.ts`, `lib/slides/types.ts`, `lib/mistakes/types.ts`

**检验标准**:
- [x] `SolveState`、`GradeResult`、`FourPartOutput`、`VotingResult` 类型定义完整
- [x] `MistakeRecord`、`MistakeCause`、`KnowledgeNode`、`KnowledgeEdge` 类型定义完整
- [x] `AvatarConfig`、`AvatarSpeech`、`CourseExportConfig` 类型定义完整
- [x] 所有类型通过 `tsc --noEmit` 无报错
- [x] barrel export 在 `lib/solve/index.ts`、`lib/mistakes/index.ts`、`lib/slides/index.ts` 中正确导出

**产出文件**:
```
lib/
├── solve/
│   ├── index.ts
│   └── types.ts            # SolveState, GradeResult, FourPartOutput, VotingResult, SolverAgentType, MistakeCause, QuestionBankEntry
├── slides/
│   ├── index.ts
│   └── types.ts            # AvatarConfig, AvatarSpeech, CourseExportConfig
└── mistakes/
    ├── index.ts
    └── types.ts            # MistakeRecord, KnowledgeNode, KnowledgeEdge
```

### `P1-002` 多模态识别基础

> 图片题目识别、图片预处理、多题分割的基础能力，为队员 1 的搜题批改提供输入层。

- **前置任务**: `P1-001`
- **负责人**: 队长
- **状态**: 🟢 已完成
- **涉及文件**: `lib/recognition/image-recognizer.ts`, `lib/recognition/image-preprocessor.ts`, `lib/recognition/multi-problem-splitter.ts`, `lib/recognition/formula-extractor.ts`

**检验标准**:
- [x] `recognizeImage(imageBlob)` 返回 `{ text, latex, problemCount, problems[] }`
- [x] 清晰照片文字识别准确率 > 85%（vision LLM + Tesseract.js fallback）
- [x] 图片预处理：裁剪、去阴影、亮度增强
- [x] 多题分割：一张图含多题时自动分割为独立子图
- [x] LaTeX 公式提取正确（数学题场景）

**产出文件**:
```
lib/
└── recognition/
    ├── index.ts
    ├── image-recognizer.ts     # 核心识别：调用大模型视觉 API / Tesseract.js
    ├── image-preprocessor.ts   # Canvas 图像预处理
    ├── multi-problem-splitter.ts # 轮廓检测 → 多题分割
    └── formula-extractor.ts    # LaTeX 公式提取
```

### `P2-001` 全新 UI 外壳

> 天空课堂品牌风格的应用外壳（天空蓝+云朵白），包含侧边导航栏、顶部工具栏，为队员 3 的页面开发提供布局基础。

- **前置任务**: `P1-001`
- **负责人**: 队长
- **状态**: 🟢 已完成
- **涉及文件**: `components/sky/layout/app-shell.tsx`, `components/sky/layout/sidebar-nav.tsx`, `components/sky/layout/top-bar.tsx`

**检验标准**:
- [x] 天空蓝 `#4A90D9` + 云朵白 `#F8FAFC` 主题色
- [x] 左侧固定导航栏包含：首页、搜题、幻灯片、学习数据、AI 助手、设置
- [x] 顶部工具栏包含：Logo、主题切换、用户头像
- [x] 路由切换正常（`app/sky/page.tsx` 及各子路由骨架页）
- [x] 响应式布局（移动端侧边栏折叠）

**产出文件**:
```
components/sky/
└── layout/
    ├── app-shell.tsx           # 应用外壳，包裹所有 sky/* 页面
    ├── sidebar-nav.tsx         # 左侧导航栏（天空主题图标）
    └── top-bar.tsx             # 顶部工具栏
app/
└── sky/
    ├── page.tsx                # 首页仪表盘（骨架）
    ├── solve/page.tsx          # 搜题页（骨架）
    ├── slides/page.tsx         # 幻灯片页（骨架）
    ├── learning/page.tsx       # 学习数据页（骨架）
    └── assistant/page.tsx      # AI 助手页（骨架）
```

### `P5-001` API 路由层

> 所有天空课堂 API 路由的骨架（返回占位响应），确保队员调用 API 时接口已存在。

- **前置任务**: `P1-001`
- **负责人**: 队长
- **状态**: 🟢 已完成
- **涉及文件**: `app/api/sky/**/route.ts`（全部 8 个路由）

**检验标准**:
- [x] `/api/sky/solve/recognize` POST — 接收 FormData，返回占位识别结果
- [x] `/api/sky/solve/grade` POST — 接收题目+答案，返回占位批改结果
- [x] `/api/sky/solve/explain` POST — 接收题目，返回占位四段式输出
- [x] `/api/sky/question-bank` GET/POST — 占位题库查询/入库
- [x] `/api/sky/slides/generate` POST — 占位幻灯片生成
- [x] `/api/sky/slides/avatar-speak` POST — 占位讲解音频生成
- [x] `/api/sky/slides/export-pptx` POST — 占位 PPTX 导出
- [x] `/api/sky/mistakes` GET/POST/PATCH/DELETE — 占位错题 CRUD
- [x] `/api/sky/knowledge-graph` GET — 占位图谱返回
- [x] `/api/sky/assistant` POST — 占位助手对话
- [x] 所有路由通过 `curl` 测试返回 200 + 合法 JSON

**产出文件**:
```
app/
└── api/
    └── sky/
        ├── solve/
        │   ├── recognize/route.ts
        │   ├── grade/route.ts
        │   └── explain/route.ts
        ├── question-bank/route.ts
        ├── slides/
        │   ├── generate/route.ts
        │   ├── avatar-speak/route.ts
        │   └── export-pptx/route.ts
        ├── mistakes/route.ts
        ├── knowledge-graph/route.ts
        └── assistant/route.ts
```

---

## 三、模块 A · 搜题批改（队员 1 独立开发）

> 与模块 B/C 无代码依赖，仅依赖队长的类型系统和识别基础。

### `A-001` 解题引擎（LangGraph 编排图）

> 基于 LangGraph StateGraph 构建解题编排流程：题库查重 → 路由到 Agent → 解题 → 批改。

- **前置任务**: `P1-001`, `P1-002`
- **负责人**: 队员 1
- **状态**: 🟢 已完成
- **涉及文件**: `lib/solve/solve-graph.ts`, `lib/solve/solver-agent.ts`

**检验标准**:
- [x] `createSolveGraph()` 创建完整的 StateGraph
- [x] 节点：`checkQuestionBank` → `routeToAgent` → `solveWithAgent` → `gradeAnswer` → `generateOutput`
- [x] 支持三种 Agent 路由：`universal` (DeepSeek-V3)、`science` (GLM-4-Plus)、`humanities` (Qwen-Max)
- [x] 题库命中直接返回
- [x] 新题正常解题
- [x] 解题失败时有 failover 降级（error 条件边 → generateOutput）

**产出文件**:
```
lib/
└── solve/
    ├── solve-graph.ts          # LangGraph StateGraph 定义
    └── solver-agent.ts         # 解题 Agent 节点实现（调用 lib/ai/providers.ts）
```

### `A-002` 批改引擎

> 对比用户答案与标准答案，判断对错、分析错因、分步给分。

- **前置任务**: `P1-001`
- **负责人**: 队员 1
- **状态**: 🟢 已完成
- **涉及文件**: `lib/solve/grader.ts`

**检验标准**:
- [x] `gradeAnswer(problem, correctAnswer, userAnswer)` 返回 `GradeResult`
- [x] 对错判断准确率 > 90%（LLM 批改 + rule-based fallback）
- [x] 支持分步批改（大题按步骤给分）
- [x] 错因自动分类：`concept-unclear` / `calculation-error` / `misreading` / `method-wrong` / `careless` / `format-error`
- [x] `partialCredit` 数组包含每步得分和评语

**产出文件**:
```
lib/
└── solve/
    └── grader.ts               # 批改引擎：对错判断 + 错因分析 + 分步给分
```

### `A-003` 四段式输出生成器

> 将解题结果格式化为四段式结构：答案 → 步骤 → 知识点 → 同类练习。

- **前置任务**: `P1-001`
- **负责人**: 队员 1
- **状态**: 🟢 已完成
- **涉及文件**: `lib/solve/four-part-output.ts`

**检验标准**:
- [x] `generateFourPartOutput(solution)` 返回 `FourPartOutput`
- [x] `answer` 字段为最终答案（加粗高亮）
- [x] `steps` 数组包含步骤标签、内容、关键点标记
- [x] `knowledgePoints` 数组包含知识点名称、描述、难度
- [x] `similarQuestions` 数组包含 2-3 道同类练习题
- [x] 批改模式下输出 `GradedFourPartOutput`（含 `gradeResult` + `mistakeAnalysis` + `recommendedPractice`）

**产出文件**:
```
lib/
└── solve/
    └── four-part-output.ts     # 四段式结构化输出
```

### `A-004` 题库系统（Self-Improvement）

> 解题时先查题库，相同/相似题目直接返回；新题解题后自动入库。

- **前置任务**: `P1-001`
- **负责人**: 队员 1
- **状态**: 🟢 已完成
- **涉及文件**: `lib/solve/question-bank.ts`

**检验标准**:
- [x] `findSimilarQuestions(problemText, threshold)` 返回语义相似度 > 0.85 的题库条目（Jaccard bigram 算法）
- [x] `saveToQuestionBank(entry)` 自动去重（problemHash）
- [x] 使用 IndexedDB 本地存储（Dexie v11 迁移）
- [x] 题库条目包含：`id`, `problemHash`, `problemText`, `answer`, `steps`, `knowledgePoints`, `agentId`, `verified`
- [x] 相似题匹配使用 Jaccard bigram（预留 Supabase pgvector 接口）

**产出文件**:
```
lib/
└── solve/
    └── question-bank.ts        # 题库 CRUD + 语义相似度匹配
```

### `A-005` 模块 A 测试

> 搜题批改全流程单元测试 + 集成测试。

- **前置任务**: `A-001`, `A-002`, `A-003`, `A-004`
- **负责人**: 队员 1
- **状态**: 🟢 已完成
- **涉及文件**: `tests/solve/*.test.ts`, `tests/recognition/*.test.ts`

**检验标准**:
- [x] 解题引擎单元测试（solve-graph.test.ts, solver-agent.test.ts 等）
- [x] 批改引擎单元测试（grader.test.ts, 14 tests）
- [x] 四段式输出格式验证测试（four-part-output.test.ts, 17 tests）
- [x] 题库 CRUD 测试（question-bank.test.ts, 22 tests）
- [x] 集成测试：solve-flow.integration.test.ts 全链路
- [x] `pnpm test` 全部通过（91 tests, 8 files in solve module）

**产出文件**:
```
tests/
├── solve/
│   ├── solve-graph.test.ts
│   ├── grader.test.ts
│   ├── four-part-output.test.ts
│   └── question-bank.test.ts
└── recognition/
    ├── image-recognizer.test.ts
    └── multi-problem-splitter.test.ts
```

### `A-006` 搜题批改页 UI

> 作业帮风格的搜题主页：左侧多模态输入 + 右侧结果展示。

- **前置任务**: `P2-001`, `P5-001`, `A-001`, `A-002`, `A-003`
- **负责人**: 队员 1
- **状态**: 🟢 已完成
- **涉及文件**: `components/sky/solve/solve-page.tsx`, `components/sky/solve/multimodal-input.tsx`, `components/sky/solve/grade-result.tsx`, `components/sky/solve/solution-panel.tsx`, `components/sky/solve/similar-problems.tsx`

**检验标准**:
- [x] 支持拍照上传（`<input capture="environment">`）、语音输入、文字输入
- [x] 左侧输入区：拍照卡片 + 手动输入框 + 提交批改按钮
- [x] 右侧结果区：题目展示 → 批改结果 → 解题步骤 → 知识点 → 同类练习
- [x] 批改结果卡片有 ✅/❌ 标识 + 错因分析
- [x] loading 状态和错误状态处理完善
- [x] 页面响应式适配移动端

**产出文件**:
```
components/sky/
└── solve/
    ├── solve-page.tsx          # 搜题主页（双栏布局）
    ├── multimodal-input.tsx    # 多模态输入组件
    ├── grade-result.tsx        # 批改结果卡片
    ├── solution-panel.tsx      # 四段式解题面板
    └── similar-problems.tsx    # 相似题推荐
```

---

## 四、模块 B · 幻灯片讲解（队员 2 独立开发）

> 与模块 A/C 无代码依赖，仅依赖队长的类型系统和 API 路由。

### `B-001` 幻灯片生成

> 输入教学主题，AI 自动生成课程幻灯片 JSON（复用现有 slide 生成管线）。

- **前置任务**: `P1-001`, `P5-001`
- **负责人**: 队员 2
- **状态**: 🔴 待开始
- **涉及文件**: `lib/slides/slide-generator.ts`

**检验标准**:
- [ ] `generateSlides(topic, options)` 返回幻灯片 JSON 数组
- [ ] 复用 `lib/prompts/generators/slide-content.md` 提示词模板
- [ ] 每张幻灯片包含：背景、标题、内容区（Simple Layout Mode 优先）
- [ ] 支持难度设定（初中/高中/大学）
- [ ] 生成结果通过 Pre-Output Checklist 验证
- [ ] 5-15 秒内返回幻灯片 JSON

**产出文件**:
```
lib/
└── slides/
    └── slide-generator.ts      # 幻灯片生成：主题 → AI → JSON
```

### `B-002` 虚拟形象讲解

> 为每张幻灯片生成讲解脚本，调用 TTS 合成语音，实现文字逐句高亮播放。

- **前置任务**: `P1-001`
- **负责人**: 队员 2
- **状态**: 🔴 待开始
- **涉及文件**: `lib/slides/avatar-speech.ts`, `lib/slides/avatar-config.ts`

**检验标准**:
- [ ] `generateAvatarSpeech(slides, avatarId)` 返回 `AvatarSpeech`（含 TTS 音频 URL 数组）
- [ ] 复用 `lib/audio/tts-providers.ts`（VoxCPM）
- [ ] 虚拟形象配置：`严肃教授`、`温柔学姐`、`幽默学渣` 至少 3 种
- [ ] 文字逐句高亮同步播放
- [ ] 支持语速调整、暂停/重播
- [ ] 可用形象列表 API 返回正确

**产出文件**:
```
lib/
└── slides/
    ├── avatar-speech.ts        # 讲解脚本生成 + TTS 合成
    └── avatar-config.ts        # 虚拟形象配置（ID、名称、人设、语音配置）
```

### `B-003` PPT 导出

> 将生成的幻灯片 + 讲解脚本 + 知识点整合为完整 PPTX 课件包。

- **前置任务**: `P1-001`, `B-001`
- **负责人**: 队员 2
- **状态**: 🔴 待开始
- **涉及文件**: `lib/export/course-exporter.ts`

**检验标准**:
- [ ] `exportCourseToPPTX(config)` 返回 `{ fileUrl, fileName }`
- [ ] 扩展现有 `lib/export/use-export-pptx.ts`
- [ ] 导出内容包含：封面页、目录页、幻灯片页（含备注）、知识点页、封底页
- [ ] 使用 pptxgenjs 纯前端导出
- [ ] 生成的 PPTX 文件可在 PowerPoint/WPS 中正常打开
- [ ] 导出过程有进度反馈

**产出文件**:
```
lib/
└── export/
    └── course-exporter.ts      # 完整课程 PPTX 打包
```

### `B-004` 模块 B 测试

> 幻灯片生成 + 虚拟形象讲解 + PPT 导出全流程测试。

- **前置任务**: `B-001`, `B-002`, `B-003`
- **负责人**: 队员 2
- **状态**: 🔴 待开始
- **涉及文件**: `tests/slides/*.test.ts`

**检验标准**:
- [ ] 幻灯片生成格式验证测试
- [ ] TTS 音频生成测试（mock API）
- [ ] PPTX 导出文件格式验证
- [ ] 集成测试：topic → slides → avatarSpeech → export 全链路
- [ ] `pnpm test` 全部通过

**产出文件**:
```
tests/
└── slides/
    ├── slide-generator.test.ts
    ├── avatar-speech.test.ts
    └── course-exporter.test.ts
```

### `B-005` 幻灯片讲解页 UI

> 独立页面：左侧操作区（输入主题 + 形象选择）+ 右侧幻灯片展示 + 虚拟形象播放器。

- **前置任务**: `P2-001`, `P5-001`, `B-001`, `B-002`
- **负责人**: 队员 2
- **状态**: 🔴 待开始
- **涉及文件**: `components/sky/slides/slide-viewer.tsx`, `components/sky/slides/avatar-player.tsx`, `components/sky/slides/avatar-selector.tsx`, `components/sky/slides/slide-editor.tsx`

**检验标准**:
- [ ] 左侧操作区：主题输入框 + 难度选择 + 生成按钮
- [ ] 左侧下方：幻灯片缩略图列表（可点击切换）
- [ ] 右侧：幻灯片展示区（复用 `components/slide-renderer/`）
- [ ] 右下角叠加层：虚拟形象头像 + 讲解文字 + 播放控制
- [ ] 底部操作栏：导出 PPTX、重新生成、添加幻灯片
- [ ] 页面响应式适配

**产出文件**:
```
components/sky/
└── slides/
    ├── slide-viewer.tsx        # 幻灯片展示主组件
    ├── avatar-player.tsx       # 虚拟形象播放器（叠加层）
    ├── avatar-selector.tsx     # 形象选择器
    └── slide-editor.tsx        # 幻灯片编辑/调整
```

---

## 五、模块 C · 学习数据（队员 3 独立开发）

> 与模块 A/B 无代码依赖，仅依赖队长的类型系统、UI 外壳和 API 路由。

### `C-001` 错题本

> 自动记录错题、AI 错因诊断、复习追踪、筛选导出。

- **前置任务**: `P1-001`, `P5-001`
- **负责人**: 队员 3
- **状态**: 🔴 待开始
- **涉及文件**: `lib/mistakes/mistake-tracker.ts`, `lib/mistakes/cause-analyzer.ts`

**检验标准**:
- [ ] `trackMistake(record)` 自动存入 IndexedDB
- [ ] `analyzeMistakeCause(problem, correctAnswer, userAnswer)` 返回 5 种错因之一
- [ ] 支持手动标记"已掌握" / "需复习"
- [ ] 按知识点/时间/错因筛选
- [ ] 一键生成错题集（可导出为 PDF）
- [ ] 错题记录包含完整元数据：`problem`, `userAnswer`, `correctAnswer`, `cause`, `solvedAt`, `reviewed`, `reviewCount`, `knowledgePoints`

**产出文件**:
```
lib/
└── mistakes/
    ├── mistake-tracker.ts      # 错题记录 + 追踪 + 筛选
    └── cause-analyzer.ts       # AI 错因诊断
```

### `C-002` 知识图谱

> 基于做题记录构建知识点图谱，D3.js 力导向图可视化，高亮薄弱知识点。

- **前置任务**: `P1-001`
- **负责人**: 队员 3
- **状态**: 🔴 待开始
- **涉及文件**: `lib/mistakes/knowledge-graph.ts`

**检验标准**:
- [ ] `buildKnowledgeGraph(mistakes)` 返回 `{ nodes, edges, weakPoints }`
- [ ] 节点包含：`id`, `name`, `category`, `mastery`(0-100), `problemCount`, `mistakeCount`, `children`
- [ ] 边包含：`from`, `to`, `relation`(`prerequisite`/`related`/`extension`)
- [ ] 薄弱知识点自动标记（错误率 > 50%）
- [ ] 支持推荐学习路径（从薄弱点出发）
- [ ] IndexedDB 本地缓存，API 返回云端数据

**产出文件**:
```
lib/
└── mistakes/
    └── knowledge-graph.ts      # 知识图谱构建 + 路径推荐
```

### `C-003` AI 助手

> 复用现有 Agent 系统，新增学习场景模板，全局悬浮球入口。

- **前置任务**: `P1-001`, `P5-001`
- **负责人**: 队员 3
- **状态**: 🔴 待开始
- **涉及文件**: `components/sky/assistant/assistant-fab.tsx`, `components/sky/assistant/assistant-panel.tsx`, `components/sky/assistant/assistant-config.tsx`, `lib/orchestration/registry/templates/solvers/`

**检验标准**:
- [ ] 全局悬浮球（右下角固定，始终可见）
- [ ] 点击展开助手面板（支持多轮对话）
- [ ] 新增 Agent 模板：`universalSolver`、`scienceSolver`、`humanitiesSolver`
- [ ] 用户可配置：学科偏好、答题风格、难度等级、语言风格
- [ ] 助手可访问错题本/知识图谱数据（提供上下文）
- [ ] 对话压缩复用 `lib/orchestration/conversation-compression.ts`

**产出文件**:
```
components/sky/
└── assistant/
    ├── assistant-fab.tsx       # 悬浮球入口
    ├── assistant-panel.tsx     # 助手对话面板
    └── assistant-config.tsx    # 个性化配置面板
lib/orchestration/registry/templates/solvers/
    ├── universal.ts            # 通用解题模板
    ├── science.ts              # 理科模板
    └── humanities.ts           # 文科模板
```

### `C-004` 学习数据页 UI

> 三 Tab 页面：错题本 + 知识图谱可视化 + 学习统计。

- **前置任务**: `P2-001`, `P5-001`, `C-001`, `C-002`
- **负责人**: 队员 3
- **状态**: 🔴 待开始
- **涉及文件**: `components/sky/learning/mistake-book.tsx`, `components/sky/learning/knowledge-graph-view.tsx`, `components/sky/learning/learning-stats.tsx`

**检验标准**:
- [ ] Tab 切换：错题本 | 知识图谱 | 学习统计
- [ ] 错题本 Tab：筛选栏 + 错题列表（错因标签 + 操作按钮）
- [ ] 知识图谱 Tab：D3.js 力导向图可视化，节点大小=掌握度，颜色=正确率
- [ ] 学习统计 Tab：今日搜题次数、错题待复习数、知识掌握百分比
- [ ] 图表使用 ECharts 或 D3.js
- [ ] 页面响应式适配

**产出文件**:
```
components/sky/
└── learning/
    ├── mistake-book.tsx        # 错题本列表 + 筛选
    ├── knowledge-graph-view.tsx # D3.js 力导向图
    └── learning-stats.tsx      # 学习统计图表
```

### `C-005` 模块 C 测试

> 错题本 + 知识图谱 + AI 助手全流程测试。

- **前置任务**: `C-001`, `C-002`, `C-003`
- **负责人**: 队员 3
- **状态**: 🔴 待开始
- **涉及文件**: `tests/mistakes/*.test.ts`

**检验标准**:
- [ ] 错题本 CRUD 测试
- [ ] 错因分析准确率测试（> 80%）
- [ ] 知识图谱构建测试
- [ ] AI 助手对话测试（mock LLM）
- [ ] `pnpm test` 全部通过

**产出文件**:
```
tests/
└── mistakes/
    ├── mistake-tracker.test.ts
    ├── cause-analyzer.test.ts
    └── knowledge-graph.test.ts
```

### `C-006` 首页仪表盘

> 天空课堂首页：学习概览卡片 + 快捷入口 + 最近活动时间线。

- **前置任务**: `P2-001`
- **负责人**: 队员 3
- **状态**: 🔴 待开始
- **涉及文件**: `app/sky/page.tsx`, `components/sky/dashboard/`

**检验标准**:
- [ ] 顶部问候语（早上好/下午好/晚上好 + 用户称呼）
- [ ] 三个数据卡片：今日搜题次数、错题待复习数、知识掌握度
- [ ] 快速开始区：四个入口卡片（拍照搜题、语音搜题、文字输入、生成幻灯片）
- [ ] 最近活动时间线（最近 5 条活动）
- [ ] 数据从 Zustand Store 读取
- [ ] 空状态友好（首次使用引导）

**产出文件**:
```
app/
└── sky/
    └── page.tsx                # 首页仪表盘
components/sky/
└── dashboard/
    ├── stat-cards.tsx          # 数据统计卡片
    ├── quick-actions.tsx       # 快捷入口
    └── activity-timeline.tsx   # 最近活动
```

---

## 六、集成测试与文档 · 队长负责

> 队员完成各自模块后，队长负责全系统集成测试和文档完善。

### `P6-001` 集成测试

> 全系统端到端测试，确保三大模块协同工作无问题。

- **前置任务**: `A-005`, `B-004`, `C-005`
- **负责人**: 队长
- **状态**: 🔴 待开始
- **涉及文件**: `tests/integration/*.test.ts`

**检验标准**:
- [ ] 搜题批改全链路：拍照 → 识别 → 解题 → 批改 → 四段式输出 → 存入错题本
- [ ] 幻灯片讲解全链路：输入主题 → 生成幻灯片 → 虚拟形象讲解 → 导出 PPTX
- [ ] 错题本联动：搜题批改产生的错题自动出现在错题本
- [ ] 知识图谱联动：错题自动更新图谱中的知识点掌握度
- [ ] AI 助手可访问错题本/知识图谱上下文
- [ ] 首页仪表盘数据实时更新
- [ ] 并发 100 人模拟请求无崩溃

**产出文件**:
```
tests/
└── integration/
    ├── solve-flow.test.ts      # 搜题批改 E2E
    ├── slide-flow.test.ts      # 幻灯片 E2E
    └── cross-module.test.ts    # 模块间联动
```

### `P6-002` 文档完善

> 更新架构文档、API 文档、类型文档、提示词文档、部署文档、测试文档。

- **前置任务**: `P6-001`
- **负责人**: 队长
- **状态**: 🔴 待开始
- **涉及文件**: `docs/sky-classroom-design.md`, `docs/api-reference.md`, `docs/types-reference.md`, `docs/testing-guide.md`

**检验标准**:
- [ ] `docs/sky-classroom-design.md` 完整设计方案
- [ ] `docs/api-reference.md` 新增 8 个天空课堂 API 文档
- [ ] `docs/types-reference.md` 新增共享类型文档
- [ ] `docs/testing-guide.md` 新增测试指南
- [ ] 所有文档通过 lint 检查

**产出文件**:
```
docs/
├── sky-classroom-design.md     # 天空课堂设计方案
├── api-reference.md            # 更新：新增天空课堂 API
├── types-reference.md          # 更新：新增共享类型
└── testing-guide.md            # 更新：新增测试指南
```

---

## 七、状态管理

> 新建 `useSkyClassroomStore`，集中管理所有模块的客户端状态。

- **前置任务**: `P1-001`
- **负责人**: 队长（定义 store 结构），队员各自实现 slice
- **状态**: 🔴 待开始
- **涉及文件**: `lib/store/use-sky-classroom-store.ts`

**检验标准**:
- [ ] Zustand persist 持久化用户偏好设置
- [ ] 各模块独立 slice：`solveSlice`、`slidesSlice`、`mistakesSlice`、`assistantSlice`
- [ ] 状态变更响应式更新 UI
- [ ] IndexedDB 适配器用于题库/错题/图谱数据缓存

**产出文件**:
```
lib/
└── store/
    └── use-sky-classroom-store.ts  # 天空课堂状态管理（Zustand）
```

---

## 八、关键技术选型

### 8.1 图片识别

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|------|
| 大模型视觉（GPT-4o / Claude） | 准确率高、支持公式 | API 成本高 | **推荐**（解题核心） |
| Tesseract.js | 免费、离线 | 中文/公式准确率低 | 辅助方案 |
| Mathpix API | 公式识别业界最佳 | 收费 | 可考虑 |

### 8.2 题库相似度匹配

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|------|
| Embedding + 向量检索 | 语义相似度、扩展性好 | 需额外部署向量库 | **推荐**（Supabase pgvector） |
| 哈希匹配 | 简单、快速 | 只能匹配完全相同题目 | 辅助方案 |

### 8.3 虚拟形象

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|------|
| 静态头像 + 语音 | 实现简单、成本低 | 缺少动态效果 | **V1.0 推荐** |
| Lottie 动画 + 语音 | 有基础动画效果 | 需设计资源 | V1.5 可选 |
| D-ID / HeyGen | 唇形同步 | 成本高、延迟高 | V2.0 |

### 8.4 数据存储

| 数据类型 | 存储方案 |
|----------|----------|
| 用户偏好设置 | Zustand persist (localStorage) |
| 题库数据 | IndexedDB（浏览器）+ Supabase（云端同步） |
| 错题记录 | IndexedDB + 服务端备份 |
| 知识图谱 | IndexedDB（本地缓存） |
| 幻灯片数据 | IndexedDB + PPTX 导出 |

### 8.5 PPT 导出

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|------|
| pptxgenjs | 纯前端、免费、支持图表 | 复杂排版有限 | **推荐** |
| 服务端 LibreOffice | 支持复杂排版 | 需服务器资源 | V2.0 考虑 |

---

## 九、风险评估与降级方案

### 9.1 高风险项

| 风险 | 概率 | 影响 | 降级方案 |
|------|------|------|----------|
| 图片识别准确率不达标 | 中 | 高 | 增加人工校对入口，用户可手动修正 |
| 多模型投票延迟高 | 中 | 中 | 默认单模型，"高精度模式"可选 |
| 虚拟形象实现复杂 | 低 | 中 | V1.0 用静态头像+文字高亮，语音后加 |
| PPT 导出排版不美观 | 中 | 中 | 使用精简模板，重点在内容而非花哨排版 |
| UI 大改工作量大 | 高 | 高 | 优先核心页面（搜题页），其余渐进式改造 |

### 9.2 功能优先级

```
P0（必须）：拍照识别 + 单模型解题 + 批改 + 四段式输出 + 全新 UI 外壳 + 搜题页
P1（重要）：题库 Self-Improvement + 错题本 + 知识图谱 + 学习数据页
P2（加分）：幻灯片讲解 + 虚拟形象 + AI 助手 + PPT 导出 + 首页仪表盘
P3（后续）：多模型投票 + 会员 + 小程序 + App + 多语言
```

---

## 十、现有代码可直接复用的部分

| 现有模块 | 天空课堂用途 |
|----------|-------------|
| `lib/orchestration/director-graph.ts` | 参考模式创建解题编排图 |
| `lib/orchestration/registry/` | 新增解题/AI助手 Agent 模板 |
| `lib/orchestration/rule-engine.ts` | 解题路由规则（题型分类→Agent 选择） |
| `lib/orchestration/role-balance.ts` | 多模型投票负载均衡 |
| `lib/orchestration/conversation-compression.ts` | AI 助手对话压缩 |
| `lib/ai/providers.ts` | DeepSeek/GLM/Qwen 已支持，直接复用 |
| `lib/ai/failover.ts` | 模型故障自动切换 |
| `lib/ai/cost-tracker.ts` | 成本追踪 |
| `lib/audio/tts-providers.ts` | 虚拟形象语音讲解 |
| `lib/audio/asr-providers.ts` | 语音输入题目 |
| `lib/hooks/use-audio-recorder.ts` | 录音 Hook |
| `lib/generation/json-repair.ts` | 解题输出 JSON 修复 |
| `lib/generation/quality-scorer.ts` | 解题质量评估 |
| `lib/generation/cache.ts` | 题库缓存 |
| `lib/generation/pipeline-runner.ts` | 幻灯片生成管线复用 |
| `lib/prompts/generators/slide-content.md` | 幻灯片生成提示词 |
| `components/slide-renderer/` | 幻灯片渲染复用 |
| `lib/export/use-export-pptx.ts` | PPT 导出基础能力 |
| `lib/api/middleware/` | 错误处理 + 速率限制 |

---

## 十一、API 设计

### 11.1 图片识别

```
POST /api/sky/solve/recognize
Request: FormData { image: File }
Response: { success, data: { text, latex, problemCount, problems?[] } }
```

### 11.2 解题讲解

```
POST /api/sky/solve/explain
Request: { problem: { text?, image? }, agentId?, useHighPrecision?, outputFormat: 'four-part' | 'graded' }
Response: { success, data: FourPartOutput | GradedFourPartOutput, fromQuestionBank, solvingTime, agentsUsed }
```

### 11.3 批改

```
POST /api/sky/solve/grade
Request: { problem, correctAnswer, userAnswer, stepByStep? }
Response: { success, data: GradeResult }
```

### 11.4 题库

```
GET  /api/sky/question-bank?query=...&limit=10
POST /api/sky/question-bank  (自动入库)
```

### 11.5 幻灯片讲解

```
GET  /api/sky/slides/avatars
POST /api/sky/slides/generate
POST /api/sky/slides/avatar-speak
POST /api/sky/slides/export-pptx
```

### 11.6 错题本

```
GET    /api/sky/mistakes?filter=...
POST   /api/sky/mistakes
PATCH  /api/sky/mistakes/:id/review
DELETE /api/sky/mistakes/:id
```

### 11.7 知识图谱

```
GET /api/sky/knowledge-graph
Response: { nodes: KnowledgeNode[], edges: KnowledgeEdge[], weakPoints: string[] }
```

### 11.8 AI 助手

```
POST /api/sky/assistant/chat
Request: { messages: [{ role, content }], config: { subject?, style?, difficulty? } }
```

---

## 十二、后续迭代规划（V2.0+）

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 用户照片生成专属形象 | 集成 D-ID / HeyGen | V2.0 |
| 会员体系 | 用户注册/登录/付费 | V2.0 |
| 多语言支持 | 英语/日语题目识别 | V2.0 |
| iOS/Android App | React Native 封装 | V2.0 |
| 微信小程序 | 小程序适配 | V2.0 |
| AI 批改整页作业 | 上传整页作业自动批改 | V2.5 |
| 实时协作解题 | 多人同时看同一题 | V2.5 |
| 家长端监控 | 学习报告推送家长 | V2.5 |
| 小天才儿童手表适配 | 手表端交互适配 | V2.5 |
