# 自适应学习者模型 V1

## 已确认的模型

### 1. 知识点掌握度

每个用户、每个知识点维护 `Beta(alpha, beta)`。

```text
答对验证题 -> alpha 增加
答错验证题 -> beta 增加
复习评分 -> 按评分更新 alpha / beta 和遗忘稳定度
```

`segment-replayed`、`dwell-recorded`、`question-asked`、`self-reported` 不更新
`alpha/beta`。它们只形成诊断候选。

### 2. 跨题能力 theta

每个用户、每个学科维度维护 `theta`。V1 固定题目难度 `b`：

```text
p(correct) = sigmoid(theta - b)
theta_next = theta + K(n) * (correct - p)
K(n) = max(0.05, 0.25 / sqrt(n + 1))
```

`b` 在在线阶段不更新。每道题必须带：

```text
itemId, itemVersion, contentHash, generatorVersion,
dimensionId, nodeIds, difficulty
```

现有 easy / medium / hard 映射为 `-0.7 / 0 / +0.7`。

### 3. 图谱诊断

图谱不传播 `alpha/beta`。它只把行为信号转换为候选节点：

```text
行为信号 -> 当前节点 suspicionScore
         -> 前置节点 suspicionScore * 0.4^depth
         -> 出一题诊断题
         -> 诊断答案才更新掌握度
```

最多向前两层。输出包含 `sourceEventIds` 和 `reasonCodes`，便于解释。

## 数据集回放

`data/adaptive-learning/evaluation/ability-replay.v1.json` 是版本化合成回放集。

测试流程：

```text
按 occurredAt 排序
先预测该答案的正确率
再用该答案更新 theta
计算 Brier、AUC
与同一数据集的常数正确率基线比较
```

合成集只验证：代码链路、时序、数值稳定性、回归风险。它不能证明真实教学带来学习增益。
真实数据达到足够规模后，必须使用按用户和时间切分的离线回放，以及前测/后测 A/B 实验。
