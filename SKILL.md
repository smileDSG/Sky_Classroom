# OpenMAIC PPT Agent — Skill & Context

## 项目概况

OpenMAIC-B-001 是一个 AI 驱动教学平台。PPT 生成模块是其核心功能之一。目标是输入主题和难度，自动生成完整的教学课件。

## 技术栈

- **框架**: Next.js 16 (Turbopack) + TypeScript 5.9
- **LLM**: DeepSeek V4 Pro (主), Kimi (备), Qwen (备)
- **PPT 生成**: pptxgenjs
- **PPT→PNG**: LibreOffice headless (auto-detected or via `LO_SOFFICE_PATH` env var)
- **认证**: JWT (jose), 默认管理员 admin/123
- **Schema 校验**: Zod
- **存储**: memory backend (DAO模式)
- **测试**: vitest

## 核心架构

```
用户输入 topic/difficulty
        │
        ├─ 智能封面推荐 (Scheme C) ───────────────────────────
        │   suggest-cover API  →  1次LLM推荐最佳DesignDNA
        │   cover-renderer.ts  →  pptxgenjs 生成封面PPTX
        │   png-converter.ts   →  LibreOffice 转 PNG
        │   SmartCoverView     →  SVG实时预览 + 操作栏
        │   StyleLabPanel      →  色彩/布局/字体/密度四维换肤
        │   useCoverDraft      →  Zustand草稿状态管理
        │   └─ 用户确认/换一换/手动调整 → DesignDNA
        │
        ├─ 封面画廊 (Legacy, 保留) ───────────────────────────
        │   generateCovers()  →  12路并发生成封面骨架
        │   cover-renderer.ts →  pptxgenjs 生成 PPTX
        │   png-converter.ts  →  LibreOffice 转 PNG 缩略图
        │   └─ 「更多风格」入口进入
        │
        └─ PPT 生成 Pipeline ───────────────────────────────
            planning-agent  →  页面级大纲规划 (注入mood/density)
            section-agent   →  章节内容生成 (并发)
            page-design-agent → 页面排版指令 (全并发, 注入density)
            QA  (Layer1结构 + Layer2内容LLM)
            instruction-executor → pptxgenjs 渲染
            png-converter → 幻灯片预览图
            audit-logger  →  结构化审计日志
```

## 文件结构

```
lib/slides/agent/
  design-dna.ts          — 12色板, 5字体, 5motif, 12布局, Zod校验
  cover-agent.ts         — 12路并发生成封面骨架 (salvage+retries)
  cover-renderer.ts      — 12种布局渲染器 → pptxgenjs PPTX
  png-converter.ts       — LibreOffice PPTX→PNG (semaphore=3, -env:UserIsolation)
  suggest-cover-agent.ts — 1次LLM智能推荐最佳DesignDNA
  planning-agent.ts      — 大纲规划 (注入mood/density, 页面类型由page-type-selector过滤)
  page-type-selector.ts  — 主题→学科推断, 过滤页面类型
  section-agent.ts       — 章节内容生成 + LaTeX→Unicode转换
  page-design-agent.ts   — 内容JSON → 渲染指令JSON (注入density指导)
  instruction-executor.ts — 执行渲染指令 (addText/addShape/addFormula/addTable...)
  qa-agent.ts            — 两层QA: Layer1结构(0LLM) + Layer2内容(1LLM)
  content-schemas.ts     — 14种页面类型Zod Schema + autoFix + LaTeX→Unicode
  pipeline.ts            — 总编排器 (Planning→Sections→Pages→QA→Repair→Merge)
  audit-logger.ts        — 结构化审计日志 (步骤/LLM/耗时)
  latex-to-omml.ts       — LaTeX→MathML→OMML 公式渲染管线

app/api/sky/slides/
  generate-covers/route.ts — POST 生成12个封面 (maxDuration=180s)
  suggest-cover/route.ts   — POST 智能推荐封面 (maxDuration=180s)
  generate/route.ts        — POST 启动课件生成 (async, 返回jobId)
  generate/status/route.ts — GET  轮询生成进度

components/sky/slides/
  slides-page.tsx        — 主页面: 状态机驱动 (IDLE→SUGGESTING→SMART_COVER→STYLE_LAB→GENERATING→PREVIEW)
  smart-cover-view.tsx   — 智能封面展示: SVG预览 + 确认/换一换/手动调整/更多风格
  cover-svg-renderer.tsx — SVG实时渲染引擎 (viewBox 13.33×7.5, 5种布局)
  cover-layouts/         — 5种SVG布局组件
    hero-left.tsx, hero-centered.tsx, split-panel.tsx, minimal-type.tsx, bold-accent.tsx
  style-lab-panel.tsx    — StyleLab换肤面板 (色彩/布局/字体/密度)
  style-pickers/         — 4个维度选择器组件
    color-picker.tsx, layout-picker.tsx, font-picker.tsx, density-picker.tsx
  cover-gallery.tsx      — 12格封面画廊 (Legacy, 「更多风格」入口)

lib/slides/hooks/
  use-cover-draft.ts     — Zustand Store: draftDNA管理 (apply/update/confirm)
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
- 每进程独立 `-env:UserInstallation=file:///` 环境变量 (隔离配置防损坏)
- 失败自动重试 (2s延迟, 最多2次)
- **无 fallback**: LO 不可用时报明确错误，不静默降级

### 6. 前端防重入 (slides-page.tsx)
- `handleGenerateCovers` 和 `handleRefreshCovers` 加 `if (coverLoading) return`

### 7. 方案C: 智能推荐 + 实时换肤 (2025-05-28 完成)
- **后端**: `suggest-cover/route.ts` — 1次LLM推荐DesignDNA → renderCoverPptx → convertPptxToPng
  - 12-15s 完成封面推荐（原12封面需90s）
  - 返回 cover(pngUrl + designDNA) + alternatives
- **SVG实时渲染**: `cover-svg-renderer.tsx` + 5种布局组件
  - 浏览器即时预览，无需等待PPTX生成
  - viewBox="0 0 13.33 7.5" 匹配 LAYOUT_WIDE
- **StyleLab换肤面板**: `style-lab-panel.tsx`
  - ColorPicker: 12色板切换
  - LayoutPicker: 5布局缩略图 + 7静态占位
  - FontPicker: 5字体配对
  - DensityPicker: sparse/moderate/rich 三段控制
- **状态管理**: `use-cover-draft.ts` (Zustand)
  - suggestedCover(原始推荐), draftDNA(实时修改)
  - updatePalette/updateLayout/updateFont/updateDensity/confirm
- **Pipeline集成**:
  - planning-agent.ts: 注入 mood(活泼/严谨) + density(稀疏/丰富) 指导大纲规划
  - page-design-agent.ts: 注入 density 指导页面排版密度
- **审计日志**: `audit-logger.ts`
  - 每Job结构化记录: steps(LLM调用/耗时), llmCalls(模型/Token/耗时), finalize(状态/页数/QA分)
- **Legacy兼容**: 原12封面画廊完整保留，通过「更多风格」入口访问

### 8. 字体系统多语言支持 (2025-05-28 完成)
- **问题**: 原 FontPicker 只改了英文字体 `heading`/`body`，中文始终回退到系统默认
- **修复**: `design-dna.ts` 中 `FONT_PAIRS` 新增 `headingStack`/`bodyStack` 字段
  - `headingStack`/`bodyStack`: 完整 CSS font-family fallback 栈（用于 SVG/CSS 渲染）
  - `heading`/`body`: 保留单一字体名（用于 pptxgenjs）
  - 5 种中文字体: 思源宋体/黑体, 站酷文艺体, 霞鹜文楷, 阿里妈妈数黑体
- **SVG 布局更新**: 所有 5 种 SVG 布局 (`cover-layouts/`) 改用 `headingStack || heading` 渲染中文标题
- **FontPicker UI**: 展示中英文名称 + 气质标签（典雅/现代/文艺/温润/力量）

### 9. LLM 超时 + 自动重试机制 (2025-05-28 完成)
- **问题**: PPT 生成卡在 8% — `callLLM` 无超时，LLM 挂起时 `generateText` 永远不 resolve
- **修复**: `lib/ai/llm.ts` 中 `callLLM` 增加:
  - `LLMRetryOptions` 新增 `timeoutMs?: number` 参数（默认 90s）
  - 内部创建 `AbortController`，超时后 abort → 触发 `AbortError` → 已有 retry 逻辑捕获
  - Planning-agent 已有 `retries: 2`，最多尝试 3 次 (每次 90s)
- **效果**: LLM 超时不再永久卡死，自动重试提升成功率

### 10. Next.js 16 启动警告清零 (2025-05-28 完成)
- **警告 1**: Turbopack 推断错误 workspace root（多个 lockfile）
  - 修复: `next.config.ts` 添加 `turbopack: { root: __dirname }`
- **警告 2**: `"middleware" file convention is deprecated. Please use "proxy" instead`
  - 修复: `middleware.ts` → `proxy.ts`，函数 `middleware` → `proxy`
  - 配置键: `experimental.middlewareClientMaxBodySize` → `experimental.proxyClientMaxBodySize`

### 11. CSS 动画系统集中化 + 前端全面美化 (2025-05-28 完成)
- **CSS 架构**: 将 `slides-page.tsx` 和 `style-lab-panel.tsx` 中约 110 行内联 `<style jsx>` 全部提取到 `app/globals.css`
  - 11 个 `@keyframes`: fade-in-left/right/down/scale, soft-pulse, floaty, check-pop, ring-expand, slide-up-fade, slide-up, gradient-x, light-sweep
  - 对应 CSS 工具类 + stagger 延迟类 (`.stagger-1` ~ `.stagger-5`)
  - 通用 `.glass-panel` 毛玻璃基类（含 dark mode 适配）
  - `smart-cover-view.tsx` 内联 `<style jsx>` 一并清除
- **空态**: 轨道虚线环（正反转 12s/8s）、浮动 icon（5.5rem 毛玻璃卡片）、渐变标题、emoji 标签带 stagger 入场动画
- **生成态**: 双层轨道环 + 环境光晕 + 轨道粒子点 + 进度条 shadow
- **建议态（Smart Cover）**: 同生成态轨道效果
- **预览态**: 3D 透视容器 + hover 光晕增强 + 角标装饰线 + 指示器 glow
- **成功态**: 轨道虚线环 + 环境光晕 + check-pop 动画
- **缩略图**: hover 微抬升 + active 图片 ring glow
- **头尾栏**: 底部/顶部渐变 accent 线
- **CSS 冲突修复**: `smart-cover-view.tsx` → `background:` 改为 `backgroundImage:`（避免和 `backgroundSize` 冲突）

## 待完成的工作

### ✅ P0: 封面画廊风格发现改进 → 已完成 (方案C)
- 智能推荐 API: 12-15s 返回AI推荐封面 + 备选风格
- SVG实时预览 + StyleLab换肤
- 状态机: IDLE → SUGGESTING → SMART_COVER → STYLE_LAB → GENERATING

### P1: [Formula] 占位符问题
Slide 5 出现 `[Formula]` 字面量。Page Design Agent 未正确使用 addFormula 指令。
- `page-design-agent.ts` prompt 强化 "Never use [Formula] placeholder"
- `instruction-executor.ts` 拒绝 `[...]` 占位符 addText

### P2: SVG布局补齐
当前仅实现 5/12 种SVG布局: hero-left, hero-centered, split-panel, minimal-type, bold-accent
- 剩余7种在LayoutPicker中显示静态占位，SVG渲染回退到hero-left
- 需补齐: 可能与cover-renderer.ts中的12种PPTX布局一一对应

### P3: 时间优化
- PNG转换: 考虑预初始化 LO profile 模板以减启动开销
- LLM耗时: DeepSeek V4 Pro 硬延迟 ~25s/调用, 难以优化

### P4: 前端 stage 类型调整
`genStage` 类型已更新但 `startProgress` 未被使用 (旧代码), 可清理。

## 关键约定

1. **无静默降级**: Agent 项目不允许 silent fallback。LLM 失败就重试，重试不行就报错。不给用户塞"预设"内容。
2. **validate 要 salvage-first**: LLM 输出先修复再校验，减少无意义重试
3. **每路独立重试**: 外层 retry loop 包裹 callLLM+parse+validate 全流程
4. **并发不连坐**: 单路失败不影响其他路，收集结果统一判断
5. **motif 由主题决定**: 不是随机轮转，是 topic→学科→motif优先级→配额分配
6. **Windows 路径**: 反斜杠问题, 使用 `-env:UserInstallation=file:///` 优于 `SYSUSERCONFIG`
7. **LibreOffice 跨平台支持**:
   - **本地开发**: `pnpm setup:lo` 检测平台并输出安装命令
   - **自定义路径**: `LO_SOFFICE_PATH` 环境变量覆盖自动检测
   - **Docker**: 镜像内置 LibreOffice (`docker compose up` 零依赖)
   - **候选路径**: Windows/macOS/Linux 常见安装位置自动扫描
   - 若 LO 不可用，**报错而非 fallback**

## 环境变量 (.env.local)

```
DEEPSEEK_API_KEY=sk-cf3819dbb2de423fae1800eb79b0533a
DEEPSEEK_MODELS=deepseek-v4-pro
KIMI_API_KEY=sk-Hdh24v4JgxAQy0tt5Y3N6TG1JrlG8XeMLOFM1ovRVToFX9Tv
QWEN_API_KEY=sk-ef1b7911d58c456290907bd62f378f75
DEFAULT_MODEL=deepseek:deepseek-v4-pro
```

## 测试

- `npx vitest run tests/slides/` — 397 个用例全部通过
- 涵盖: cover-agent, suggest-cover-api, cover-svg-renderer, cover-layouts, style-lab-panel, use-cover-draft, audit-logger, planning-density, page-design-density, slide-generator, avatar-speech, design-dna, content-schemas, cover-renderer, cover-integration, pptx-image-handler, image-generation, pipeline-validator
- 运行: `npx vitest run tests/slides/`

## 启动

### 本地开发

```bash
cd C:\Users\11486\Desktop\OpenMAIC-B-001

# 1. 检查 LibreOffice 是否已安装
pnpm setup:lo

# 2. 启动开发服务器
npx next dev
# http://localhost:3000/sky/slides
```

### Docker 部署（推荐团队使用）

```bash
docker compose up -d
# LO 已内置在镜像中，无需额外安装
```
