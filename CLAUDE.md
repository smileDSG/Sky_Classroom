# 智眸无界 天空课堂 — Claude 协作指南

## 项目背景

AI 驱动的智能互动学习平台。Next.js 16 + React 19 + TypeScript，基于 LangGraph 多 Agent 编排。当前重点：PPT 生成系统、解题引擎、题库导入。

## Skill 调用规则

遇到以下场景时，主动提醒用户调用对应 skill，不要直接开始写代码：

| 场景 | 调用 |
|------|------|
| UI 组件/页面设计、CSS 样式优化 | `/frontend-design` |
| PPT 生成、模板、导出、封面设计 | `/pptx` |
| 修改 Claude SDK 调用代码、prompt caching、thinking | `/claude-api` |
| PDF 解析、提取、处理 | `/pdf` |
| 疑难 bug 调试、系统性排查 | `/systematic-debugging` |
| 写开发计划、技术方案 | `/writing-plans` |
| 测试驱动开发、写单元测试 | `/test-driven-development` |
| 并行任务拆分、多 Agent 协作 | `/dispatching-parallel-agents` |
| 主题系统、设计 Token | `/theme-factory` |
| Canvas 绘图、白板优化 | `/canvas-design` |
| E2E/Playwright 测试 | `/webapp-testing` |
| Web Artifacts 独立预览 | `/web-artifacts-builder` |
| MCP 工具注册 | `/mcp-builder` |
| Word 文档导出 | `/docx` |
| 头脑风暴需求 | `/brainstorming` |
| 按规划执行开发 | `/executing-plans` |
| 完成开发分支收尾 | `/finishing-a-development-branch` |
| 代码审查 | `/requesting-code-review` 或 `/receiving-code-review` |
| Git worktree 操作 | `/using-git-worktrees` |
| 完成前验证 | `/verification-before-completion` |
| 编写自定义 skill | `/writing-skills` |

## 开发原则

- 优先编辑现有文件，不要新建文件
- 不添加未使用的代码
- 不在代码里写多行注释（只保留必要的单行 WHY 注释）
- UI 改动需要在浏览器中验证
- 提交前跑 TypeScript 检查：`npx tsc --noEmit`
