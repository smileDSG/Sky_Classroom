# OpenMAIC PPT Agent — Skill & Context

## 项目概况

OpenMAIC-B-001 是一个 AI 驱动教学平台。PPT 生成模块是其核心功能之一。目标是输入主题和难度，自动生成完整的教学课件。

## 技术栈

- **框架**: Next.js 16 (Turbopack) + TypeScript 5.9
- **LLM**: DeepSeek V4 Pro (主), Kimi (备), Qwen (备)
- **PPT 生成**: pptxgenjs
- **PPT→PNG**: LibreOffice headless (Windows `C:\Program Files\LibreOffice\program\soffice.exe`)
- **认证**: JWT (jose), 默认管理员 admin/123
- **Schema 校验**: Zod
- **存储**: memory backend (DAO模式)
- **测试**: vitest

## 核心架构

```
用户输入 topic/difficulty
        │
        ├─ 封面画廊 ─────────────────────────────────────────
        │   generateCovers()  →  12路并发生成封面骨架
        │   cover-renderer.ts →  pptxgenjs 生成 PPTX
        │   png-converter.ts  →  LibreOffice 转 PNG 缩略图
        │   └─ 用户选择封面风格 → DesignDNA
        │
        └─ PPT 生成 Pipeline ───────────────────────────────
            planning-agent  →  页面级大纲规划
            section-agent   →  章节内容生成 (并发)
            page-design-agent → 页面排版指令 (全并发)
            QA  (Layer1结构 + Layer2内容LLM)
            instruction-executor → pptxgenjs 渲染
            png-converter → 幻灯片预览图
```

## 文件结构

```
lib/slides/agent/
  design-dna.ts          — 12色板, 5字体, 5motif, 12布局, Zod校验
  cover-agent.ts         — 12路并发生成封面骨架 (salvage+retries)
  cover-renderer.ts      — 12种布局渲染器 → pptxgenjs PPTX
  png-converter.ts       — LibreOffice PPTX→PNG (semaphore=3, SYSUSERCONFIG)
  planning-agent.ts      — 大纲规划 (页面类型由page-type-selector过滤)
  page-type-selector.ts  — 主题→学科推断, 过滤页面类型
  section-agent.ts       — 章节内容生成 + LaTeX→Unicode转换
  page-design-agent.ts   — 内容JSON → 渲染指令JSON
  instruction-executor.ts — 执行渲染指令 (addText/addShape/addFormula/addTable...)
  qa-agent.ts            — 两层QA: Layer1结构(0LLM) + Layer2内容(1LLM)
  content-schemas.ts     — 14种页面类型Zod Schema + autoFix + LaTeX→Unicode
  pipeline.ts            — 总编排器 (Planning→Sections→Pages→QA→Repair→Merge)
  latex-to-omml.ts       — LaTeX→MathML→OMML 公式渲染管线

app/api/sky/slides/
  generate-covers/route.ts — POST 生成12个封面 (maxDuration=180s)
  generate/route.ts        — POST 启动课件生成 (async, 返回jobId)
  generate/status/route.ts — GET  轮询生成进度

components/sky/slides/
  slides-page.tsx        — 主页面: 状态机驱动 (IDLE→COVER_LOADING→COVER_GALLERY→GENERATING→PREVIEW)
  cover-gallery.tsx      — 12格封面画廊, 选推荐/刷新
```

## 已完成的重大改动

### 1. LaTeX→Unicode 内联公式转换 (content-schemas.ts)
化学公式 `$CO_2$` → CO₂, `$NADP^+$` → NADP⁺。4 阶段处理:
- Phase 1: 命名化学式正则表 (30+ 规则)
- Phase 2: 通用单元素下标 `$X_n$` → Xₙ
- Phase 3: 通用单元素上标 `$X^{n}$` → Xⁿ
- Phase 4: 残存简单 `$...$` 的兜底转换

### 2. 封面生成并发化 (cover-agent.ts)
- **salvageJson()**: LLM输出先修复再校验 (去fence/补括号/去逗号/提取JSON)
- **12路并发 + 限流6**: `concurrencyLimit(tasks, 6)`
- **重试**: callLLM retries=1, 外层 slot retries=2, 最大 4次LLM调用/slot
- **无静默降级**: 成功<8则整体报错
- **主题感知motif分配**: `getMotifsForTopic(topic)` — 关键词匹配→学科分类→motif优先级

### 3. QA 质检系统恢复 (pipeline.ts)
- 回接完整 `runQA()`: Layer1结构检查 + Layer2内容审查(LLM)
- 结构问题自动修复 (补封面/结束页)

### 4. Pipeline 进度细化 (pipeline.ts + slides-page.tsx)
- 每阶段精确进度: 规划5-15% → 章节20-40% → 页面42-70% → QA72-78% → 修复80% → 合并82-100%
- 实时消息: "章节内容：2/4 — 第2章「光反应」✓"

### 5. LibreOffice 并行 PNG 转换 (png-converter.ts)
- semaphore: 1→3
- 每进程独立 `SYSUSERCONFIG` 环境变量
- 失败自动重试 (2s延迟, 1次)

### 6. 前端防重入 (slides-page.tsx)
- `handleGenerateCovers` 和 `handleRefreshCovers` 加 `if (coverLoading) return`

## 待完成的工作

### P0: 封面画廊风格发现改进
当前封面画廊流程: 输入主题 → 90s → 12个封面。用户想改成:
1. 快速 LLM 调用 (~5-8s) 发现 4-6 个风格方向 (纯文字)
2. 用户勾选偏好风格 (2-3个)
3. 定向生成封面 (~25-30s)
4. 总时间从 90s → 35s, 且风格与主题匹配

需新建:
- `POST /api/sky/slides/suggest-styles` 路由
- 前端风格选择步骤 (在输入主题和展示画廊之间)

### P1: [Formula] 占位符问题
Slide 5 出现 `[Formula]` 字面量。Page Design Agent 未正确使用 addFormula 指令。
- `page-design-agent.ts` prompt 强化 "Never use [Formula] placeholder"
- `instruction-executor.ts` 拒绝 `[...]` 占位符 addText

### P2: 时间优化
- 封面画廊: 实现上述风格发现改进 (预计从90s→35s)
- PNG转换: 考虑预初始化 LO profile 模板以减启动开销
- LLM耗时: DeepSeek V4 Pro 硬延迟 ~25s/调用, 难以优化

### P2: 前端 stage 类型调整
`genStage` 类型已更新但 `startProgress` 未被使用 (旧代码), 可清理。

## 关键约定

1. **无静默降级**: Agent 项目不允许 silent fallback。LLM 失败就重试，重试不行就报错。不给用户塞"预设"内容。
2. **validate 要 salvage-first**: LLM 输出先修复再校验，减少无意义重试
3. **每路独立重试**: 外层 retry loop 包裹 callLLM+parse+validate 全流程
4. **并发不连坐**: 单路失败不影响其他路，收集结果统一判断
5. **motif 由主题决定**: 不是随机轮转，是 topic→学科→motif优先级→配额分配
6. **Windows 路径**: 反斜杠问题, `SYSUSERCONFIG` 优于 `-env:UserInstallation`
7. **libreOffice**: 位置 `C:\Program Files\LibreOffice\program\soffice.exe`

## 环境变量 (.env.local)

```
DEEPSEEK_API_KEY=sk-cf3819dbb2de423fae1800eb79b0533a
DEEPSEEK_MODELS=deepseek-v4-pro
KIMI_API_KEY=sk-Hdh24v4JgxAQy0tt5Y3N6TG1JrlG8XeMLOFM1ovRVToFX9Tv
QWEN_API_KEY=sk-ef1b7911d58c456290907bd62f378f75
DEFAULT_MODEL=deepseek:deepseek-v4-pro
```

## 测试

- `tests/slides/cover-agent.test.ts` — 46 个用例: salvageJson×11, schema×8, assembly×8, full flow×4, getMotifsForTopic×15
- 运行: `npx vitest run tests/slides/cover-agent.test.ts`

## 启动

```bash
cd C:\Users\11486\Desktop\OpenMAIC-B-001
npx next dev
# http://localhost:3000/sky/slides
```
