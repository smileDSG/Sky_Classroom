# PPT Agent 架构设计文档

> 状态: 讨论中 | 日期: 2026-05-26

## 一、项目愿景

将现有的 PPT 生成功能模块重构为一个**能力强大的 PPT 生成 Agent 系统**，具备：

1. **灵活的页级规划** — 页数、页型、顺序由 LLM 动态决定，不再受固定 7 页模板限制
2. **并行生成** — 多 Agent 并发生成不同页面，大幅提升生成速度
3. **质量闭环** — 生成 → 质检 → 修复，确保输出质量达标
4. **可独立部署** — 后期可从此项目剥离为独立 Agent 项目

## 二、整体架构

```
用户输入 (topic + difficulty)

        ▼
┌─────────────────────────────────────────┐
│  Phase 0: 封面画廊（本次交互）            │
│  LLM 生成 12 套封面设计参数                │
│  → pptxgenjs 渲染 → LibreOffice → PNG    │
│  → 用户从画廊选 1 套                      │
└─────────────────────────────────────────┘
        ▼
┌─────────────────────────────────────────┐
│  Phase 1: Outline Planner Agent         │
│  规划详细页级大纲                          │
└─────────────────────────────────────────┘
        ▼
┌─────────────────────────────────────────┐
│  Phase 2: Parallel Page Agents          │
│  多 Agent 并发生成各页内容                 │
└─────────────────────────────────────────┘
        ▼
┌─────────────────────────────────────────┐
│  Phase 3: Assembly & Render             │
│  内容合并 + pptxgenjs 整件渲染             │
└─────────────────────────────────────────┘
        ▼
┌─────────────────────────────────────────┐
│  Phase 4: QA & Repair Loop              │
│  质检 → 修复 → 再检，直到达标              │
└─────────────────────────────────────────┘
        ▼
    输出 PPTX + LibreOffice → PNG 预览
```

## 三、Phase 0: 封面画廊（已定案）

### 3.1 数据流

```
POST /api/slides/generate-covers
Body: { topic: "勾股定理", difficulty: "高中" }

    ▼
Step A: LLM 生成 12 套封面设计参数（1 次调用，3-8s）
    System Prompt 注入 pptx skill 设计规范
    输出 12 套 JSON: { colors, fonts, decoration, layout, styleName, recommended }

    ▼
Step B: pptxgenjs 渲染 12 个单页 PPTX（全并行，<1s）
    每套参数 → 1 个 .pptx（只含封面页）

    ▼
Step C: LibreOffice headless → 12 个 PNG（全并行，3-6s）
    12 个独立 LibreOffice 进程，1920×1080，144 DPI

    ▼
Response: { covers: [{ id, styleName, pngUrl, recommended, designParams }] }
总耗时: ~8-15s
```

### 3.2 前端加载动画

三阶段进度指示器（非精确百分比，阶段过渡）：

```
┌─────────────────────────────────────────┐
│    ✨ 正在为"勾股定理"设计封面            │
│                                         │
│    ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●     │
│   分析主题      设计风格      渲染预览    │
│   (进行中)      (等待中)      (等待中)   │
│                                         │
│   AI 正在结合学科特点匹配最佳视觉风格     │
└─────────────────────────────────────────┘
```

| 阶段 | 文案 | 后端动作 | 耗时 |
|------|------|----------|------|
| 分析主题 | "AI 正在分析'勾股定理'的学科特点…" | LLM 生成 12 套设计参数 | 3-8s |
| 设计风格 | "正在渲染 12 种封面风格…" | pptxgenjs 批量渲染 | <1s |
| 渲染预览 | "即将呈现封面画廊…" | LibreOffice 转 PNG | 3-6s |

### 3.3 封面画廊 UI

12 宫格排列，第 1 个标记"推荐"并高亮，用户点击选择后确认，进入完整生成流程。

---

## 四、决策记录

### D-001: 页面生成方案（2026-05-26）

**决策**：AI 动态生成封面 → 用户选风格 → 锁定设计参数全链路渲染。完全舍弃旧的 12 个固定 PPTX 模板。

**核心链路**：

```
用户输入 topic（如"勾股定理"）
    │
    ▼
Step A: 1 次 LLM 调用 → 生成 12 套封面设计参数
    │  每套包含: { 色板, 字体, 装饰motif, 布局方式, 风格名 }
    │  设计约束来源: pptx skill 的 10 套色板 + 字体配对表 + 设计铁律
    │
    ▼
Step B: 12 套参数 → pptxgenjs 纯代码渲染 12 个封面缩略图（毫秒级，不调 LLM）
    │
    ▼
Step C: 用户从画廊选 1 套 → 锁定该套的设计参数为全链路"设计 DNA"
    │
    ▼
Step D→E: 大纲 Agent + Page Agent 全部注入同一套设计 DNA
```

**与旧方案的本质区别**：

| | 旧方案 | 新方案 |
|---|---|---|
| 12 个选项 | 12 个固定 PPTX 文件，所有 topic 看到同样的封面 | AI 每次针对具体 topic 生成 12 个封面。勾股定理和荷塘月色看到的封面完全不同 |
| 选中后 | 固定 7 页序列，Python 按 shape_idx 填文本 | 大纲 Agent 自由规划页数页型，pptxgenjs 代码渲染每页 |
| 风格如何适配 topic | 不匹配——同一个"科技风"模板给电路和给古文用一样的设计 | LLM 根据 topic 实时诠释：古典风 × 数学 = 弦图+隶书，古典风 × 文学 = 荷花+行楷 |

**视觉底层如何实现（不需要多模态 LLM）**：

| 视觉需求 | 实现方式 |
|----------|----------|
| 几何装饰（线条、圆形、网格） | pptxgenjs 原生形状 |
| 图标 | react-icons → SVG → PNG → 嵌入 PPT |
| 数据图表 | pptxgenjs 内置 chart |
| 公式 | LaTeX → mathml2omml |
| 照片（可选增强） | 图片生成 API，非核心依赖 |

### D-002: 封面画廊实现方案（2026-05-26）

- **封面渲染**: pptxgenjs 代码渲染 → LibreOffice headless → PNG，不用 Canvas
- **转换工具**: LibreOffice 26.2，输出 1920×1080/144 DPI，质量已验证
- **并发**: 12 个 pptxgenjs 并行渲染，12 个 LibreOffice 进程并行转换
- **总耗时**: ~8-15s（LLM 3-8s + 渲染 <1s + 转换 3-6s）
- **加载动画**: 三阶段进度指示器 + 动态文案，非精确百分比

---

## 五、待决策事项

### Q2: 并行粒度？ ✅ 已决策

**决策**：按章节模块分组（方向 B）。

大纲 Agent 将整个 PPT 切分为 3-5 个章节模块，每个模块交给一个 Section Agent 独立生成该章节的完整内容（过渡页 + 概念页 + 案例页 + ...）。

**决策理由**：
- 同一模块内的过渡页和内容页由同一个 LLM 调用生成，天然保证页间逻辑一致性，不需要信任 Agent 会遵守外部上下文
- 并发数适中（3-5 个），不被限流
- 每个 Agent 只需要知道自己负责的章节，不需要全局上下文

**各方案对比**：

| | 方案 1：逐页并发 | 方案 2：章节模块 ✅ | 方案 3：按页型分组 |
|---|---|---|---|
| 并发数 | 15-20 个 | 3-5 个 | 5-8 个 |
| 跨页一致性 | 弱 | 强（同一 LLM 调用） | 弱（跨 Agent 无共享上下文） |
| 速度 | 最快 | 较快 | 中等 |
| 页间逻辑 | 无协调 | 天然连续 | 需额外上下文注入 |

### Q2: 并行粒度？ ✅ 已决策

**决策**：章节模块并发 × 页面设计全并发。

**三层 Agent 架构**：

```
规划 Agent（1 次 LLM）
    │  输入: topic + difficulty + 设计 DNA
    │  输出: 页级大纲，按 Section 分块
    │  [{ section:1, pages:[{num:1,type:"cover"}, {num:2,type:"toc"}] },
    │   { section:2, pages:[{num:3,type:"chapter"}, {num:4,type:"concept"}, ...] }]
    │
    ▼
章节 Agent × 3-5（并发）
    │  输入: 所在 Section 的页级大纲 + 设计 DNA
    │  输出: 按页结构化的纯内容 JSON
    │  { sectionId, pages: [{ pageNum, pageType, content: {...} }, ...] }
    │
    ▼
页面设计 Agent × N（全并发，N = 总页数）
    │  不需要额外"拆页处理器"——Section Agent 输出本身按页组织
    │  输入: 单页内容 + 设计 DNA + pptxgenjs API 参考
    │  输出: 该页 renderCode（pptxgenjs 代码片段）
    │
    ▼
合并执行: N 段 renderCode → pptxgenjs 顺序渲染 → 完整 PPTX
```

**并发量分析**：DS v4 Pro 并发上限 500，本架构峰值并发 ~25 个（1 规划 + 5 章节 + 20 页面设计），远未触及瓶颈。

### Q3: 质检标准 & 修复闭环 ✅ 已决策

**决策**：三层质检 + 两轮全量修复 + 兜底降级。

#### 质检三层的执行顺序

```
Layer 1（结构质检，代码层，<0.1s）
    │  门禁作用
    │
    ├─ 有 high 级问题 → 跳过 Layer 2/3，直接进修复
    │
    └─ 通过 → Layer 2 和 Layer 3 并行启动
              ├─ Layer 2（内容质检，1 次 LLM，~5s）
              └─ Layer 3（视觉质检，SubAgent 看图，~5s）
            │
            ▼
        合并问题清单 → 判分
```

#### Layer 1: 结构质检（代码，0 LLM）

检查项：renderCode 是否为空、content.title 是否为空、pageType 与 content 结构匹配、元素坐标在画布内、设计 DNA 一致性、cover 是否在第 1 页、end 是否在最后 1 页、pageNum 连续不跳号。

#### Layer 2: 内容质检（1 次 LLM）

输入每页内容摘要（非全文，节省 token），检查维度：跑题、重复、逻辑递进、目录对应、难度匹配。输出 `{ contentScore, issues }`。

#### Layer 3: 视觉质检（SubAgent 看图）

LibreOffice 渲染 PNG → SubAgent 逐张检查：文字溢出、元素重叠、对比度不足、间距不均、对齐偏差。

#### 修复循环

```
Round 0: 初始生成 → 合并
    │
    ▼
QA（Layer 1 门禁 → Layer 2 + 3 并行）
    │
    ├─ pass → 输出 PPTX ✅
    │
    └─ 未通过 → 修复 Round 1
                  │
                  所有问题（high/medium/low）全部并发修复
                  内容问题 → 重调该页所属 Section Agent
                  布局问题 → 重调该页页面设计 Agent
                  │
                  ▼
                  重新合并 → QA
                  │
                  ├─ pass → 输出 ✅
                  │
                  └─ 未通过 → 修复 Round 2（最后一轮）
                                │
                                所有剩余问题再次全部并发修复
                                │
                                ▼
                                重新合并 → 最终 QA
                                │
                                ├─ pass → 输出 ✅
                                │
                                └─ 未通过 → 输出 + 降级兜底
```

#### 两轮修复失败后的兜底

| 问题类型 | 兜底策略 |
|----------|----------|
| 内容问题（跑题/重复/深度不足） | 整页放弃，替换为"标题 + 此页内容需人工补充"占位页 |
| 视觉问题（溢出/重叠/对比度） | 回退到最简布局：标题居中 + 正文左对齐 + 无装饰 |

输出附带 QA 报告，标记降级和兜底页面，前端展示时提示用户手动编辑。

### Q4: 页面类型体系 ✅ 已决策（初版，保留扩展空间）

**决策**：14 种页型，分为四类。规划 Agent 依据硬规则 + 软规则自动选择。

#### 页型目录

**结构页（每份 PPT 必有）**：

| 页型 | 内容 Schema | 教学角色 |
|------|-------------|----------|
| `cover` | `{ title, subtitle, tagline }` | 课程封面 |
| `toc` | `{ items: [{ num, title, desc }] }` | 学习导航 |
| `end` | `{ slogan, subtitle, thanks }` | 收尾 |

**章节过渡页**：

| `chapter` | `{ num, title, subtitle, preview }` | 章节引入 |

**内容页**：

| 页型 | 内容 Schema | 适用场景 |
|------|-------------|----------|
| `concept` | `{ title, cards: [{ title, desc }], summary }` | 多概念并列讲解 |
| `case` | `{ title, scenarios: [{ problem, solution }], highlight }` | 例题/案例 |
| `compare` | `{ title, left: {...}, right: {...}, conclusion }` | 对比分析 |
| `process` | `{ title, steps: [{ num, title, desc }] }` | 步骤/流程 |
| `table` | `{ title, headers, rows, summary }` | 数据对比表 |
| `formula` | `{ title, mainFormula, derivation, application }` | 公式推导 |
| `timeline` | `{ title, events: [{ date, content }] }` | 历史/发展脉络 |

**互动/总结页**：

| `summary` | `{ title, keyPoints, preview }` | 章末总结 |
| `quiz` | `{ title, questions: [{ q, options, answer }] }` | 课堂练习 |

#### 页型选择规则

**硬规则（代码约束，不靠 LLM）**：
- cover 永远是第 1 页，end 永远是最后 1 页
- toc 紧跟 cover
- chapter 必须在其所属内容页之前

**软规则（注入规划 Agent system prompt）**：
- 学科偏好：数理多用 formula/case，文史多用 timeline/compare，生物地理多用 concept/process
- 学段适配：初中少推导多案例，高中均衡，大学深度优先
- 递进规则：concept 在 case 之前，避免连续 3+ 页同类型
- summary 放在章节末尾

#### 扩展设计

页型体系通过 `pageTypeRegistry`（TypeScript enum + zod schema）集中管理，规划 Agent prompt 中的页型列表从 registry 动态生成。新增/废弃页型只需修改 registry，prompt 自动同步。

### D-003: 设计 DNA Schema（2026-05-26）

**定位**：LLM 在约束框架里做选择题，不是任意设计。

```typescript
interface DesignDNA {
  styleName: string;           // "古典中式"、"科技深色"

  colors: {
    coverBg: string;            // 封面底色
    contentBg: string;          // 内容页底色
    accent: string;             // 主强调色
    accentSecondary: string;    // 辅强调色
    accentLight: string;        // 浅变体（卡片底、半透明装饰）
    textPrimary: string;        // 标题
    textBody: string;           // 正文
    textMuted: string;          // 标签/页码
    textOnDark: string;         // 深色底上文字
  };

  fonts: {
    heading: string;            // 标题字体
    body: string;               // 正文字体
    en: string;                 // 英文/数字字体
    headingSize: number;        // 封面标题 pt
    pageTitleSize: number;      // 内容页标题 pt
    bodySize: number;           // 正文 pt
    captionSize: number;        // 标签 pt
  };

  decoration: {
    motif: string;              // 装饰母题: geometric-lines | ink-wash | neon-grid | organic-circles | chinese-seal
    density: 'sparse' | 'moderate' | 'rich';
    cornerWeight: string;       // 装饰重心位置
  };

  components: {
    cardStyle: 'accent-left-bar' | 'top-accent-border' | 'shadow-only' | 'filled-accent';
    bulletStyle: 'dot' | 'check' | 'arrow' | 'chinese-brush';
    pageNumberStyle: 'simple-number' | 'number-slash-total' | 'circle-number';
  };

  mood: string;                 // "严谨学术"、"清新自然"——LLM 理解用
  bestFor: string[];            // ["数学", "物理"]——推荐匹配用
}
```

**约束来源**：10 套预定义色板（从 pptx skill + 旧模板提取）、字体配对表、装饰 motif 目录。Cover Agent 从中选择组合，不允许自创。

## 七、API 端点设计

### 端点 1：POST /api/slides/generate-covers

用户输入 topic 后，快速返回 12 套封面画廊。

```
POST /api/slides/generate-covers
Body: { topic: "勾股定理", difficulty: "senior" }

Response (200, ~8-15s):
{
  success: true,
  covers: [
    {
      id: 1,
      styleName: "古典中式",
      pngUrl: "/temp/covers/cover-1-xxxx.png",
      recommended: true,
      designParams: { ...DesignDNA }
    },
    ...共 12 个
  ]
}
```

### 端点 2：POST /api/slides/generate

用户选中封面后，提交完整生成任务。异步执行，前端轮询进度。

```
POST /api/slides/generate
Body: { topic, difficulty, designDNA }

立即返回 202:
{ jobId: "abc123", status: "planning" }
```

### 端点 3：GET /api/slides/generate/status

```
GET /api/slides/generate/status?jobId=abc123

Response:
{
  jobId: "abc123",
  stage: "sections_generating",
  message: "第 2 章内容生成中...",
  progress: 35,
  totalPages: 15
}

// 完成时:
{
  jobId: "abc123",
  stage: "done",
  progress: 100,
  pptxUrl: "/temp/pptx/xxx.pptx",
  fileName: "勾股定理_古典中式.pptx",
  previewImages: ["/temp/preview/slide-1.png", ...],
  qaReport: { totalScore: 92, pass: true, issues: [] },
  generationTime: 42000
}
```

### 进度阶段映射

| stage | progress | 典型耗时 | 文案示例 |
|------|:--:|------|------|
| planning | 0-15% | 3-8s | "正在规划课程大纲..." |
| sections_generating | 15-40% | 5-10s | "第 2 章内容生成中..." |
| pages_designing | 40-75% | 10-20s | "正在渲染 12/15 页..." |
| merging | 75-80% | <1s | "正在合并课件..." |
| qa_reviewing | 80-90% | 5-8s | "正在质检课件质量..." |
| repairing | 90-95% | 5-10s | "发现 2 个问题，修复中..." |
| done | 100% | — | "课件生成完毕 ✅" |

---

## 八、前端状态机

### 状态流转图

```
IDLE → COVER_LOADING → COVER_GALLERY → GENERATING → PREVIEW
                              │              │
                              └→ IDLE        └→ ERROR → IDLE
                                              └→ PREVIEW（带降级标记）
```

### 各状态定义

| 状态 | UI | 用户可操作 |
|------|----|-----------|
| IDLE | 输入框 + 学段选择 + 生成按钮 | 输入、选学段、点击生成 |
| COVER_LOADING | 三阶段加载动画，输入区锁定 | 不可操作 |
| COVER_GALLERY | 12 宫格模态弹窗 + "重新生成推荐模板"按钮 | 浏览、选中、确认/取消、刷新模板 |
| GENERATING | 顶部横幅进度条 + 阶段文案，页面其他区域可操作 | 不可发起新生成（提示等待），可浏览已有结果 |
| PREVIEW | 左侧缩略图 + 中央大图 + 底栏 | 翻页、下载、重新生成、修改主题、查看质检报告 |
| ERROR | 错误提示 + 重试/返回按钮 | 重试、返回 IDLE |

### 封面缓存

首次生成完成后，封面画廊以 `topic + difficulty` 为 key 缓存在前端内存中。

- **重新生成**（PREVIEW 底栏）→ 直接展示缓存画廊，0 秒等待，用户可重新选择风格
- **重新生成推荐模板**（COVER_GALLERY 内）→ 清除缓存，重新调 LLM 生成 12 套全新封面

### PREVIEW 功能细节

- **下载课件**：下载 .pptx 文件
- **查看质检报告**：弹窗展示总分 + 每页问题列表，点击问题条目直接切到对应页面预览
- **重新生成**：弹出缓存画廊，用户重新选风格生成
- **修改主题**：回到 IDLE，保留 topic，清空设计 DNA

### 异常处理

**COVER_LOADING 阶段**：LLM 调用失败 → 静默重试 1 次 → 仍失败进 ERROR。pptxgenjs 渲染/LibreOffice 失败同理。

**GENERATING 阶段**：任何阶段失败进 ERROR，保留 jobId 供重试。重试从失败阶段续跑（非从头开始）。并发控制：已有任务进行中时，点击生成提示"请等待当前任务完成"。

**GENERATING → PREVIEW（带降级）**：QA 两轮修复后仍有残留问题，正常进入 PREVIEW，问题页在缩略图右上角标记 ⚠️。

---

## 九、Agent Prompt 设计

### pptx Skill 内容分配表

| pptx skill 内容 | Cover | 规划 | 章节 | 页面设计 | QA |
|------|:--:|:--:|:--:|:--:|:--:|
| 10 套色板 | ✅ | | | ✅ | |
| 字体配对表 + 字号层级 | ✅ | | | ✅ | |
| 设计铁律（标题不下划线、不居中正文...） | ✅ | | | ✅ | |
| 装饰 motif 规则 | ✅ | | | ✅ | |
| 布局模式（双栏/网格/图标行...） | | ✅ | | ✅ | |
| 间距规范（边距/块间距） | | | | ✅ | |
| 数据展示规范（大数字/对比栏/时间线） | | | | ✅ | |
| 14 种页型目录 | | ✅ | ✅ | | |
| 页型 × 学科匹配偏好 + 递进规则 | | ✅ | | | |
| 每页型的内容 Schema | | ✅ | ✅ | | |
| pptxgenjs API 参考 | | | | ✅ | |
| react-icons 图标嵌入方法 | | | | ✅ | |
| QA 检查维度 + 输出格式 | | | | | ✅ |

---

### 7.1 Cover 生成 Agent

**职责**：根据 topic + difficulty，输出 12 套 DesignDNA。

**注入内容**：10 套色板 + 字体配对表 + 字号层级 + 设计铁律 + 装饰 motif 规则

**System Prompt**：

```
## 角色
你是一位资深演示设计师，为教学课件设计封面视觉方案。

## 设计规范（所有约束来自专业研究，不可违反）

[嵌入：10 套色板完整表]
[嵌入：字体配对表 + 字号层级]
[嵌入：设计铁律]
[嵌入：装饰 motif 规则]

## 任务
为以下主题设计 12 套不同风格的封面视觉方案。

规则：
1. 12 套方案必须风格差异明显，不允许 2 套共用同一色板
2. colors 所有字段必须从色板中选择，不允许自创
3. fonts 必须从配对表中选择，不允许自创
4. decoration.motif 根据学科匹配：
   - 数学/物理/编程 → geometric-lines, neon-grid
   - 语文/历史/文学 → ink-wash, chinese-seal
   - 生物/地理/生态 → organic-circles
   - 通用 → geometric-lines, organic-circles
5. cardStyle 与 decoration.motif 配套
6. 仅 1 套标记 recommended:true，必须是最匹配该学科的
7. mood 和 bestFor 必须反映真实风格和适配学科

## 输出格式
只输出纯 JSON 数组，不要 markdown 代码块：
[
  {
    "styleName": "古典中式",
    "recommended": true,
    "colors": { "coverBg":"...","contentBg":"...","accent":"...","accentSecondary":"...","accentLight":"...","textPrimary":"...","textBody":"...","textMuted":"...","textOnDark":"..." },
    "fonts": { "heading":"","body":"","en":"","headingSize":0,"pageTitleSize":0,"bodySize":0,"captionSize":0 },
    "decoration": { "motif":"","density":"moderate","cornerWeight":"top-right" },
    "components": { "cardStyle":"accent-left-bar","bulletStyle":"dot","pageNumberStyle":"number-slash-total" },
    "mood": "",
    "bestFor": []
  },
  ...共 12 套
]
```

**User Prompt**：
```
主题：{topic}
学段：{difficulty}
语言：中文

请为以上主题设计 12 套不同风格的封面视觉方案。
推荐风格应匹配 {topic} 的学科特性。
```

---

### 7.2 规划 Agent

**职责**：产出按 Section 分组的页级大纲，每页含 contentOutline。

**注入内容**：14 种页型目录 + 页型 × 学科匹配偏好 + 递进规则 + 每页型的内容 Schema

**System Prompt**：

```
## 角色
你是一位教学设计师，为课程规划幻灯片的大纲和内容要点。

## 可用页面类型
[嵌入：14 种页型目录 + 每种的内容 Schema]

## 页型选择规则
[嵌入：学科匹配偏好 + 学段适配 + 递进规则]

## 硬规则（不可违反）
- cover 永远是第 1 页，end 永远是最后 1 页
- toc 紧跟 cover
- chapter 之后必须跟 2-5 页相关内容页
- concept 必须在 case 之前
- 同一章节内避免连续 3 页以上相同页型
- summary 放在每个章节末尾

## 设计 DNA（全文链路统一）
{designDNA 完整 JSON}

## 任务
根据主题、学段和设计 DNA，规划完整的页级大纲。
按章节（Section）分组，每页输出页型、标题、内容要点（contentOutline）。

contentOutline 是将来的章节 Agent 的创作依据，必须包含：
- 该页要讲的核心知识点或案例场景
- 需要覆盖的关键概念名称
- 如果是案例页，给出具体例题类型和方向

## 输出格式
只输出纯 JSON：
{
  "sections": [
    {
      "sectionId": 1,
      "title": "章节标题",
      "pages": [
        {
          "pageNum": 4,
          "type": "concept",
          "title": "页面标题（≤10 字）",
          "contentOutline": {
            "focus": "这页要讲什么",
            "keyConcepts": ["概念1", "概念2"],
            "notes": "章节 Agent 的创作指引"
          }
        },
        ...
      ]
    },
    ...
  ]
}
```

**User Prompt**：
```
主题：{topic}
学段：{difficulty}
语言：中文
总页数建议：初中 10-14 页，高中 14-18 页，大学 18-24 页

请规划完整的页级大纲，确保内容深度递进、章节逻辑清晰。
```

---

### 7.3 章节 Agent

**职责**：接收所在 Section 的页级大纲 + contentOutline，产出每页的完整内容 JSON。不碰布局。

**注入内容**：14 种页型目录 + 每页型内容 Schema + 设计 DNA

**System Prompt**：

```
## 角色
你是一位 {difficulty} 学科教师，正在为"{sectionTitle}"章节编写课件内容。

## 设计 DNA（全文链路统一）
{designDNA 完整 JSON}

## 页面内容 Schema 参考
[嵌入：该 Section 涉及页型的内容 Schema]

## 任务
根据下面的大纲，为每一页生成完整的内容数据（纯 JSON，不含坐标和样式）。

## 重要规则
1. 严格遵循 contentOutline 的指引，不要偏离 focus/keyConcepts
2. 所有示例、案例必须真实可查，不编造
3. 卡片标题 ≤6 字，卡片描述 ≤80 字
4. 涉及公式的页面，公式必须用 LaTeX 格式
5. 内容深度匹配 {difficulty} 学段
6. 【反例警示】如果主题是 {topic}，严禁引入无关学科内容

## 输出格式
只输出纯 JSON：
{
  "sectionId": 2,
  "pages": [
    {
      "pageNum": 4,
      "pageType": "concept",
      "content": {
        "title": "...",
        "cards": [{ "title": "电流", "desc": "电荷定向移动形成的物理量..." }],
        "summary": "..."
      }
    },
    ...
  ]
}
```

**User Prompt**：
```
主题：{topic}
学段：{difficulty}
章节：{sectionTitle}（共 {sectionPageCount} 页）

## 本章大纲
{JSON：该 Section 的完整大纲，含每页 contentOutline}

请逐页生成完整内容。
```

---

### 7.4 页面设计 Agent

**职责**：接收单页的内容 JSON + DesignDNA，输出该页的 pptxgenjs renderCode。

**注入内容**：pptxgenjs API 参考 + react-icons 图标方法 + 布局模式 + 间距规范 + 设计铁律 + 10 套色板

**System Prompt**：

```
## 角色
你是一位 pptxgenjs 开发专家，将教学内容渲染为专业幻灯片页面。

## pptxgenjs API 参考
[嵌入：pptxgenjs.md 完整内容]

## 设计约束
- 画布尺寸: 13.3" × 7.5" (LAYOUT_WIDE)
- 设计铁律: [九条设计铁律]
- 当前设计 DNA: {designDNA 完整 JSON}
- 间距: 0.5" 最小边距, 0.3-0.5" 块间距
- 布局模式参考: [嵌入布局模式描述]

## 任务
为下面这一页生成 pptxgenjs renderCode。只输出这一页的代码，不要定义 pres 对象，不要调用 writeFile。

假设 pres 和 slide 已创建，你只需要写 slide.xxx() 调用。

## 代码规范
- 颜色必须从 designDNA.colors 中取
- 字体必须从 designDNA.fonts 中取
- decoration 使用 designDNA.decoration.motif 对应的形状组合
- 卡片样式使用 designDNA.components.cardStyle
- 使用 designDNA.components.bulletStyle 样式做 bullet 列表
- 所有颜色用 6 位 hex，不带 # 前缀
- 需要图标时用 react-icons + sharp 方法

## 输出格式
只输出 JavaScript 代码块：
```js
// Page {pageNum}: {pageType} — "{title}"
slide.background = { color: "{contentBg}" };
slide.addText("{title}", {
  x: 0.8, y: 0.5, w: 11.7, h: 0.7,
  fontSize: {pageTitleSize}, fontFace: "{heading}",
  color: "{textPrimary}", bold: true, margin: 0
});
...
```
```

**User Prompt**：
```
设计 DNA: {designDNA JSON}
页面类型: {pageType}
页面内容: {content JSON}
页号: {pageNum} / {totalPages}

请为此页生成 renderCode。
```

---

### 7.5 QA Agent

**职责**：质检整个 PPT 的内容和结构。

**注入内容**：QA 检查维度 + 输出格式

**System Prompt**（内容质检层）：

```
## 角色
你是教学课件质检专家。对以下 PPT 内容进行严格审查。

## 检查维度
1. 跑题检查：任何页面的内容是否偏离主题？
2. 重复检查：哪些页面之间内容重叠或互为重复？
3. 递进检查：页面之间的逻辑顺序是否合理？
   - 概念是否在案例之前讲？
   - 是否有跳跃（前一页没讲就跳到下一页）？
4. 目录检查：toc 页的条目和后续 chapter 页标题是否一一对应？
5. 难度检查：内容是否符合 {difficulty} 学段要求？
6. 完整性检查：每页的 content 是否完整？有无空字段？

## 输出格式
只输出纯 JSON：
{
  "contentScore": 0-100,
  "pass": true/false,
  "issues": [
    {
      "pageNum": 4,
      "severity": "high|medium|low",
      "type": "off_topic|duplicate|logic_gap|toc_mismatch|difficulty|incomplete",
      "detail": "具体问题描述（中文）"
    }
  ]
}

## 判定规则
- 任何 high 级问题 → pass=false
- 3 个及以上 medium 级问题 → pass=false
- contentScore < 75 → pass=false
```

**User Prompt**：
```
主题：{topic}
学段：{difficulty}

## 页面内容
{每页的 pageNum + type + title + content 摘要}
```

---

### 7.6 修复 Agent

复用现有 Agent，额外注入修复上下文：

```
内容修复:
  复用章节 Agent
  额外注入: "上一版问题: {issue.detail}，本次必须修正。其他正常页面不需要修改。"

布局修复:
  复用页面设计 Agent
  额外注入: "上一版问题: {issue.detail}，请调整坐标/字体大小/颜色。"
```

## 十、关键技术细节

### 10.1 renderCode 安全执行

页面设计 Agent 不输出原始 JS 代码，输出 JSON 指令序列。执行层逐个执行并校验。

```json
{ "pageNum": 5, "instructions": [
  { "op": "setBackground", "params": { "color": "1A2744" } },
  { "op": "addText", "params": { "text": "...", "x": 0.8, ... } },
  { "op": "addShape", "params": { "type": "RECTANGLE", ... } }
]}
```

`InstructionExecutor` 类，每个 op 对应独立处理器，参数 zod 校验。未知 op 跳过 + 日志。任何指令失败 → 该页进修复循环。

### 10.2 合并步骤

顺序执行所有页的 instructions：`pres.addSlide()` → 遍历执行该页指令 → 下一页。纯代码 <1s。单页失败用空白页 + 标题兜底。

### 10.3 LibreOffice 进程管理

进程池：最大并发 6，单次超时 10s，失败重试 1 次。任务队列 + 信号量控制。

### 10.4 Job 状态管理

内存 Map，不持久化。Job 完成后 5 分钟自动清理。服务重启丢失 → 前端轮询 404 → 提示用户重新生成。

### 10.5 Cover Agent DesignDNA 校验

zod schema 逐套校验。色板值不在预定义范围 → 替换为默认色板；字体不在配对表 → 替换为 "Microsoft YaHei + Georgia"；motif 非法 → "geometric-lines"；字段缺失 → 默认 DesignDNA 补全。单套被替换 >3 个字段标记"降级方案"但不阻断流程。

### 10.6 页数控制

用户在前端选择范围：简洁(10-20) / 标准(20-35) / 详细(35-50) / 深度(50)。学段决定默认值（初中→简洁，高中→标准，大学→详细）。规划 Agent 收到 {minPages, maxPages} 硬约束，超出范围→reject 要求重规划。

### 10.7 Section Agent 部分失败

只重试失败的 Section，最多 2 次。2 次仍失败 → 该 Section 用 contentOutline 自动生成基础内容页兜底，标记 ⚠️。已成功的 Section 不受影响。

### 10.8 临时文件清理

/temp/ 下文件 30 分钟过期。setInterval 每 10 分钟扫一次目录清理。Job 清理时关联文件一并删除。