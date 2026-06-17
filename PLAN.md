# 任务计划书

> 生成时间: 2026-06-17
> 任务: 让 Teaching 模块生成富模板幻灯片（概念卡片、公式推导、步骤流程等），而非纯文本幻灯片

## 目标

修改 Teaching 模块的内容生成器，使其输出 `StructuredContent` 格式（concept/formula/process 等），然后直接传入 Layout Agent 渲染为带模板布局的幻灯片，与 Classroom Generation 产出相同质量的课件。

## 选定方案

**方案A: 改内容生成器** — 修改 `content-prompts.ts` 让 LLM 输出 StructuredContent，再在 `to-classroom.ts` 中直接传入 Layout Agent

## 关键发现

当前系统有两条独立的幻灯片生成路径：
1. **Classroom Generation** (`lib/generation/`) → LLM 输出 `StructuredContent` → Layout Agent → 带模板的精美幻灯片
2. **Teaching Module** (`lib/teaching/`) → LLM 输出 `ContentChunk[]`（纯文本）→ 手动拼 PPT 元素 → 简陋幻灯片

之前已尝试过在 `to-classroom.ts` 中调用 `generateSlideContent()`（Slide Generator 管线），但它需要 `SceneOutline` + LLM 调用 + 模板匹配，流程冗余。正确做法是让 Teaching 内容生成器直接输出 `StructuredContent`。

## 执行步骤

### 1. 修改 `lib/teaching/content-prompts.ts`

**做什么：** 重写 prompt，让 LLM 输出 `StructuredContent` 格式而非 `ContentChunk[]`

- 根据 `section.contentType` 选择合适的输出 schema：
  - `explanation` → `concept` 或 `summary`
  - `example` → `case`
  - `diagram` → `process`
  - `quiz` → 保持不变（仍输出 quiz chunks）
- Prompt 中嵌入目标 schema 的 JSON 结构说明
- 保留 Markdown + LaTeX 格式要求
- 新增 `buildStructuredContentPrompt()` 函数，原 `buildContentPrompt()` 保留作为 fallback

### 2. 修改 `lib/teaching/content-generator.ts`

**做什么：** 让 `generateSectionContent()` 尝试返回 `StructuredContent`，失败时 fallback 到 `ContentChunk[]`

- 新增返回类型 `GeneratedContent`：
  ```typescript
  interface GeneratedContent {
    structured?: StructuredContent;  // 优先使用
    chunks: ContentChunk[];           // fallback
  }
  ```
- 修改 `generateSectionContent()` 返回 `GeneratedContent`
- 先调用新 prompt，尝试用 `structuredContentSchema.safeParse()` 验证
- 验证失败则 fallback 到原 `ContentChunk[]` 逻辑
- 更新 `GeneratedSection` 类型和 `generateLessonStream`/`generateLessonConcurrent` 等函数

### 3. 修改 `lib/teaching/to-classroom.ts`

**做什么：** 当 section 有 `structured` 内容时，直接传入 Layout Agent 渲染

- 移除当前的 `generateSlideContent()` 调用（冗余的二次 LLM 调用）
- 当 `sectionData.structured` 存在时：
  - 调用 `selectTemplateForOutline()` 选模板
  - 调用 `layoutContentWithTemplate(structured, template)` 生成 `TemplateSlideData`
  - 用 `templateData.page.elements` 创建 Slide
- 当 `sectionData.structured` 不存在时：
  - 走现有 `chunksToSlides()` 文本 fallback
- 移除 `createAICallFn()` 和 `teachingChunksToOutline()` 辅助函数（不再需要）
- 保留 `isTestEnv` guard（测试环境仍走 fallback）

### 4. 更新 `lib/server/teaching-job-store.ts`

**做什么：** 确保 `GeneratedSectionData` 类型支持 `structured` 字段

- 在 `GeneratedSectionData` 接口中添加 `structured?: StructuredContent`

### 5. 更新测试

**做什么：** 更新 `tests/teaching/to-classroom.test.ts`

- 现有测试继续通过（走 fallback 路径）
- 新增测试用例验证 `structured` 内容的转换路径

## 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `lib/teaching/content-prompts.ts` | 修改 | 新增 `buildStructuredContentPrompt()` |
| `lib/teaching/content-generator.ts` | 修改 | 返回类型改为 `GeneratedContent` |
| `lib/teaching/to-classroom.ts` | 修改 | structured 走 Layout Agent |
| `lib/server/teaching-job-store.ts` | 修改 | 类型添加 `structured` 字段 |
| `tests/teaching/to-classroom.test.ts` | 修改 | 新增 structured 测试 |

## 风险点

- **LLM 输出不稳定**：StructuredContent schema 比 ContentChunk 复杂，解析失败率可能更高 → 已有 fallback 机制
- **模板路径硬编码**：`TEMPLATE_DIR` 指向本地路径，生产环境可能不同 → 使用现有 `selectTemplateForOutline()` 逻辑
- **性能**：每个 section 的 LLM 调用会多处理一些 token（因为需要输出结构化 JSON）→ 影响不大

## 预期产出

- Teaching 模块生成的课堂幻灯片将具有与 Classroom Generation 相同的模板布局质量
- 概念卡片、公式推导、步骤流程、对比分析等丰富排版
- 在模板不可用或解析失败时，仍能 fallback 到纯文本幻灯片
