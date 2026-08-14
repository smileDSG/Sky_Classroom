# Agent 能力升级方案调研记录

## 当前仓库事实

- `lib/ai/agent-memory.ts` 已有短期对话记忆和长期事实记忆。
- `lib/orchestration/agent-memory.ts` 已有多 Agent 的 typed memory、最近轮次和关键事实。
- `lib/adaptive-learning/profile/event-recorder.ts` 已有统一学习事件写入、知识状态更新、能力证据记录和 `correlationId`。
- `lib/adaptive-learning/decision/learner-decision.ts` 已有 diagnostic/teach/review/quiz 决策和 fallback 规则基础。
- `lib/orchestration/director-node.ts` 已有 Director 的单 Agent 快速路径、多 Agent LLM 路由和回合限制。
- `lib/orchestration/graph-definition.ts` 已有 LangGraph director -> agent_generate -> director 循环。
- `lib/orchestration/registry/templates/students/` 已有 curious、analytical、creative、note-taker 学生模板。
- `lib/adaptive-learning/contracts/learner.ts` 已有 learning event、evidence quality、knowledge state、behavior payload 的 Zod 契约。
- `migrations/004_mysql_storage.sql` 已有基于 JSON 的通用 MySQL storage_entries 表。
- `package.json` 已有 `@langchain/langgraph`、`@langchain/core`、`mysql2`、`vitest`；未发现 Mem0、AutoGen、APScheduler 的当前运行依赖。

## 架构判断

当前项目不应同时维护 Next.js/TypeScript Agent 和 Python/SpringBoot Agent 两条重复业务链。Python + PostgreSQL + Qdrant + AutoGen 可以作为后期独立 Agent 服务或分析服务，但原型阶段直接使用现有 TypeScript 能力更小、更容易验证。

## 重要边界

- 反思画像是“带证据的学习行为假设”，不是 verified mastery。
- 反事实推演是预期影响模拟，不是真实因果结论。
- `expectedEffects` 和 `observed outcomes` 必须使用不同字段和不同事件来源。
- 数据必须通过 `decisionId`/`correlationId` 串联，而不是仅按时间猜测因果关系。
- 用户明确指定主题时，决策器只能调整教学策略，不能覆盖主题。
- 先记录数据，再做 DoWhy 或模型微调。
