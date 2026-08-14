# 个性化学习算法 V1 计划

## 目标

做出一个可见、可测试的闭环：

```text
答题/复习事件 -> 知识状态更新 -> 下一步决策 -> 首页/测验/授课变化
```

首期不迁移全站，不训练复杂模型。先证明画像会随学习行为变化，并被现有功能消费。

## 范围

首期覆盖：

- Cloud Mind 测验
- 学习中心/首页下一步推荐
- AI 授课参数
- 画像实验页

首期暂不覆盖：PPT 全链路、多智能体课堂策略、IRT、上下文 bandit。

## 阶段 0：可见实验场

状态：completed（演示模式）

产出：

- 页面路径：`/sky/learning/personalization-lab`。
- 调试 API：`/api/sky/personalization-lab`，支持读取状态、模拟事件、重置演示数据。
- 新增个性化实验页，显示每个知识点的掌握度、可信度、记忆度。
- 提供“答对一题”“答错一题”“复习成功”“复习失败”“重置”操作。
- 显示当前推荐动作、推荐理由、测验参数、授课参数。
- 使用独立内存 session 演示，不污染真实用户学习记录。

验收：

- 点击一次“答错”后，目标知识点掌握度下降。
- 掌握度低且可信度足够时，推荐从练习变成讲解。
- 掌握度高但记忆度下降时，推荐变成复习。
- 页面展示推荐变化原因，不依赖 LLM。

## 阶段 1：统一状态算法

状态：completed

产出：

- 统一 `knowledge-state-engine.ts` 和 `knowledge-state-updater.ts`，只保留一个写入路径。
- V1 使用 Beta-Bernoulli：`alpha/beta -> mastery/confidence`。
- 增加简化遗忘模型：`lastReviewedAt + stabilityDays -> retention`。
- 保留事件幂等，重复提交同一 `eventId` 不重复计算。

验收：

- 同一事件不会被累计两次。
- 正确、错误、复习成功、复习失败都有固定预期结果。
- 没有证据时不输出“已掌握”结论。

## 阶段 2：接入现有功能

状态：completed

产出：

- [x] 新增统一 `getLearnerDecision()` 服务。
- [x] 测验读取目标知识点和难度；答题后立即返回新决策。
- [x] 首页读取今日下一步动作。
- [x] 授课读取主题、难度和决策原因。
- [x] 测验题量、提示模式接入。
- [x] 授课解释深度、节奏、内容形式接入教案生成任务。
- [x] AI 助手继续使用 Teaching Projection，并加入决策动作与原因。
- [x] 用户明确指定主题时，用户意图优先，算法只调整难度和表达方式。
- [x] 记忆卡完成后写入复习证据，并刷新今日计划。
- [x] 学习路径节点与计划任务同步；掌握度达标后推进下一个节点。
- [x] 搜题批改写入练习证据，并自动完成匹配的计划任务。
- [x] 课件生成读取画像决策，调整页数、节奏和内容形式。

接入顺序：

1. 测验 -> 状态更新
2. 状态 -> 首页推荐
3. 推荐 -> 授课参数
4. 记忆卡、学习路径、搜题、课件已完成专用参数接入

验收：

- 用户完成测验后，下一次首页请求看到新推荐。
- 同一用户在测验和授课中看到相同的目标知识点。
- 推荐带 `reasonCodes`、`profileVersion`、`eventWatermark`。

## 阶段 3：测试与演示

状态：completed

自动化测试：

- 单元测试：掌握度、可信度、记忆度更新。
- 单元测试：低可信度/低掌握度/低记忆度的动作决策。
- API 集成测试：答题后画像和推荐同步变化。
- Playwright 测试：实验页操作 -> 数值变化 -> 推荐变化。

固定演示场景：

1. 冷启动：没有证据 -> 诊断。
2. 连续答错：低掌握 -> 基础讲解。
3. 学会后间隔数日：低记忆度 -> 复习。
4. 连续答对：升级难度。
5. 用户明确选题：算法不覆盖用户目标。

## 阶段 4：小范围上线

状态：in_progress

- [x] Shadow Mode：记录新决策，不改变真实用户行为。
- [x] 对比旧推荐和新推荐，并按画像版本去重。
- [x] 实验页展示对照数量和变化数量。
- [ ] 收集至少 20 条有效答题记录，比较新模型与 Beta 基线。
- 确认推荐解释、画像更新延迟、异常回退正常后，再默认开启。

## V1 完成标准

- 一个用户可以在实验页看到画像实时变化。
- 同一份画像至少影响首页、测验、授课三个地方。
- 每次推荐可解释、可回放、可测试。
- 失败时回退到现有默认行为，不阻塞学习流程。

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Vitest could not resolve `@/lib/adaptive-learning/decision/personalization-lab` | 1 | Expected RED state; add the module in the GREEN step |
| API test patch targeted a file that did not exist | 1 | Reissue as an add-file patch |
| Vitest could not resolve the personalization lab API route | 1 | Expected RED state; add the route in the GREEN step |
| UI test found two visible `导数定义` labels | 1 | Use the unique heading role instead of ambiguous text lookup |
| Prettier reported formatting issues in 4 new files | 1 | Run Prettier write on only the new implementation/test files |
| Browser retention check expected stale summary wording | 1 | Fresh DOM showed the intended review decision; update verification wording |

## Verification Notes

- 自适应学习全量回归（上一轮）：45 个测试文件、203 个测试通过。
- 本轮关键回归：4 个测试文件、13 个测试通过。
- Shadow Mode 回归：4 个测试文件、33 个测试通过；全量相关回归更新为 47 个文件、213 个测试通过。
- 已使用 `data/adaptive-learning/evaluation/ability-replay.v1.json` 验证 24 条数据可生成完整影子报告。
- 已接入 ASSISTments09 公开数据：下载原始 parquet，生成 5,000 条规范化样本，并接入 TypeScript 回放测试。
- 修复真实数学测验证据链：提交事件现在包含固定题目身份、版本、难度、内容哈希和生成器版本，可进入阶段 4 影子评估；未匹配知识点也会带身份降级记录。
- 定向 `git diff --check`：本轮新增自适应学习、数据脚本和测试文件通过；全仓库检查仍有 6 个既有文档尾随空格，未改动无关文档。
- `npx tsc --noEmit` 与 `npm run lint`：当前机器读取 pnpm 链接依赖时返回 `EPERM`，未能执行。
