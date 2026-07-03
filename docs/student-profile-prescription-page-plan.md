# 学情分析页重构方案：从用户画像到学习处方

> 模块：天梯工坊 / 学情分析  
> 页面：`/sky/learning/profile`、`/sky/student`  
> 目标：把“用户画像”从静态展示改造成能直接驱动学习动作的“学习处方页”。

## 1. 背景

当前学情分析页已经具备两类数据基础：

- 行为画像：由做题、错题、测验和复习记录聚合，主要来自 `buildStudentProfile`。
- 对话画像：由用户自然语言描述学习目标、偏好和当前状态，主要来自 `ProfileOnboardingChat` 和 `extractConversationProfile`。

但当前页面的问题是：它更像一个“画像结果展示页”，没有把画像翻译成用户下一步可以执行的学习动作。用户看到正确率、薄弱点、错误模式后，仍然不知道“我现在应该点哪里、先学什么、为什么这样推荐”。

因此，本次重构不只是视觉美化，而是把页面定位改成：

**学情分析页 = 用户画像的解释层 + 学习处方的行动入口。**

## 2. 当前问题

### 2.1 视觉问题

- 当前复用了 `components/sky/solve/student-profile.tsx`，该组件偏深色、偏搜题场景，和天梯工坊浅色详情页不一致。
- 页面首屏被对话建档模块和统计卡片占据，主次不清。
- 卡片信息密度不均，有些指标很大但价值不高，例如“错误模式数”。

### 2.2 产品问题

- 画像没有真正变成学习建议。
- 用户需要自己理解薄弱点、错因和正确率之间的关系。
- 页面缺少直接行动：生成讲解、针对出题、加入复习计划、查看知识图谱。
- 对话画像和行为画像没有统一呈现，用户很难知道系统是“根据什么”推荐。

### 2.3 技术问题

- `StudentProfilePage` 只展示后端返回的 `profile`，没有构造面向页面的 view model。
- `ProfileOnboardingChat` 产生的 `profilePatch` 目前停留在组件内部状态中，没有成为学情页推荐逻辑的输入。
- 行为画像和对话画像缺少一个融合后的“学习处方”结构。

## 3. 设计目标

1. 让用户 5 秒内知道下一步应该做什么。
2. 让用户知道系统为什么给出这个建议。
3. 让用户可以立刻开始学习动作，而不是只看报表。
4. 让用户画像真正参与推荐，而不是只作为展示内容。
5. 保持浅色、清爽、可扫描的天梯工坊风格。

## 4. 核心概念

### 4.1 行为画像 Performance Profile

来源：做题、错题、测验、复习记录。

对应现有类型：

```ts
interface StudentProfile {
  userId: string;
  masteryBySubject: Record<string, number>;
  masteryByKnowledge: Record<string, number>;
  weakPoints: string[];
  strongPoints: string[];
  errorPatterns: ErrorPattern[];
  totalQuestions: number;
  totalCorrect: number;
  lastUpdated: string | number;
}
```

它回答：

- 哪些知识点薄弱？
- 哪些知识点掌握较好？
- 最近正确率如何？
- 主要错因是什么？

### 4.2 偏好画像 Preference Profile

来源：对话式画像、学习过程中的用户反馈。

对应现有类型：

```ts
interface ConversationalProfilePatch {
  majorBackground?: ConversationalProfileDimension<string>;
  learningGoal?: ConversationalProfileDimension<string>;
  knowledgeBase?: ConversationalKnowledgeBasePatch;
  cognitiveStyle?: ConversationalProfileDimension<string>;
  errorPatternPreference?: ConversationalProfileDimension<string[]>;
  resourcePreference?: ConversationalProfileDimension<string[]>;
  interactionPreference?: ConversationalProfileDimension<string>;
  learningPace?: ConversationalProfileDimension<string>;
  currentLearningState?: ConversationalProfileDimension<string>;
}
```

它回答：

- 用户当前学习目标是什么？
- 用户喜欢代码案例、图解、练习还是文字总结？
- 用户更想要步骤优先、原理优先还是快速拿答案？
- 用户是否有时间压力或焦虑状态？

### 4.3 学习处方 Learning Prescription

新增页面级 view model，不一定一开始落库。它由行为画像和偏好画像共同生成。

```ts
interface LearningPrescription {
  headline: string;
  summary: string;
  priorityTopics: PrescriptionTopic[];
  recommendedMode: string;
  nextActions: PrescriptionAction[];
  evidence: PrescriptionEvidence[];
}

interface PrescriptionTopic {
  name: string;
  mastery: number;
  reason: string;
  suggestedAction: string;
}

interface PrescriptionAction {
  key: 'teach' | 'quiz' | 'review' | 'graph';
  label: string;
  description: string;
  href?: string;
  topics: string[];
}

interface PrescriptionEvidence {
  label: string;
  value: string;
  source: 'performance' | 'preference' | 'mixed';
}
```

它回答：

- 当前最该补什么？
- 应该用什么方式补？
- 为什么这样推荐？
- 点哪里开始？

## 5. 画像融合规则

### 5.1 优先级

行为画像优先决定“学什么”，偏好画像决定“怎么学”。

```text
学什么：
  weakPoints + masteryByKnowledge + errorPatterns

怎么学：
  learningGoal + resourcePreference + interactionPreference + learningPace
```

示例：

```text
行为画像：
  过拟合 mastery=20，错因=概念不清

偏好画像：
  喜欢代码案例，目标是两周内补机器学习

学习处方：
  先补“过拟合”，用代码案例讲解，再做辨析题。
```

### 5.2 薄弱点排序

推荐优先级建议按以下规则计算：

```ts
priorityScore =
  (100 - mastery) * 0.5
  + errorFrequency * 12
  + isInConversationalWeakPoints * 15
  + isRecentError * 10;
```

说明：

- 掌握度越低，优先级越高。
- 错误频率越高，优先级越高。
- 用户自己提到“卡住”的点要加权。
- 最近出错的点要加权。

### 5.3 学习方式选择

根据偏好画像生成推荐方式：

| 画像信号 | 推荐方式 |
| --- | --- |
| `resourcePreference` 包含“代码案例” | 生成讲解时优先用代码案例 |
| `resourcePreference` 包含“练习” | 首屏主按钮偏向“针对出题” |
| `interactionPreference` 为“步骤优先” | 文案强调“拆步骤” |
| `interactionPreference` 为“原理优先” | 文案强调“先补原理” |
| `learningPace` 有时间压力 | 推荐短任务，如“今天先做 8 题” |
| `currentLearningState` 包含焦虑/看不懂 | 降低语气压力，推荐小步任务 |

### 5.4 证据展示

每条学习处方都要能解释来源：

```text
为什么推荐过拟合？
- 掌握度 20%
- 最近错了 3 次
- 高频错因是概念不清
- 你在画像对话里提到“过拟合总是搞不懂”
```

这样用户会感觉系统是在“理解我”，而不是随机推荐。

## 6. 页面结构

### 6.1 首屏结构

```text
┌──────────────────────────────────────────────────────┐
│ 你的学习处方                                          │
│ 先补过拟合，再练模型评估                              │
│ 正确率 64% · 薄弱点 3 个 · 偏好：代码案例 + 步骤拆解 │
│                                                      │
│ [生成个性化讲解] [针对出题] [加入复习计划]             │
└──────────────────────────────────────────────────────┘

┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ 当前优先补     │ │ 推荐学习方式   │ │ 今日建议任务   │
│ 过拟合         │ │ 代码案例       │ │ 8 道辨析题      │
└───────────────┘ └───────────────┘ └───────────────┘
```

### 6.2 主体结构

```text
左侧主栏：
  1. 薄弱点优先级列表
  2. 错因模式解释
  3. 证据与数据来源

右侧辅栏：
  1. 用户画像摘要
  2. 学习偏好折叠卡
  3. 最近更新时间/刷新按钮
```

移动端改为单列：

```text
学习处方
行动按钮
薄弱点列表
错因模式
画像摘要
补充学习偏好
```

## 7. 关键模块设计

### 7.1 ProfilePrescriptionHero

职责：承载首屏结论和主行动。

展示内容：

- `headline`：一句话学习处方。
- `summary`：正确率、薄弱点数量、推荐方式。
- 主按钮：生成个性化讲解。
- 次按钮：针对出题、加入复习计划、查看知识图谱。

示例文案：

```text
先补过拟合，再练模型评估
你最近的错误集中在概念不清，建议用代码案例先补概念，再做 8 道辨析题。
```

### 7.2 ProfileActionCards

职责：让用户直接行动。

卡片：

1. 生成个性化讲解
   - 跳转：`/sky/cloud-mind/teaching?topic=过拟合`
   - 使用画像：`resourcePreference`、`interactionPreference`

2. 针对出题
   - 跳转：`/sky/cloud-mind/quiz?topic=过拟合,模型评估`
   - 使用画像：`weakPoints`、`masteryByKnowledge`

3. 加入复习计划
   - 行为：调用 `prioritizeReview(priorityTopics)`
   - 使用画像：`weakPoints`、`errorPatterns`

4. 查看知识图谱
   - 跳转：`/sky/learning/graph`
   - 使用画像：`weakPoints`

### 7.3 WeakPointPriorityList

职责：把薄弱点从“标签堆”改成“优先级列表”。

每行展示：

- 知识点名
- 掌握度进度条
- 推荐理由
- 小按钮：练 5 题 / 加入复习

示例：

```text
1. 过拟合
   掌握度 20%
   原因：概念不清出现 3 次，你也在画像中提到这里卡住。
   [练 5 题] [加入复习]
```

### 7.4 ErrorPatternInsight

职责：解释“为什么错”。

展示方式：

```text
高频错因
概念不清：8 次，集中在过拟合、RAG
方法选择：3 次，集中在模型评估
```

不要只展示“错误模式数”，因为这个指标不具备行动含义。

### 7.5 ProfilePreferenceSummary

职责：展示偏好画像，帮助用户理解系统如何个性化。

展示字段：

- 学习目标
- 推荐讲解方式
- 资源偏好
- 学习节奏
- 当前状态

文案示例：

```text
系统当前理解你：
目标：两周内补机器学习
偏好：代码案例、步骤拆解
节奏：每天 20 分钟，小步推进
```

### 7.6 ProfilePreferenceDrawer

职责：承载现有 `ProfileOnboardingChat`，但默认折叠。

改造方式：

- 默认显示为“补充学习偏好”小卡片。
- 用户点击后展开对话。
- 对话完成后把 `profilePatch` 回传给页面，用于重新计算 `LearningPrescription`。

## 8. 数据流

```text
GET /api/sky/student/profile
  |
  v
StudentProfilePage
  |
  |-- performanceProfile: StudentProfile
  |
  |-- preferenceProfile: ConversationalProfilePatch
  |     来源：ProfileOnboardingChat 当前结果
  |
  v
buildLearningPrescription(performanceProfile, preferenceProfile)
  |
  v
ProfilePrescriptionView
  |
  |-- 生成讲解
  |-- 针对出题
  |-- 加入复习
  |-- 查看知识图谱
```

## 9. 实现方案

### 9.1 第一阶段：前端页面重构

目标：不改后端、不新增数据库，先让页面变得有用。

改动文件：

- `app/sky/student/student-profile-page.tsx`
- 可选新增：`components/sky/student/profile-prescription-view.tsx`

工作内容：

1. 移除 `StudentProfileDisplay` 在学情分析页里的直接复用。
2. 在页面内构造 `LearningPrescription`。
3. 新增浅色版处方 UI。
4. 把 `ProfileOnboardingChat` 放进折叠区。
5. 对话产生的 `profilePatch` 通过回调传回父组件。

阶段收益：

- UI 立即变好。
- 页面能给出下一步学习动作。
- 不依赖后端画像持久化即可验证体验。

### 9.2 第二阶段：对话画像参与推荐

目标：让对话画像不只是显示，而是参与处方计算。

改动文件：

- `components/sky/student/profile-onboarding-chat.tsx`
- `app/sky/student/student-profile-page.tsx`
- 可选新增：`lib/student/learning-prescription.ts`

工作内容：

1. 给 `ProfileOnboardingChat` 增加 `onPatchChange` 回调。
2. 抽出 `buildLearningPrescription`。
3. 将行为画像和对话画像融合。
4. 在证据区展示“来自做题数据”和“来自画像对话”的来源。

### 9.3 第三阶段：画像持久化

目标：刷新页面后仍保留用户偏好画像。

可选改动：

- 新增 `profile signals` 存储。
- 或将确认后的 `ConversationalProfilePatch` 存入用户配置。

建议先不做，等第一阶段体验确认后再推进。

## 10. 推荐的文件结构

```text
app/sky/student/student-profile-page.tsx
  页面容器：拉取 profile、处理 loading/error、拼装 view model

components/sky/student/profile-prescription-view.tsx
  展示组件：处方首屏、行动卡、薄弱点列表、错因解释、画像摘要

components/sky/student/profile-onboarding-chat.tsx
  对话组件：增加 onPatchChange，把 profilePatch 暴露给父组件

lib/student/learning-prescription.ts
  纯函数：buildLearningPrescription
```

如果想减少文件数量，第一阶段可以先把展示组件写在 `student-profile-page.tsx` 内部，等稳定后再拆分。

## 11. 交互细节

### 11.1 无数据状态

如果 `totalQuestions === 0` 且没有对话画像：

```text
还没有足够数据生成学习处方
先完成一次诊断或用 2 分钟告诉我你的学习目标。

[开始画像对话] [去做诊断]
```

### 11.2 有行为数据但无对话画像

```text
我已经能根据做题记录判断薄弱点
补充学习偏好后，讲解方式和任务节奏会更贴合你。

[补充学习偏好]
```

### 11.3 有对话画像但无行为数据

```text
我先按你的目标给出初始建议
完成几道题后，我会用真实表现校准处方。
```

### 11.4 行为画像和对话画像冲突

例如用户说“基础很好”，但测验连续低分：

```text
页面不直接否定用户。
显示：最近题目暴露出几个需要先补的前置点，建议先用短任务校准一下。
```

内部规则：

- 做题结果优先影响 `weakPoints` 和 `mastery`。
- 用户自述优先影响 `goal`、`pace`、`preference`。

## 12. UI 风格

### 12.1 颜色

- 主色：emerald / sky，用于行动和正向状态。
- 风险色：rose，用于薄弱点。
- 提醒色：amber，用于建议、时间压力、待复习。
- 背景：slate-50、white、轻微边框。

### 12.2 组件风格

- 页面主卡片圆角 16px，内部小卡片 12px。
- 避免深色大面积背景。
- 避免大阴影堆叠。
- 图标使用 lucide，不使用 emoji 做结构图标。
- 按钮必须有明确文本，不只放图标。

### 12.3 信息层级

优先级：

1. 下一步建议
2. 行动按钮
3. 薄弱点列表
4. 推荐原因
5. 原始统计数据

## 13. 验收标准

### 13.1 功能验收

- [ ] 用户进入学情分析页后，首屏能看到一句明确学习处方。
- [ ] 有薄弱点时，页面能展示优先级列表。
- [ ] `针对出题` 能带着薄弱点跳转到 quiz 页面。
- [ ] `查看知识图谱` 能跳转到 graph 页面。
- [ ] `补充学习偏好` 默认折叠，展开后能继续使用现有对话。
- [ ] 对话产生的偏好能影响页面处方文案。

### 13.2 视觉验收

- [ ] 页面整体为浅色模式。
- [ ] 不再出现大面积 `bg-slate-800` / 深色画像卡片。
- [ ] 移动端没有横向滚动。
- [ ] 主行动按钮在首屏可见。
- [ ] 信息卡片之间有清晰层级。

### 13.3 代码验收

- [ ] `student-profile-page.tsx` 不再直接复用搜题场景的 `StudentProfileDisplay`。
- [ ] 学习处方构造逻辑尽量是纯函数，方便测试。
- [ ] 不破坏 `/sky/student` 和 `/sky/learning/profile` 两个入口。
- [ ] 文件级 ESLint 通过。

## 14. 风险与取舍

### 14.1 暂不做复杂后端持久化

第一阶段先用前端状态融合 `profilePatch`，可以快速验证页面价值。  
缺点是刷新后偏好画像可能丢失。这个问题可以在第三阶段通过 `profile signals` 解决。

### 14.2 暂不做复杂 AI 处方生成

第一版用规则生成学习处方，不调用 LLM。  
优点是稳定、快、可解释。  
后续如果要更自然的文案，可以在规则结果之上加 LLM 润色，但不建议让 LLM 直接决定学习优先级。

### 14.3 保留原画像组件给搜题场景

`components/sky/solve/student-profile.tsx` 可以继续服务搜题页或教学面板。  
学情分析页需要专用组件，因为它的目标是“行动处方”，不是“画像详情”。

## 15. 建议实施顺序

1. 新增 `buildLearningPrescription` 纯函数。
2. 重构 `StudentProfilePage` 首屏为学习处方。
3. 增加行动卡和薄弱点优先级列表。
4. 将 `ProfileOnboardingChat` 折叠，并通过回调输出 `profilePatch`。
5. 接入 `profilePatch` 影响处方文案。
6. 跑文件级 ESLint 和 5 个学习详情路由访问检查。

## 16. 最终效果

改造后，学情分析页不再回答：

```text
你有哪些画像数据？
```

而是回答：

```text
你现在最该补什么？
为什么是它？
应该用什么方式补？
点哪里开始？
```

这就是用户画像和学情分析页结合的核心价值。
