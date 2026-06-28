# OpenMAIC 移动端施行方案

> 目标：在现有 Web 端已经基本完善的基础上，交付一套手机端可稳定使用、体验接近 App、功能闭环完整的移动 Web / PWA。移动端与桌面端共用现有 Next.js 项目、API、数据库、鉴权、AI 生成、课堂播放、学习记录和账号体系，不另起原生 App 仓库，不复制后端业务逻辑。

## 1. 建设目标

### 1.1 核心目标

移动端必须支持学生完成完整学习闭环：

```text
登录/注册
  -> 进入移动首页
  -> 发起 AI 授课或选择学习工具
  -> 查看生成/识别/答题进度
  -> 查看课堂、解题、测验或课件结果
  -> 向 AI 助手追问
  -> 加入错题/复习/继续学习
```

移动端不是桌面端缩放版，而是围绕手机场景重新组织信息、操作路径和页面结构。

### 1.2 交付形态

- 移动 Web / PWA，手机浏览器可访问，支持添加到桌面。
- 与桌面 Web 共用同一 Next.js 代码库。
- 与桌面端共用 `app/api/*`、`lib/*`、`lib/store/*`、鉴权、课堂数据、生成任务和学习数据。
- 优先适配竖屏手机，兼容常见小屏横屏。
- 桌面端现有体验不得被移动端改造破坏。

### 1.3 第一阶段不做

- 不重做后台管理页、供应商配置页、复杂设置页的完整移动端。
- 不实现完整 PPT 编辑器级别的手机编辑能力。
- 不实现离线 AI 生成。
- 不建立移动端专属数据库。
- 不为移动端复制一套生成管线、播放状态机或鉴权系统。
- 不要求课堂白板、课件编辑、知识图谱等复杂桌面交互在手机端完全等价。

## 2. 当前项目映射

### 2.1 关键路由与移动端职责

| 功能 | 当前路由 | 移动端目标 | 优先级 | 负责人 |
| --- | --- | --- | --- | --- |
| 移动首页 | `/sky` | 学习入口、最近任务、今日建议、快捷工具 | P0 | 成员 B |
| AI 授课入口 | `/sky/teaching` | 保持跳转兼容，实际重点适配 `/sky/cloud-mind/teaching` | P0 | 成员 B |
| AI 授课页 | `/sky/cloud-mind/teaching` | 表单、生成、进度、结果入口 | P0 | 成员 B |
| 课堂播放 | `/classroom/[id]` | 只读/轻交互课堂消费视图 | P0 | 成员 B |
| AI 助手 | `/sky/assistant` | 移动聊天、历史抽屉、上下文追问 | P0 | 成员 B |
| 账号鉴权 | `/auth/*`、`/account` | 登录注册、“我的”、退出登录 | P0 | 成员 A |
| 学习中心 | `/sky/learning` | 今日复习、学习统计、错题入口 | P1 | 成员 B |
| 解题 | `/sky/solve`、`/sky/cloud-mind/solve` | 拍照/上传、识别、解析、加入错题 | P1 | 成员 B |
| 测验 | `/sky/cloud-mind/quiz`、`/sky/learning/test` | 单题卡片答题、结果页 | P1 | 成员 B |
| 记忆卡片 | `/sky/cloud-mind/memory` | 卡片复习、掌握状态 | P1 | 成员 B |
| 课件 | `/sky/slides`、`/sky/cloud-mind/slides` | 列表、预览、切页、导出入口 | P1 | 成员 B |
| 设置 | `/settings` | 基础设置入口，高级设置提示桌面端 | P2 | 成员 A |

### 2.2 关键代码资产

| 领域 | 当前位置 | 移动端策略 |
| --- | --- | --- |
| 天空课堂壳层 | `components/sky/layout/app-shell.tsx` | 接入桌面/移动双壳层 |
| 桌面顶部导航 | `components/sky/layout/sky-tab-bar.tsx` | 桌面保留，移动端使用底部导航 |
| 首页组件 | `components/sky/home/*`、`components/sky/dashboard/*` | 复用数据能力，移动端重组布局 |
| AI 助手 | `components/sky/assistant/*` | 复用聊天核心，重做移动布局 |
| 解题 | `components/sky/solve/*` | 复用业务逻辑，重做上传和结果展示 |
| 题库 | `components/sky/question-bank/*` | 第一阶段只做入口和轻量查看 |
| 课件 | `components/sky/slides/*` | 手机端以预览为主，编辑延后 |
| 课堂状态 | `lib/store/*`、`lib/playback/*` | 不分叉，移动端订阅同一状态 |
| AI 生成 | `lib/generation/*`、`app/api/generate*`、`app/api/sky/*` | 复用现有接口和任务状态 |

## 3. 总体技术路线

### 3.1 路线选择

采用“同仓库响应式移动端 + PWA 增强”：

```text
同一 Next.js 项目
  -> 共享 app/api 和 lib 业务逻辑
  -> 新增 components/mobile 通用移动组件
  -> 页面层选择桌面/移动视图
  -> PWA 提供添加到桌面体验
```

这样可以最大化复用现有业务能力，也能让两个人在同一仓库中按边界并行开发。

### 3.2 壳层策略

建议将现有 `SkyAppShell` 改成桌面壳层和移动壳层的统一入口：

```tsx
export function SkyAppShell({ children }: SkyAppShellProps) {
  return (
    <>
      <div className="hidden md:flex">
        <DesktopSkyShell>{children}</DesktopSkyShell>
      </div>
      <div className="md:hidden">
        <MobileSkyShell>{children}</MobileSkyShell>
      </div>
    </>
  );
}
```

原则：

- `MobileSkyShell` 只负责全局结构：顶部栏、底部导航、safe-area、页面滚动容器。
- 业务页面只负责内容，不重复实现全局导航。
- 优先用 CSS 断点控制桌面/移动显示，减少 hydration mismatch。
- 对没有使用 `SkyAppShell` 的页面，例如 `/sky/cloud-mind/teaching`，由业务负责人单独接入移动容器或响应式布局。

### 3.3 推荐新增目录

```text
components/mobile/
  shell/
    mobile-sky-shell.tsx
    mobile-top-bar.tsx
    mobile-bottom-nav.tsx
    mobile-page.tsx
    mobile-sticky-action-bar.tsx
  ui/
    mobile-sheet.tsx
    mobile-action-menu.tsx
    mobile-segmented-control.tsx
    mobile-upload-button.tsx
    mobile-empty-state.tsx
    mobile-error-state.tsx
    mobile-skeleton.tsx
    mobile-form-field.tsx
  hooks/
    use-is-mobile.ts
    use-mobile-viewport.ts
    use-keyboard-inset.ts

lib/mobile/
  navigation.ts
  viewport.ts
  capabilities.ts
  route-context.ts

e2e/tests/mobile/
  smoke.spec.ts
  teaching-flow.spec.ts
  classroom.spec.ts
  assistant.spec.ts
  solve-review.spec.ts
```

### 3.4 重要约束

- 不复制 API。
- 不复制 Zustand store。
- 不复制 AI 生成管线。
- 不复制课堂播放状态机。
- 不在业务组件深层到处写移动端判断。
- 不让每个页面各自写一套底部弹层、空状态、错误态和底部按钮。

## 4. 功能完整性规划

### 4.1 P0：必须交付的完整学习闭环

P0 是移动端第一阶段的硬性交付范围。

#### P0-1 移动端壳层

用户能力：

- 手机端打开后看到移动端布局。
- 可通过底部导航进入首页、学习、云端智囊、助手、我的。
- 页面顶部有标题、返回、更多操作位。
- 页面底部不被导航遮挡。

验收：

- 375px、390px、412px 宽度下无导航溢出。
- iOS safe-area 下底部按钮和导航不遮挡内容。
- 路由高亮准确。
- 桌面端布局无明显回归。

#### P0-2 登录与“我的”

用户能力：

- 手机端可登录、注册、找回密码。
- 登录后可查看账号信息、套餐/用量、学习入口和退出登录。
- 未登录访问学习功能时有清晰引导。

验收：

- 表单输入不会被软键盘遮挡。
- 登录成功后能回到原目标页面。
- 退出登录后状态刷新正确。

#### P0-3 移动首页

用户能力：

- 查看今日学习建议。
- 查看最近课堂或最近生成任务。
- 快速进入 AI 授课、解题、复习、AI 助手、课件。

验收：

- 首屏能看到主要学习入口。
- 加载、空数据、失败状态完整。
- 无横向滚动。
- 大型图表不阻塞首屏。

#### P0-4 AI 授课与生成进度

用户能力：

- 输入授课主题。
- 设置必要参数：学段/年级、难度、学习目标。
- 发起生成。
- 查看当前生成阶段、已完成步骤、失败信息。
- 取消、重试或进入课堂结果。
- 刷新页面后继续查看任务状态。

验收：

- 可完成“输入主题 -> 生成 -> 查看进度 -> 打开结果”。
- 长文本输入可用。
- 高级参数默认折叠。
- 失败时有错误说明和重试入口。

#### P0-5 课堂移动端消费视图

用户能力：

- 打开已有课堂。
- 查看当前章节、讲解内容、老师/同学发言。
- 查看 PPT/白板预览。
- 播放、暂停、上一页、下一页。
- 打开章节目录和课堂摘要。
- 带课堂上下文向 AI 助手追问。

验收：

- PPT/白板区域不造成不可恢复横向滚动。
- 播放按钮状态准确。
- 音频由用户点击后播放，自动播放失败时有提示。
- 课堂内容在 390px 宽度下可读。

#### P0-6 AI 助手移动聊天

用户能力：

- 发送多轮消息。
- 接收流式回复。
- 停止生成、重试发送。
- 查看和切换历史会话。
- 从课堂/解题/错题带上下文进入对话。

验收：

- 输入框固定在底部且不被键盘遮挡。
- 流式输出不导致页面明显抖动。
- 历史会话在抽屉中可用。
- 网络失败可重试。

### 4.2 P1：应交付的学习工具闭环

P1 用来保证移动端不是只有课堂，而是具备日常学习完整性。

#### P1-1 解题、拍照与错题

用户能力：

- 拍照或从相册上传图片。
- 查看图片预览，重新选择或删除。
- 查看识别文本、步骤解析、最终答案。
- 继续追问。
- 加入错题本。
- 进入错题复习。

验收：

- 上传失败、图片过大、识别失败均有提示和重试。
- 解析内容不横向溢出。
- 可从解题结果进入错题和助手。

#### P1-2 学习中心

用户能力：

- 查看今日复习任务。
- 查看学习趋势简版。
- 查看能力概览。
- 进入错题、测验、学习路径。

验收：

- 首屏不加载过重图表。
- 数据为空时有学习引导。
- 复习入口清晰。

#### P1-3 测验与记忆卡片

用户能力：

- 单题卡片式答题。
- 上一题、下一题、提交答案。
- 查看解析。
- 查看结果页。
- 记忆卡片翻面，标记掌握/不熟。

验收：

- 按钮不误触。
- 长公式、代码、表格可横向查看或折叠。
- 结果页展示分数、错题和下一步建议。

#### P1-4 课件移动预览

用户能力：

- 查看课件列表和生成状态。
- 逐页预览课件。
- 左右切换页面。
- 导出或下载 PPTX。
- 轻量修改标题或重新生成封面/单页。

验收：

- 预览区域保持比例。
- 文字不被压扁或裁切。
- 复杂编辑提示到桌面端完成。

### 4.3 P2：可延后能力

- 高级设置完整移动端。
- 题库完整管理和批量导入移动端。
- PPT 精细编辑移动端。
- 管理后台移动端。
- 离线学习包。
- 推送通知。
- 原生 App 壳。

## 5. 两人低耦合分工

### 5.1 分工原则

- 成员 A 负责“移动端基础设施”：壳层、导航、通用 UI、账号、PWA、测试基建。
- 成员 B 负责“学习业务移动化”：首页内容、AI 授课、课堂、助手、解题、复习、课件。
- 成员 A 不深入改业务流程和业务 API。
- 成员 B 不直接改全局 shell、底部导航和通用 UI 实现。
- 公共组件缺能力时，由成员 B 提需求，成员 A 补组件或扩展 props。
- 双方只在明确约定的集成点交汇。

### 5.2 成员 A 任务边界

负责目录和文件：

```text
components/mobile/shell/*
components/mobile/ui/*
components/mobile/hooks/*
lib/mobile/*
components/sky/layout/app-shell.tsx
app/auth/*
app/account/page.tsx
app/manifest.ts 或 public/manifest.webmanifest
e2e/tests/mobile/*
```

核心交付：

- `MobileSkyShell`
- `MobileTopBar`
- `MobileBottomNav`
- `MobilePage`
- `MobileStickyActionBar`
- `MobileSheet`
- `MobileActionMenu`
- `MobileUploadButton`
- `MobileEmptyState`
- `MobileErrorState`
- `MobileSkeleton`
- `useIsMobile`
- `useMobileViewport`
- `useKeyboardInset`
- 登录/账号移动适配
- PWA 基础配置
- 移动端 e2e 基建

成员 A 不负责：

- AI 授课业务字段设计。
- 课堂播放业务状态机。
- AI 助手消息业务逻辑。
- 解题、错题、测验、课件业务流程。

### 5.3 成员 B 任务边界

负责路由和业务页面：

```text
app/sky/page.tsx
app/sky/cloud-mind/teaching/page.tsx
app/sky/assistant/page.tsx
app/sky/learning/page.tsx
app/sky/solve/page.tsx
app/sky/cloud-mind/solve/page.tsx
app/sky/cloud-mind/quiz/page.tsx
app/sky/cloud-mind/memory/page.tsx
app/sky/slides/page.tsx
app/sky/cloud-mind/slides/page.tsx
app/classroom/[id]/page.tsx
components/sky/*
```

核心交付：

- 移动首页内容。
- AI 授课表单和生成进度。
- 课堂移动消费视图。
- AI 助手移动聊天。
- 解题/拍照/错题。
- 学习中心/测验/记忆卡片。
- 课件移动预览。

成员 B 不负责：

- 全局底部导航实现。
- `MobileSkyShell` 的 safe-area 和滚动策略。
- PWA manifest。
- 登录注册底层逻辑。
- 移动端 e2e 基础设施。

### 5.4 交叉文件处理规则

| 文件/区域 | 处理规则 |
| --- | --- |
| `components/sky/layout/app-shell.tsx` | 成员 A 先改，成员 B 不直接改壳层逻辑 |
| `app/sky/page.tsx` | 成员 A 提供移动容器，成员 B 填业务内容 |
| `components/mobile/ui/*` | 成员 A 维护，成员 B 只使用；确需修改先同步 |
| `app/api/*` | 谁负责业务谁改，禁止为移动端复制同功能 API |
| `lib/store/*` | 原则上不为移动端分叉；新增状态需双方确认 |
| `components/sky/*` | 成员 B 为主；如要抽公共移动组件，迁到 `components/mobile` 由成员 A 接手 |

### 5.5 集成接口

成员 A 提供统一页面容器：

```tsx
<MobilePage
  title="页面标题"
  description="可选说明"
  backHref="/sky"
  rightAction={<MoreButton />}
  bottomAction={<PrimaryButton />}
>
  {children}
</MobilePage>
```

成员 B 业务页面必须提供统一状态：

```ts
type MobileViewState = 'idle' | 'loading' | 'empty' | 'ready' | 'submitting' | 'error';
```

每个业务页至少处理：

- 未登录
- 加载中
- 空数据
- 正常数据
- 操作中
- 失败
- 重试

API 调用层建议统一适配为：

```ts
type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };
```

旧 API 不强行重构，但移动端页面不应直接散落处理多种返回结构。

## 6. 防错与质量标准

### 6.1 排版防错标准

所有移动端页面必须满足：

- 320px 宽度下无关键内容溢出。
- 375px、390px、412px 宽度下无横向滚动。
- 底部导航不遮挡内容。
- 底部固定按钮不遮挡表单或列表末尾。
- 标题、按钮、卡片文字不能互相覆盖。
- 长单词、公式、代码、URL、表格必须可滚动、换行或折叠。
- 弹层高度不超过视口，内容可滚动。
- 顶部 sticky 和底部 fixed 不造成页面双滚动混乱。

### 6.2 功能防错标准

所有核心功能必须满足：

- 每个异步操作有 loading 状态。
- 每个失败状态有错误提示。
- 每个可恢复失败有重试入口。
- 生成、上传、识别、流式对话不能只有静默等待。
- 路由跳转失败或数据缺失时不能白屏。
- 登录过期时能回到登录流程。
- API 返回异常结构时页面不崩溃。
- 用户离开生成进度页后，回到页面仍可恢复任务状态。

### 6.3 触摸与输入标准

- 可点击区域高度建议不小于 44px。
- 主要按钮放在单手易触达位置。
- 输入框聚焦后不被软键盘遮挡。
- 长文本输入支持滚动编辑。
- 上传图片入口同时支持拍照和相册。
- 音频播放必须由用户点击触发。

### 6.4 性能标准

- 移动首页首屏不加载大型 canvas、知识图谱或过重图表。
- 课堂白板、课件预览、知识图谱按需加载。
- 图片上传前提示大小限制，必要时压缩。
- 聊天流式输出和课堂播放不能导致整页高频重渲染。
- 列表超过合理长度时使用分页、增量加载或虚拟列表。

### 6.5 降级策略

| 复杂能力 | 移动端处理 |
| --- | --- |
| 白板编辑 | 第一阶段只读预览，可缩放/全屏 |
| PPT 精细编辑 | 提供预览、导出、轻量标题修改；复杂编辑提示桌面端 |
| 知识图谱 | 移动端展示摘要和关键节点，完整交互延后 |
| 大型图表 | 移动端展示简版统计卡片 |
| 自动音频播放 | 用户点击后播放，失败时提示 |
| 相机权限失败 | 降级为文件上传 |
| 生成任务耗时长 | 可恢复进度，首页展示最近任务 |

## 7. 实施里程碑

### M0：范围确认

预计：0.5 天

任务：

- 确认采用移动 Web / PWA。
- 确认 P0 必须完成，P1 尽量完成，P2 延后。
- 确认两人文件归属。
- 建立 PR 合并顺序。

完成标准：

- 本方案合入仓库。
- 双方按文件边界开始开发。

### M1：移动端底座

预计：2 到 3 天

成员 A：

- 建立 `components/mobile` 和 `lib/mobile`。
- 完成移动端 shell、顶部栏、底部导航、页面容器。
- 接入 `SkyAppShell`。
- 完成最小通用 UI：Sheet、ActionBar、Empty、Error、Skeleton。

成员 B：

- 梳理 `/sky` 首页移动信息架构。
- 拆分 AI 授课页面移动端表单和进度视图。

完成标准：

- 手机端打开 `/sky` 有移动端导航和页面容器。
- 桌面端 `/sky` 无明显回归。

### M2：P0 学习闭环

预计：4 到 6 天

成员 A：

- 完成登录/账号移动端。
- 完成移动端 smoke e2e。
- 修复 safe-area、键盘遮挡、底部导航遮挡。

成员 B：

- 完成移动首页。
- 完成 AI 授课提交和进度。
- 完成课堂移动端消费视图。
- 完成 AI 助手移动聊天。

完成标准：

- 手机端可以完成：

```text
登录 -> 首页 -> AI 授课 -> 生成进度 -> 课堂 -> 助手追问
```

### M3：P1 学习工具

预计：4 到 6 天

成员 A：

- 补齐 PWA manifest。
- 补齐移动端公共组件缺口。
- 扩展移动端测试。

成员 B：

- 完成解题、拍照、上传、错题。
- 完成学习中心、测验、记忆卡片。
- 完成课件移动预览。

完成标准：

- 手机端可以完成：

```text
拍题/上传 -> 解题 -> 加入错题 -> 复习
```

- 手机端可以查看测验结果和课件预览。

### M4：联调与稳定性收尾

预计：2 到 3 天

共同任务：

- 检查桌面端回归。
- 修复横向滚动、遮挡、白屏、输入框、弹层、错误态。
- 跑测试命令。
- 补 PR 截图和手测记录。

完成标准：

- P0 路径通过移动端手测和 e2e。
- 所有质量命令通过。
- 已知限制写入 PR 描述。

## 8. PR 拆分

### PR 1：移动端壳层与公共组件

标题：

```text
feat: add mobile shell and shared mobile UI
```

负责人：成员 A

范围：

- `components/mobile/shell/*`
- `components/mobile/ui/*`
- `components/mobile/hooks/*`
- `lib/mobile/*`
- `SkyAppShell` 接入移动端布局

验收：

- `/sky` 手机端有移动导航。
- 桌面端无明显回归。

### PR 2：账号、移动首页与 PWA 基础

标题：

```text
feat: add mobile account home and pwa basics
```

负责人：成员 A 为主，成员 B 负责首页业务内容

范围：

- `/auth/*`
- `/account`
- `/sky` 移动首页
- PWA manifest
- mobile smoke e2e

验收：

- 手机端可登录并进入首页。
- 首页入口完整。
- 可添加到桌面。

### PR 3：AI 授课与课堂移动端

标题：

```text
feat: adapt teaching and classroom for mobile
```

负责人：成员 B

范围：

- `/sky/cloud-mind/teaching`
- 生成进度
- `/classroom/[id]`
- 课堂到助手的上下文入口

验收：

- P0 授课闭环可用。
- 课堂移动端可消费内容。

### PR 4：AI 助手、解题与复习

标题：

```text
feat: adapt assistant solve and review flows for mobile
```

负责人：成员 B

范围：

- `/sky/assistant`
- `/sky/solve`
- `/sky/cloud-mind/solve`
- 错题、复习、测验、记忆卡片

验收：

- 可聊天、可解题、可加入错题、可复习。

### PR 5：课件预览与稳定性补齐

标题：

```text
feat: add mobile slides preview and polish
```

负责人：成员 B 为主，成员 A 补测试和公共组件

范围：

- `/sky/slides`
- `/sky/cloud-mind/slides`
- 移动端 e2e 扩展
- UI 细节修复

验收：

- 可查看课件。
- 移动端核心测试稳定。

## 9. 测试方案

### 9.1 必跑命令

提交 PR 前执行：

```bash
pnpm check
pnpm lint
npx tsc --noEmit
pnpm check:i18n-keys
pnpm test
```

涉及页面交互时补充：

```bash
pnpm test:e2e
```

### 9.2 移动端视口

至少覆盖：

- 320 x 568
- 375 x 667
- 390 x 844
- 412 x 915
- 667 x 375 横屏
- 1440 x 900 桌面回归

### 9.3 P0 自动化用例

建议新增：

```text
e2e/tests/mobile/smoke.spec.ts
e2e/tests/mobile/teaching-flow.spec.ts
e2e/tests/mobile/classroom.spec.ts
e2e/tests/mobile/assistant.spec.ts
```

覆盖：

- 打开 `/sky`。
- 底部导航切换。
- 登录页输入。
- AI 授课页表单可输入。
- 生成进度页可打开。
- 课堂页可打开。
- AI 助手可输入并发送。

### 9.4 P1 自动化或手测用例

建议覆盖：

- 拍照/相册上传入口可用。
- 图片预览、删除、重新选择。
- 解题结果页展示。
- 加入错题。
- 错题复习。
- 测验答题和提交。
- 课件预览切页。

### 9.5 视觉检查清单

每个移动页面提交前检查：

- 是否横向滚动。
- 是否底部遮挡。
- 是否顶部栏遮挡内容。
- 文字是否溢出卡片。
- 按钮文字是否被挤压。
- 弹层内容是否可滚动。
- 加载态是否撑破布局。
- 错误态是否有重试。
- 深色模式是否可读。
- 桌面端是否回归。

## 10. 验收标准

移动端第一阶段可验收时，必须满足：

- 手机端有清晰移动布局，不是桌面端压缩版。
- 用户可以完成 P0 学习闭环。
- 用户至少可以完成一个 P1 学习工具闭环，推荐“拍题/上传 -> 解题 -> 加入错题 -> 复习”。
- 课堂结果能在手机端查看和轻控制。
- AI 助手能在手机端稳定多轮对话。
- 课件能在手机端预览。
- 320px 到 430px 主流宽度无关键排版错误。
- 弹层、输入框、底部导航、底部按钮没有遮挡问题。
- 失败状态不会白屏，均可提示或重试。
- 桌面端主要页面无明显回归。
- 质量命令通过。
- 移动端核心路径有 e2e 或明确手测记录。

## 11. 后续演进

第一阶段稳定后，再考虑：

- 推送通知：生成完成、复习提醒、打卡提醒。
- 离线阅读：已生成课堂、知识卡片、错题离线查看。
- 移动端语音问答。
- 移动端课件轻编辑。
- 更完整的题库管理移动端。
- 原生壳包装。
- 教师端移动管理能力。

