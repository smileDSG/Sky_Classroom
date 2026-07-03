# 开源项目与第三方工具使用说明

本项目基于 OpenMAIC / sky-classroom 代码仓库进行参赛方向扩展，当前新增方向为“面向高校专业课程的多智能体个性化学习资源生成系统”。项目根目录 `package.json` 标注许可证为 `AGPL-3.0`，项目根目录保留 `LICENSE` 文件。最终提交材料应继续保留原项目许可证和版权说明。

## 本次新增/整理内容

- 《人工智能导论》课程知识库：`data/course-knowledge/ai-intro/`
- 软件杯演示数据：`data/demo/software-cup/`
- 方案、执行计划和可信机制说明：`docs/software-cup-*.md`

新增课程材料为原创整理，外部 PDF、网页和官方文档仅作为参考来源，不复制完整原文、代码、图表或排版内容。

## 主要开源依赖

| 名称 | 用途 | 来源 | 协议 |
| --- | --- | --- | --- |
| OpenMAIC / sky-classroom | 参赛项目基础代码仓库 | 当前仓库 | AGPL-3.0 |
| Next.js | Web 应用框架 | https://nextjs.org | MIT |
| React / React DOM | 前端 UI 框架 | https://react.dev | MIT |
| TypeScript | 类型系统和编译工具 | https://www.typescriptlang.org | Apache-2.0 |
| Tailwind CSS | 样式系统 | https://tailwindcss.com | MIT |
| Radix UI / Base UI | 无障碍 UI 基础组件 | https://www.radix-ui.com / https://base-ui.com | MIT |
| lucide-react | 图标库 | https://lucide.dev | ISC |
| Vercel AI SDK (`ai`, `@ai-sdk/*`) | LLM 调用和流式输出 | https://sdk.vercel.ai | Apache-2.0 |
| LangChain / LangGraph | 多智能体和工作流编排参考 | https://www.langchain.com / https://langchain-ai.github.io/langgraph | MIT |
| OpenAI Node SDK | LLM API 调用 | https://github.com/openai/openai-node | Apache-2.0 |
| Zod | 运行时数据校验 | https://zod.dev | MIT |
| Zustand | 前端状态管理 | https://zustand.docs.pmnd.rs | MIT |
| KaTeX / Temml | 数学公式渲染 | https://katex.org / https://temml.org | MIT |
| Shiki | 代码高亮 | https://shiki.style | MIT |
| Playwright | E2E 测试 | https://playwright.dev | Apache-2.0 |

## 外部学习资料来源

详见 `data/source-materials/ai-intro/source-links.md`。其中包括：

- Mathematics for Machine Learning：https://mml-book.com
- 动手学深度学习：https://zh.d2l.ai
- Berkeley CS188：https://inst.eecs.berkeley.edu/~cs188/
- LangChain RAG Tutorial：https://python.langchain.com/docs/tutorials/rag/
- LangGraph Overview：https://langchain-ai.github.io/langgraph/
- NIST AI RMF：https://doi.org/10.6028/NIST.AI.100-1

## 提交注意事项

- 提交包中保留 `LICENSE` 和本说明文件。
- 若后续引入新的模型、API、图片、音频或视频生成工具，需要在本文件中追加来源、用途和协议/服务条款说明。
- 第三方依赖的最终协议以对应官方仓库、npm 包元数据和许可证文件为准。
