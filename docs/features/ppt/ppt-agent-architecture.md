# PPT Agent 架构设计文档

> 状态: **已实现** | 日期: 2026-05-30 | 版本: v2.0

## 一、项目愿景

将 PPT 生成功能模块重构为一个**多 Agent 并行生成系统**，具备：

1. **灵活的页级规划** — 页数、页型、顺序由 LLM 动态决定，不再受固定模板限制
2. **并行生成** — 多 Agent 并发生成不同章节和页面，大幅提升生成速度
3. **质量闭环** — 生成 → 质检 → 修复，确保输出质量达标
4. **可独立部署** — 核心逻辑封装在 `lib/slides/agent/` 中，后期可剥离为独立服务

## 二、整体架构

```
用户输入 (topic + difficulty)

        ▼
┌─────────────────────────────────────────┐
│  Phase 0A: Smart Cover 推荐              │
│  单 LLM 调用 → 推荐 DesignDNA + 3 备选    │
│  → 渲染封面 PPTX → LibreOffice → PNG     │
│  → 用户确认或进入封面画廊                 │
└─────────────────────────────────────────┘
        │ (可选：进入 Phase 0B)
        ▼
┌─────────────────────────────────────────┐
│  Phase 0B: 封面画廊（12 套）              │
│  12 并发 LLM 调用 → 12 套 DesignDNA       │
│  → pptxgenjs 渲染 → LibreOffice → PNG    │
│  → 用户从画廊选 1 套                      │
└─────────────────────────────────────────┘
        ▼
┌─────────────────────────────────────────┐
│  Phase 1: Planning Agent (两层)          │
│  Layer 1: 章节骨架规划                     │
│  Layer 2: 各章节页面详情（并发）            │
└─────────────────────────────────────────┘
        ▼
┌─────────────────────────────────────────┐
│  Phase 2: Section Agents (并发)          │
│  每章节独立 Agent 生成内容 JSON            │
└─────────────────────────────────────────┘
        ▼
┌─────────────────────────────────────────┐
│  Phase 3: Page Design Agents (并发)      │
│  每页独立 Agent 生成渲染指令               │
└─────────────────────────────────────────┘
        ▼
┌─────────────────────────────────────────┐
│  Phase 4: QA & Repair                    │
│  结构质检 → 内容质检 → 自动修复            │
└─────────────────────────────────────────┘
        ▼
┌─────────────────────────────────────────┐
│  Phase 5: Merge & Preview                │
│  指令合并 → pptxgenjs 渲染 → PNG 预览      │
└─────────────────────────────────────────┘
        ▼
    输出 PPTX + PNG 预览图
```

## 三、Phase 0A: Smart Cover 推荐

### 3.1 数据流

```
POST /api/sky/slides/suggest-cover
Body: { topic: "勾股定理", difficulty: "高中" }

    ▼
Step A: LLM 风格推荐（单调用，~5-8s）
  - System Prompt 注入 12 套色板 + 5 套字体 + 布局类型列表
  - LLM 输出: { paletteId, fontId, layoutType, density, mood, styleName, bestFor }
  - 附带 3 个备选方向 (alternatives)

    ▼
Step B: 组装 DesignDNA + 渲染封面 PPTX（<1s）
  - 调用 cover-renderer.tsx（12 种布局类型之一）

    ▼
Step C: LibreOffice headless → PNG（3-6s）

    ▼
Response: {
  cover: { pngUrl, designDNA },
  alternatives: [{ paletteId, fontId, layoutType, density, mood, styleName }]
}
总耗时: ~8-15s
```

### 3.2 实现文件

| 文件 | 职责 |
|------|------|
| `lib/slides/agent/suggest-cover-agent.ts` | LLM 风格推荐、DesignDNA 组装、备选方向生成 |
| `lib/slides/agent/cover-renderer.ts` | 12 种布局类型的封面渲染器 |
| `lib/slides/agent/png-converter.ts` | LibreOffice PNG 转换（信号量限制 3 并发） |
| `app/api/sky/slides/suggest-cover/route.ts` | API 端点，串联 Step A→B→C |

### 3.3 Topic-Aware Motif 分配

`suggest-cover-agent.ts` 和 `cover-agent.ts` 共享 `getMotifsForTopic()`，根据主题关键词推断学科类别：

| 学科类别 | 关键词示例 | 优先 Motif |
|----------|-----------|-----------|
| humanities | 语文、历史、文学、诗词 | ink-wash → chinese-seal → organic-circles |
| stem | 数学、物理、化学、编程 | geometric-lines → neon-grid → organic-circles |
| science | 生物、地理、生态 | organic-circles → neon-grid → geometric-lines |
| general | 其他未匹配主题 | 均衡分配 |

---

## 四、Phase 0B: 封面画廊（12 套）

### 4.1 数据流

```
POST /api/sky/slides/generate-covers
Body: { topic: "勾股定理", difficulty: "高中" }

    ▼
Step A: 12 并发 LLM 调用（限制 6 并发）
  - 每套预分配: paletteId（12 套色板随机分配）+ motif（topic-aware）+ layoutType（motif 候选池轮询）
  - 每调用输出: { styleName, fontId, density, mood, bestFor }
  - JSON Salvage: markdown fences、控制字符、尾随逗号、未闭合括号自动修复
  - 每 slot 最多 2 次外部重试

    ▼
Step B: pptxgenjs 渲染 12 个单页 PPTX（全并行，<1s）
  - 12 种布局类型: hero-centered, hero-left, split-panel, big-number, vertical-poem,
    corner-drama, frame-border, minimal-type, bold-accent, gradient-wash,
    double-stripe, image-zone

    ▼
Step C: LibreOffice 转 PNG（信号量 3 并发，约 4 轮）

    ▼
Response: { covers: [{ id, styleName, pngUrl, recommended, designParams }] }
最低成功数: 8/12
```

### 4.2 实现文件

| 文件 | 职责 |
|------|------|
| `lib/slides/agent/cover-agent.ts` | 12 套封面生成、JSON Salvage、topic-aware motif 分配 |
| `lib/slides/agent/cover-renderer.ts` | 12 种布局类型的纯代码渲染 |
| `app/api/sky/slides/generate-covers/route.ts` | API 端点 |

### 4.3 JSON Salvage 机制

`cover-agent.ts` 中的 `salvageJson()` 处理常见 LLM 输出问题：

1. 去除 markdown fences (` ```json `)
2. 去除控制字符
3. 去除尾随逗号
4. 自动闭合未匹配的 `{` `[`
5. 尝试提取有效 JSON 对象边界

---

## 五、Phase 1: Planning Agent（两层架构）

### 5.1 架构

```
Layer 1: planSections()
  │ 输入: topic + difficulty + minPages + maxPages + designDNA
  │ 输出: SectionSkeleton[] (章节骨架 + 页数分配)
  │ 验证: 计算总页数 ≥ minPages
  │ 单调用，temperature=0.7，maxTokens=4096
  │
  ▼
Layer 2: planSectionPages() × N (并发，limit=12)
  │ 输入: 单个 SectionSkeleton
  │ 输出: PagePlan[] (该章节每页的 type/title/contentOutline)
  │ 验证: 页数严格匹配、pageNum 连续、contentOutline.focus 存在
  │ 每调用 maxTokens = min(8192, pages×1800+400)
  │
  ▼
mergeOutline()
  │ 插入 cover(1) + toc(2) + end(末尾)
  │ 全局重排 pageNum
  │
  ▼
Zod 校验 + 页数范围校验
```

### 5.2 硬规则（注入 System Prompt）

- 总页数 = 1(cover) + 1(toc) + Σ(各章节页数) + 1(end)
- 每个章节必须包含：1 页 chapter + 2-5 页内容页 + 1 页 summary
- 3 个及以上并列对比项时，该章节必须分配 table 页型
- concept 必须在 case 之前
- 同一章节内避免连续 3 页以上相同页型

### 5.3 页数修剪

Layer 1 输出后，若计算总页数 > maxPages，从最后一个章节开始逐页削减（每章最少保留 3 页）。若仍无法削减至范围内，返回失败。

### 5.4 实现文件

| 文件 | 职责 |
|------|------|
| `lib/slides/agent/planning-agent.ts` | Layer 1/2 + mergeOutline + 整体校验 |
| `lib/slides/agent/page-type-selector.ts` | Topic → 学科推断 → 页型白名单 + 偏好规则 |
| `lib/slides/agent/concurrency.ts` | 通用并发限制器（带超时 + 交错启动） |

---

## 六、Phase 2: Section Agent

### 6.1 职责

接收 SectionPlan（含每页的 type/title/contentOutline），输出每页的完整内容 JSON。

### 6.2 内容 Schema 注入

System Prompt 只注入该 Section 涉及的页型 Schema（从 `content-schemas.ts` 动态提取），减少 token 浪费。

### 6.3 多层校验与自动修复

```
LLM 输出
  │
  ▼
validateSectionOutput (callLLM 重试触发条件)
  ├─ 基础格式: 包含 pages 数组、长度匹配、以 }/}] 结尾
  ├─ 质量校验 A: concept 卡片 desc 不重复
  ├─ 质量校验 B: 含公式关键词的页面必须有 formulas/mainFormula
  └─ 质量校验 C: 创作指引未混入正文（正则过滤）
  │
  ▼
JSON 解析 → sectionOutputSchema Zod 校验
  │
  ▼
convertContentLatex() — 行内 LaTeX ($...$) → Unicode
  │ 注意: formulas[].latex 保留原始 LaTeX，供下游 addFormula 使用
  │
  ▼
postProcessContent() — 三层自动修复
  │
  ├─ A. 概念卡片重复修复: 相同 desc → 前缀添加 title
  ├─ B. 公式缺失智能修复:
  │     - concept: 从 cards.desc 提取公式
  │     - case: 从 scenarios 提取公式
  │     - summary: 从 keyPoints 提取公式
  │     - formula: mainFormula/derivation 兜底填充
  │     - 最多 3 条，去重
  └─ C. 创作指引混入修复:
        - 正则过滤指令性前缀（"必须"、"严禁"、"请"、"强调"...）
        - 过滤设计说明类文本
        - 过短或不洁文本 → fallback 替换
  │
  ▼
二次校验: 公式关键词页面强制兜底
  │ 若仍无公式 → 注入 placeholder (focus/notes 文本提取)
  │
  ▼
Per-page CONTENT_SCHEMAS 校验 + autoFixContent()
  │ schema 失败 → autoFixContent() → 重校验
  │ 仍失败 → 返回错误（不再 fallback）
  │
  ▼
输出 SectionOutput
```

### 6.4 公式输出规则（硬规则）

| 页型 | 公式字段 | 说明 |
|------|---------|------|
| formula | `mainFormula` (主公式) + `derivation` + `application` | 整页展示单一公式，禁止 `formulas` |
| concept/case/summary | `formulas[]` (可选，最多 3 条) | 辅助公式，每条 `{ label, latex }` |

触发关键词：反应式、方程式、公式、化学式、总反应、电极反应、电势、能斯特、半反应、氧化还原、浓度商、吉布斯、自由能

### 6.5 严格失败策略

任何 Section 生成失败直接 throw，不再 fallback。失败原因记录到日志，前端展示错误信息。

### 6.6 实现文件

| 文件 | 职责 |
|------|------|
| `lib/slides/agent/section-agent.ts` | Section 内容生成、多层校验、自动修复 |
| `lib/slides/agent/content-schemas.ts` | 14 种页型 Zod Schema + autoFix + LaTeX/Unicode 转换 |

---

## 七、Phase 3: Page Design Agent

### 7.1 职责

接收单页 content JSON + DesignDNA，输出该页的渲染指令序列（JSON 格式，非 JS 代码）。

### 7.2 输出格式

```json
{
  "pageNum": 5,
  "instructions": [
    { "op": "setBackground", "params": { "color": "1A2744" } },
    { "op": "addText", "params": { "text": "...", "x": 0.8, "y": 0.5, "w": 11.7, "h": 0.7, "fontSize": 34, "fontFace": "...", "color": "FFFFFF", "bold": true, "align": "left" } },
    { "op": "addShape", "params": { "type": "RECTANGLE", "x": 1, "y": 1, "w": 3, "h": 2, "fillColor": "722ED1", "fillTransparency": 90 } },
    { "op": "addFormula", "params": { "latex": "\\int_a^b f(x)dx", "x": 1, "y": 2, "w": 8, "h": 0.8, "fontSize": 16, "color": "1E293B" } },
    { "op": "addTable", "params": { "headers": ["A","B"], "rows": [["1","2"]], "x": 0.8, "y": 2, "w": 11.7, "headerBgColor": "...", "borderColor": "..." } },
    { "op": "addChart", "params": { "chartType": "BAR", "data": [...], "x": 1, "y": 2, "w": 5, "h": 3 } } },
    { "op": "addImage", "params": { "path": "/temp/...", "x": 1, "y": 1, "w": 3, "h": 2 } }
  ]
}
```

### 7.3 公式渲染硬规则

- 数学公式、化学方程式 **必须用 `addFormula` 指令**，严禁用 `addText` 塞 LaTeX 文本
- 严禁使用 `[Formula]` 等占位符文本
- `formulas` 数组每个元素必须生成对应的 `addText(label) + addFormula(latex)` 指令
- 文本中的数学表达式必须提取并生成 `addFormula`
- LaTeX 正确使用 `^` 上标和 `_` 下标：`Zn^{2+}`、`H_2O`
- 流程步骤间禁止使用 `addText` 输出孤立的 "→" 符号，步骤连接通过 `addShape(LINE)` 实现

### 7.4 Fallback 布局生成器

任何 LLM 输出失败（JSON 解析失败、Schema 校验失败、异常）时，自动使用 `buildFallbackPageInstructions()` 生成兜底布局：

- cover/chapter/end/toc/table/formula：专用兜底布局
- 其他页型：通用布局（标题 + 正文提取 + 装饰形状）

### 7.5 指令自动修复

`tryRepairInstructions()` 处理常见 LLM 输出问题：

- 颜色值去除 `#` 前缀
- 数值字段强制转为 number
- 坐标 clamp 到安全范围 (x,y: 0-10; w,h: 0.1-13.3)
- 布尔字段字符串转 boolean

### 7.6 Token 预算按页型分配

| 页型 | maxOutputTokens |
|------|----------------|
| cover, toc, end, chapter | 4096 |
| concept, case, compare, process, timeline, summary, quiz | 6144 |
| table, formula | 8192 |

### 7.7 实现文件

| 文件 | 职责 |
|------|------|
| `lib/slides/agent/page-design-agent.ts` | 页面设计 Agent、fallback 生成器、指令修复 |
| `lib/slides/agent/instruction-executor.ts` | 7 种指令的 Zod Schema + 安全执行引擎 |

---

## 八、Phase 4: QA & Repair

### 8.1 三层质检架构

```
Layer 1: structuralQA() — 代码层，<0.1s
  │ 门禁作用
  ├─ 有 high 级问题 → 直接进修复
  └─ 通过 → 启动 Layer 2
       │
       ▼
  Layer 2: contentQA() — LLM 层，~5s
    输入每页内容摘要，检查跑题/重复/逻辑递进/难度匹配
    │
    ▼
  合并问题清单 → 判分
```

**注**: Layer 3（视觉质检，SubAgent 看图）已预留接口，当前未实现。

### 8.2 Layer 1: structuralQA 检查项

| 检查类别 | 具体项 |
|----------|--------|
| 结构完整性 | cover 在第 1 页、end 在最后一页、toc 存在、chapter 分布合理 |
| 页码连续性 | pageNum 连续不跳号 |
| 内容非空 | 无空 content、无空 title |
| 重复检测 | 无重复卡片、无重复页面 |
| 公式完整性 | 含公式关键词的页面有 formulas/mainFormula |
| 孤儿指令 | 无未使用的 contentOutline 或创作指引残留 |
| 设计 DNA 一致性 | 颜色值在预定义范围内 |

### 8.3 Layer 2: contentQA 判定标准

- `totalScore ≥ 75` + 无 high 级问题 + medium < 3 → **pass**
- LLM 失败时 contentScore 默认 30（低于及格线），不盲信

### 8.4 修复策略

当前实现采用**单轮自动修复**：

- 结构问题（missing_cover/end/title/formula/orphan/duplicate）→ 代码层自动修复
- 内容问题 → 标记在 QA Report 中，不触发重生成（避免无限循环）

### 8.5 实现文件

| 文件 | 职责 |
|------|------|
| `lib/slides/agent/qa-agent.ts` | structuralQA + contentQA + 修复逻辑 |

---

## 九、Phase 5: Merge & Preview

### 9.1 合并流程

```
N 页 PageInstructions
  │
  ▼
new pptxgen() — LAYOUT_WIDE (13.33" × 7.5")
  │
  ▼
for each page:
  pres.addSlide()
  instructionExecutor.execute(slide, pres, instructions, pageNum)
  │  单指令失败 → 记录错误，继续下一指令（不崩溃整页）
  │
  ▼
pres.writeFile() → .pptx
  │
  ▼
LibreOffice headless → PNG 预览图（每页一张）
```

### 9.2 Instruction Executor 安全机制

- 每条指令 Zod Schema 校验，未知 op 跳过 + 日志
- `addText` 过滤：孤立箭头符号、placeholder 文本、设计指引泄漏
- `addImage`/`setBackground` 路径安全校验（禁止 `..` traversal）
- `addFormula`: LaTeX → OMML (`latex-to-omml.ts`)，失败 fallback 到 Unicode 文本
- `addText` 行内 LaTeX 自动转 Unicode，防泄漏

### 9.3 实现文件

| 文件 | 职责 |
|------|------|
| `lib/slides/agent/instruction-executor.ts` | 指令执行引擎 |
| `lib/slides/agent/png-converter.ts` | LibreOffice PNG 转换 |
| `lib/export/latex-to-omml.ts` | LaTeX → OMML 转换 |

---

## 十、Design DNA 系统

### 10.1 色板（12 套）

| ID | 名称 | 氛围 |
|----|------|------|
| midnight-executive | 商务专业 | 深色底 + 金色强调 |
| forest-moss | 自然清新 | 绿色系 |
| coral-energy | 活力热情 | 橙红色系 |
| warm-terracotta | 温暖人文 | 土橙色系 |
| ocean-gradient | 科技冷静 | 蓝色系 |
| charcoal-minimal | 极简现代 | 灰白系 |
| teal-trust | 可信稳重 | 青色系 |
| berry-cream | 优雅柔和 | 粉紫系 |
| sage-calm | 平静治愈 | 鼠尾草绿 |
| cherry-bold | 醒目大胆 | 深红色系 |
| classical-chinese | 中式古典 | 深红 + 金色 |
| tech-dark-cn | 科技深邃 | 深蓝 + 紫色 |

### 10.2 字体配对（5 套）

| ID | 标题字体 | 正文字体 | 英文字体 |
|----|---------|---------|---------|
| georgia-calibri | Microsoft YaHei | Microsoft YaHei | Georgia |
| impact-arial | SimHei | Microsoft YaHei | Impact |
| noto-sans | Noto Sans SC | Noto Sans SC | Calibri |
| lora-inter | SimSun | Microsoft YaHei | Lora |
| pt-serif | SimHei | SimSun | PT Serif |

### 10.3 Motif（装饰母题）

- `geometric-lines`: 几何线条
- `ink-wash`: 水墨渲染
- `neon-grid`: 霓虹网格
- `organic-circles`: 有机圆形
- `chinese-seal`: 中式印章

### 10.4 校验与兜底

`validateDesignDNA()`: 逐字段 Zod 校验 + 自动替换非法值：

- 色板值不在预定义范围 → 替换为默认色板
- 字体不在配对表 → 替换为 `georgia-calibri`
- motif 非法 → `geometric-lines`
- 字段缺失 → 默认 DesignDNA 补全
- replacementCount > 3 → 标记降级

### 10.5 实现文件

| 文件 | 职责 |
|------|------|
| `lib/slides/agent/design-dna.ts` | 12 套色板 + 5 套字体 + motif 规则 + 校验逻辑 |

---

## 十一、API 端点设计

### 11.1 POST /api/sky/slides/suggest-cover

Smart Cover 推荐。返回推荐封面 + 3 个备选方向。

```typescript
Body: { topic: string, difficulty: string, model?: string }
Response: {
  cover: { pngUrl: string, designDNA: DesignDNA },
  alternatives: AlternativeDirection[]
}
```

### 11.2 POST /api/sky/slides/generate-covers

生成 12 套封面画廊。

```typescript
Body: { topic: string, difficulty: string, model?: string }
Response: {
  covers: [{ id, styleName, pngUrl, recommended, designParams: DesignDNA }]
}
```

### 11.3 POST /api/sky/slides/generate

启动完整生成 Pipeline。异步执行，前端轮询进度。

```typescript
Body: {
  topic: string,
  difficulty: string,
  designDNA: DesignDNA,
  minPages?: number,  // default 15
  maxPages?: number,  // default 25
  model?: string
}
Response (202): { jobId: string, status: 'planning' }
```

**服务端保护**：
- JWT 鉴权
- IP 级别速率限制
- 最大并发 Job 数: 5
- topic 长度限制: ≤100 字符
- 页数范围: 1-60，minPages ≤ maxPages

### 11.4 GET /api/sky/slides/generate/status

```typescript
Query: { jobId: string }
Response: { job: JobState }
```

Job 不存在时返回 404（可能已过期或从未存在）。

### 11.5 Pipeline Stage 映射

| stage | progress | 典型耗时 | 文案示例 |
|------|:--:|------|------|
| planning | 0-15% | 3-8s | "正在规划课程大纲..." |
| sections_generating | 15-40% | 5-10s | "第 2 章内容生成中..." |
| pages_designing | 40-75% | 10-20s | "正在渲染 12/15 页..." |
| qa_reviewing | 75-85% | 5-8s | "正在质检课件质量..." |
| repairing | 85-90% | 2-5s | "发现 2 个问题，修复中..." |
| merging | 90-95% | <1s | "正在合并课件..." |
| done | 100% | — | "课件生成完毕 ✅" |

---

## 十二、前端状态机

### 12.1 状态流转

```
EMPTY → SMART_COVER_LOADING → SMART_COVER_PREVIEW
  │                              │
  │ (点击快捷主题/输入生成)        │ (点击"查看更多")
  │                              ▼
  │                         COVER_GALLERY_LOADING → COVER_GALLERY
  │                              │                      │
  │                              │ (选择封面确认)         │ (点击"使用推荐")
  │                              └──────────────────────┘
  │                                         │
  │                                         ▼
  │                              GENERATING → PREVIEW
  │                                 │           │
  │                                 └→ ERROR ←──┘ (重新生成)
  │
  └────────────────────────────────────────────── (修改主题)
```

### 12.2 各状态定义

| 状态 | UI | 用户可操作 |
|------|----|-----------|
| EMPTY | 全屏居中：标题 + 说明 + 快捷主题 pills | 输入主题、选学段、点击快捷主题 |
| SMART_COVER_LOADING | 全屏加载动画（阶段文案） | 不可操作 |
| SMART_COVER_PREVIEW | 中央封面大图 + 右侧备选列表 + 底部操作栏 | 切换备选、确认使用、查看更多 |
| COVER_GALLERY_LOADING | 全屏加载动画 | 不可操作 |
| COVER_GALLERY | 12 宫格封面画廊 | 浏览、选中、确认/取消 |
| GENERATING | 顶部进度条（stage + progress + message） | 不可发起新生成 |
| PREVIEW | 左侧缩略图栏 + 中央大图 + 底部操作栏 | 翻页、下载、重新生成、修改主题 |
| ERROR | 错误提示 + 重试/返回按钮 | 重试、返回 |

### 12.3 前端组件结构

```
slides-page.tsx (主协调器, 682 行)
  ├── ControlBar (条件渲染: hasContent 时显示)
  │     ├── 学段 Toggle (初中/高中/大学)
  │     ├── 主题输入框 (Search icon + input, flex gap-2)
  │     └── 生成按钮 + Sidebar 切换
  ├── EmptyState (无内容时全屏显示)
  │     ├── 标题 + 说明
  │     └── 快捷主题 pills (勾股定理、牛顿定律、光合作用、唐诗宋词)
  ├── SmartCover (SmartCover 推荐结果)
  ├── GeneratingState (生成中进度展示)
  ├── PreviewPane (生成完成预览)
  │     ├── Sidebar (缩略图列表)
  │     ├── MainView (大图)
  │     └── Footer (下载/重生成/修改主题)
  └── CoverGalleryModal (12 宫格画廊弹窗)
```

### 12.4 布局细节

- 页面通过 `-mx-6 -my-6` 抵消 `SkyAppShell` main 的 `px-6 py-6`，实现**全 bleed 无边距**
- ControlBar 无背景色，仅 `border-b` 分隔线
- 最小字体 12px，统一 `rounded-lg`，仅保留必要 hover 过渡 (0.15s)
- purple-primary `#722ed1`

### 12.5 Hydration Mismatch 防护

```typescript
// page.tsx (两个路由相同)
'use client';
const SlidesPage = dynamic(() => import('@/components/sky/slides/slides-page'), {
  ssr: false,
});
```

- `'use client'` + `dynamic({ ssr: false })` 让 SlidesPage **完全客户端渲染**
- 避开 Turbopack Windows 缓存滞后导致的 hydration mismatch

### 12.6 轮询 Hook

```typescript
// useJobPolling.ts
startPolling(jobId, {
  onStageUpdate: (stage, progress, message) => {...},
  onComplete: (result: { pptxUrl, fileName, previewImages, qaReport }) => {...},
  onError: (error) => {...},
});
// 轮询间隔: 2s
// 最大连续错误: 5 次 → 停止轮询并报错
```

### 12.7 实现文件

| 文件 | 职责 |
|------|------|
| `app/sky/slides/page.tsx` | 路由包装器（ssr: false） |
| `app/sky/cloud-mind/slides/page.tsx` | 同上 |
| `components/sky/slides/slides-page.tsx` | 主协调器、状态机 |
| `components/sky/slides/states/empty-state.tsx` | 空状态 |
| `components/sky/slides/hooks/use-job-polling.ts` | Job 轮询 Hook |

---

## 十三、关键技术细节

### 13.1 并发控制

| 阶段 | 并发限制 | 实现 |
|------|---------|------|
| Layer 2 页面规划 | 12 | `withConcurrencyLimit()` |
| Section Agent | 12 | `withConcurrencyLimit()` |
| Page Design Agent | 8 | `withConcurrencyLimit()` |
| 封面生成 (12 套) | 6 | 内部 `concurrencyLimit()` |
| LibreOffice PNG 转换 | 3 | `Semaphore` 信号量 |
| 最大并发 Job | 5 | API 层硬限制 |

`withConcurrencyLimit()`: 工作者池 + 每项 10min 硬超时 + 交错启动（避免服务商队列饱和）。

### 13.2 Job 状态管理

- 存储: `globalThis.__pptJobs`（内存 Map）
- 自动清理: 10 分钟后删除
- 服务重启丢失 → 前端轮询 404 → 提示用户重新生成
- Job Stage: `planning` → `sections_generating` → `pages_designing` → `qa_reviewing` → `repairing` → `merging` → `done`

### 13.3 封面渲染器布局类型

`cover-renderer.ts` 支持 12 种布局：

1. `hero-centered` — 居中巨大标题 + 装饰围绕
2. `hero-left` — 左对齐文本 + 右侧装饰
3. `split-panel` — 左半深色面板 + 右半浅色
4. `big-number` — 超大数字/公式占视觉重心
5. `vertical-poem` — 竖排中文，中式书封感
6. `corner-drama` — 装饰集中一角
7. `frame-border` — 细边框包裹
8. `minimal-type` — 纯排版无形状
9. `bold-accent` — 顶部粗色带
10. `gradient-wash` — 柔和渐变底
11. `double-stripe` — 上下平行线夹标题
12. `image-zone` — 右侧图区占位

### 13.4 页型体系（14 种）

**结构页**: cover, toc, end
**章节过渡**: chapter
**内容页**: concept, case, compare, process, table, formula, timeline
**互动/总结**: summary, quiz

页型选择通过 `page-type-selector.ts` 实现 topic-aware 白名单：
- 数学 → formula > case > concept
- 物理 → formula > case > concept
- 化学 → formula > case > table
- 生物 → concept > compare > process
- 历史 → timeline > compare > concept
- 文学 → concept > compare > case
- 计算机 → process > case > table

### 13.5 内容 Schema 自动修复

`content-schemas.ts` 中的 `autoFixContent()`:

- 截断超长字符串至 Schema 限制
- 填充缺失字段（空字符串 / 空数组 / 默认值）
- 数组去重、长度 clamp 到范围
- `deepRepairContent()`: 类型强制转换、嵌套对象修复、表格行展开

### 13.6 LaTeX / Unicode 转换工具

| 函数 | 用途 |
|------|------|
| `convertInlineLatexToUnicode()` | 化学式/电荷/下标/上标 Unicode 转换 |
| `unicodeMathToLatex()` | Unicode → LaTeX 反向转换 |
| `cleanJsonText()` | 去除 markdown fences、尾随逗号、注释、单引号修复、JSON 截断修复 |
| `extractFormulasFromText()` | 从文本中提取数学表达式 |

### 13.7 PNG 转换稳定性

`png-converter.ts`:

- LibreOffice 路径自动发现（Windows/macOS/Linux）
- `-env:UserInstallation=file:///` 隔离每个进程，防止 profile 损坏
- 信号量限制 3 并发
- 2 次重试 + 2s 退避
- 15s 超时 + SIGKILL

### 13.8 日志与调试

所有 Agent 使用统一日志系统 (`createLogger`)：

- 日志标识: `PlanningAgent`, `SectionAgent`, `PageDesignAgent`, `QAAgent`, `CoverAgent`, `SuggestCoverAgent`, `CoverRenderer`, `PngConverter`
- 关键阶段记录耗时（ms）
- Cover Agent 调试日志写入 `logs/cover-agent-{slot}-{timestamp}.txt`

---

## 十四、文件目录总览

```
lib/slides/agent/
├── pipeline.ts              # Pipeline 编排器（Job 管理 + Stage 推进）
├── planning-agent.ts        # Planning Agent（Layer 1/2 + Merge）
├── section-agent.ts         # Section Agent（内容生成 + 多层修复）
├── page-design-agent.ts     # Page Design Agent（JSON 指令 + Fallback）
├── qa-agent.ts              # QA Agent（结构质检 + 内容质检 + 修复）
├── design-dna.ts            # 设计 DNA（12 色板 + 5 字体 + 校验）
├── content-schemas.ts       # 14 种页型 Schema + 自动修复 + LaTeX 工具
├── instruction-executor.ts  # 指令执行引擎（7 种指令 + 安全校验）
├── cover-agent.ts           # 12 套封面生成（Salvage + Topic-aware）
├── suggest-cover-agent.ts   # Smart Cover 推荐（单 LLM 调用）
├── cover-renderer.ts        # 封面渲染器（12 种布局）
├── png-converter.ts         # LibreOffice PNG 转换（信号量 + 重试）
├── page-type-selector.ts    # Topic → 学科推断 → 页型白名单
├── concurrency.ts           # 通用并发限制器

app/api/sky/slides/
├── suggest-cover/route.ts       # POST Smart Cover 推荐
├── generate-covers/route.ts     # POST 12 套封面画廊
├── generate/route.ts            # POST 启动 Pipeline
└── generate/status/route.ts     # GET Job 状态查询

components/sky/slides/
├── slides-page.tsx            # 主协调器
├── states/
│   ├── empty-state.tsx        # 空状态
│   ├── smart-cover.tsx        # Smart Cover 预览
│   ├── generating-state.tsx   # 生成中
│   └── preview-pane.tsx       # 预览面板
├── cover-gallery-modal.tsx    # 12 宫格画廊弹窗
└── hooks/
    └── use-job-polling.ts     # Job 轮询
```

---

## 十五、演进记录

### 2026-05-26 — v1.0 初版架构设计

- 确定四层 Agent 架构（Planning → Section → Page Design → QA）
- 确定 14 种页型体系
- 确定 DesignDNA Schema
- 确定封面画廊方案

### 2026-05-30 — v2.0 实现对齐

- **Smart Cover 推荐** 从概念变为独立 API (`suggest-cover-agent.ts`)
- **Planning Agent** 明确为两层（Layer 1 骨架 + Layer 2 详情），并发=12
- **Section Agent** 补充多层自动修复细节（公式缺失、创作指引过滤、卡片去重）
- **Page Design Agent** 输出从 JS 代码改为 JSON 指令，补充 fallback 生成器和指令修复
- **QA Agent** 明确当前为两层（Layer 3 视觉预留），补充具体检查项和判分标准
- **前端状态机** 完全重写：移除 SlidesHeader/SkyBackground、ControlBar 去背景化、EmptyState 简化、单行一体化输入框、全 bleed 布局
- **并发参数** 确定：sections=12, pageDesign=8, LO=3, maxJobs=5
- **Job 管理** 明确内存 Map + 10min 自动清理
- **设计 DNA** 更新为 12 套色板 + 5 套字体 + topic-aware motif 分配
- **API 路由** 统一为 `/api/sky/slides/...`
- **Hydration 防护** 采用 `'use client'` + `dynamic({ ssr: false })`
