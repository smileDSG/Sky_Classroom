# 对话式学习画像构建设计

本文档说明 Sky Classroom 如何用自然对话构建和更新学生画像。目标是避免在注册时使用“查户口”式表单，让画像在真实学习行为中逐步变准，并能直接服务课程生成、解题、测验、错题复习和学习路径推荐。

## 结论

注册阶段只采集账号必需信息，不采集完整学习画像。学习画像应在首次进入学习场景时通过 3-5 轮破冰对话初始化，之后由测验、错题、学习反馈和日常对话持续更新。

这样设计有三个原因：

- 注册时用户还没有进入学习心流，问太多会提高流失率。
- 很多画像维度不适合自报，例如认知风格、易错模式、真实掌握度，应由行为数据校准。
- 对话式画像可以边解释边确认，用户更容易理解“系统为什么这样推荐”。

## 现有代码基础

当前仓库已经具备一部分画像链路，可以在此基础上扩展。

| 能力 | 现有位置 | 当前作用 | 后续用法 |
| --- | --- | --- | --- |
| 注册账号 | `app/api/auth/register/route.ts` | 只创建用户与登录态，已有教育字段但注册时置空 | 保持极简注册，不在注册表单增加画像问题 |
| 首页画像入口 | `app/sky/page.tsx` | 无数据时提示“先用自然语言建立你的学习画像” | 作为首次破冰对话入口 |
| 学生画像页 | `app/sky/student/page.tsx`, `app/sky/student/student-profile-page.tsx` | 展示由做题/错题聚合出的学情分析 | 增加对话式画像初始化与修正区 |
| 学习画像面板 | `components/sky/study-lab/profile-summary-panel.tsx` | 展示近期正确率、推荐难度、薄弱点 | 展示“系统当前判断”，允许确认/修正 |
| 对话抽取 demo | `app/api/sky/student/profile/conversation/route.ts` | 从自然语言输入构建软件杯 demo 的 8 维画像 | 扩展为生产可用的多轮画像抽取接口 |
| 行为画像聚合 | `lib/student/profile-builder.ts` | 从错题、测验记录生成 `StudentProfile` | 作为真实掌握度与易错模式的主来源 |
| 个性化上下文 | `app/api/sky/cloud-mind/personalization-context/route.ts`, `lib/cloud-mind/personalization-context.ts` | 给工具推荐、难度、薄弱点提供上下文 | 融合对话画像与行为画像 |
| 诊断结果写入 | `app/api/sky/teaching/diagnostic/submit/route.ts` | 记录诊断错题，刷新画像缓存 | 冷启动后校准基础水平 |
| 课堂测验反馈 | `app/api/sky/teaching/quiz-answer/route.ts` | 校验答案并在错题时失效画像缓存 | 学习中实时校准薄弱点 |
| 解题批改 | `app/api/sky/solve/grade/route.ts` | 错题写入 mistake book | 用错因更新易错模式 |
| 显式反馈 | `app/api/student/feedback/route.ts` | 接收 mastered / needs_review 并刷新缓存 | 后续应持久化为高置信度反馈事件 |

## 用户旅程与触发位置

### 1. 注册阶段

发生位置：注册页与 `app/api/auth/register/route.ts`。

触发时机：用户第一次创建账号。

用户看到：邮箱或用户名、密码等账号字段。不要出现专业、年级、基础水平、学习风格等画像表单。

系统动作：

- 创建用户记录。
- 将 `educationLevel`、`grade`、`favoriteSubjects`、`learningStyle` 等字段保持为空。
- 不触发画像抽取。

设计原因：注册阶段的目标是完成登录身份，不是完成教育诊断。画像问题应出现在用户准备开始学习的上下文里。

### 2. 首次进入 Sky 首页

发生位置：`app/sky/page.tsx` 的学习画像卡片。

触发时机：用户登录后进入 `/sky`，且 `personalization.hasLearningData` 为 false。

用户看到：

> 先用 2 分钟聊聊你的学习目标，我会据此推荐课程、练习和讲解方式。

主要按钮：

- `开始建立画像`，跳转到 `/sky/learning/profile` 或 `/sky/student` 的画像对话区。
- `先直接学习`，进入课程/解题/测验入口，但在首次任务前再轻量询问。

系统动作：

- 调用 `GET /api/sky/cloud-mind/personalization-context` 判断是否已有学习数据。
- 无学习数据时展示破冰入口。
- 记录用户是否跳过破冰，但不强制阻断学习。

### 3. 破冰对话初始化

发生位置：学生画像页，建议在 `app/sky/student/student-profile-page.tsx` 上方增加一个对话面板，例如 `components/sky/student/profile-onboarding-chat.tsx`。

触发时机：

- 用户点击首页的“开始建立画像”。
- 用户首次进入学习画像页且没有学习数据。
- 用户第一次生成课程或测验前，系统发现没有画像上下文。

用户看到：3-5 轮自然对话，不展示表单，不一次性列出所有问题。

推荐脚本：

1. 系统问：“你最近最想提升哪门课或哪个能力？比如 AI 入门、Python、数学、考研、比赛项目都可以。”
   - 抽取：学习目标、学科方向、动机。

2. 系统问：“你现在大概卡在哪里？是完全没入门，还是有基础但做题或项目容易断？”
   - 抽取：知识基础、薄弱点、掌握程度。

3. 系统问：“你更希望我怎么带你学？直接给步骤、先讲原理、用例子带，还是多给练习？”
   - 抽取：认知风格、反馈偏好、资源偏好。

4. 可选追问：“这件事有没有时间压力？比如考试、作业、比赛、转专业、项目截止。”
   - 抽取：时间紧迫度、学习动机、计划强度。

5. 系统确认：“我先按这个画像来：目标是 X，当前薄弱点是 Y，讲解方式偏 Z，推荐从 W 开始。对吗？”
   - 抽取：用户确认，提升置信度。

系统动作：

- 调用 `POST /api/sky/student/profile/conversation`。
- 接口返回 `profilePatch`、`evidence`、`confidence`、`nextQuestion`、`needsConfirmation`。
- 前端展示“系统当前判断”，让用户确认或修正。
- 确认后的字段作为显式高置信度画像事件保存。

### 4. 首次学习任务前

发生位置：

- 课程生成页：`app/sky/cloud-mind/teaching/page.tsx`。
- 解题页：`app/sky/cloud-mind/solve/page.tsx`。
- 测验页：`app/sky/cloud-mind/quiz/page.tsx`。
- 幻灯片页：`app/sky/cloud-mind/slides/page.tsx`。

触发时机：用户输入学习主题、拍题、生成测验或创建课程，但系统没有足够画像数据。

用户看到：一句轻量追问，而不是完整 onboarding。

示例：

> 在开始前我确认一下：你希望这次更偏“快速拿答案”，还是“把原理讲透”？

系统动作：

- 将回答作为本次任务上下文使用。
- 同步写入画像事件，置信度低于破冰确认结果。
- 继续原学习任务，不让画像流程打断用户目标。

### 5. 学习过程中持续更新

发生位置：

- 教学聊天接口。
- 解题聊天区。
- 课堂测验提交接口。
- 错题复习与学习反馈接口。

触发时机：

- 用户要求“别讲原理，直接给代码”。
- 用户反复追问同一知识点。
- 用户答题错误。
- 用户点击 mastered / needs_review。
- 用户表现出焦虑、挫败或时间压力。

用户看到：正常学习对话。系统不应频繁弹窗打断。

系统动作：

- 对用户文本做轻量信息抽取，生成画像事件。
- 对答题结果、错题和反馈做结构化记录。
- 调用 `invalidateProfileCache(userId)`，让下次 `buildStudentProfile` 重新聚合。
- 对低置信度推断只影响短期推荐，不直接覆盖高置信度显式信息。

### 6. 诊断、测验、错题后的校准

发生位置：

- `app/api/sky/teaching/diagnostic/submit/route.ts`
- `app/api/sky/teaching/quiz-answer/route.ts`
- `app/api/sky/solve/grade/route.ts`

触发时机：用户完成诊断、课堂测验或解题批改。

用户看到：

> 这次暴露出两个需要补强的点：函数连续性、极限计算。我会把后续练习难度调低一点。

系统动作：

- 将错题写入 quiz attempts 或 mistake book。
- 更新 `weakPoints`、`masteryByKnowledge`、`errorPatterns`。
- 如果用户自称“基础很好”但多次低正确率，记录为“自我评估偏高”的低风险内部信号，不直接用尖锐措辞展示。

### 7. 模块结束复盘

发生位置：课程完成页、测验完成页、错题复习完成页。

触发时机：用户完成一个学习模块。

用户看到一个轻量问题：

> 这节你觉得最卡的是哪里？我会据此调整下一步安排。

系统动作：

- 将复盘文本送入画像抽取。
- 更新近期状态、情绪压力、薄弱点和资源偏好。
- 如果和行为数据冲突，降低自报信息置信度，并在下次学习时温和复核。

### 8. 画像展示与修正

发生位置：

- `components/sky/study-lab/profile-summary-panel.tsx`
- `app/sky/student/student-profile-page.tsx`

触发时机：用户查看学习画像、首页摘要、学习路径推荐原因。

用户看到：

- 当前目标。
- 当前薄弱点。
- 推荐难度。
- 偏好的讲解方式。
- 最近系统依据哪些证据更新了画像。

用户可以操作：

- `正确`
- `不准确，修改`
- `暂时不要使用这个偏好`

系统动作：

- 用户确认的修改写为最高置信度事件。
- 被否定的推断降权或停用。
- 后续推荐说明引用最新可信画像。

## 画像维度与来源

| 维度 | 是否冷启动询问 | 主要来源 | 更新策略 |
| --- | --- | --- | --- |
| 学习目标 | 是 | 破冰对话、任务输入 | 用户显式修改时覆盖 |
| 专业/课程背景 | 轻量询问 | 破冰对话、课程选择 | 低频更新 |
| 知识基础 | 是，但不细问 | 破冰对话、诊断、测验 | 行为数据优先 |
| 薄弱点 | 是 | 诊断、错题、反复追问 | 按近期表现动态更新 |
| 易错模式 | 否 | 错题批改、错因分析 | 行为数据优先 |
| 认知风格 | 轻量询问 | 资源偏好、停留/跳过、对话要求 | 置信度衰减，近期行为优先 |
| 交互偏好 | 是 | 破冰对话、聊天表达 | 最近 3-5 次有效行为加权 |
| 情绪与压力 | 否 | 对话语气、复盘文本 | 只作为短期教学语气调节，不做长期标签展示 |
| 时间紧迫度 | 是 | 破冰对话、任务截止 | 到期后自动衰减 |

## 数据流

```text
注册/登录
  |
  v
Sky 首页画像卡片
  |
  v
破冰对话 -----> profile conversation API -----> 对话画像事件
  |                                                |
  v                                                v
首次学习任务 ------------------------------> personalization context
  |                                                |
  v                                                v
诊断 / 测验 / 解题批改 -----> quiz/mistake data -> buildStudentProfile
  |                                                |
  v                                                v
模块复盘与用户修正 ------------------------> 画像面板与推荐理由
```

## 建议的数据模型

现有 `StudentProfile` 更偏行为聚合，适合表示真实掌握度。对话式画像建议另建事件层，不要直接把每次推断写死到最终画像。

建议新增三个概念：

### ProfileSignal

用于记录一次画像信号。

字段建议：

- `id`
- `userId`
- `dimension`
- `value`
- `source`: `onboarding_chat`、`learning_chat`、`diagnostic`、`quiz`、`mistake`、`feedback`、`manual_correction`
- `confidence`
- `evidence`
- `createdAt`
- `expiresAt`

### ConversationalProfile

用于表示显式/隐式偏好。

字段建议：

- `learningGoal`
- `background`
- `preferredExplanationStyle`
- `resourcePreference`
- `interactionPreference`
- `timePressure`
- `currentEmotionalState`
- `lastConfirmedAt`

### UnifiedLearningProfile

用于给推荐、生成和教学 prompt 使用。

组成：

- `StudentProfile`：来自 `buildStudentProfile` 的掌握度、薄弱点、易错模式。
- `ConversationalProfile`：来自对话的目标、偏好、节奏、状态。
- `PersonalizationContext`：面向工具推荐的摘要视图。

## API 设计建议

### POST /api/sky/student/profile/conversation

用途：处理一轮画像对话，返回下一问与画像补丁。

请求：

```json
{
  "sessionId": "profile-onboarding-xxx",
  "message": "我想两周内补一下机器学习，主要卡在过拟合和模型评估",
  "userId": "optional-user-id",
  "stage": "onboarding"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "nextQuestion": "你更希望我用代码案例带你学，还是先补概念框架？",
    "profilePatch": {
      "learningGoal": {
        "value": "两周内补强机器学习",
        "confidence": 0.86
      },
      "knowledgeBase": {
        "weakPoints": ["过拟合", "模型评估"],
        "confidence": 0.82
      }
    },
    "evidence": ["两周内", "卡在过拟合和模型评估"],
    "needsConfirmation": false
  }
}
```

### POST /api/sky/student/profile/signals

用途：保存画像事件。初期可以由 conversation route 内部调用，后续独立出来。

典型来源：

- 破冰确认。
- 用户在学习中要求改变讲解方式。
- 模块复盘。
- 用户手动修正画像。

### GET /api/sky/cloud-mind/personalization-context

现有接口继续作为工具推荐入口。后续应把 `ConversationalProfile` 合入返回结果，例如：

- `learningGoal`
- `preferredExplanationStyle`
- `resourcePreference`
- `timePressure`
- `profileCompleteness`
- `lastConfirmedAt`

## Prompt 抽取要求

画像抽取 prompt 应满足以下规则：

- 只抽取有证据支持的字段。
- 每个字段必须带 `confidence` 和 `evidence`。
- 情绪状态只作为短期状态，不生成永久人格标签。
- 遇到隐私信息时脱敏或拒绝保存。
- 当置信度低于阈值时返回追问，而不是强行写入。
- 当自报信息和行为数据冲突时，保留冲突并等待校准。

建议阈值：

- `confidence >= 0.8`：可进入长期画像，但仍允许用户修正。
- `0.5 <= confidence < 0.8`：只用于短期推荐或触发追问。
- `confidence < 0.5`：不写入画像，只记录为待确认线索。

## 前端落地清单

1. 在 `app/sky/page.tsx` 的画像卡片中，根据 `hasLearningData` 和对话画像完成度显示不同 CTA。
2. 在 `app/sky/student/student-profile-page.tsx` 增加破冰对话面板。
3. 新增 `components/sky/student/profile-onboarding-chat.tsx`，负责多轮对话、展示抽取结果、确认画像。
4. 在学习任务入口缺少画像时，显示单句轻量追问，不强制跳转。
5. 在 `components/sky/study-lab/profile-summary-panel.tsx` 增加“系统当前判断”和“修正”入口。

## 后端落地清单

1. 扩展 `app/api/sky/student/profile/conversation/route.ts`，从 demo 规则抽取升级为生产抽取接口。
2. 新增 `lib/student/conversation-profile-types.ts` 定义对话画像与画像事件类型。
3. 新增 `lib/student/conversation-profile-prompts.ts` 管理抽取 prompt。
4. 新增 profile signal DAO，存储用户确认、隐式推断、行为校准事件。
5. 修改 `lib/cloud-mind/personalization-context.ts`，融合对话画像与行为画像。
6. 在 `app/api/sky/teaching/diagnostic/submit/route.ts`、`app/api/sky/teaching/quiz-answer/route.ts`、`app/api/sky/solve/grade/route.ts` 保持行为数据优先校准。
7. 完善 `app/api/student/feedback/route.ts`，从“只刷新缓存”升级为“保存反馈事件 + 刷新缓存”。

## 验收标准

- 新用户注册时不会看到画像表单。
- 新用户进入 `/sky` 时能看到自然语言建立画像入口。
- 破冰对话 3-5 轮内能生成目标、基础、偏好、时间压力等初始画像。
- 用户可以跳过破冰并直接学习。
- 诊断、测验、错题会影响薄弱点和推荐难度。
- 用户能看到画像依据，并能确认或修正。
- 低置信度推断不会直接覆盖用户确认过的信息。
- 情绪与压力只用于短期教学语气，不作为公开长期标签。

## 风险与约束

- 不要让画像流程阻塞学习主任务。画像是辅助，不是门槛。
- 不要把所有偏好都当成长期稳定人格。学习偏好会随场景变化。
- 不要保存敏感隐私原文。证据片段应脱敏、最小化。
- 不要让“自称基础好”直接决定难度。真实掌握度必须由诊断和答题校准。
- 不要在推荐理由中使用刺耳标签，例如“你高估了自己”。应改为“建议先用一组小题校准基础”。

## 推荐实施顺序

1. 先完成前端破冰对话入口和 `profile/conversation` 接口返回结构。
2. 再增加画像事件持久化。
3. 然后把对话画像合入 `personalization-context`。
4. 最后做画像面板的可视化证据与用户修正。

第一阶段即使只支持本地内存或文件存储，也能在比赛演示中完整呈现“自然语言输入 -> 画像抽取 -> 个性化推荐 -> 测验校准 -> 画像更新”的闭环。
