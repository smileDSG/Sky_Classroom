# 实操案例：RAG 课程问答助手

## 目标

使用课程讲义构建一个最小 RAG 问答助手，理解文档切分、检索、生成、来源引用和低置信度处理。

## 前置知识

- 大语言模型和 Prompt。
- 向量检索的基本直觉。
- 课程知识库和来源引用。

## 实验步骤

1. 收集课程讲义 Markdown 文件。
2. 按章节和小节切分文本。
3. 为每个片段建立可检索索引。
4. 根据学生问题检索相关片段。
5. 把片段和问题交给模型生成回答。
6. 输出来源章节、置信度和复核提示。

## 伪代码

```python
documents = load_markdown_files("data/course-knowledge/ai-intro/chapters")
chunks = split_by_heading(documents, max_chars=900, overlap=120)
index = build_vector_index(chunks)

question = "为什么训练集准确率高但测试集准确率低？"
hits = index.search(question, top_k=4)

if not hits:
    answer = "当前课程知识库没有找到可靠来源，请补充资料或人工复核。"
else:
    context = format_context_with_citations(hits)
    answer = llm_generate(
        system="你是人工智能导论助教。只能基于给定课程片段回答，并给出来源。",
        user=f"课程片段：{context}\n\n学生问题：{question}",
    )

print(answer)
```

## 输出要求

- 回答必须包含“结论、解释、例子、下一步学习建议”。
- 每个关键事实尽量绑定课程来源。
- 无来源或低置信度时明确提示需要复核。
- 不直接代写作业，改为提供思路和检查清单。

## 思考题

- 为什么 RAG 能降低幻觉风险，但不能完全消除幻觉？
- 文档切分过长或过短分别有什么问题？
- 如何评价课程问答助手的回答质量？

## 评分标准

- 能完成文档切分和检索流程设计：25 分。
- 能输出来源引用：25 分。
- 能说明低置信度和拒答策略：25 分。
- 能完成至少 5 个问题的测试记录：25 分。

## 可生成资源

系统可以基于本案例生成项目任务书、代码框架、答辩讲稿、风险说明和评价表。
