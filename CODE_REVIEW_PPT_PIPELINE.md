# PPT 生成全链路 Code Review — 最终综合报告

> **Date:** 2026-05-29
> **Reviewers:** 4 模块并行 agent review + manual review 交叉验证
> **Coverage:** Pipeline 编排 → Agent 提示 → Schema 验证 → 渲染执行 → 导出预览 → API 层 → LLM 包装器

## 统计概览

| Severity | Count |
|----------|-------|
| 🔴 Critical | 15 |
| 🟠 High | 27 |
| 🟡 Medium | 30 |
| 🟢 Low | 19 |

## 最严重风险 Top 6

1. **路径遍历** — `preview/route.ts`, `pptx-preview.ts` 任意文件读取+公开下载
2. **SSRF** — `isSafeImageUrl` 是死代码，`pptx-image-handler.ts` 从未调用
3. **Pipeline timer 泄漏** — 失败路径 heartbeat 永不清理
4. **QA 失败默认满分** — `contentScore` 保持 100
5. **Section Agent validation bypass** — auto-fix 失败仍返回 success
6. **生成路由无认证/限制** — 匿名用户可触发昂贵 pipeline

## 关键洞察：防御代码已存在，但从未启用

- `lib/server/ssrf-guard.ts` — 实现完善，但 `pptx-image-handler.ts` 未调用，且非生产环境被禁用
- `lib/slides/agent/design-dna.ts` — `validateDesignDNA()`/`sanitizeColors()`/`sanitizeFonts()` 均已实现，但 `generate/route.ts` 从未调用

## 修复优先级路线图

### P0 — 本周（安全 + 数据正确性）
- 修复所有 path traversal
- 启用 SSRF 防护
- 修复 timer leak
- 修复 audit error 归因
- QA 失败默认 pass: false
- Section Agent auto-fix 失败返回 success: false
- 修复 cleanJsonText()
- 修复 png-converter.ts spawn timeout

### P1 — 两周内（可靠性 + 访问控制）
- 添加 API 认证
- 添加 rate limiting + job 上限
- 添加 designDNA 验证
- 添加 minPages/maxPages/topic Zod 验证
- 添加并发信号量
- 添加 pipeline 整体超时
- Surface instruction executor 错误
- QA LLM 输出 Zod 验证
- fetch 响应大小限制 + timeout
- addText/table/chart/latex Zod length 限制
- PPTX TTL 清理

### P2 — 一个月内（代码质量）
- 替换 .passthrough() 为 strict union
- 对齐 schema title 限制
- 降低 temperature
- Prompt injection 防护
- trunc() grapheme-aware
- 删除 buildFallbackContent 死代码
- 区分可重试/不可重试错误
- 错误信息脱敏

(完整版保存在 lib/slides/agent/.code-review-full.md)
