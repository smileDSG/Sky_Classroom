# 响应时间与生成进度机制说明

## 目标

系统需要避免长时间白屏等待。不同任务采用不同响应策略：短任务流式输出，长任务异步生成，资源包分阶段返回。

## 响应目标

| 场景 | 目标 |
| --- | --- |
| 普通答疑首 token | 3 秒内 |
| 学习画像抽取 | 5-10 秒内返回初版 |
| 课程知识库检索 | 2 秒内返回候选片段 |
| 讲义生成 | 15-30 秒内看到主要内容 |
| 题库生成 | 每 3-5 秒返回一批题 |
| 学习路径规划 | 10 秒内返回骨架 |
| PPT 生成 | 异步 job，展示阶段进度 |
| 视频/动画生成 | 先返回脚本和分镜，再异步生成媒体 |

## 任务分层策略

### 1. 流式输出

适用于：

- 即时答疑。
- 讲义生成。
- 题目解析。
- 学习建议。

展示方式：

- Markdown 逐段渲染。
- 代码块和公式按完整块渲染。
- 来源引用在段落结束后补齐。

### 2. 异步任务

适用于：

- PPT 生成。
- 多资源包生成。
- 视频/动画生成。
- 大批量题库生成。

任务状态：

```json
{
  "jobId": "resource-job-001",
  "stage": "quality_review",
  "progress": 72,
  "currentAgent": "QualityReviewAgent",
  "partialResults": ["lecture", "quiz", "mind_map"],
  "canCancel": true,
  "canRetry": true
}
```

### 3. Agent 进度追踪

建议阶段：

1. 画像分析。
2. 课程检索。
3. 资源设计。
4. 多 Agent 生成。
5. 质量审核。
6. 学习路径规划。
7. 结果保存。

每个阶段展示：

- 当前 Agent。
- 当前任务。
- 已完成资源数。
- 失败或需复核提示。

### 4. 降级与缓存

- 相同学生输入和课程章节命中缓存，减少重复生成。
- 模型不可用时返回 `data/demo/software-cup/generated-resources.json` 的 fallback 样例。
- 单个资源失败不影响已生成资源展示。
- 长任务失败时保留部分结果，允许单项重试。

## 当前可用演示数据

即使暂未完成所有 API，以下文件可作为性能和进度机制的演示基线：

- `data/demo/software-cup/generated-resources.json`：包含 Agent trace、资源列表、学习路径和审核结果。
- `docs/software-cup-demo-script.md`：包含备用演示方案。
- `data/course-knowledge/ai-intro/`：用于后续接入检索和生成流水线。
