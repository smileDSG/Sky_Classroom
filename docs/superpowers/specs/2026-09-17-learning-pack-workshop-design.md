# 学习包工坊设计

> 原「课程资源工坊」重构：从「凑 6 类演示产物」改为「生成能真正走完学习闭环的结构化学习包」
> 日期：2026-09-17 · 状态：待评审

## 1. 背景与问题

当前「课程资源工坊」一次性生成 6 类资源（讲义、PPT、导图、题库、实操、视频脚本），存在三个问题：

1. **形态凑数而非帮助学习**：大量产物是「为展示多样而凑」的演示材料，不是围绕真实学习闭环设计的资料。
2. **重复**：`ppt_outline`（幻灯片大纲+讲解建议）与讲义高度重复，且是给老师看的教学辅助；`video_script` 只是一段脚本文本，对学生没有任何直接用处。平台已有交互出题引擎、错题画像/复盘、AI 老师讲解、RAG 知识库，独立生成题库清单还会和出题引擎功能重叠。
3. **不可直接消费**：产物是一堆等着学生自行下载的 Markdown，练习与反馈没有形成闭环。

### 用户的明确取舍

在头脑风暴中已确认：

- 目标是「完整学习会话闭环」。
- 产以**结构化学习包、以文档为主**，但**绝不和现有功能重复**。
- **练习、复盘全外包给现有功能**（出题引擎、错题复盘），包内不埋题。
- 最终保留四份文档：个性化概念讲义、知识结构导图、薄弱点自查清单、学习路径与跳转指引。

## 2. 目标

把「课程资源工坊」改造成「**学习包工坊**」，每个学习包按「学 → 查 → 练（跳转）→ 复盘（跳转）」四阶段组织，产出 4 份有序、可直接消费、不重复现有功能的文档。

非目标：

- 不做交互式答题会话（那是出题引擎的职责）。
- 不做 AI 老师讲解会话（那是授课编排的职责）。
- 不做独立题库清单与错题复盘（重复现有功能）。

## 3. 产物模型

### 3.1 类型：6 类 → 4 类

| 阶段 | 类型 id | 名称 | 内容要点 |
|---|---|---|---|
| 学 | `markdown_lecture` | 个性化概念讲义（保留） | 针对薄弱点精讲，带课程来源引用、学习任务、自查小目标 |
| 学 | `mind_map` | 知识结构导图（保留） | Mermaid 结构图 + 薄弱点定位 + 前置关系 |
| 查 | `self_check` | 薄弱点自查清单（**新增**） | 按每个薄弱点给「能做到/还不行」判定式自查项 + 常见错因对照表；明确标注「不替代正式答题」 |
| 练/复盘 | `learning_path` | 学习路径与跳转指引（**新增**） | 把练、复盘环节具体引导到出题引擎与错题复盘完成，附学习顺序；第 4 阶段替代并统一现有 `learningPath` |

新常量：

```ts
export const COURSE_RESOURCE_TYPES = [
  'markdown_lecture',
  'mind_map',
  'self_check',
  'learning_path',
] as const;
```

### 3.2 移除

- `ppt_outline`（PPT）：与讲义重复、教师向，移除。
- `video_script`（视频脚本）：无学习价值，移除。
- `quiz_bank`（独立题库清单）：重复出题引擎，练习改由跳转完成，移除 `quiz_bank` 槽位。

## 4. 学习闭环

闭环四阶段在 `learning_path` 文档与结果页「后续学习」统一呈现（一套结构，不造两套）：

- **学**：讲义 + 导图。
- **查**：自查清单（学生自己判断是否掌握）。
- **练**：跳转出题引擎 `/sky/cloud-mind/quiz`，把当前薄弱点作为主题带入。
- **复盘**：跳转错题复盘/学习计划 `/sky/learning`。

现有 `result.learningPath`（`LearningPathNode[]`）重构为对齐这四阶段，既作为 UI 的「后续学习」，也是第 4 份 `learning_path` 文档的内容载体，**统一而不是重复**。

## 5. 生成流程与信任底线

沿用已有流水线（安全 → 画像 → 检索 → 生成 → 质检 → 学习路径），仅调整产物类型：

- 按需单生成仍生效：用户只选 1 类就只生成该类。
- 信任底线不变：LLM 失败绝不静默回退 demo 假料，任务进入 failed 态并保留输入供重试。
- LLM RAG 增强继续按所选类型填充 4 份文档的内容。

## 6. 代码触点（连锁改动）

1. **`lib/software-cup/demo-service.ts`**
   - `COURSE_RESOURCE_TYPES` 改为 4 类；`isCourseResourceType`/`normalizeResourceTypes` 不变。
   - 删除 `buildPptContent`、`buildQuizContent`、以及 `code_case`/`video_script` 的分支与字段（`slides`、`questionIds`、`caseFile`、`scriptFile` 不再作为产物字段）。
   - 新增 `buildSelfCheckContent`、`buildLearningPathContent`。
   - 调整 `personalizeResourceTitle`、`personalizeResources`、`buildPersonalizedLearningPath`、`buildPersonalizedAgentTrace`、`buildResourceBrief`、`buildResourceContent` 对 4 类产物的处理。
   - `runSoftwareCupGeneration` 中 `buildPersonalizedLearningPath` 改为四阶段。

2. **demo 兜底数据 `data/demo/software-cup/generated-resources.json`**
   - 资源槽改为 4 份（讲义、导图、自查清单、学习路径），删除 ppt/video/quiz 槽。

3. **前端 `components/sky/course-studio/course-studio-page.tsx`**
   - `RESOURCE_TYPES` 与 `RESOURCE_META` 改为 4 项（含 `self_check`、`learning_path` 的图标/配色/文案）。
   - `resourceSummary`、结果卡片、筛选、`follow` Tab 的 NextActions 同步更新。
   - 类型选择器默认全选 4 项。

4. **移动端 `app/m/sky/cloud-mind/course-studio/page.tsx`**
   - 资源类型改为 4 项（讲义、导图、自查清单、学习路径）。

5. **校验/流式/任务库**：`app/api/sky/resource-generation/jobs/route.ts`、`lib/server/resource-generation-job-store.ts` 中硬编码类型清单与文案同步为 4 类。

6. **知识库 RAG 接线（保留）**：`lib/server/resource-generation-kb.ts` 入库与出题检索不变，`course` 库与 `resource-{jobId}-{resourceId}` sourceId 保持；`ingestGeneratedResources` 只需跟随新类型，无需新增逻辑。

7. **审计** `components/sky/learning/profile-completion-page.tsx`、`components/sky/software-cup/software-cup-page.tsx`、`components/sky/solve/teaching-panel.tsx`：若仅展示资源类型/文案则同步更新，不引入无关重构。

## 7. 命名与文案

- 产品名：**课程资源工坊 → 学习包工坊**。
- 首屏标题/引导改为强调「生成一套能走完的学习包」。
- 进度与结果文案改为四阶段（学/查/练/复盘）。

## 8. 测试与成功标准

- 更新并新增测试：资源类型选择（只剩 4 类且单选生效）、LLM-RAG 仍失败必报错、结果页 4 类渲染与学习路径四阶段、KB 入库仍按新类型打 tag。
- 受影响测试文件：`tests/sky/course-studio-page.test.tsx`、`tests/software-cup/resource-type-selection.test.ts`、`tests/software-cup/llm-rag-generation.test.ts`、`tests/software-cup/resource-kb-ingest.test.ts`、`tests/software-cup/resource-generation-stream.test.ts`。
- 成功标准：每包恰好 4 份文档按闭环顺序；无静默 demo；练/复盘通过跳转完成、包内不埋题；`pnpm test` 相关套件、受影响文件 `tsc --noEmit` 通过。

## 9. 明确确认的两点

1. `quiz_bank` 题库彻底下架，练习外包给出题引擎（与「练/复盘全外包」一致）。
2. 学习路径用「统一」思路：既作 UI 展示、又作第 4 份 `learning_path` 文档载体，不造两套。