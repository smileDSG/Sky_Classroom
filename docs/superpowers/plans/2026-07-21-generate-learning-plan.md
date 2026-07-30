# 轻量学习计划生成脚本实施计划

## 目标
基于已爬取的 5638 份 Markdown 资料，实现一个命令行脚本，根据学生画像生成针对性学习计划。

## 范围
- 不引入向量数据库，使用关键词匹配召回资料。
- 单文件脚本：`scripts/generate-learning-plan.ts`。
- 调用现有 `lib/ai/` LLM Provider 生成计划。

## 流程
1. 读取学生画像（CLI 参数或 JSON 文件）。
2. 遍历 `data/crawled/**/*.md`，解析 front matter 与正文。
3. 根据画像关键词（学科、薄弱点、目标）计算文件相关度得分。
4. 取 Top-N 相关文档片段。
5. 构造 Prompt，调用 LLM 生成 `LearningPlan`。
6. 输出为 Markdown 文件。

## 数据定义
- `LearnerProfile`：grade, subjects, weakPoints, goals, weeklyHours, examDate。
- `KnowledgeChunk`：source, title, course, tags, content, score。
- `LearningPlan`：target, durationWeeks, weeklyHours, weeks, resources。

## 模块
- `scripts/generate-learning-plan.ts`：单一入口，包含参数解析、文件扫描、评分、LLM 调用、输出。

## 验证
- 使用示例画像测试：高三学生，数学薄弱点“函数与导数”，每周 10 小时。
- 检查输出是否覆盖薄弱点、每周时长是否合规、是否引用资料来源。
