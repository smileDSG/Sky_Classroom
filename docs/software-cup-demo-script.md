# 软件杯演示脚本

## 演示定位

系统定位为“面向高校专业课程的多智能体个性化学习资源生成系统”。演示主线围绕《人工智能导论》课程，展示从自然语言学习需求到画像、资源、路径、审核和评估的闭环。

## 固定学生输入

```text
我是软件工程大二学生，正在学人工智能导论。Python 基础还可以，线性代数学过但不太熟。现在最困惑的是过拟合、模型评估和 RAG，不太会把概念和代码联系起来。希望两周内补上机器学习基础和大模型智能体，偏好图解、代码案例和分层练习题。每天大概能学 45 分钟，希望系统帮我规划学习顺序并生成资料。
```

对应文件：`data/demo/software-cup/student-input.txt`

## 5-8 分钟演示流程

### 1. 说明课程知识库

展示 `data/course-knowledge/ai-intro/`：

- `course-meta.json`：课程元信息。
- `syllabus.md`：12 章课程大纲。
- `chapters/`：12 章原创讲义。
- `knowledge-graph.json`：48 个知识点、56 条关系。
- `question-bank.json`：48 道初始题。
- `cases/`：4 个代码实操案例。
- `media-scripts/`：3 个多模态视频/动画脚本。

对应赛题要求：自行构造至少一门完整高校专业课程知识库。

### 2. 对话式画像构建

输入固定学生文本，展示系统抽取的 8 维画像：

- 专业背景。
- 学习目标。
- 知识基础。
- 认知风格。
- 易错点偏好。
- 资源偏好。
- 学习节奏。
- 当前学习状态。

备用展示文件：`data/demo/software-cup/student-profile-sample.json`

对应赛题要求：摒弃繁琐表单，通过自然语言对话构建不少于 6 个维度的动态画像。

### 3. 多智能体协作过程

展示 Agent 流程：

1. Director 拆解任务。
2. ProfileAgent 构建画像。
3. CourseUnderstandingAgent 检索课程知识库。
4. ResourceDesignAgent 设计资源包。
5. Lecture/Quiz/MindMap/Case/Video Agents 并行生成资源。
6. QualityReviewAgent 做来源和安全审核。
7. LearningPathAgent 生成学习路径。

对应赛题要求：体现多智能体架构，并生成至少 5 种资源。

### 4. 多模态学习资源

展示 `data/demo/software-cup/generated-resources.json` 中的 6 类资源：

- 个性化讲义。
- PPT 大纲。
- 思维导图。
- 题库。
- RAG 代码案例。
- 视频脚本。

对应赛题要求：生成专业讲解文档、思维导图、练习题、视频脚本、代码实操案例等资源。

### 5. 学习路径和推荐理由

展示 14 天路径：

- Day 1-2：训练集、验证集、测试集。
- Day 3-5：过拟合诊断与评价指标。
- Day 6-9：KNN/决策树代码实验。
- Day 10-12：RAG 与来源引用。
- Day 13-14：课程问答助手项目。

强调每一步都能解释推荐理由：先补前置知识，再做实践，再进入项目。

### 6. 防幻觉与内容安全

展示每个资源的：

- 来源章节。
- 置信度。
- 审核状态。
- 低置信度处理策略。

对应赛题要求：防幻觉、内容安全、来源引用、审核机制。

### 7. 进度与性能体验

说明长任务不白屏：

- 普通答疑流式输出。
- 资源生成分 Agent 展示进度。
- PPT/视频等长任务异步生成。
- 失败时保留部分结果并可重试。

## 备用演示方案

如果现场 API key、网络或模型响应不稳定，直接使用以下 fallback 数据展示完整链路：

- `data/demo/software-cup/student-profile-sample.json`
- `data/demo/software-cup/generated-resources.json`
- `data/course-knowledge/ai-intro/`

备用方案仍能覆盖赛题硬性要求：课程知识库、画像维度、多智能体过程、资源类型、学习路径、防幻觉机制。
