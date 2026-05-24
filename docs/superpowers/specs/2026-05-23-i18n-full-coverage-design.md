# i18n 全量覆盖设计方案

**日期:** 2026-05-23
**分支:** Dev-ryx
**范围:** 全项目国际化 — UI 文本 + API 路由 + AI 回复语言跟随

---

## 1. 问题陈述

当前 i18n 系统（`i18next` + `react-i18next`）已覆盖 59 个组件，拥有 24 个命名空间、6 种语言。但存在三个核心问题：

### 1.1 天空课堂 (Sky) 模块零覆盖

Sky 模块（`components/sky/`、`app/sky/`）约 23 个文件全部使用硬编码中文，locale JSON 中无任何 Sky 相关 key。切换语言后，这些区域的文本不会变化。

### 1.2 首页及其他组件遗漏

- `app/page.tsx` — 天空课堂 logo、slogan、AI 搜题卡片、footer 均为硬编码中文
- `components/ai/kagami-panel.tsx` — 小镜人设对话、场景标签、错误提示全部硬编码
- `components/ai/global-ai-panel.tsx` — 错误提示、标题、占位符硬编码
- `components/slide-renderer/Editor/Canvas/` — 幻灯片编辑器右键菜单约 40 项硬编码中文
- `components/draggable-qa-button.tsx` — "答疑" 硬编码
- `components/stage.tsx`、`components/quiz-view.tsx` 等零星遗漏

### 1.3 AI 回复语言不跟随用户选择

API 路由中的 AI system prompt 全部硬编码中文（如 `"请识别图片中的数学题目内容"`），无论用户选择什么语言，AI 始终用中文回复。API 路由的错误消息也全部硬编码中文。

---

## 2. 现状分析

### 2.1 现有 i18n 架构

```
lib/i18n/
├── config.ts          ← i18next 初始化（react-i18next + 动态 import JSON）
├── index.ts           ← translate() / getClientTranslation()
├── locales.ts         ← supportedLocales 注册表
├── types.ts           ← Locale 类型 + defaultLocale = 'zh-CN'
└── locales/
    ├── zh-CN.json     ← 1058 行，24 个 namespace
    ├── en-US.json     ← 1058 行
    ├── ja-JP.json     ← 1058 行
    ├── zh-TW.json     ← 1058 行
    ├── ru-RU.json     ← 1058 行
    └── ar-SA.json     ← 1058 行

lib/hooks/use-i18n.tsx  ← I18nProvider + useI18n() hook
                          （React Context: locale, setLocale, t）
```

### 2.2 现有命名空间（24 个）

| 命名空间 | Key 数 | 用途 |
|---------|:-----:|------|
| common | 4 | 通用（你/确定/取消/加载中） |
| home | 2 | 首页问候 |
| toolbar | 26 | 工具栏 |
| export | 8 | 导出 |
| import | 7 | 导入 |
| chat | 11 | 聊天 |
| actions | 2 | 操作 |
| agentBar | 8 | 智能体栏 |
| proactiveCard | 5 | 主动卡片 |
| voice | 2 | 语音 |
| stage | 10 | 舞台 |
| classroomComplete | 4 | 课堂完成 |
| whiteboard | 15 | 白板 |
| quiz | 27 | 测验 |
| roundtable | 19 | 圆桌讨论 |
| pbl | 7 | PBL |
| share | 1 | 分享 |
| classroom | 15 | 课堂 |
| upload | 5 | 上传 |
| generation | 83 | 生成管线 |
| settings | 562 | 设置（最大） |
| profile | 9 | 个人资料 |
| media | 13 | 媒体 |
| accessCode | 3 | 访问码 |

### 2.3 遗漏文件清单（35 个）

**Sky 布局（4）：**
- `components/sky/layout/sidebar-nav.tsx` — 导航标签 + 底部链接
- `components/sky/layout/sky-tab-bar.tsx` — 标签栏
- `components/sky/layout/top-bar.tsx` — 顶栏标题 + aria-label
- `components/sky/layout/app-shell.tsx` — aria-label

**Sky 页面（4）：**
- `app/sky/page.tsx` — 问候语 + demo 数据知识点标签
- `app/sky/layout.tsx` — 页面元数据
- `app/sky/learning/page.tsx` — Tab 标签 + 页面标题
- `app/sky/assistant/page.tsx` — 页面标题
- `app/sky/slides/page.tsx` — （通过组件间接引用）

**Sky 仪表盘（1）：**
- `components/sky/dashboard/stat-cards.tsx` — 错因映射、时间格式化、快捷操作

**Sky 解题（5）：**
- `components/sky/solve/solve-page.tsx` — 错误提示、状态文字
- `components/sky/solve/solution-panel.tsx` — 批改状态、难度标签
- `components/sky/solve/grade-result.tsx` — 错因映射、评分标签
- `components/sky/solve/multimodal-input.tsx` — 提示、占位符
- `components/sky/solve/similar-problems.tsx` — 按钮、状态消息

**Sky 学习（3）：**
- `components/sky/learning/mistake-book.tsx` — 错因映射、筛选器、日期格式
- `components/sky/learning/learning-stats.tsx` — 错因映射
- `components/sky/learning/review-plan.tsx` — 天数标签、统计标签、错误提示

**Sky 助手（3）：**
- `components/sky/assistant/assistant-panel.tsx` — 系统提示词、错误提示、学科/年级/风格标签
- `components/sky/assistant/assistant-config.tsx` — 学科/风格/年级下拉选项
- `components/sky/assistant/assistant-fab.tsx` — aria-label、alt 文本

**Sky 幻灯片（1）：**
- `components/sky/slides/slides-page.tsx` — 状态提示、按钮文案、占位符

**AI 面板（2）：**
- `components/ai/kagami-panel.tsx` — 人设系统提示词、fallback 消息、场景标签、语音提示
- `components/ai/global-ai-panel.tsx` — 错误提示、标题、占位符

**首页（1）：**
- `app/page.tsx` — logo 文案、slogan、AI 搜题卡片、footer

**幻灯片编辑器（1）：**
- `components/slide-renderer/Editor/Canvas/index.tsx` — 右键菜单（粘贴/全选/标尺/网格线/重置）
- `components/slide-renderer/Editor/Canvas/EditableElement.tsx` — 元素右键菜单（剪切/复制/对齐/层级/组合/删除等 30+ 项）

**API 路由（5）：**
- `app/api/sky/solve/recognize/route.ts` — AI prompt + 错误消息
- `app/api/sky/solve/explain/route.ts` — 错误消息
- `app/api/sky/solve/grade/route.ts` — 错误消息
- `app/api/sky/assistant/route.ts` — AI prompt + 错误消息
- `app/api/sky/slides/generate/route.ts` — 错误消息
- 以及其他 sky/* API 路由的错误消息

**其他组件（6）：**
- `components/draggable-qa-button.tsx` — "答疑"
- `components/stage.tsx` — title 属性
- `components/stage/scene-sidebar.tsx` — title 属性
- `components/scene-renderers/quiz-view.tsx` — fallback 消息
- `components/agent/agent-config-panel.tsx` — confirm() 对话框
- `app/layout.tsx` — 根元数据

### 2.4 重复代码（错因标签）

以下映射在 **4 个文件**中各自定义了一份完全相同的副本：
```
concept-unclear   → 概念不清
calculation-error → 计算失误
misreading        → 审题错误
method-wrong      → 方法错误
careless          → 粗心/粗心大意
format-error      → 格式错误
```

文件：`stat-cards.tsx`、`mistake-book.tsx`、`learning-stats.tsx`、`grade-result.tsx`

---

## 3. 架构设计

### 3.1 新增命名空间（3 个）

```
sky            ← Sky 模块全部 UI 文案（~110 keys）
kagami         ← 小镜面板 UI 文案（~15 keys）
slideEditor    ← 幻灯片编辑器右键菜单（~30 keys）
```

**选择 3 个而非 7 个的理由：**
- 遵循现有模式的粒度（`settings` 有 562 key，`generation` 有 83 key）
- `sky` 内部通过嵌套层级组织子模块（`sky.layout.*`、`sky.solve.*`、`sky.learning.*`...）
- `kagami` 独立是因为它在 `components/ai/` 下，不属于 Sky 模块
- `slideEditor` 独立是因为它是独立系统（WYSIWYG 编辑器），与 Sky 无关

### 3.2 完整 Key 结构

```yaml
sky:
  layout:
    home: 首页
    dashboard: 概况
    solve: 搜题
    slides: 幻灯片
    learning: 学习数据
    assistant: 小镜课堂
    assistantShort: 小镜
    classroomSim: 课堂模拟
    settings: 设置
    skyClassroom: 天空课堂
    toggleTheme: 切换主题
    expandSidebar: 展开侧边栏
    collapseSidebar: 收起侧边栏

  dashboard:
    greetingMorning: 早上好，同学！☀️
    greetingAfternoon: 下午好，同学！🌤️
    greetingEvening: 晚上好，同学！🌙
    greetingNight: 夜深了，注意休息！⭐
    totalMistakes: 错题总数
    reviewedRate: 已复习率
    weakPoints: 薄弱知识点
    reviewProgress: 复习进度
    quickActions: 快捷操作
    photoSolve: 拍照搜题
    slideLecture: 幻灯片讲解
    learningData: 学习数据
    aiAssistant: AI 助手
    justNow: 刚刚
    minutesAgo: "{{n}}分钟前"
    hoursAgo: "{{n}}小时前"
    daysAgo: "{{n}}天前"
    monthsAgo: "{{n}}个月前"

  solve:
    title: AI 搜题批改
    description: 拍照、语音或输入题目，AI 帮你解答、批改、推荐相似题
    enterSolve: 进入搜题
    recognizing: 正在识别...
    solving: 正在解题...
    grading: 正在批改...
    aiAnalyzing: AI 正在分析你的答案
    aiThinking: AI 正在思考解题思路
    recognizeFailed: 图片识别失败
    solveFailed: 解题失败
    gradeFailed: 批改失败
    solveError: 解题过程中出现错误
    gradeError: 批改过程中出现错误
    correct: 回答正确！
    incorrect: 回答有误
    keepUp: 继续保持，你已经掌握了这个知识点
    dontWorry: 别担心，我们来看看错在哪里
    pass: 及格
    fail: 不及格
    passReview: 批改通过
    needFix: 需要订正
    markComplete: 标记完成
    markIncomplete: 标记未完成
    showAnswer: 查看答案
    hideAnswer: 收起答案
    allDone: 太棒了！所有同类练习都已完成
    remaining: "还有 {{n}} 道题目待练习"
    relatedProblem: 相关练习题
    causeReason: "错因：{{cause}}"
    inputPlaceholder: 请输入题目内容，支持数学公式...
    answerPlaceholder: 请输入你的答案...
    startRecording: 点击开始录音
    stopRecording: 点击停止录音
    recordingHint: 正在识别语音内容...
    voiceHint: 支持数学题目语音输入
    difficultyBasic: 基础
    difficultyAdvanced: 进阶
    difficultyHard: 困难

  learning:
    title: 学习数据
    mistakeBook: 错题本
    reviewPlan: 复习计划
    knowledgeGraph: 知识图谱
    learningStats: 学习统计
    all: 全部
    unreviewed: 未复习
    reviewed: 已复习
    searchKnowledge: 搜索知识点...
    masteryProgress: 掌握进度
    todayReview: 今日待复习
    weekPlan: 未来7天计划
    items: 题
    loadFailed: 加载失败
    dataSourceCloud: 云端同步
    dataSourceLocal: 本地计算
    dataSource: "数据来源: {{source}}"
    day: "{{n}}天后"
    today: 今天
    monthDay: "{{m}}月{{d}}日"

  assistant:
    title: AI 助手
    closeAssistant: 关闭助手
    sendMessage: 发送消息
    openKagami: 打开小镜课堂
    inputPlaceholder: 输入你的问题...
    requestFailed: 请求失败，请重试
    unknownError: 未知错误
    noResponse: 抱歉，我没有生成回答，请稍后重试。
    serviceError: 抱歉，请求出现错误，请稍后重试。
    suggestion1: "帮我看看这道{{subject}}题"
    suggestion2: "什么是{{subject}}里的核心概念"
    suggestion3: 怎么高效复习错题
    subjects:
      math: 数学
      physics: 物理
      chemistry: 化学
      chinese: 语文
      english: 英语
    styles:
      detailed: 详细
      concise: 简洁
      heuristic: 启发式
    grades:
      junior: 初中
      senior: 高中
      college: 大学

  slides:
    title: 幻灯片
    generating: AI 正在生成幻灯片...
    generateButton: 生成幻灯片
    generatingButton: 生成中
    generateFailed: "生成失败: {{reason}}"
    retry: 请重试
    networkError: 网络错误，请检查服务是否运行
    exportButton: 导出 PPTX
    exportingButton: 导出中
    exportSuccess: "已导出: {{fileName}}"
    exportFailed: 导出失败
    topicPlaceholder: 输入教学主题，如：勾股定理、牛顿定律...
    defaultTitle: 课件
    expandPanel: 展开讲解栏
    collapsePanel: 收起讲解栏

  errorCause:
    conceptUnclear: 概念不清
    calculationError: 计算失误
    misreading: 审题错误
    methodWrong: 方法错误
    careless: 粗心大意
    formatError: 格式错误

  common:
    title: 天空课堂
    description: AI 驱动的智能教学平台
    slogan: 云端智学，无限可能
    footer: 天空课堂 · AI 驱动的智能教学平台

kagami:
  scene:
    thinking: 正在思考...
    teaching: 讲解中...
    done: 哼，解决了。
  voice:
    on: 语音已开启
    off: 语音已关闭
  title: 小镜课堂 (Ctrl+Shift+A)
  inputPlaceholder: 输入题目...
  networkError1: ……信号不好，待会再说。
  networkError2: ……烦死了，网络又出问题了。
  idleFallback1: ……没事的话，我还要看轻小说呢。
  idleFallback2: 哈？就这？我还以为有题目要问呢。
  idleFallback3: 闲聊的话找此方去，我只负责答疑。
  idleFallback4: （叹气）你到底有没有正事啊……
  idleFallback5: 喂，我可是很忙的。有题目就快说。
  idleFallback6: ……这种话题不在我的服务范围。
  idleFallback7: 你是不是走错地方了？这里是问题目的。
  idleFallback8: 啧，浪费我时间。下次想好题目再来。
  aiError: 抱歉，AI 助手暂时无法响应。
  requestError: 请求失败，请重试。

slideEditor:
  contextMenu:
    paste: 粘贴
    selectAll: 全选
    ruler: 标尺
    gridLines: 网格线
    gridNone: 无
    gridSmall: 小
    gridMedium: 中
    gridLarge: 大
    resetPage: 重置当前页
    unlock: 解锁
    cut: 剪切
    copy: 复制
    delete: 删除
    lock: 锁定
    setLink: 设置链接
    group: 组合
    ungroup: 取消组合
    bringToFront: 置于顶层
    bringForward: 上移一层
    sendToBack: 置于底层
    sendBackward: 下移一层
    horizontalCenter: 水平居中
    horizontalVerticalCenter: 水平垂直居中
    leftAlign: 左对齐
    rightAlign: 右对齐
    verticalCenter: 垂直居中
    topAlign: 顶部对齐
    bottomAlign: 底部对齐
```

### 3.3 服务端 i18n 模块

**新建 `lib/server/i18n.ts`：**

```ts
// 直接从 JSON 文件导入（无 React 依赖，支持 API Route）
import zhCN from '@/lib/i18n/locales/zh-CN.json';
import enUS from '@/lib/i18n/locales/en-US.json';
// ... 其他语言

const locales: Record<string, Record<string, any>> = { ... };

function resolveKey(obj: any, path: string): string { ... }

export function getServerTranslation(locale: string, key: string, params?: Record<string, string>): string {
  const lang = locale in locales ? locale : 'zh-CN';
  let value = resolveKey(locales[lang], key) ?? resolveKey(locales['zh-CN'], key) ?? key;
  // 替换 {{param}} 占位符
  if (params) { ... }
  return value;
}

// 便捷方法：获取 AI 系统提示词
export function getServerPrompt(key: string, locale: string): string { ... }
```

**选择理由：** 不引入 `i18next` 到服务端（`i18next` 本身支持 Node，但其初始化需要异步 backend 加载，增加复杂度）。直接 JSON import 更简单、同步、无网络开销。

### 3.4 AI 语言跟随机制

**客户端：**
- 新建 `lib/api/fetch-with-locale.ts`（或在现有 API 调用的地方统一添加 header）
- 所有 fetch 调用自动注入 `X-Locale: <当前 locale>`

**API 路由端：**
```ts
// 每个 API Route 读取 header
const locale = request.headers.get('X-Locale') || 'zh-CN';
const languageNames = {
  'zh-CN': '简体中文', 'zh-TW': '繁體中文', 'en-US': 'English',
  'ja-JP': '日本語', 'ru-RU': 'Русский', 'ar-SA': 'العربية'
};

// 注入到 AI system prompt
const systemPrompt = getServerPrompt('sky.solve.recognizePrompt', locale);
const langInstruction = `Respond in ${languageNames[locale]}.`;
```

**受影响的 API 路由：**
- `app/api/sky/solve/recognize/route.ts` — 图像识别 prompt
- `app/api/sky/solve/explain/route.ts` — 解题 prompt（如果包含 system prompt）
- `app/api/sky/assistant/route.ts` — 助手对话 prompt
- `app/api/sky/slides/generate/route.ts` — 幻灯片生成 prompt（如果有）

### 3.5 错因标签去重

**方案：统一使用 locale key**

4 个文件中的硬编码映射删除，改为：
```tsx
// 之前（每个文件各一份）
const CAUSE_LABELS = { 'concept-unclear': '概念不清', ... }

// 之后（统一引用）
const { t } = useI18n();
const label = t(`sky.errorCause.${causeKey}`);
```

不需要新增常量文件，locale JSON 即为唯一真相源。

---

## 4. 实施轮次

### 轮次 1：基础设施

**目标：** 搭建框架，使后续轮次可以逐组件接入

| 操作 | 文件 |
|------|------|
| 新建 | `lib/server/i18n.ts` |
| 新建 | `lib/api/fetch-with-locale.ts`（或扩展已有 API 工具） |
| 追加 | `lib/i18n/locales/zh-CN.json` — +`sky`、`kagami`、`slideEditor` 三个 namespace |
| 追加 | `lib/i18n/locales/en-US.json` — 同上，英文翻译 |
| 追加 | `lib/i18n/locales/ja-JP.json` — 同上，日文翻译 |
| 追加 | `lib/i18n/locales/zh-TW.json` — 同上，繁体翻译 |
| 追加 | `lib/i18n/locales/ru-RU.json` — 同上，俄文翻译（AI 辅助，标注待审） |
| 追加 | `lib/i18n/locales/ar-SA.json` — 同上，阿拉伯文翻译（AI 辅助，标注待审） |

**验证标准：** `tsc --noEmit` 零错误，locale JSON 格式合法

### 轮次 2：Sky 布局 + 页面

**目标：** 最高可见度的导航和页面标题首先国际化

| 操作 | 文件 |
|------|------|
| 修改 | `components/sky/layout/sidebar-nav.tsx` — NAV_ITEMS 改用 `t('sky.layout.*')` |
| 修改 | `components/sky/layout/sky-tab-bar.tsx` — NAV_ITEMS 改用 `t('sky.layout.*')` |
| 修改 | `components/sky/layout/top-bar.tsx` — 标题、aria-label 改用 `t()` |
| 修改 | `components/sky/layout/app-shell.tsx` — aria-label 改用 `t()` |
| 跳过 | `app/sky/layout.tsx` — 静态 metadata，本轮不处理（见 4.1） |
| 修改 | `app/sky/page.tsx` — 问候语改用 `t('sky.dashboard.greeting*')` |
| 修改 | `app/sky/learning/page.tsx` — Tab 标签 + 页面标题改用 `t()` |
| 修改 | `app/sky/assistant/page.tsx` — 页面标题改用 `t()` |
| 修改 | `components/sky/dashboard/stat-cards.tsx` — 快捷操作、错因标签、时间格式化 |

**验证标准：** 切换到 en-US/ja-JP，Sky 导航栏和仪表盘文本全部跟随语言切换

### 轮次 3：Sky 组件

**目标：** 解题、学习、助手、幻灯片组件国际化

| 操作 | 文件 |
|------|------|
| 修改 | `components/sky/solve/solve-page.tsx` — 状态文字、错误提示 |
| 修改 | `components/sky/solve/solution-panel.tsx` — 批改状态、难度标签 |
| 修改 | `components/sky/solve/grade-result.tsx` — 错因标签删除本地映射 |
| 修改 | `components/sky/solve/multimodal-input.tsx` — 提示、占位符 |
| 修改 | `components/sky/solve/similar-problems.tsx` — 按钮、状态消息 |
| 修改 | `components/sky/learning/mistake-book.tsx` — 错因映射删除、筛选器、占位符 |
| 修改 | `components/sky/learning/learning-stats.tsx` — 错因映射删除 |
| 修改 | `components/sky/learning/review-plan.tsx` — 天数、统计标签、错误提示 |
| 修改 | `components/sky/learning/knowledge-graph-view.tsx` — （检查已有 i18n 使用） |
| 修改 | `components/sky/assistant/assistant-config.tsx` — 学科/风格/年级选项 |
| 修改 | `components/sky/assistant/assistant-panel.tsx` — 错误提示、标题、学科/年级标签 |
| 修改 | `components/sky/assistant/assistant-fab.tsx` — aria-label、alt |
| 修改 | `components/sky/slides/slides-page.tsx` — 状态、按钮、占位符 |

**验证标准：** 完整走通解题流程（拍照→识别→解题→批改），所有 UI 文本跟随语言

### 轮次 4：首页 + AI 面板 + 幻灯片编辑器 + API 路由

**目标：** 所有剩余遗漏 + AI prompt 国际化

| 操作 | 文件 |
|------|------|
| 修改 | `app/page.tsx` — logo 文案、slogan、AI 搜题卡片、footer |
| 跳过 | `app/layout.tsx` — 静态 metadata，本轮不处理（见 4.1） |
| 修改 | `components/ai/kagami-panel.tsx` — UI 部分（场景标签、语音提示、错误消息、占位符）；系统提示词仅追加语言指令，不整体翻译 |
| 修改 | `components/ai/global-ai-panel.tsx` — 错误提示、标题、占位符 |
| 修改 | `components/slide-renderer/Editor/Canvas/index.tsx` — 右键菜单项 |
| 修改 | `components/slide-renderer/Editor/Canvas/EditableElement.tsx` — 元素右键菜单项 |
| 修改 | `components/draggable-qa-button.tsx` — "答疑" |
| 修改 | `components/stage.tsx` — title 属性 |
| 修改 | `components/stage/scene-sidebar.tsx` — title 属性 |
| 修改 | `components/scene-renderers/quiz-view.tsx` — fallback 消息 |
| 修改 | `components/agent/agent-config-panel.tsx` — confirm() 对话框 |
| 修改 | `app/api/sky/solve/recognize/route.ts` — AI prompt + 错误消息 |
| 修改 | `app/api/sky/solve/explain/route.ts` — 错误消息 |
| 修改 | `app/api/sky/solve/grade/route.ts` — 错误消息 |
| 修改 | `app/api/sky/assistant/route.ts` — AI prompt + 错误消息 |
| 修改 | `app/api/sky/slides/generate/route.ts` — 错误消息 |
| 修改 | `app/api/sky/slides/export-pptx/route.ts` — 错误消息 |
| 修改 | `app/api/sky/question-bank/route.ts` — 错误消息 |
| 修改 | `app/api/sky/mistakes/route.ts` — 错误消息 |
| 修改 | `app/api/sky/knowledge-graph/route.ts` — 错误消息 |
| 修改 | `app/api/sky/review/due/route.ts` — 错误消息 |
| 修改 | `app/api/sky/slides/avatar-speak/route.ts` — 错误消息 |

**验证标准：** 全量 curl 测试 API 端点，确认错误消息和 AI prompt 跟随 header 中的语言

### 轮次 5：RTL 适配 + 全量回归

**目标：** ar-SA 右到左布局 + 回归

| 操作 | 文件 |
|------|------|
| 修改 | `app/layout.tsx` — 根 `<html>` 标签根据 locale 设置 `dir="rtl"` |
| 修改 | `tailwind.config` 或全局 CSS — 确认 RTL 兼容 |
| 运行 | `npx tsc --noEmit` — 类型检查 |
| 运行 | `pnpm test` — 全量测试套件 |

### 4.1 已知限制：静态元数据

`app/layout.tsx` 和 `app/sky/layout.tsx` 中的 `export const metadata` 是 Next.js 静态导出，无法使用 React hooks 或 Context。这些字段仅用于 SEO / 浏览器标签页标题，不影响用户可见 UI。

**处理：** 本轮不处理元数据国际化（后续可通过 `generateMetadata` + cookie 实现，属于独立任务）。

---

## 5. 排除项（不做翻译）

以下内容不属于 UI 文本，不纳入此次计划：

1. **Demo 题目数据**（数学题、物理题内容）— 教学素材，不是 UI
2. **代码注释** — 面向开发者
3. **小镜人设系统提示词全文**（kagami-panel.tsx 中 30 行性格描述）— AI 内部指令，仅追加语言指令不翻译
4. **知识图谱中的知识点**（代数、几何、二次函数）— 学科术语，暂按数据对待
5. **pnpm-lock.yaml、构建产物、日志**

---

## 6. 风险评估

| 风险 | 影响 | 缓解 |
|------|------|------|
| ru-RU/ar-SA 翻译质量 | 用户体验差 | 在 locale 文件中标注 `VERIFY:` 注释，等待母语者审核 |
| ar-SA RTL 样式错乱 | 阿拉伯语 UI 显示异常 | 轮次 5 独立处理，不影响其他语言 |
| API 路由性能 | 每次请求读 JSON→解析 key path | 文件在 import 时被 Node 缓存，实际为零开销 |
| 现有测试因 key 变化而失败 | CI 挂掉 | 每轮结束后运行 `pnpm test` |
| 服务端 i18n key 与客户端不同步 | 翻译遗漏 | 共享同一份 locale JSON 文件，自动同步 |

---

## 7. 成功标准

1. 切换语言后，Sky 模块所有 UI 文本（导航、页面、组件）全部跟随
2. 首页 Sky 入口文案跟随语言
3. 幻灯片编辑器右键菜单跟随语言
4. API 错误消息跟随请求的 `X-Locale` header
5. AI（小镜助手、搜题、批改）的回复语言跟随用户选择
6. `tsc --noEmit` 零错误
7. `pnpm test` 全量通过
