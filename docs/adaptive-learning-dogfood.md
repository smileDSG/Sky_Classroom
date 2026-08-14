# 自适应学习 Agent 内部 Dogfood

目标：用内部账号采集真实学习链路，验证记忆反思、反事实决策和行为结果记录。此阶段只观察，不把模拟数据当成真实证据。

## 0. 前置条件

1. 执行迁移 `migrations/007_agent_capability_data.sql` 到 `migrations/010_shadow_outcome_metrics.sql`。
2. `.env.local` 保持：

```env
SHADOW_ROLLOUT_ENABLED=false
SHADOW_ROLLOUT_PERCENTAGE=0
```

3. 重启 Next.js 服务，使配置生效。

## 1. 采集真实数据

准备 3-5 个内部账号。每个账号至少完成 20 道会产生 `verified` 证据的题目，覆盖：

- 正确题、错误题、连续错误；
- 查看解析/请求提示；
- 完成一次练习；
- 中途退出一次练习。

正常使用 `/sky/cloud-mind/quiz`、`/sky/cloud-mind/teaching`、`/sky/cloud-mind/memory`。不要手工改数据库，不要把 `source=simulation` 的记录混入真实账号。

## 2. 检查单个账号

登录目标账号后请求：

```text
GET /api/sky/learning-shadow-report
```

放行条件：

- `status=ready`；
- `eligibleResponses >= 20`；
- `outcomes.status=ready`；
- `outcomes.eligibleOutcomes >= 20`；
- `baseline`、`newModel` 都有 session；
- 没有明显异常的退出率、提示率或完成率。

若 `status=insufficient-data`，继续 dogfood，不开灰度。

## 3. 内部环境开启 100%

至少一个内部账号满足放行条件后，在仅供内部账号使用的环境配置：

```env
SHADOW_ROLLOUT_ENABLED=true
SHADOW_ROLLOUT_PERCENTAGE=100
```

重启服务。这样内部账号一定进入 cohort，可以验证真实新策略。分流按稳定 user/session bucket 计算，同一账号不会每次请求随机变化；新策略失败时回退旧规则。

## 4. 生产环境开 1%

内部验证无异常后，生产环境改为：

```env
SHADOW_ROLLOUT_ENABLED=true
SHADOW_ROLLOUT_PERCENTAGE=1
```

1% 是稳定 cohort，不保证某个指定内部账号进入。需要跟踪指定账号时，使用内部专用环境，不要为了命中账号把生产比例临时调高。

## 5. 观察窗口

连续观察 1-3 天。每天记录每个账号 Shadow 报告中的：

- 完成率；
- 正确率；
- 提示请求率；
- 退出率；
- baseline 与 newModel 的差异；
- 是否出现错误决策、主题漂移或重复教学。

建议把每次报告保存到内部评测表，字段至少包含：`userId`、报告时间、证据数、两组 session 数、四项指标、异常说明。

## 6. 停止条件

满足任一条件，立即关闭灰度：

```env
SHADOW_ROLLOUT_ENABLED=false
SHADOW_ROLLOUT_PERCENTAGE=0
```

- 退出率明显高于 baseline；
- 完成率或正确率连续下降；
- 新策略把用户指定主题改掉；
- LLM 输出导致 schema 错误未回退；
- decision、answer、outcome 无法按 `decisionId` 串联；
- 真实数据与模拟数据混库。

## 7. 数据边界

- `virtual-shadow-fixture` 只用于离线回归，不写真实学习表。
- `learner_reflections` 是行为假设，不覆盖 verified knowledge state。
- Shadow 的 expected effect 是预测，不是真实因果结论。
- 没有真实结果数据前，不做 DoWhy、微调或产品效果宣传。

## 8. 常用验证命令

```powershell
& 'E:\\01_Work\\sky-classroom\\node_modules\\.bin\\vitest.cmd' run 'tests/adaptive-learning' --pool=threads --maxWorkers=1
& 'E:\\01_Work\\sky-classroom\\node_modules\\.bin\\vitest.cmd' run 'tests/adaptive-learning/virtual-shadow-fixture.test.ts' --maxWorkers=1
```

当前模拟 fixture 能证明代码链路可跑通；真实 dogfood 才能证明策略是否值得灰度扩大。
