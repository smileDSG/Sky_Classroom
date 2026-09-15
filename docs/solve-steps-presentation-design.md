# 解题过程呈现优化 — 设计文档

日期：2026-09-15
状态：已获用户认可，进入实现

## 背景与问题

拍照搜题/解题功能：答案正确，但「解题过程/步骤」呈现简陋。用户在三个维度确认了问题：

1. 步骤内容质量：AI 生成的步骤啰嗦、存在空步骤、不稳定、不专业。
2. 视觉排版：步骤卡片单调（序号+整段文字），缺重点高亮 / 公式排版 / 层次区分。
3. 缺少辅助形式：缺思路导读、本步结论等提示。

## 根因诊断

| 环节 | 现状代码 | 根因 |
|------|---------|------|
| 生成端 | `lib/solve/solver-prompts.ts` | Prompt 对 steps 仅要求 `{"label","content","keyPoints"}`，无「每步非空、单步单一职责、命名规范、必要论证标记」任何约束 → 空步骤 / 纯标题步骤 / 流水账 |
| 结构端 | `lib/solve/types.ts` | step 模型仅 3 字段，无「步骤类型 / 本步结论」→ 下游无法差异化渲染与辅助展示 |
| 渲染端 | `components/sky/solve/solution-panel.tsx` | 固定「序号+标题+整段」卡片，无层次、无高亮、无导读 |

## 修复设计

### 1. Prompt 约束（内容质量）— `lib/solve/solver-prompts.ts`

在 `AGENT_SYSTEM_PROMPTS` 的三个 solver 分支（universal/science/humanities）共用强约束块，要求：

- 每个步骤必须「自洽完整、非空」；禁止只给标题、禁止空步骤。
- 每步只做一件事，一次只推进一个推导/概念。
- 步骤命名按规范意图走（读题拆解 → 建模/关系 → 推导变形 → 计算 → 验证/结论），label 用「步骤i：<意图短语>」形式。
- 关键推导/易错点，在 content 末尾追加一行标记（供前端高亮）。
- 步骤总数量级适中（选择题 2-4 步、解答题 3-8 步），禁止无意义的碎步。

### 2. 步骤模型扩展（结构基础）— `lib/solve/types.ts`

`step` 增加两个**可选**字段（向后兼容，缺省按旧逻辑渲染）：

```ts
{
  label: string;
  content: string;
  keyPoints?: string[];
  // 新增（可选）
  type?: 'idea' | 'transform' | 'calc' | 'verify'; // 本步意图类型
  summary?: string; // 本步结论一句话（导读/辅助形式）
}
```

同时把 `buildSolverPrompt` 侧的 JSON schema 示例同步为含 `type`/`summary`。

### 3. 渲染增强（视觉排版 + 辅助形式）— `solution-panel.tsx`

- 每步顶部增加一行「本步要点」：优先取 `summary`，缺省取 `keyPoints` 的首条作为导读。
- 按 `type` 差异化样式：
  - `idea`（思路）：左侧信息色边的提示块，读题/建模。
  - `transform`（变形/推导）：公式居中强调（MathRenderer 加大）。
  - `calc`（计算）：编号序列更紧凑。
  - `verify`（验证/结论）：底部成功色小结行。
  - 无 `type`：维持现有卡片，不回归。
- 保留 dedup 与既有 keyPoints Badge 逻辑不变。

## 兼容性

- 所有新增字段可选；题目缓存 / 题库命中的旧数据（无 type/summary）按原样式渲染。
- 不触碰题库回填、答案自校验、识别流程。

## 增强 2：开放/证明题「结论级」答案自校验

用户反馈：大题/证明题「不知道对不对」。原自校验只对可判定题(选择/填空/判断)强制复核，
开放解答题高置信即跳过，证明题因此拿不到信心标注。

改动（2026-09-15，与步骤呈现同批）：
- `lib/solve/solve-graph.ts` `verifyAnswerNode`：由「非可判定即跳过」放宽为「有答案即复核」——
  solve 开放题也用独立模型(GLM-5.1)做结论级复核，产出 answerReview：
  verified / corrected / pending-confirmation 写入 job 与前端徽标。
- `lib/solve/solve-verify.ts` `decideVerification`：移除「开放解答高置信跳过」分支，
  有答案即复核；删除不再使用的 `HIGH_CONFIDENCE_THRESHOLD`。
- 保留：无答案 / 题库缓存命中仍跳过（零开销）。

## 增强 3：`\bigtriangleup` 渲染泄漏修复

截图题步骤4把三角形显示为 `\big triangleup` 裸代码。两层根因：
1. LLM 把命令名误加空格（`\big triangleup`）→ `fixCommonLatexErrors` 增补归一化合并。
2. 更深层：BARE_LATEX 前缀匹配从长到短找已知命令时命中短命令 `\big`，
   把完整命令 `\bigtriangleup` 拆成 `\big` + 前缀 `triangleup` 文字泄漏。
   → wrapper 增加「整词即为完整已知命令则不拆分」优先判断。

验证：新增 `tests/sky/math-renderer-normalize.test.tsx`（组件渲染）+ `math-renderer-errors.test.ts`（纯函数）。

## 测试

- 单元：为 prompt 强约束块的存在性、以及 steps 容错解析（含 type/summary、含缺省）补测试。
- 更新受影响既有断言（若有）。
- 真机手测清单（交付报告时给用户）：
  1. 搜一道解答题 → 步骤数适中、无空步骤、命名规范、关键推导高亮、每步有「要点/结论」。
  2. 搜一道选择题 → 步骤 2-4 步，精简。
  3. 再搜一道已入库题（旧缓存无新字段）→ 按旧样式正常渲染、不炸、不回归。
  4. 对比改造前后同一题步骤观感。