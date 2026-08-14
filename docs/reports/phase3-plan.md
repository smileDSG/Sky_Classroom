# 天空课堂 Phase 3 项目开发计划

> 创建日期：2026-05-19  
> 状态：规划中  
> 目标：完善 AI 教学平台的核心体验、用户运营与技术基础设施

---

## 项目总览

Phase 3 聚焦以下四个方向：**AI 能力增强**、**学习体验完善**、**平台与运营**、**技术架构**。  
每项任务标注优先级（P0 = 最高，P1 = 高，P2 = 中）和预估工作量。

---

## 一、AI 能力增强

### 1.1 多模态交互 —— 语音搜题 + 手写公式识别（P0）

**问题描述**：当前搜题仅支持图片输入，学生无法语音提问或手写数学题拍照。

**目标**：
- 在搜题页面增加语音输入按钮，学生可直接语音描述题目，系统通过 ASR 转为文本后进入解题流程
- 支持手写公式/题目拍照识别，优化对非标准排版手写体的 OCR 效果

**技术方案**：
- 语音输入：复用现有 `SpeechButton` 组件（基于浏览器 Web Speech API），在 `MultimodalInput` 中新增语音 tab
- 手写识别：利用 Qwen-VL / GLM-5V-Turbo 的视觉能力，在 OCR_PROMPT 中增加"识别手写数学题"的指令分支
- 前端新增手写板 canvas 组件，学生可直接手写后提交

**涉及文件**：
- `components/sky/solve/solve-page.tsx` —— 增加语音输入 UI
- `components/sky/solve/multimodal-input.tsx` —— 新增语音 tab 和手写板
- `app/api/sky/solve/recognize/route.ts` —— 扩展 OCR_PROMPT 支持手写识别

**预估工作量**：3-5 天

---

### 1.2 智能追问链 —— 对话式解题（P0）

**问题描述**：搜题后学生不理解某一步，只能重新开始，缺乏上下文追问能力。

**目标**：
- 解题结果页增加"继续追问"输入框，学生可针对某一步骤提问
- 系统保持题目上下文，进行多轮对话式讲解
- 追问记录与原题解绑定，形成完整的"解题对话树"

**技术方案**：
- 在 Sky Classroom Store 中为每道题增加 `followUpMessages` 数组，存储对话历史
- 解题 API `/api/sky/solve/explain` 支持可选的 `conversationId` 和 `history` 参数
- 前端新增 `FollowUpChat` 组件，嵌入 SolutionPanel 底部

**涉及文件**：
- `lib/store/use-sky-classroom-store.ts` —— 新增追问对话状态
- `app/api/sky/solve/explain/route.ts` —— 支持上下文追问
- `components/sky/solve/solution-panel.tsx` —— 嵌入追问组件

**预估工作量**：4-6 天

---

### 1.3 个性化推荐引擎 —— 基于错题本的知识薄弱点推荐（P0）

**问题描述**：错题本、学习图是独立模块，没有联动推荐。

**目标**：
- 分析学生错题本中的错误知识点，自动标记薄弱领域
- 根据薄弱知识点推荐练习题（从题库中抽取或 AI 生成）
- 首页增加"今日推荐练习"卡片

**技术方案**：
- 在 MistakeBook 数据结构中增加 `knowledgeTags` 字段，关联知识点标签
- 新增 `/api/sky/recommend` 端点：读取错题标签 → 匹配题库 → 返回推荐题目
- 前端 `KnowledgeGraphView` 增加"薄弱点"热力图高亮
- 首页增加推荐卡片，点击直接跳转做题

**涉及文件**：
- `lib/store/use-sky-classroom-store.ts` —— MistakeBook 增加知识标签
- 新增 `app/api/sky/recommend/route.ts` —— 推荐引擎 API
- `components/sky/learning/knowledge-graph-view.tsx` —— 热力图
- 新增 `components/sky/learning/recommendation-card.tsx`

**预估工作量**：5-7 天

---

### 1.4 AI 助教记忆机制 —— 连贯的学生 Agent 对话（P1）

**问题描述**：课堂模拟中学生 Agent 没有记忆，每次讨论都是独立对话，缺乏连贯性。

**目标**：
- 每个 Agent 维护短期记忆（当前课堂内的讨论摘要）和长期记忆（跨课堂的学习偏好）
- Agent 在讨论中能引用之前的观点，产生更自然的对话
- 支持"回顾之前提到的..."等记忆触发式对话

**技术方案**：
- 使用 LangChain 的 `RunnableWithMessageHistory` 或自定义摘要记忆
- 课堂结束后，提取讨论关键信息存入 AgentProfile 的 `memory` 字段
- 每次生成 Agent 发言时，注入记忆摘要到系统提示词
- 记忆采用滑动窗口 + 摘要压缩，控制 token 开销

**涉及文件**：
- `lib/ai/` —— 新增 `agent-memory.ts` 模块
- 课堂生成 API —— Agent 发言生成时注入记忆
- `lib/store/settings/agents.ts` —— AgentProfile 增加 memory 字段

**预估工作量**：5-8 天

---

## 二、学习体验完善

### 2.1 解题进度保存（P0）

**问题描述**：搜题过程中状态是瞬时的，页面刷新或退出后数据丢失。

**目标**：
- 自动保存搜题过程（识别结果、解题步骤、追问记录）到 IndexedDB
- 用户再次进入时可恢复最近的解题会话
- 支持手动保存多条解题记录

**技术方案**：
- 使用 Zustand persist 中间件 + Dexie 存储解题历史
- 在 Solve 状态机中增加 `sessionId` 字段，关联每次解题
- 新增"历史记录"侧边栏，展示已保存的解题记录

**涉及文件**：
- `lib/store/use-sky-classroom-store.ts` —— 增加解题会话持久化
- 新增 `lib/store/dexie-db.ts` —— Dexie 数据库 schema
- 新增 `components/sky/solve/solve-history.tsx`

**预估工作量**：3-4 天

---

### 2.2 错题复习计划 —— 艾宾浩斯遗忘曲线（P1）

**问题描述**：学生没有复习提醒机制，错题容易被遗忘。

**目标**：
- 根据艾宾浩斯遗忘曲线（1天、2天、4天、7天、15天、30天）自动安排复习
- 首页增加"今日待复习"提醒卡片
- 复习时推送原题的变式题，检验是否真正掌握

**技术方案**：
- 在 Mistake 模型中增加 `lastReview`、`nextReview`、`reviewCount`、`masteryLevel` 字段
- 新增定时任务（客户端 cron）计算当日待复习题目
- 首页通知系统增加复习提醒
- 复习结果自动更新 masteryLevel，调整下次复习间隔

**涉及文件**：
- `lib/store/use-sky-classroom-store.ts` —— Mistake 增加复习计划字段
- 新增 `lib/schedule/review-scheduler.ts` —— 复习计划计算
- 首页增加复习提醒组件
- `app/api/sky/review/due` —— 查询待复习题目 API

**预估工作量**：4-6 天

---

### 2.3 课堂模板库（P1）

**问题描述**：用户每次需要从零开始输入课程描述，缺少快捷入口。

**目标**：
- 预置学科模板（数学、物理、化学、英语等），用户一键选择后做局部调整即可生成课堂
- 模板包含：课程标题、教学目标、知识点列表、推荐 Agent 配置
- 支持用户收藏/自定义模板

**技术方案**：
- 新增 `lib/templates/` 目录，存放预设模板 JSON
- 首页输入区增加"从模板创建"按钮，点击弹出模板选择器
- 模板可编辑，修改后作为新课程生成
- 用户自定义模板存入 localStorage

**涉及文件**：
- 新增 `lib/templates/` —— 学科模板库
- `app/page.tsx` —— 增加模板选择器入口
- 新增 `components/template-picker.tsx`

**预估工作量**：3-4 天

---

## 三、平台与运营

### 3.1 PPT 导出质量提升（P0）

**问题描述**：当前生成的 PPT 过于丑陋，缺乏专业排版和视觉效果。

**目标**：
- 引入多种专业 PPT 主题模板（天空蓝、极简白、学术风等）
- 自动排版：标题层级、字体大小、间距统一
- 支持图表/公式渲染到 PPTX
- 封面页加入课程标题、日期、教师信息
- 内容页加入页码、进度指示

**技术方案**：
- 重写 `lib/export/pptx-generator.ts`（或使用子包 `packages/pptxgenjs`）
- 引入设计 token 系统：字体、颜色、间距统一配置
- 公式通过 MathML/OMML 转换后嵌入 Word/PPT
- 新增模板注册机制，支持用户选择主题

**涉及文件**：
- `lib/slides/slide-generator.ts` —— 增强幻灯片生成逻辑
- `lib/export/pptx-generator.ts` 或子包 —— 重构 PPTX 生成
- `packages/pptxgenjs/` —— 利用已有子包
- 新增 `lib/export/themes/` —— PPT 主题模板

**预估工作量**：7-10 天

---

### 3.2 虚拟形象创建（P0）

**问题描述**：课堂模拟中的教师/学生 Agent 形象单一，缺乏个性化。

**目标**：
- 用户可自定义虚拟形象：头像上传、AI 生成头像、选择预设形象
- 不同 Agent（教师、学生）显示不同形象
- 形象在课堂回放、讨论区、搜题讲解中统一展示

**技术方案**：
- 复用现有 `AvatarSelector` 组件（`components/sky/slides/avatar-selector.tsx`），扩展到全局
- 新增 AI 生成头像功能：通过文生图 API 生成卡通风格教师/学生形象
- 形象数据存入 UserProfile Store
- AgentProfile 增加 `avatarUrl` 字段

**涉及文件**：
- `components/sky/slides/avatar-selector.tsx` —— 扩展到全局
- 新增 `components/avatar-creator.tsx` —— AI 生成头像
- `lib/store/user-profile.ts` —— 增加头像字段
- `lib/store/settings/agents.ts` —— Agent 头像

**预估工作量**：4-6 天

---

### 3.3 AI 全局可用（P0）

**问题描述**：AI 能力目前分散在各个模块中，缺少统一的 AI 入口和能力调度。

**目标**：
- 全局 AI 助手：页面任意位置可通过快捷键（如 Ctrl+Shift+A）唤起 AI 对话
- 统一 AI 能力中心：提供文本解释、公式推导、翻译、总结等常用功能
- AI 能力与当前页面上下文联动（选中文字即可提问）

**技术方案**：
- 新增全局 `AIProvider` 上下文，管理 AI 状态和配置
- 全局悬浮 AI 按钮 + 对话面板（复用 `AssistantPanel` 但解耦）
- 页面选中文字后出现"AI 解释"浮动按钮
- 快捷键注册在 `lib/store/keyboard.ts`

**涉及文件**：
- 新增 `components/ai/global-ai-panel.tsx`
- 新增 `lib/ai/global-ai-context.tsx` —— AI 全局上下文
- `app/layout.tsx` —— 注入全局 AI 组件
- `lib/store/keyboard.ts` —— 快捷键

**预估工作量**：5-7 天

---

### 3.4 样式优化（P1）

**问题描述**：用户对多处 UI 样式不满意，需要整体视觉提升。

**目标**：
- 统一天空蓝主题色系，消除白色/灰色生硬过渡
- 卡片阴影、圆角、边框统一设计 Token
- 暗色模式完善（目前部分组件暗色适配不完整）
- 移动端响应式优化
- 动画过渡统一（framer-motion 时长/缓动函数）

**技术方案**：
- 建立设计 Token 系统：`lib/theme/tokens.ts`
- 使用 Tailwind CSS v4 的 `@theme` 指令定义统一色板
- 暗色模式审计：逐个组件检查 dark: 变体
- 移动端：所有页面在 375px 宽度下可用性测试

**涉及文件**：
- 新增 `lib/theme/tokens.ts` —— 设计 Token
- `app/globals.css` —— 统一色板定义
- 各组件样式文件（全面审计）

**预估工作量**：5-8 天

---

### 3.5 课堂场景 UI 布局重构（P1）

**问题描述**：课堂模拟场景的 UI 布局需要优化，提升观看体验。

**目标**：
- 现有计划中的布局：左侧讲解区 + 右侧 PPT 展示
- PPT 展示区支持全屏切换（一键放大）
- 讨论区增加消息筛选（只看老师/只看学生/只看我的提问）
- 场景导航增加缩略图预览

**技术方案**：
- 在 `stage.tsx` 中实现新的 flex/grid 布局
- CanvasArea 增加全屏模式
- ChatArea 增加消息过滤逻辑
- SceneSidebar 增加缩略图网格

**涉及文件**：
- `components/stage.tsx` —— 主布局重构
- `components/chat/chat-area.tsx` —— 消息筛选
- `components/scene-renderers/classroom-complete.tsx` —— 布局适配
- `components/stage/scene-sidebar.tsx` —— 缩略图

**预估工作量**：4-6 天

---

### 3.6 用户登录注册系统（P0）

**问题描述**：当前无用户认证系统，所有数据存储在本地，无法跨设备同步。

**目标**：
- 用户注册/登录（邮箱+密码、手机号+验证码）
- JWT Token 认证
- 用户数据云端同步（错题本、解题记录、课堂历史、设置）
- 访客模式：未登录用户可使用基础功能，数据存本地

**技术方案**：
- 后端：新增 `/api/auth/register`、`/api/auth/login`、`/api/auth/refresh` 端点
- 使用 bcrypt 加密密码，jsonwebtoken 签发 JWT
- 数据库：使用 Dexie（IndexedDB）离线 + 后端 API 同步，或直接引入轻量数据库（SQLite/Supabase）
- 前端：新增登录/注册页面，AuthProvider 上下文管理登录状态
- 现有本地 Store 增加云端同步逻辑

**涉及文件**：
- 新增 `app/auth/login/page.tsx`、`app/auth/register/page.tsx`
- 新增 `app/api/auth/register/route.ts`、`login/route.ts`、`refresh/route.ts`
- 新增 `lib/auth/` —— 认证工具函数、JWT 处理、密码加密
- 新增 `components/auth/auth-provider.tsx` —— 全局认证上下文
- `app/layout.tsx` —— 注入 AuthProvider
- 各 Store 增加同步逻辑

**预估工作量**：10-14 天

---

### 3.7 使用限制与付费系统（P0）

**目标**：
- 免费用户每日最多使用 5 次 AI 功能（课堂生成 + 搜题 + 助教对话合计）
- 超出限制后提示升级付费
- 付费面板：展示价格、购买流程（接入支付宝/微信支付）
- 管理员可查看使用统计和付费用户列表

**技术方案**：
- 在用户模型中增加 `dailyUsage`、`usageLimit`、`planType`（free/premium）字段
- 每日零点重置使用计数
- 新增 `/api/usage/check` 端点：检查是否超限
- 新增 `/api/billing/` 系列端点：创建订单、查询状态
- 支付回调处理：支付宝/微信 Webhook
- 前端新增付费升级弹窗、使用次数进度条

**涉及文件**：
- 新增 `lib/usage/usage-tracker.ts` —— 使用计数
- 新增 `app/api/usage/check/route.ts`
- 新增 `app/api/billing/` —— 支付相关 API
- 新增 `components/billing/upgrade-dialog.tsx`
- 首页/AI 功能页面增加使用次数显示

**预估工作量**：7-10 天

---

### 3.8 幻灯片动画改进（P1）

**问题描述**：幻灯片播放时动画效果单一，缺乏教学演示的动态感。

**目标**：
- 内容分步出现：点击或自动播放时，逐条显示知识点
- 强调动画：关键公式/概念高亮、放大、脉冲效果
- 过渡动画优化：页面切换增加擦除、推进、淡入等效果
- 数学公式逐步推导动画：每一步依次出现

**技术方案**：
- 在 Slide 数据模型中增加 `animations` 字段：定义每个元素的入场/强调/退场动画
- 使用 framer-motion 实现复杂动画序列
- SlideViewer 新增动画控制器，管理播放进度
- 公式推导动画：将 LaTeX 拆分为步骤数组，逐步渲染

**涉及文件**：
- `lib/types/slide.ts` —— 增加 animation 字段
- `components/sky/slides/slide-viewer.tsx` —— 动画控制器
- `lib/slides/slide-generator.ts` —— 生成时附带动画信息
- 新增 `components/sky/slides/animation-controller.tsx`

**预估工作量**：5-8 天

---

### 3.9 TTS 语音导入（P1）

**问题描述**：课堂讲解语音需要更好的音质和更多声音选择。

**目标**：
- 支持用户上传自定义语音文件作为 TTS 音源（声音克隆）
- 接入更多高质量 TTS 提供商（Azure Neural TTS、ElevenLabs、Fish Audio）
- 教师可选择不同音色（男声/女声/童声）
- 语音播放速度、音调可调节

**技术方案**：
- 新增 TTS 提供商注册机制：`lib/tts/providers/` 目录
- 用户上传语音文件 → 存储到本地/云端 → 关联到用户 Profile
- 设置页面增加 TTS 配置面板：音色选择、速度调节
- 现有 TTS 调用层抽象为统一接口

**涉及文件**：
- 新增 `lib/tts/providers/` —— TTS 提供商适配
- 新增 `lib/tts/tts-engine.ts` —— 统一 TTS 调用接口
- `lib/store/settings/audio.ts` —— 增加 TTS 配置
- 设置页面增加 TTS 配置面板

**预估工作量**：4-6 天

---

## 四、技术架构

### 4.1 语义缓存层（P1）

**问题描述**：搜题的 Recognize → Explain → Grade 链路重复调用相同 API，浪费 token 和等待时间。

**目标**：
- 对相同/相似题目进行语义匹配缓存，直接返回历史结果
- 缓存命中率目标 > 30%
- 可配置缓存 TTL 和相似度阈值

**技术方案**：
- 使用文本嵌入模型（如 text-embedding-3-small）将题目文本转为向量
- 向量存入 IndexedDB（前端）或轻量向量存储
- 搜索时计算余弦相似度，超过阈值则命中缓存
- 缓存数据结构：`{ embedding, result, timestamp, hitCount }`

**涉及文件**：
- 新增 `lib/cache/semantic-cache.ts` —— 语义缓存引擎
- `app/api/sky/solve/explain/route.ts` —— 查询缓存
- `app/api/sky/solve/recognize/route.ts` —— OCR 结果缓存
- `lib/store/dexie-db.ts` —— 缓存存储 schema

**预估工作量**：4-6 天

---

### 4.2 PWA 离线支持（P2）

**问题描述**：关键功能在没有网络时不可用。

**目标**：
- 错题本、搜题历史支持离线浏览
- 离线时可查看已加载的课堂内容
- 网络恢复后自动同步未提交的数据

**技术方案**：
- 新增 `next-pwa` 或自定义 Service Worker
- 静态资源缓存策略：shell + API 响应缓存
- IndexedDB 存储离线数据
- 网络状态检测：显示离线提示，自动重试队列

**涉及文件**：
- 新增 `public/sw.js` —— Service Worker
- 新增 `lib/offline/` —— 离线数据管理
- `app/layout.tsx` —— PWA manifest 注入
- `next.config.ts` —— PWA 配置

**预估工作量**：4-6 天

---

### 4.3 性能监控 Dashboard（P2）

**问题描述**：已有 perf monitor 框架但利用率低，缺少可视化的性能洞察。

**目标**：
- 实时展示 LLM 调用延迟、成功率、token 消耗
- 页面加载性能指标（FCP、LCP、CLS）
- API 调用统计（次数、错误率、响应时间）
- 用户行为漏斗（访问 → 注册 → 使用 → 付费）

**技术方案**：
- 扩展现有 `lib/monitoring/performance.ts`，增加指标上报
- 新增 `/admin/performance` 管理页面
- 使用 Chart.js 或 Recharts 展示数据可视化
- 指标数据存入 IndexedDB，定期聚合

**涉及文件**：
- `lib/monitoring/performance.ts` —— 扩展现有监控
- 新增 `app/admin/performance/page.tsx` —— 监控面板
- 新增 `components/admin/performance-dashboard.tsx`
- 新增 `lib/monitoring/metrics-store.ts`

**预估工作量**：5-7 天

---

## 优先级排序与里程碑

### Sprint 1（第 1-2 周）：核心体验提升
| # | 任务 | 优先级 | 预估天数 |
|---|------|--------|----------|
| 1 | PPT 导出质量提升 | P0 | 7-10 |
| 2 | 用户登录注册系统 | P0 | 10-14 |
| 3 | 多模态交互 | P0 | 3-5 |
| 4 | 智能追问链 | P0 | 4-6 |

### Sprint 2（第 3-4 周）：AI 与学习深化
| # | 任务 | 优先级 | 预估天数 |
|---|------|--------|----------|
| 5 | 个性化推荐引擎 | P0 | 5-7 |
| 6 | 解题进度保存 | P0 | 3-4 |
| 7 | AI 全局可用 | P0 | 5-7 |
| 8 | 使用限制与付费系统 | P0 | 7-10 |
| 9 | 虚拟形象创建 | P0 | 4-6 |

### Sprint 3（第 5-6 周）：体验打磨
| # | 任务 | 优先级 | 预估天数 |
|---|------|--------|----------|
| 10 | 样式优化 | P1 | 5-8 |
| 11 | 课堂场景 UI 布局重构 | P1 | 4-6 |
| 12 | 幻灯片动画改进 | P1 | 5-8 |
| 13 | TTS 语音导入 | P1 | 4-6 |
| 14 | AI 助教记忆机制 | P1 | 5-8 |

### Sprint 4（第 7-8 周）：基础设施
| # | 任务 | 优先级 | 预估天数 |
|---|------|--------|----------|
| 15 | 错题复习计划 | P1 | 4-6 |
| 16 | 课堂模板库 | P1 | 3-4 |
| 17 | 语义缓存层 | P1 | 4-6 |
| 18 | PWA 离线支持 | P2 | 4-6 |
| 19 | 性能监控 Dashboard | P2 | 5-7 |

**总预估**：8 周（40-56 工作日）

---

## 风险与注意事项

1. **登录注册系统**是最大的单项任务，涉及后端 API、数据库选型、前端认证流程，建议优先确定数据库方案（SQLite/Supabase/本地 IndexedDB）
2. **PPT 导出**依赖 `pptxgenjs` 子包，需评估现有子包的能力边界
3. **付费系统**涉及支付接入，需提前申请支付宝/微信支付商户号
4. **TTS 语音导入**如涉及声音克隆，需注意版权和合规问题
5. **语义缓存**需要嵌入模型，会增加额外的 API 调用成本

---

## 技术债务清理（并行进行）

- TypeScript strict mode 逐步开启
- 组件命名规范统一（部分使用 kebab-case，部分使用 PascalCase）
- API 错误码体系统一（当前部分返回硬编码字符串）
- 测试覆盖率提升至 60%+（当前较低）
