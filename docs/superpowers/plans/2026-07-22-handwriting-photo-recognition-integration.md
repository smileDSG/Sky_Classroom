# 手写照片识别融合拍照搜题实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 保持现有拍照搜题前端样式，增强纸质手写文字和公式识别，并将确认结果继续交给现有解题链路。

**Architecture:** 扩展 `/api/sky/solve/recognize` 的手写提示词、置信度和歧义响应。高置信度结果继续自动解题；低置信度或存在歧义时，在现有结果区域显示可编辑确认，不新增页面。

**Tech Stack:** Next.js 16、React 19、TypeScript、Vitest。

---

### Task 1: 识别 API

- [ ] 为总体置信度、歧义和确认标记添加测试。
- [ ] 增强手写/印刷混合 OCR 提示词。
- [ ] 保持旧响应字段兼容。

### Task 2: 现有页面融合

- [ ] 扩展 `recognizeImage` 返回类型。
- [ ] 高置信度自动解题，低置信度显示可编辑确认。
- [ ] 确认后复用现有任务创建和解题 Agent 链路。

### Task 3: 验证

- [ ] 运行识别和解题相关测试。
- [ ] 运行变更文件 ESLint。
- [ ] 运行生产构建并启动 `3003` 验证。
