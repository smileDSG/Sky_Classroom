# 第三方依赖与许可汇总

> 本文件用于软件杯提交材料中的第三方依赖说明。当前为人工整理版，最终提交前建议结合 `package.json`、`pnpm-lock.yaml`、各依赖官方仓库和许可证文件复核。

## 项目基础

| 名称 | 当前用途 | 协议/说明 |
| --- | --- | --- |
| OpenMAIC / sky-classroom | 基础 AI 课堂平台与本次参赛代码底座 | AGPL-3.0，见根目录 `LICENSE` 和 `package.json` |

## 前端与 UI

| 名称 | 当前用途 | 协议 |
| --- | --- | --- |
| Next.js | App Router、服务端渲染和 API routes | MIT |
| React | 组件化 UI | MIT |
| Tailwind CSS | 原子化样式 | MIT |
| Radix UI / Base UI | 可访问交互组件 | MIT |
| lucide-react | 图标 | ISC |
| KaTeX / Temml | 公式渲染 | MIT |
| Shiki | 代码高亮 | MIT |
| Zustand | 状态管理 | MIT |

## AI 与智能体

| 名称 | 当前用途 | 协议/说明 |
| --- | --- | --- |
| Vercel AI SDK | 模型调用、流式输出、前后端 AI 交互 | Apache-2.0 |
| OpenAI Node SDK | OpenAI 兼容模型调用 | Apache-2.0 |
| LangChain Core | RAG、工具链和链式调用参考 | MIT |
| LangGraph | 多智能体状态图和编排参考 | MIT |
| Zod | Agent 输入输出结构校验 | MIT |

## 文档、测试与工程

| 名称 | 当前用途 | 协议 |
| --- | --- | --- |
| TypeScript | 类型检查 | Apache-2.0 |
| ESLint | 代码规范检查 | MIT |
| Prettier | 代码格式化 | MIT |
| Vitest | 单元测试 | MIT |
| Playwright | E2E 测试 | Apache-2.0 |

## 学习资料引用边界

本项目整理了《人工智能导论》课程知识库。外部资料只作为课程结构和参考阅读来源，不复制完整书籍、课程讲义、代码、图表或排版内容。课程知识库正文为原创改写。

外部学习资料及使用边界见：

- `data/source-materials/ai-intro/source-links.md`

## 后续维护规则

新增第三方依赖、模型服务、图片素材、音频素材、视频生成工具时，必须补充：

- 名称。
- 来源链接。
- 用途。
- 协议或服务条款。
- 是否会处理学生数据。
- 是否进入提交包。
