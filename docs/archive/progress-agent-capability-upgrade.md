# Agent 能力升级方案进度

## 2026-08-13

- Phase 5 基础闭环完成：Shadow 报告关联 `intervention_decisions` 与 `learner_outcomes`，新增 completion/correct/hint-request/exit 四项指标，按 baseline/newModel 分组；Outcome 新增 `hintsRequested`，旧记录默认 0。
- 新增确定性灰度 gate：`evaluateShadowRollout()`，默认关闭；必须达到 20 条 verified 答题证据，按稳定 user/session bucket 才可进入配置 cohort。personalization 默认保持旧推荐，new learner decision 仅 shadow 记录。
- Phase 5 回归通过：threads pool 单 worker `tests/adaptive-learning` 53 files / 226 tests；Shadow/Outcome/personalization/quiz exit 新增回归通过；Prettier、`git diff --check` 通过。
- Quiz 数据链路补齐：按需查看解析累计 `hintsRequested`；完成和退出均写 `learner_outcomes`，退出同时写 `session-exited`，不再把退出伪装成完成。
- 数据库新增 `migrations/010_shadow_outcome_metrics.sql`；正式灰度前需执行 migration，并观察报告 baseline/newModel 指标，未自动放量。

- Phase 4 完成：新增 6 类虚拟学生人设、seed 确定性 mock simulation、统一 turns/events/metrics/failureReasons 输出；新增 `virtual_student_simulations` DAO、migration 和 `/api/virtual-students` 鉴权 API。
- Phase 4 回归通过：单 worker `tests/adaptive-learning` 共 52 files / 221 tests；模拟数据仅写 `virtual_student_simulations`，不写真实 learning events、reflections、outcomes；不依赖外部 LLM key。
- 修正 API 契约：请求格式合法但 profile 不存在返回 404；格式非法返回 400。相关文件 Prettier 检查通过。
- 当前阻塞：全仓 `tsc --noEmit` 仍有既有 `app/sky/cloud-mind/memory/page.tsx` 缺 `useCallback`、`app/sky/cloud-mind/quiz/page.tsx` 类型/声明顺序错误；与本次 Phase 4 文件无关。并发 Vitest worker 曾异常退出，单 worker 已完整通过。

- Phase 3 基础闭环完成：新增 counterfactual decision service；规则生成 3 个候选、评分选择；可选 LLM + Zod 校验；非法输出/异常自动回退规则。
- Chat Director 已记录候选方案、选中方案、reflection snapshot、model/fallback 状态；显式主题硬约束保留。
- Phase 3 定向回归：6 files / 15 tests passed。tsc/ESLint 仍受本机 node_modules EPERM 阻断。

- Phase 2 基础闭环完成：新增 learner_reflections DAO/迁移、规则反思摘要、可选 LLM + Zod 校验、10 事件/24 小时触发、/api/learning-reflections。
- Chat 自动检查并运行到期反思，将有效期内假设注入 teaching projection；标记为非权威，不覆盖 verified knowledge state。
- Phase 2 定向回归：5 files / 13 tests passed。外部 cron/APScheduler 待部署阶段接入。

- 已读取仓库指导和规划技能。
- 已确认当前仓库为 Next.js + React + TypeScript，已有 LangGraph、Zod、MySQL、Vitest 和学习事件基础。
- 已确认四个目标模块：记忆与反思、反事实决策、虚拟学生测试、因果行为数据集。
- 已确定采用当前仓库栈优先的兼容方案，不引入重复 Python/SpringBoot 业务链。
- 已生成 `PLAN-agent-capability-upgrade.md`、`findings-agent-capability-upgrade.md`。
- 已开始执行 Phase 1。
- 新增 intervention decision/outcome DAO、Zod schema、MySQL migration。
- 扩展 7 类干预生命周期事件；新增 `recordInterventionSelected()`。
- 定向回归通过：3 个测试文件，24 tests passed。
- `npx tsc --noEmit` 被本机 `node_modules` 文件权限 `EPERM` 阻断；未发现 TS 错误输出。
- Phase 1 状态：基础层完成；Director/前端实际接线待继续。
- 新增 `/api/learning-outcomes`：鉴权、decision 所属校验、outcome 写入/查询、重复提交幂等。
- Chat 每次请求写 baseline intervention decision，并发送 `decision_context` SSE。
- Chat 同步写 `intervention-planned`、`intervention-selected`、`session-completed` 数据链路。
- 定向回归最终通过：6 个测试文件，38 tests passed。
- Phase 1 当前状态：完成。quiz/review 已接入 decision 创建、完成 outcome、退出事件；新增 API 单测。定向回归：4 files / 13 tests passed。
- 新增 `buildVirtualShadowFixture()`：内存生成 20-100 条虚拟学生 Shadow 数据，默认 24 条；包含 runs/events/decisions/outcomes，统一标记 `source=simulation`，不写真实学习表、不调用外部 LLM。
- Shadow fixture 回归通过：同 seed 输入可复现，baseline/newModel 各半，24 条模拟链路达到 Shadow ready；adaptive 全量回归 54 files / 229 tests passed。
- 结论边界：模拟数据可验证 decision -> event -> outcome -> Shadow report 链路和回归稳定性；不能证明新策略对真实学生有效。下一步需内部账号 dogfood，积累真实 verified evidence 后再观察灰度指标。
- 新增 `docs/adaptive-learning-dogfood.md`：真实账号采集、报告放行条件、内部环境 100% 验证、生产 1% 稳定灰度、观察指标和停止条件；`.env.example` 默认 `SHADOW_ROLLOUT_ENABLED=false`、`SHADOW_ROLLOUT_PERCENTAGE=0`。
