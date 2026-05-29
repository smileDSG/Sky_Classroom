# 天空课堂 (Sky Classroom) — 项目文档报告

> 生成日期：2026-05-29
> 版本：v0.2.1
> 许可证：AGPL-3.0

---

## 一、项目概述

**天空课堂** 是一个 AI 驱动的智能互动学习平台，基于多 Agent 协作架构，支持从 PDF 上传自动生成沉浸式多角色课堂体验。项目采用 Next.js 16 + React 19 + TypeScript 技术栈，集成 LangGraph 状态图编排、Vercel AI SDK 多模型接入、CopilotKit 智能助手等前沿 AI 技术。

### 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16.1.2, React 19.2.3, TypeScript 5.x |
| AI/LLM | Vercel AI SDK 6.x, LangGraph, CopilotKit |
| 状态管理 | Zustand 5.x, Immer |
| 数据库 | Supabase (PostgreSQL), MySQL2 |
| 认证 | JWT (jose), bcryptjs |
| UI | Tailwind CSS 4, Radix UI, shadcn, Motion (Framer Motion) |
| 富文本 | ProseMirror |
| 图表 | ECharts 6, @xyflow/react |
| 数学渲染 | KaTeX, Temml, mathml2omml |
| PPT 导出 | pptxgenjs (workspace) |
| 测试 | Vitest, Playwright |
| 包管理 | pnpm 10.x |

---

## 二、功能模块全景

### 2.1 天空课堂首页 (Sky Home)

- **开场动画序列** — 云朵飘动 + 太阳光线 + 书本下落 + 白色扩散过渡 (`components/sky/home/intro-sequence.tsx`)
- **问候语区域** — 基于时间段的动态问候 + 学习统计（今日学习时长、连续打卡、知识掌握度）(`components/sky/home/greeting-section.tsx`)
- **课堂生成入口** — PDF 上传 → AI 解析 → 多 Agent 课堂生成 (`components/sky/home/hero-input.tsx`)
- **课堂列表网格** — 已有课堂的缩略图卡片展示 (`components/sky/home/classroom-grid.tsx`)
- **快捷入口** — 云端智囊、AI 智能生成等 (`components/sky/home/quick-access-grid.tsx`)
- **模板选择器** — 内置 9 套学科模板 + 用户自定义模板 (`lib/templates/`)

### 2.2 多 Agent 课堂系统 (Classroom)

**核心架构：Director-Agent 循环**

```
START → director ──(end)──→ END
            │
            └─(next)→ agent_generate ──→ director (loop)
```

基于 LangGraph StateGraph 的编排引擎，核心组件：

| 组件 | 文件 | 职责 |
|------|------|------|
| Director Node | `lib/orchestration/director-node.ts` | 调度中心，决定下一个发言的 Agent |
| Agent Node | `lib/orchestration/agent-node.ts` | 执行单个 Agent 的生成 |
| Graph Definition | `lib/orchestration/graph-definition.ts` | LangGraph 拓扑定义 |
| State Manager | `lib/orchestration/state-manager.ts` | 课堂状态管理 |
| Prompt Builder | `lib/orchestration/prompt-builder.ts` | 动态 Prompt 组装 |
| Rule Engine | `lib/orchestration/rule-engine.ts` | 发言规则引擎 |
| Role Balance | `lib/orchestration/role-balance.ts` | 角色发言平衡 |
| Context Pruner | `lib/orchestration/context-pruner.ts` | 上下文窗口裁剪 |
| Agent Memory | `lib/orchestration/agent-memory.ts` | Agent 记忆管理 |
| Conversation Compression | `lib/orchestration/conversation-compression.ts` | 对话压缩 |

**Agent 角色模板** (`lib/orchestration/registry/templates/`):

| 角色 | 模板文件 | 说明 |
|------|----------|------|
| 星野老师 (Teacher) | `teacher.ts` | 主讲教师，温柔优雅，引导式教学 |
| 助教 (Assistant) | `assistant.ts` | 辅助答疑，补充知识点 |
| 好奇型学生 (Curious) | `students/curious.ts` | 善于提问，推动课堂深入 |
| 分析型学生 (Analytical) | `students/analytical.ts` | 逻辑推理，解题导向 |
| 创意型学生 (Creative) | `students/creative.ts` | 发散思维，联想类比 |
| 笔记型学生 (Note-taker) | `students/note-taker.ts` | 整理归纳，输出笔记 |
| 科学解题器 (Science Solver) | `solvers/science.ts` | 理科题目求解 |
| 人文解题器 (Humanities Solver) | `solvers/humanities.ts` | 文科题目求解 |
| 通用解题器 (Universal Solver) | `solvers/universal.ts` | 通用题目求解 |

**课堂生成流水线**:

1. 用户上传 PDF → `parse-pdf` API 解析
2. `generate-classroom` API 创建后台 Job
3. `classroom-job-runner.ts` 驱动 LangGraph 编排
4. Director 节点循环调度各 Agent 发言
5. 生成完成后通知用户审阅/取消
6. `approve` API 确认入库

### 2.3 解题引擎 (Solve Engine)

基于 LangGraph 的 5 节点流水线：

```
START → checkSolveCache → checkQuestionBank → routeToAgent → solveWithAgent → gradeAnswer → generateOutput → END
             │(hit)             │(hit)
             └──────────────────┴──────────────────────────────────────────┘
```

| 组件 | 文件 | 职责 |
|------|------|------|
| Solve Graph | `lib/solve/solve-graph.ts` | LangGraph 状态图定义 |
| Solver Agent | `lib/solve/solver-agent.ts` | LLM 求解节点 |
| Grader | `lib/solve/grader.ts` | 答案评分引擎（LLM + 规则混合） |
| Four-Part Output | `lib/solve/four-part-output.ts` | 四段式输出生成器 |
| Question Bank | `lib/solve/question-bank.ts` | 题库系统（自优化） |
| Solve Cache | `lib/solve/solve-cache.ts` | 求解缓存（近似匹配 0.70） |
| Streaming Solver | `lib/solve/streaming-solver.ts` | 流式求解 |
| Error Classifier | `lib/solve/error-classifier.ts` | 错误分类器 |
| Confidence Validator | `lib/solve/confidence-validator.ts` | 置信度校验 |
| Solver Prompts | `lib/solve/solver-prompts.ts` | 求解系统提示词 |

### 2.4 云端智囊 (Cloud Mind)

多功能 AI 工具集，位于 `app/sky/cloud-mind/`：

| 功能 | 页面 | Agent | 说明 |
|------|------|-------|------|
| 拍照解题 | `solve/page.tsx` | Solve Agent | 图片 OCR + AI 求解 |
| PPT 生成 | `slides/page.tsx` | Slides Agent | PDF → 演示文稿 |
| 智能出题 | `quiz/page.tsx` | Quiz Agent | 基于知识点自动生成题目 |
| AI 写作 | `write/page.tsx` | Write Agent | 多风格写作辅助 |
| AI 翻译 | `translate/page.tsx` | Translate Agent | 多语言翻译 |
| 记忆卡片 | `memory/page.tsx` | Memory Cards Agent | 艾宾浩斯记忆卡片 |
| 知识图谱 | `knowledge/` | — | 错题关联知识网络可视化 |

**Cloud Mind Agent 清单** (`lib/agents/cloud-mind/`):

- `slides-agent.ts` — PPT 幻灯片生成
- `quiz-agent.ts` — 智能出题
- `write-agent.ts` — AI 写作
- `translate-agent.ts` — AI 翻译
- `memory-cards-agent.ts` — 记忆卡片生成

### 2.5 PPT 生成系统

**12 套模板映射**，支持分步生成、字体自适应、表格样式保留：

- 生成流程：PDF 解析 → 大纲审阅 → 模板选择 → 分步生成 → 进度追踪
- 导出模式：在线预览 / PPTX 导出 / WPS 模板 + AI 前景渲染
- 封面生成：独立 API `generate-covers`
- 模板推理：`infer-template` API 自动匹配最佳模板

### 2.6 学习系统

| 功能 | 说明 |
|------|------|
| 学习统计 | 今日学习时长、连续打卡天数、知识掌握度 |
| 错题本 | 错题收集 + 分类 + 重练 |
| 知识图谱 | @xyflow/react 交互式知识网络（缩放、平移、拖拽） |
| 艾宾浩斯复习 | 基于遗忘曲线的复习计划 |
| 题库系统 | 自优化题库，支持相似题推荐 |
| 签到系统 | 每日签到打卡 |

### 2.7 虚拟形象系统 (Avatar)

- 虚拟形象弹窗 (`AvatarSpeechPopup`) — Agent 发言时显示角色头像 + 气泡
- 小镜助手 (Kagami) — 双模式 AI 助手：动漫傲娇模式 / 专业模式 (`components/ai/kagami-panel.tsx`)
- 角色头像系统 — 教师、学生、助教各有独立头像

### 2.8 白板系统

用户绘图工具集 (`components/whiteboard/`):
- 画笔、形状、线条、橡皮擦、文字、激光笔
- 图形预览优化 + 文字拖拽编辑
- viewBox 修复

### 2.9 用户系统

| 功能 | API | 说明 |
|------|-----|------|
| 注册 | `auth/register` | 邮箱注册 |
| 登录 | `auth/login` | JWT 认证 |
| 密码重置 | `auth/forgot-password` / `reset-password` | 邮箱验证码 |
| 个人中心 | `user/profile` | 用户信息管理 |
| 个性化 | `user/personalization` | 主题偏好、语言设置 |
| 头像 | `user/avatar` | 头像上传 |
| 用量统计 | `usage/check` | 使用量追踪 |
| 套餐计费 | `billing/orders` | 计划管理 |

### 2.10 多语言支持 (i18n)

- 支持 6 种语言：中文、英文、日文、俄文等
- i18next + react-i18next
- Prompt 模板 i18n (`lib/prompts/i18n/`)

### 2.11 其他功能

| 功能 | 说明 |
|------|------|
| 图片生成 | Seedream/OpenAI/Qwen/Gemini/Grok 多模型 |
| 视频生成 | Seedance/Kling/Veo/Sora/Grok |
| TTS 语音 | Azure Voices 集成 |
| Web 搜索 | 搜索增强生成 |
| PDF 解析 | unpdf 库 |
| PWA 离线 | Service Worker 支持 |
| 暗色主题 | next-themes 深色/浅色切换 |
| 性能监控 | `api/admin/performance` |

---

## 三、AI Provider 接入架构

### 3.1 支持的 AI Provider (16 个)

| Provider | 类型 | 代表模型 |
|----------|------|----------|
| OpenAI | openai | GPT-5.5, GPT-5.4 Pro, GPT-5.4, GPT-5.4 Mini, GPT-5.4 Nano |
| Anthropic | anthropic | Claude Opus 4.7, Opus 4.6, Sonnet 4.6, Sonnet 4.5, Haiku 4.5 |
| Google | google | Gemini 3.1 Pro, 3 Flash, 2.5 Flash, 2.5 Pro |
| GLM | openai | GLM-5.1, GLM-5, GLM-4.7 系列 |
| Qwen | openai | Qwen3.6 Max/Plus/Flash, Qwen3.5 系列 |
| DeepSeek | openai | DeepSeek V4 Pro/Flash |
| Kimi | openai | Kimi K2.6, K2.5, K2 Thinking |
| MiniMax | anthropic | MiniMax M2.7 |
| SiliconFlow | openai | DeepSeek/Qwen/Kimi/GLM 托管版 |
| 豆包 (Doubao) | openai | Seed 2.0 Pro/Lite/Mini |
| OpenRouter | openai | DeepSeek V4 托管版 |
| Grok | openai | Grok 4.20 Reasoning/Multi-Agent |
| 腾讯混元 | openai | Hy3 Preview |
| 小米 MiMo | openai | MiMo V2.5 Pro/V2.5 |
| Ollama | openai | 本地模型（Llama 3.3, Gemma 3） |
| Lemonade | openai | 本地 Gemma 4 26B |

### 3.2 Provider 抽象层

- **统一接口** — 通过 Vercel AI SDK 的 `createOpenAI` / `createAnthropic` / `createGoogleGenerativeAI` 统一接入
- **Thinking 策略** — `lib/ai/strategies/thinking-strategy.ts` 处理不同模型的思维链参数
- **MiniMax 适配器** — `lib/ai/adapters/minimax-adapter.ts` 处理 MiniMax 的 Anthropic 兼容 API
- **自定义 Provider** — 支持用户通过 localStorage 添加自定义 OpenAI 兼容 Provider
- **模型元数据** — `lib/ai/model-metadata.ts` 管理模型能力标注

---

## 四、项目搭建日志

### 第一阶段：基础架构 (2026-05-15 ~ 2026-05-16)

| 日期 | 提交 | 内容 |
|------|------|------|
| 05-15 | `21b042e` | **项目初始化** — .gitignore + 基础结构 |
| 05-15 | `0578bc5` | Captain 前置任务 — 类型系统、Provider 层、编排层、API 层 |
| 05-15 | `76e238f` | 前端测试套件、预设系统、UI 错误/虚拟列表组件 |
| 05-16 | `d41acf4` | OpenMAIC v0.2.1 基座 + B-001 规划文档 |
| 05-16 | `3372737` | **Prompt 系统 Phase 1** — 模块化 Prompt 基础设施 |
| 05-16 | `a7f1cde` | **Prompt 系统 Phase 2** — 核心模板、角色、学生人设 |
| 05-16 | `3462f40` | 第一次完整项目提交 |

### 第二阶段：模块开发 (2026-05-16 ~ 2026-05-19)

| 日期 | 提交 | 内容 |
|------|------|------|
| 05-16 | `0dccf4c` | **模块 B 重构开发** — 前端组件重构 |
| 05-16 | `76e238f` | 前端测试套件 + 预设系统 |
| 05-17 | `dcc4941` | 天空课堂基础设施 + Captain 前置任务 |
| 05-17 | `759dcfc` | **模块 C 重构** — Store 拆分 + Agent Bar 组件拆分 + 测试 |
| 05-18 | `f9878cc` | **解题图谱 Phase 1** — LangGraph StateGraph 定义（5 节点） |
| 05-18 | `d57211f` | Solver Agent 节点 — 混合策略实现 |
| 05-18 | `5c99a32` | **评分引擎** — LLM + 规则混合评分 |
| 05-18 | `a6d2142` | **四段式输出生成器** |
| 05-18 | `a77e961` | **题库系统** — 自优化题库 |
| 05-19 | `ec5cacb` | **模块 B 完成** (B-001~B-005) |
| 05-19 | `3d18668` | **模块 C 完成** — 学习数据、AI 助手、仪表盘 |
| 05-19 | `3530ea2` | **解题页面 UI** — 多模态输入 + 结果展示 |
| 05-19 | `b62a659` | **API 基础设施** — 存储抽象层 |
| 05-19 | `818390d` | **184 个单元测试** — API 中间件 + 存储层 |

### 第三阶段：功能完善 (2026-05-19 ~ 2026-05-23)

| 日期 | 提交 | 内容 |
|------|------|------|
| 05-20 | `a83eabf` | **用户认证系统 + 用量限制 & 计费** |
| 05-20 | `dd9e32b` | Phase 6 — 模板库、PWA 离线、性能仪表盘 |
| 05-20 | `c88c238` | **模块 C 完整版** — 可拖拽答疑按钮 + 艾宾浩斯复习计划 UI |
| 05-20 | `2468bea` | **小镜课堂虚拟形象** + API 认证修复 |
| 05-21 | `7bb6573` | 模板选择器 + 计费 UI 接入首页 |
| 05-23 | `f22fd68` | **虚拟形象气泡弹窗** — AgentSpeechPopup 组件 |
| 05-23 | `ac2953a` | **PPT 导出三模式** + WPS 模板 + 虚拟形象系统 |
| 05-23 | `707af03` | **i18n 全覆盖** — 6 语言、RTL 支持 |

### 第四阶段：高级功能 (2026-05-24 ~ 2026-05-27)

| 日期 | 提交 | 内容 |
|------|------|------|
| 05-24 | `e15f7e1` | **小镜双模式** — 动漫傲娇 / 专业 AI 助手切换 |
| 05-24 | `d44d334` | **数学渲染** — 流式求解 + 全数学符号覆盖 |
| 05-25 | `8adc988` | 后台解题 Job + 导航时照片恢复 |
| 05-25 | `9ed10d6` | **PPT 模板包生成系统** — 12 套模板映射、分步生成 |
| 05-25 | `21b6ea0` | **课堂后台生成** — 两阶段审阅 + 取消支持 |
| 05-26 | `8bb9d13` | PPT 模板包优化 — 进度条修复、目录项修复 |
| 05-26 | `cd49e03` | **课堂 UI 重设计** — 话题卡片式会话列表 |
| 05-26 | `de48105` | 聊天气泡重设计 — 角色样式 + 头像光环 |
| 05-27 | `b5f2696` | **电影级开场动画** — 云朵 + 太阳 + 书本 |
| 05-27 | `4b909b0` | **多 Job 课堂生成** — 实时进度 + 会话持久化 |
| 05-27 | `26287d4` | 批量更新 — 解题引擎、云端智囊、UI 页面 |
| 05-27 | `0f0c82d` | **知识图谱交互** — 缩放、平移、拖拽 |
| 05-27 | `9d424d2` | 问候语组件 — 时间问候 + 快速统计 |

### 第五阶段：Beta 测试 & 优化 (2026-05-28)

| 日期 | 提交 | 内容 |
|------|------|------|
| 05-28 | `fbe5cc6` ~ `430e787` | **Beta 测试系统完整实现** — HMAC 签名 Cookie、邀请码门控、反馈面板、管理后台、CLI 工具 |
| 05-28 | `b6d5c8a` | **白板绘图工具** — 画笔/形状/线条/橡皮擦/文字/激光笔 |
| 05-28 | `05ffc3e` | **重构：移除 Beta 系统**，新增 MySQL 存储 + 套餐计费 |
| 05-28 | `92a4dc2` | Hydration 错误修复 + 云端助手 UI 优化 |
| 05-28 | `beecca6` | **PR #37 合并** — 模块 C 最终整合 |

---

## 五、API 路由清单

### 认证相关
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/logout` | POST | 用户登出 |
| `/api/auth/me` | GET | 获取当前用户 |
| `/api/auth/refresh` | POST | 刷新 Token |
| `/api/auth/forgot-password` | POST | 忘记密码 |
| `/api/auth/reset-password` | POST | 重置密码 |
| `/api/auth/verify-email` | POST | 邮箱验证 |
| `/api/auth/seed-admin` | POST | 初始化管理员 |

### 课堂生成
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/generate-classroom` | POST | 创建课堂生成 Job |
| `/api/generate-classroom/[jobId]` | GET | 查询 Job 状态 |
| `/api/generate-classroom/[jobId]/approve` | POST | 审阅通过 |
| `/api/generate-classroom/[jobId]/cancel` | POST | 取消 Job |
| `/api/classroom` | GET/POST | 课堂 CRUD |

### AI 生成
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/generate/scene-content` | POST | 场景内容生成 |
| `/api/generate/scene-actions` | POST | 场景动作生成 |
| `/api/generate/scene-outlines-stream` | POST | 大纲流式生成 |
| `/api/generate/agent-profiles` | POST | Agent 人设生成 |
| `/api/generate/image` | POST | 图片生成 |
| `/api/generate/video` | POST | 视频生成 |
| `/api/generate/tts` | POST | 语音合成 |

### 天空课堂功能
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/sky/solve/jobs` | POST | 创建解题 Job |
| `/api/sky/solve/recognize` | POST | 图片 OCR 识别 |
| `/api/sky/solve/grade` | POST | 答案评分 |
| `/api/sky/solve/explain` | POST | 解题详解 |
| `/api/sky/solve/explain-stream` | POST | 流式解题详解 |
| `/api/sky/slides/generate` | POST | PPT 生成 |
| `/api/sky/slides/generate-covers` | POST | PPT 封面生成 |
| `/api/sky/slides/export-pptx` | POST | PPTX 导出 |
| `/api/sky/slides/infer-template` | POST | 模板推理 |
| `/api/sky/slides/preview` | GET | 幻灯片预览 |
| `/api/sky/slides/avatar-speak` | POST | 虚拟形象发言 |
| `/api/sky/slides/avatars` | GET | 获取虚拟形象列表 |
| `/api/sky/cloud-mind/quiz` | POST | 智能出题 |
| `/api/sky/cloud-mind/write` | POST | AI 写作 |
| `/api/sky/cloud-mind/translate` | POST | AI 翻译 |
| `/api/sky/cloud-mind/memory-cards` | POST | 记忆卡片 |
| `/api/sky/cloud-mind/knowledge` | GET | 知识图谱 |
| `/api/sky/cloud-mind/slides` | POST | 云端智囊 PPT |
| `/api/sky/mistakes` | GET/POST | 错题本 |
| `/api/sky/question-bank` | GET | 题库 |
| `/api/sky/knowledge-graph` | GET | 知识图谱数据 |
| `/api/sky/learning-stats` | GET | 学习统计 |
| `/api/sky/review/due` | GET | 复习计划 |
| `/api/sky/check-in` | POST | 每日签到 |
| `/api/sky/assistant` | POST | AI 助手对话 |

### 用户 & 计费
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/user/profile` | GET/PUT | 用户资料 |
| `/api/user/avatar` | POST | 头像上传 |
| `/api/user/personalization` | GET/PUT | 个性化设置 |
| `/api/user/change-password` | POST | 修改密码 |
| `/api/usage/check` | GET | 用量查询 |
| `/api/billing/orders` | GET/POST | 订单管理 |
| `/api/billing/webhook/mock` | POST | 模拟支付回调 |

### 基础设施
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/parse-pdf` | POST | PDF 解析 |
| `/api/chat` | POST | 通用聊天 |
| `/api/transcription` | POST | 语音转文字 |
| `/api/web-search` | POST | Web 搜索 |
| `/api/proxy-media` | GET | 媒体代理 |
| `/api/telemetry` | POST | 遥测数据 |
| `/api/server-providers` | GET | 服务端 Provider 列表 |
| `/api/verify-model` | POST | 模型验证 |
| `/api/verify-image-provider` | POST | 图片 Provider 验证 |
| `/api/verify-video-provider` | POST | 视频 Provider 验证 |
| `/api/verify-pdf-provider` | POST | PDF Provider 验证 |
| `/api/azure-voices` | GET | Azure 语音列表 |
| `/api/admin/performance` | GET | 性能监控 |

---

## 六、目录结构

```
sky-classroom/
├── app/                          # Next.js App Router
│   ├── api/                      # API 路由 (70+ endpoints)
│   ├── auth/                     # 认证页面
│   ├── classroom/                # 课堂页面
│   ├── sky/                      # 天空课堂主应用
│   │   ├── assistant/            # AI 助手
│   │   ├── cloud-mind/           # 云端智囊工具集
│   │   │   ├── memory/           # 记忆卡片
│   │   │   ├── quiz/             # 智能出题
│   │   │   ├── slides/           # PPT 生成
│   │   │   ├── solve/            # 拍照解题
│   │   │   ├── translate/        # AI 翻译
│   │   │   └── write/            # AI 写作
│   │   ├── dashboard/            # 学习仪表盘
│   │   ├── learning/             # 学习中心
│   │   ├── slides/               # 幻灯片课堂
│   │   └── solve/                # 解题页面
│   ├── settings/                 # 设置页面
│   └── generation-*/             # 生成进度页面
├── components/                   # React 组件
│   ├── agent/                    # Agent 相关组件
│   ├── ai/                       # AI 助手组件 (Kagami)
│   ├── classroom/                # 课堂组件
│   ├── generation/               # 生成组件
│   ├── roundtable/               # 圆桌讨论
│   ├── scene-renderers/          # 场景渲染器
│   ├── sky/                      # 天空课堂组件
│   │   ├── home/                 # 首页组件
│   │   ├── slides/               # 幻灯片组件
│   │   └── solve/                # 解题组件
│   ├── slide-renderer/           # 幻灯片渲染器
│   ├── stage/                    # 舞台组件
│   ├── templates/                # 模板选择器
│   ├── ui/                       # UI 基础组件 (shadcn)
│   └── whiteboard/               # 白板组件
├── lib/                          # 核心库
│   ├── agents/                   # Agent 实现
│   │   ├── cloud-mind/           # 云端智囊 Agent
│   │   └── rag/                  # RAG 检索增强
│   ├── ai/                       # AI Provider 抽象层
│   ├── orchestration/            # 多 Agent 编排引擎
│   │   ├── registry/             # Agent 注册表
│   │   │   └── templates/        # 角色模板
│   │   └── summarizers/          # 对话摘要器
│   ├── prompts/                  # Prompt 工程
│   │   ├── core/                 # 核心 Prompt
│   │   ├── generators/           # 生成器 Prompt
│   │   ├── i18n/                 # 多语言 Prompt
│   │   ├── roles/                # 角色 Prompt
│   │   ├── snippets/             # Prompt 片段
│   │   ├── student-personas/     # 学生人设
│   │   └── templates/            # Prompt 模板
│   ├── solve/                    # 解题引擎
│   ├── templates/                # 课程模板
│   │   └── builtin/              # 内置学科模板
│   ├── classroom/                # 课堂会话管理
│   ├── store/                    # Zustand 状态管理
│   ├── hooks/                    # React Hooks
│   ├── i18n/                     # 国际化
│   └── ...                       # 其他工具库
├── docs/                         # 文档
├── migrations/                   # 数据库迁移
├── packages/                     # Workspace 包
│   ├── mathml2omml/              # MathML → OMML 转换
│   └── pptxgenjs/                # PPT 生成库
├── public/                       # 静态资源
│   ├── avatars/                  # 角色头像
│   ├── logos/                    # Provider Logo
│   └── logo-icon.svg             # 网站图标
├── scripts/                      # 脚本工具
├── tests/                        # 测试文件
└── e2e/                          # E2E 测试
```

---

## 七、团队协作

### 分支策略

| 分支 | 用途 |
|------|------|
| `master` | 主分支，生产就绪 |
| `Dev-ryx` | 开发分支（ikun7777） |
| `feat/module-c-pr` | 模块 C 功能分支（zhangcheng21） |
| `feat/ppt-template-packs-fixes` | PPT 模板修复分支（zi-yuan-qin） |
| `backup-before-reset` | 备份分支 |

### PR 历史

共 37 个 Pull Request，主要贡献者：
- **ikun7777** — 核心架构、AI 编排、解题引擎、首页、认证系统
- **zhangcheng21** — 模块 C（学习数据、AI 助手、仪表盘、UI 优化）
- **zi-yuan-qin** — 模块 B（前端重构、PPT 模板系统）

---

## 八、部署

- **平台**：Vercel (standalone 模式)
- **数据库**：Supabase (PostgreSQL) + MySQL
- **环境变量**：`BETA_MODE`、`ALLOWED_FRAME_ANCESTORS` 等
- **Docker**：`docker/` 目录包含容器化配置

---

*报告生成完毕。如需补充特定模块的详细文档，请告知。*
