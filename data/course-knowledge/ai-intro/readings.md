# 《人工智能导论》拓展阅读材料

> 使用说明：以下材料用于课程知识库的参考阅读、来源引用和资源推荐。项目提交时不复制完整原文，不搬运原书代码或图表，仅标注来源并基于课程目标进行原创整理。

## 1. 数学与机器学习基础

### Mathematics for Machine Learning

- 作者：Marc Peter Deisenroth, A. Aldo Faisal, Cheng Soon Ong
- 来源：https://mml-book.com
- 建议关联章节：第 4 章机器学习基础、第 5 章监督学习、第 6 章神经网络。
- 推荐阅读用途：
  - 线性代数、概率统计、优化的数学预备知识。
  - 线性回归、PCA、SVM 等模型背后的数学直觉。
- 适合推送对象：
  - 数学基础较弱但希望补原理的学生。
  - 准备继续学习机器学习理论课程的学生。

## 2. 深度学习与 PyTorch 实践

### 动手学深度学习

- 作者：Aston Zhang, Zachary C. Lipton, Mu Li, Alexander J. Smola
- 来源：https://zh.d2l.ai
- 建议关联章节：第 6 章神经网络、第 7 章自然语言处理、第 8 章计算机视觉。
- 推荐阅读用途：
  - 多层感知机、模型选择、过拟合、Dropout、卷积神经网络。
  - 注意力机制、Transformer、深度学习工程实践。
- 适合推送对象：
  - 偏好代码实操和实验验证的学生。
  - 想从《导论》过渡到《深度学习》课程的学生。

## 3. 人工智能课程结构参考

### Berkeley CS188 / AIMA 课程内容

- 来源：https://inst.eecs.berkeley.edu/~cs188/
- 建议关联章节：第 2 章搜索、第 3 章知识表示、第 9 章强化学习。
- 推荐阅读用途：
  - 搜索、逻辑智能体、不确定性推理、MDP、强化学习等传统 AI 主题。
  - 课程知识图谱中的前置关系和章节覆盖范围设计。
- 适合推送对象：
  - 希望系统学习经典 AI 的学生。
  - 对搜索、推理和强化学习感兴趣的学生。

## 4. RAG 与智能体工程

### LangChain RAG Tutorial

- 来源：https://python.langchain.com/docs/tutorials/rag/
- 建议关联章节：第 10 章大模型与智能体、第 12 章课程项目。
- 推荐阅读用途：
  - 文档加载、文本切分、向量检索、检索增强生成流程。
  - 构建课程问答助手的工程参考。
- 适合推送对象：
  - 想完成 RAG 课程项目的学生。
  - 对大模型应用开发感兴趣的学生。

### LangGraph Overview

- 来源：https://langchain-ai.github.io/langgraph/
- 建议关联章节：第 10 章大模型与智能体。
- 推荐阅读用途：
  - 多智能体状态图、流程编排、持久化、流式输出和人工审核。
  - 解释 Director-Agent 架构与长任务进度追踪。
- 适合推送对象：
  - 对智能体系统架构感兴趣的学生。
  - 需要理解本参赛系统技术路线的评委或答辩听众。

## 5. AI 安全与可信治理

### NIST AI Risk Management Framework

- 来源：https://doi.org/10.6028/NIST.AI.100-1
- 概览：https://www.nist.gov/itl/ai-risk-management-framework
- 生成式 AI 概况：https://doi.org/10.6028/NIST.AI.600-1
- 建议关联章节：第 11 章 AI 安全与伦理。
- 推荐阅读用途：
  - 可信 AI、风险识别、风险治理、生成式 AI 风险管理。
  - 参赛系统防幻觉、内容安全和人工复核机制说明。
- 适合推送对象：
  - 关注 AI 伦理、安全和治理的学生。
  - 负责答辩中“防幻觉与内容安全”说明的材料准备。

## 6. 资源推送建议

| 学生画像特征 | 推荐材料 |
| --- | --- |
| 数学基础薄弱 | Mathematics for Machine Learning 中线性代数、概率和优化章节 |
| 代码实践偏好 | 动手学深度学习和本知识库实操案例 |
| 对搜索推理薄弱 | CS188 / AIMA 相关搜索、逻辑和 MDP 主题 |
| 对 RAG 感兴趣 | LangChain RAG Tutorial、本课程 RAG 问答助手案例 |
| 对多智能体感兴趣 | LangGraph Overview、本系统 Agent 协作流程 |
| 对安全伦理薄弱 | NIST AI RMF、第 11 章案例讨论 |
