# 智能体框架架构

## 总览

sky-classroom（智眸无界）是一个基于 **LangGraph** 的多智能体交互式课堂系统。核心模式是 **Director → Agent 循环**：Director 节点决定下一个发言的 Agent，被选中的 Agent 生成回复和动作。系统支持 AI 教师、助教和学生角色实时协作授课。

```
┌─────────────────────────────────────────────┐
│  前端 (React + Agent Loop)                  │  ← UI 层
├─────────────────────────────────────────────┤
│  API 路由 (/api/chat)                       │  ← 接口层
├─────────────────────────────────────────────┤
│  LangGraph 编排 (Director + Agent)          │  ← 编排层
├─────────────────────────────────────────────┤
│  提示词系统 (Templates + Snippets)          │  ← 提示词层
├─────────────────────────────────────────────┤
│  智能体注册表 (Factory + Templates)         │  ← 角色层
└─────────────────────────────────────────────┘
```

---

## 1. LangGraph 编排引擎

**源码**: `lib/orchestration/graph-definition.ts`

编排图只有两个节点：

```
START → director ──(end)──→ END
            │
            └─(next)→ agent_generate ──→ director (循环)
```

- **director**: 决策节点 — 决定下一个发言的 Agent
- **agent_generate**: 执行节点 — 让被选中的 Agent 生成回复

状态通过 LangGraph 的 `Annotation.Root` 定义（`state-manager.ts`），追踪消息历史、当前 Agent、轮次计数、白板账本等。

---

## 2. Director（调度器）

**源码**: `lib/orchestration/director-node.ts`

Director 是系统的大脑，有三种调度策略：

| 场景 | 策略 | 是否调用 LLM |
|---|---|---|
| 单 Agent | 纯代码逻辑，直接调度 | 否 |
| 用户指定 Agent | 快速路径，直接 dispatch | 否 |
| 多 Agent | LLM 路由决策 | 是 |

多 Agent 路由流程：

1. 压缩对话历史为摘要
2. 构建包含所有 Agent 信息的 prompt
3. 调用 LLM 输出 `{"next_agent":"<id>"}` / `{"next_agent":"END"}` / `{"next_agent":"USER"}`
4. 解析决策并调度

**路由规则**（`director-base.md`）：

- 教师发言后优先调度学生
- 不重复调度本轮已发言的 Agent
- 追求角色多样性（teacher → student → assistant 循环）
- 推进对话进程（explain → question → deeper → perspective → summary）

---

## 3. Agent 节点

**源码**: `lib/orchestration/agent-node.ts`

每个 Agent 的执行流程：

```
构建 System Prompt → 组装消息 → LLM 流式生成 → 解析 JSON → 发射事件
```

关键机制：

- **动作过滤**: 根据角色和场景类型过滤允许的动作（教师可控制幻灯片，学生只能用白板）
- **记忆系统** (`agent-memory.ts`): 追踪每个 Agent 的历史发言
- **流式解析**: 边生成边解析 JSON 数组，实时发射 `text_delta` 和 `action` 事件
- **输出格式**: JSON 数组 — `type:"text"` 为说话，`type:"action"` 为执行动作

---

## 4. 智能体注册表与工厂

### AgentFactory

**源码**: `lib/orchestration/registry/factory.ts`

三种创建方式：

- `createFromTemplate()`: 从内置模板创建
- `createFromLLM()`: 从 LLM 生成的参数创建（动态生成的 Agent）
- `createCustom()`: 用户自定义创建

### 内置角色模板

| 角色 | 名称 | 性格 | 优先级 |
|---|---|---|---|
| **Teacher** | 星野老师 | 温柔优雅的蓝发教师，善于用生动例子引导 | 10 |
| **Assistant** | 芽衣助教 | 活泼开朗的双马尾少女，通俗易懂补充讲解 | 7 |
| **Student (curious)** | 小萌 | 戴猫耳的元气少女，对一切充满好奇 | 5 |
| **Student (analytical)** | 智也 | 戴细框眼镜的沉稳少年，擅长逻辑分析 | 6 |
| **Student (creative)** | 梦璃 | 神秘梦幻的紫发少女，无限想象力 | 4 |
| **Student (note-taker)** | 凛 | 认真严谨的黑长直少女，善于梳理知识点 | 5 |

### 组合规则引擎

**源码**: `lib/orchestration/registry/combination-rules.ts`

根据课程信息自动推荐 Agent 组合：

| 规则 | 条件 | 组合 |
|---|---|---|
| Minimal | ≤3 个场景 | 1 teacher + 2 students |
| Workshop | 有 interactive/PBL | 1 teacher + 2 assistants + 3 students |
| Discussion | 纯 slide 且 >5 场景 | 1 teacher + 4 students |
| Assessment | 有 quiz | 1 teacher + 1 assistant + 2 students |
| Standard | 默认 | 1 teacher + 1 assistant + 3 students |

---

## 5. 提示词系统

**源码**: `lib/prompts/`

基于文件的模板引擎，支持三种占位符：

| 语法 | 含义 |
|---|---|
| `{{variableName}}` | 变量插值 |
| `{{snippet:name}}` | 文件片段引入 |
| `{{#if condition}}...{{/if}}` | 条件渲染 |

核心模板：

- `agent-base.md`: 所有 Agent 共享的基础 prompt（教学原则、输出格式、动作规范）
- `director-base.md`: Director 路由决策 prompt
- 角色/人设 `.md` 文件：角色指南、学生人设描述

---

## 6. 前端 Agent Loop

**源码**: `lib/chat/agent-loop.ts`

前端驱动的多 Agent 循环，与 eval 共享同一套逻辑：

```
while (turnCount < maxTurns) {
  1. 刷新 store 状态
  2. POST /api/chat
  3. 解析 SSE 流事件
  4. 检查退出条件（END / USER / maxTurns / 空轮次）
}
```

退出条件：Director 说 END、cue 用户、达到最大轮次、连续空回复、中止信号。

---

## 7. PBL Agent MCP

**源码**: `lib/pbl/mcp/agent-mcp.ts`

独立于课堂编排的项目式学习（PBL）Agent 系统，用于生成阶段的 Agent 角色管理：

- `AgentMCP` 类：CRUD 操作管理 PBL 项目中的 Agent 角色
- 每个 PBL Agent 有 `system_prompt`、`default_mode`、`delay_time`、`actor_role`、`role_division` 等属性
- 支持在 `PBLProjectConfig` 上创建/更新/删除 Agent

---

## 8. 解题助手模板

**源码**: `lib/orchestration/registry/templates/solvers/`

独立的解题 Agent 体系：

| 模板 | 学科 |
|---|---|
| `universal.ts` | 全科（数学、物理、化学、语文、英语） |
| `science.ts` | 理科 |
| `humanities.ts` | 文科 |

解题助手以分步骤展示解题过程、标注关键知识点、提供同类练习建议为特色。

---

## 9. 云端智囊（独立工具 Agent 集）

**源码**: `lib/agents/cloud-mind/`

云端智囊是一组**独立的单 Agent 工具集**，与课堂多智能体系统完全不同。没有编排层、没有 Director、没有状态图，每个 Agent 是一个独立函数，直接调用 LLM 完成特定任务。

### 架构对比

| 特性 | 课堂多智能体 | 云端智囊 |
|---|---|---|
| 编排方式 | LangGraph 状态图 + Director 循环 | 无编排，每个 Agent 独立函数 |
| Agent 数量 | 6 个角色实时协作 | 5 个独立工具，各自运行 |
| LLM 调用 | 通过 LangGraph 适配器 | 直接用 Vercel AI SDK |
| 输出格式 | JSON 数组（text + action 混合） | 结构化 JSON（每种 Agent 不同 schema） |
| 流式处理 | SSE 事件流 + 解析器 | AI SDK 内置 `streamText` |
| LLM 提供商 | 可配置多种 | 主用 DeepSeek |

### 架构总览

```
┌─────────────────────────────────────────────┐
│  前端页面 (/sky/cloud-mind/*)               │
├─────────────────────────────────────────────┤
│  独立 Agent 函数 (直接调用 LLM)             │  ← 无编排层
├─────────────────────────────────────────────┤
│  Vercel AI SDK (generateText / streamText)  │
├─────────────────────────────────────────────┤
│  DeepSeek (deepseek-chat)                   │
├─────────────────────────────────────────────┤
│  RAG 知识库检索 (可选)                      │
└─────────────────────────────────────────────┘
```

### 9.1 Slides Agent（PPT 课件讲解）

**源码**: `lib/agents/cloud-mind/slides-agent.ts`

- **输入**: 课件文本内容 + 主题
- **输出**: `SlidesAnalysisOutput` — 大纲、逐页讲解脚本、关键概念、互动建议、板书要点、课后练习
- **特性**: 支持 RAG 检索已有课件库补充参考、支持流式输出
- **System Prompt**: 要求以教师口吻编写讲解词，每页 200-400 字

### 9.2 Memory Cards Agent（记忆卡片）

**源码**: `lib/agents/cloud-mind/memory-cards-agent.ts`

- **输入**: 知识点/学习内容 + 主题 + 卡片数量
- **输出**: `MemoryCardDeck` — 正面问题、背面答案、助记技巧、难度标签、艾宾浩斯复习间隔
- **特性**: RAG 检索已有卡片库、按难度分类（easy/medium/hard）、自动规划复习节奏
- **System Prompt**: 记忆术专家角色，支持口诀、联想、故事串联等助记技巧

### 9.3 Write Agent（智能写作）

**源码**: `lib/agents/cloud-mind/write-agent.ts`

- **输入**: 主题 + 写作类型 + 字数要求 + 补充要求
- **输出**: 流式文本（直接输出文章）
- **支持体裁**: 作文（记叙/议论/说明）、学术论文、创意写作（小说/散文/诗歌）、摘要总结
- **特性**: 纯流式输出，无 JSON 解析

### 9.4 Translate Agent（智能翻译）

**源码**: `lib/agents/cloud-mind/translate-agent.ts`

- **输入**: 文本 + 源语言 + 目标语言
- **输出**: `TranslateOutput` — 翻译结果、备选翻译、翻译说明
- **支持语言**: 中/英/日/韩/法/德
- **特性**: 同时支持同步 `generateText` 和流式 `streamText`，temperature 较低（0.3）保证准确性

### 9.5 Quiz Agent（智能出题）

**源码**: `lib/agents/cloud-mind/quiz-agent.ts`

- **输入**: 学科 + 难度 + 知识点 + 数量
- **输出**: `QuizOutput` — 选择题列表（题目、4 个选项、正确答案索引、详细解析）
- **支持学科**: 数学、物理、化学、生物、语文、英语
- **特性**: RAG 检索参考资料辅助出题、三种难度级别（基础/进阶/挑战）

### 公共基础设施

#### RAG 管道

**源码**: `lib/agents/rag/`

部分 Agent 共享的检索增强生成管道：

- `document-chunker.ts` — 文档分块
- `vector-store.ts` — 向量存储
- `retriever.ts` — 检索器，支持语义搜索 + LLM 重排序

#### 个性化系统

**源码**: `lib/agents/personalization-utils.ts`

根据用户设置动态调整 Agent 行为：

| 设置项 | 选项 |
|---|---|
| 教育阶段 | 小学/初中/高中/大学本科/研究生 |
| 学习风格 | 视觉型/听觉型/阅读型/实践型/平衡型 |
| 回答详细程度 | 简洁/标准/详细/全面 |
| AI 性格 | 友善/专业/鼓励/严格/幽默 |
| 偏好学科 | 用户自定义 |
| 自定义指令 | 用户自定义 |
