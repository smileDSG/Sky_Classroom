# OpenMAIC 移动端实施方案

> 目标：在现有 Web 端基本完善的基础上，交付一套手机端可稳定使用、功能闭环完整、体验接近 App 的移动 Web / PWA。移动端与桌面端共用当前 Next.js 项目、API、数据库、鉴权、AI 生成、课堂播放、学习数据和账号体系，不另起原生 App 仓库，不复制后端业务逻辑。

## 1. 总体目标

### 1.1 核心闭环

移动端第一阶段必须让学生在手机上完成真实学习闭环：

```text
登录/注册
  -> 进入移动首页
  -> 发起 AI 授课或选择学习工具
  -> 查看生成/识别/答题进度
  -> 进入课堂、解题、测验、天梯工坊或课件结果
  -> 向 AI 助手追问
  -> 加入错题、安排复习、继续学习
```

移动端不是桌面端的缩小版，而是围绕手机竖屏、单手操作、软键盘、弱网络、短时学习场景重新组织页面结构和操作路径。

### 1.2 交付形态

- 交付移动 Web / PWA，手机浏览器可访问，支持添加到桌面。
- 保持同一套 Next.js 16 + React 19 + TypeScript 代码库。
- 共用 `app/api/*`、`lib/*`、`lib/store/*`、鉴权、课堂数据、生成任务和学习画像。
- 优先适配 320px 到 430px 竖屏手机，同时保证常见横屏不崩。
- 桌面端现有体验不得因移动端改造出现明显回归。

### 1.3 第一阶段不做

- 不重做后台管理、供应商配置、复杂设置页的完整手机端。
- 不实现完整 PPT 编辑器级别的手机编辑能力。
- 不实现离线 AI 生成。
- 不建立移动端专属数据库。
- 不复制生成管线、课堂播放状态机、AI 助手逻辑或鉴权系统。
- 不要求白板编辑、复杂知识图谱、复杂课件编辑在手机端与桌面端完全等价。

## 2. 当前项目基线

### 2.1 关键技术基线

- App Router：核心页面位于 `app/`。
- UI：React 19、Tailwind CSS 4、shadcn/ui、Radix、lucide-react。
- 状态：Zustand store 位于 `lib/store/`。
- AI 与业务：生成、课堂、云端智囊、天梯工坊、解题、课件均已有 Web 端业务能力。
- 测试：Vitest + Playwright，CI 顺序为 `pnpm check`、`pnpm lint`、`npx tsc --noEmit`、`pnpm check:i18n-keys`、`pnpm test`。

### 2.2 当前移动端改造对象

| 模块 | 当前路由/文件 | 移动端目标 | 优先级 | 负责人 |
| --- | --- | --- | --- | --- |
| 全局天空课堂壳层 | `components/sky/layout/app-shell.tsx` | 桌面/移动双壳层、顶部栏、底部导航、safe-area | P0 | 成员 A |
| 移动首页 | `app/sky/page.tsx` | 今日建议、最近任务、快捷工具、学习入口 | P0 | 成员 B |
| 账号与我的 | `app/auth/*`、`app/account/page.tsx` | 登录注册、个人信息、套餐用量、退出登录 | P0 | 成员 A |
| AI 授课 | `app/sky/cloud-mind/teaching/page.tsx` | 表单、生成、进度、结果入口 | P0 | 成员 B |
| 课堂播放 | `app/classroom/[id]/page.tsx` | 手机端只读/轻交互课堂消费视图 | P0 | 成员 B |
| AI 助手 | `app/sky/assistant/page.tsx` | 移动聊天、历史抽屉、上下文追问 | P0 | 成员 B |
| 天梯工坊 | `app/sky/learning/page.tsx`、`components/sky/learning/workshop-page.tsx` | 数据化学习中心、错题、复习、画像、今日任务 | P0 | 成员 B |
| 解题 | `app/sky/solve/page.tsx`、`app/sky/cloud-mind/solve/page.tsx` | 拍照/上传、识别、解析、加入错题 | P1 | 成员 B |
| 测验 | `app/sky/cloud-mind/quiz/page.tsx` | 单题卡片答题、结果页、错题沉淀 | P1 | 成员 B |
| 记忆卡片 | `app/sky/cloud-mind/memory/page.tsx` | 卡片复习、掌握/不熟标记 | P1 | 成员 B |
| 课件 | `app/sky/slides/page.tsx`、`app/sky/cloud-mind/slides/page.tsx` | 列表、生成状态、预览、切页、导出 | P1 | 成员 B |
| 设置 | `app/settings/page.tsx` | 基础设置入口，高级设置提示到桌面端 | P2 | 成员 A |

说明：`/sky/learning` 已经是正式天梯工坊入口，不再保留或依赖 `/sky/learning/test` 测试页。

## 3. 总体技术路线

### 3.1 路线选择

采用“同仓库响应式移动端 + PWA 增强”：

```text
同一 Next.js 项目
  -> 复用 app/api 与 lib 业务逻辑
  -> 新增移动端通用壳层与 UI 组件
  -> 页面层按桌面/移动信息架构呈现
  -> Playwright 覆盖移动视口
  -> PWA 提供添加到桌面体验
```

这样能最大化复用现有业务能力，也能让两个人按清晰边界并行开发。

### 3.2 壳层策略

`SkyAppShell` 是全局改造的核心。建议拆成桌面壳层和移动壳层，但入口保持一个：

```tsx
export function SkyAppShell({ children }: SkyAppShellProps) {
  return (
    <>
      <div className="hidden md:block">
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

- `MobileSkyShell` 只负责全局结构：顶部栏、底部导航、safe-area、滚动容器、全局任务入口。
- 业务页面只负责内容，不重复实现全局导航。
- 优先用 CSS 断点控制桌面/移动显示，避免服务端和客户端首帧不一致。
- 涉及 theme、时间、随机数、浏览器尺寸的内容必须在 mount 后渲染，避免 hydration mismatch。
- 不在深层业务组件到处写 `window.innerWidth` 判断。

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
  learning-workshop.spec.ts
  solve-review.spec.ts
  slides-preview.spec.ts
```

### 3.4 不可突破的工程约束

- 不复制 API。
- 不复制 Zustand store。
- 不复制 AI 生成管线。
- 不复制课堂播放状态机。
- 不新增“移动端专属业务数据模型”，只新增移动端 UI 状态。
- 不让每个页面各自实现一套底部导航、抽屉、空状态、错误态。
- 不为了移动端删除桌面端已有能力。
- 不把测试页或实验路由作为正式移动端入口。

## 4. 功能完整性规划

### 4.1 P0：必须交付的完整学习闭环

P0 是第一阶段硬性交付范围。P0 任一闭环不可用，都不算移动端可验收。

#### P0-1 移动端壳层

用户能力：

- 手机打开 `/sky`、`/sky/learning`、`/sky/assistant` 等页面时进入移动布局。
- 可通过底部导航进入首页、天梯工坊、云端智囊、AI 助手、我的。
- 页面顶部有标题、返回、更多操作位。
- 页面底部内容不被底部导航或固定按钮遮挡。
- 今日打卡、用户头像、后台任务入口在移动端有合适位置，不挤压主内容。

验收：

- 320px、375px、390px、412px 宽度无关键内容横向溢出。
- iOS safe-area 下底部导航不遮挡按钮。
- 桌面端导航和布局无明显回归。
- 刷新页面后导航高亮准确。

#### P0-2 登录与“我的”

用户能力：

- 手机端可登录、注册、退出登录。
- 未登录访问学习功能时有清晰引导。
- 登录后可查看账号信息、套餐/用量、学习入口和退出按钮。
- 登录成功后能回到原目标页面。

验收：

- 表单输入不被软键盘遮挡。
- 错误提示可见且可重试。
- 登录态过期时不白屏，能回到登录流程。

#### P0-3 移动首页

用户能力：

- 首屏看到今日建议、最近任务、继续学习入口。
- 快速进入 AI 授课、解题、天梯工坊、AI 助手、课件。
- 看到生成任务或最近课堂的状态。

验收：

- 首屏信息不堆成桌面大面板。
- 加载、空数据、失败状态完整。
- 不加载过重图表或大型 canvas 阻塞首屏。
- 无横向滚动。

#### P0-4 AI 授课与生成进度

用户能力：

- 输入授课主题。
- 设置必要参数：学段、年级、难度、学习目标。
- 发起生成。
- 查看当前生成阶段、已完成步骤、失败信息。
- 可取消、重试或进入课堂结果。
- 刷新或离开后能恢复任务状态。

验收：

- 完成“输入主题 -> 生成 -> 查看进度 -> 打开课堂”。
- 长文本输入可用。
- 高级参数默认折叠。
- 生成失败有明确说明和重试入口。
- 进度页不因接口轮询失败白屏。

#### P0-5 课堂移动消费视图

用户能力：

- 打开已有课堂。
- 查看当前章节、老师/同学发言、讲解内容。
- 查看 PPT/白板预览。
- 播放、暂停、上一页、下一页。
- 打开章节目录和课堂摘要。
- 带课堂上下文向 AI 助手追问。

验收：

- 课堂内容在 390px 宽度下可读。
- PPT/白板区域保持比例，不造成不可恢复横向滚动。
- 音频必须由用户点击触发，自动播放失败时有提示。
- 播放按钮状态准确。
- 课堂助手入口能带上当前课堂上下文。

#### P0-6 AI 助手移动聊天

用户能力：

- 发送多轮消息。
- 接收流式回复。
- 停止生成、重试发送。
- 查看和切换历史会话。
- 从课堂、解题、天梯工坊带上下文进入对话。

验收：

- 输入框固定在底部且不被键盘遮挡。
- 流式输出不导致页面明显抖动。
- 历史会话在抽屉中可用。
- 网络失败可重试。
- 长公式、代码、表格可横向查看或折叠。

#### P0-7 天梯工坊移动闭环

用户能力：

- 打开正式 `/sky/learning` 查看天梯工坊。
- 查看今日任务、推荐理由、数据来源、刷新数据。
- 开始今日任务。
- 查看完整画像并能返回天梯工坊。
- 查看错题、复习计划、知识图谱、学习统计、学情分析。

验收：

- 不依赖测试路由。
- 数据来自现有 API 和 store，不写死展示数据。
- 今日任务按钮在移动端不被底部导航遮挡。
- 各 tab 可切换，切换后滚动位置合理。
- 没有画像数据时展示引导，不展示假数据。

### 4.2 P1：应交付的学习工具闭环

P1 保证移动端不仅能看课堂，也能完成日常学习工具。

#### P1-1 解题、拍照与错题

用户能力：

- 拍照或从相册上传图片。
- 查看图片预览，重新选择或删除。
- 查看识别文本、步骤解析、最终答案。
- 继续追问。
- 加入错题本。
- 进入错题复习。

验收：

- 相机权限失败时降级为文件上传。
- 图片过大、上传失败、识别失败均有提示和重试。
- 解析内容不横向溢出。
- 可从解题结果进入错题和助手。

#### P1-2 测验与记忆卡片

用户能力：

- 单题卡片式答题。
- 上一题、下一题、提交答案。
- 查看解析和结果页。
- 记忆卡片翻面，标记掌握/不熟。
- 结果能沉淀到错题或学习画像。

验收：

- 按钮点击区域不小于 44px。
- 长公式、表格、代码可查看。
- 结果页展示分数、错题和下一步建议。
- 返回上一页不丢失当前答题状态。

#### P1-3 课件移动预览

用户能力：

- 查看课件列表和生成状态。
- 逐页预览课件。
- 左右切换页面。
- 导出或下载 PPTX。
- 轻量修改标题或重新生成封面/单页。

验收：

- 预览区域保持比例。
- 复杂编辑提示到桌面端完成。
- 文字不被压扁或裁切。
- 导出失败有错误提示。

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
- 成员 B 负责“学习业务移动化”：首页业务内容、AI 授课、课堂、助手、天梯工坊、解题、测验、课件。
- 成员 A 不深入改业务 API 和学习流程。
- 成员 B 不直接改移动壳层、底部导航、safe-area、通用 UI 内部实现。
- 公共组件缺能力时，由成员 B 提需求，成员 A 扩展 props 或新增通用组件。
- 双方只在约定集成点交汇，不在同一批 PR 中大面积改同一文件。

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
- 移动端 Playwright 基建

成员 A 不负责：

- AI 授课业务字段设计。
- 课堂播放业务状态机。
- AI 助手消息业务逻辑。
- 解题、错题、测验、课件业务流程。
- 天梯工坊推荐算法和画像数据逻辑。

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

- 移动首页业务内容。
- AI 授课表单和生成进度。
- 课堂移动消费视图。
- AI 助手移动聊天。
- 天梯工坊移动闭环。
- 解题/拍照/错题。
- 测验/记忆卡片。
- 课件移动预览。

成员 B 不负责：

- 全局底部导航实现。
- `MobileSkyShell` 的 safe-area 和滚动策略。
- PWA manifest。
- 登录注册底层逻辑。
- 移动端 e2e 基础设施。

### 5.4 交叉文件规则

| 文件/区域 | 处理规则 |
| --- | --- |
| `components/sky/layout/app-shell.tsx` | 成员 A 主责，成员 B 不直接改壳层逻辑 |
| `components/mobile/ui/*` | 成员 A 维护，成员 B 只使用；确需修改先同步 |
| `app/api/*` | 谁负责业务谁改；禁止为移动端复制同功能 API |
| `lib/store/*` | 原则上不为移动端分叉；新增状态需双方确认 |
| `components/sky/*` | 成员 B 主责；若沉淀为公共移动组件，迁移到 `components/mobile` 后交成员 A 维护 |
| `app/sky/page.tsx` | 成员 A 提供移动容器，成员 B 填业务内容 |
| `e2e/tests/mobile/*` | 成员 A 建框架，成员 B 补业务路径断言 |

### 5.5 集成契约

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

成员 B 的业务页面统一处理视图状态：

```ts
type MobileViewState =
  | 'idle'
  | 'loading'
  | 'empty'
  | 'ready'
  | 'submitting'
  | 'error';
```

每个业务页面至少处理：

- 未登录。
- 加载中。
- 空数据。
- 正常数据。
- 操作中。
- 失败。
- 重试。

API 调用层建议收敛成：

```ts
type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };
```

旧 API 不强行重构，但移动端页面不应散落处理多种返回结构。

## 6. 防错与质量标准

### 6.1 现有 Web UI 移动兼容治理

移动端适配必须覆盖现有 Web UI 页面，不能只新增移动壳层后把桌面内容原样塞进手机宽度。每个进入移动端交付范围的页面，都要先做一次兼容审计，再决定直接响应式复用、拆移动视图，还是降级为只读/预览。

页面审计分三类：

| 类型 | 判断标准 | 处理方式 |
| --- | --- | --- |
| A 类：可响应式复用 | 页面主要由卡片、表单、文本列表组成，没有复杂拖拽/大画布 | 保留原组件，补 `sm/md/lg` 断点、单列布局、移动间距和文本换行 |
| B 类：需要移动变体 | 桌面页依赖多栏、侧边栏、复杂表格、大图表、固定工具栏 | 抽出共享数据和业务逻辑，新增 `Mobile*View` 或移动布局分支 |
| C 类：移动端降级 | 桌面页依赖白板编辑、PPT 精细编辑、复杂知识图谱、大型 canvas | 手机端提供预览、只读、导出或跳转桌面端提示 |

现有 Web UI 常见风险点必须逐页排查：

- `w-[固定值]`、`min-w-*`、`grid-cols-*`、`lg:grid-cols-[...]` 导致横向溢出。
- 桌面侧边栏、右侧详情栏、顶部导航在手机上挤压主内容。
- 表格、公式、代码块、URL、长知识点名称撑破卡片。
- 图表、白板、PPT 预览、知识图谱没有固定比例或溢出容器。
- hover-only 操作在触摸设备不可发现。
- 弹窗高度超过视口，底部按钮被键盘或 safe-area 遮挡。
- 绝对定位装饰元素、浮动按钮、固定工具栏覆盖正文。
- 桌面端“横向排列按钮组”在手机上没有换行或折叠。

处理规则：

- 能直接响应式复用的组件，优先通过 class 调整完成，不复制业务逻辑。
- 桌面复杂布局需要移动变体时，只拆视图层；数据获取、store、API 调用保持共用。
- 桌面侧边栏在移动端改为 `MobileSheet`、分段控制或顶部 tab。
- 桌面表格在移动端改为卡片列表，保留搜索、筛选和关键操作。
- 桌面多栏布局在移动端统一降为单列，重要操作放入底部 `MobileStickyActionBar`。
- 大图表在移动端优先展示摘要卡片，完整图表放入“查看详情”或横向滚动容器。
- 所有移动变体必须和桌面变体共享同一份空状态、错误态和数据校验逻辑。
- 任何移动端专属渲染都不能造成 SSR 与客户端首帧结构不一致。

重点页面兼容策略：

| 页面/模块 | 移动端策略 |
| --- | --- |
| `/sky` 首页 | 重组为今日建议、继续学习、快捷入口、最近任务的单列信息流 |
| `/sky/learning` 天梯工坊 | 保留正式数据化能力，首屏突出今日任务和画像入口，详情区用 tab/折叠组织 |
| `/sky/assistant` AI 助手 | 桌面侧栏改为历史会话抽屉，聊天输入固定底部 |
| `/sky/cloud-mind/teaching` AI 授课 | 表单分段，进度状态独立卡片，高级参数默认折叠 |
| `/classroom/[id]` 课堂 | PPT/白板固定比例，只读消费为主，目录和摘要放抽屉 |
| `/sky/cloud-mind/solve` 解题 | 上传区、结果区、追问区分步骤展示，底部固定主操作 |
| `/sky/cloud-mind/quiz` 测验 | 单题卡片，上一题/下一题/提交固定在易触达区域 |
| `/sky/slides` 课件 | 课件列表卡片化，预览固定比例，复杂编辑降级 |

每个页面完成后必须在 320、375、390、412、横屏和桌面视口下截图或手测记录。发现横向滚动、遮挡、文字重叠、按钮不可点时，该页面不得进入已完成状态。

### 6.2 排版防错标准

所有移动页面必须满足：

- 320px 宽度下无关键内容溢出。
- 375px、390px、412px 宽度下无不可控横向滚动。
- 底部导航不遮挡内容。
- 底部固定按钮不遮挡表单或列表末尾。
- 标题、按钮、卡片文字不互相覆盖。
- 长单词、公式、代码、URL、表格必须可滚动、换行或折叠。
- 弹层高度不超过视口，内容可滚动。
- 顶部 sticky 和底部 fixed 不造成双滚动混乱。
- 固定比例区域使用 `aspect-ratio`，不靠内容撑高。
- 网格使用 `minmax(0, 1fr)` 或单列降级，防止长内容撑破布局。

### 6.3 功能防错标准

所有核心功能必须满足：

- 每个异步操作有 loading 状态。
- 每个失败状态有错误提示。
- 每个可恢复失败有重试入口。
- 生成、上传、识别、流式对话不能只有静默等待。
- 路由跳转失败或数据缺失时不能白屏。
- 登录过期能回到登录流程。
- API 返回异常结构时页面不崩溃。
- 用户离开生成进度页后，回到页面仍可恢复任务状态。
- 组件卸载时取消轮询或忽略过期响应，避免状态错乱。

### 6.4 Hydration 防错标准

移动端首屏尤其容易触发 hydration mismatch，必须遵守：

- SSR 和客户端首帧 className、style、DOM 结构一致。
- 不在首帧渲染中直接使用 `Date.now()`、`Math.random()`、`window.innerWidth`。
- theme、localStorage、媒体查询、浏览器能力检测必须 mount 后再影响 DOM。
- 客户端专属动画和装饰元素可用 mounted gate。
- 不用 `suppressHydrationWarning` 掩盖真实结构差异，除非明确无法避免。

### 6.5 触摸与输入标准

- 可点击区域高度建议不小于 44px。
- 主按钮放在单手容易触达的位置。
- 输入框聚焦后不被软键盘遮挡。
- 长文本输入支持滚动编辑。
- 上传图片入口同时支持拍照和相册。
- 音频播放必须由用户点击触发。
- 危险操作必须有二次确认或撤销能力。

### 6.6 性能标准

- 移动首页首屏不加载大型 canvas、知识图谱或过重图表。
- 课堂白板、课件预览、知识图谱按需加载。
- 图片上传前提示大小限制，必要时压缩。
- 聊天流式输出和课堂播放不能导致整页高频重渲染。
- 列表超过合理长度时使用分页、增量加载或虚拟列表。
- 弹层和抽屉懒加载内容，避免首屏打包过重。

### 6.7 降级策略

| 复杂能力 | 移动端处理 |
| --- | --- |
| 白板编辑 | 第一阶段只读预览，可缩放/全屏 |
| PPT 精细编辑 | 提供预览、导出、轻量标题修改；复杂编辑提示桌面端 |
| 知识图谱 | 展示摘要和关键节点，完整交互延后 |
| 大型图表 | 展示简版统计卡片 |
| 自动音频播放 | 用户点击后播放，失败时提示 |
| 相机权限失败 | 降级为文件上传 |
| AI 生成耗时长 | 可恢复进度，首页展示最近任务 |
| 弱网络 | 展示可重试状态，保留已有结果 |

## 7. 实施里程碑

### M0：范围确认

预计：0.5 天

任务：

- 确认采用移动 Web / PWA。
- 确认 P0 必须完成，P1 尽量完成，P2 延后。
- 确认两人文件归属。
- 建立 PR 合并顺序。
- 确认 `/sky/learning` 是正式天梯工坊入口，不再使用测试路由。

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
- 建立 mobile Playwright viewport 配置或测试工具函数。

成员 B：

- 梳理 `/sky` 首页移动信息架构。
- 梳理 AI 授课页移动端表单和进度视图。
- 梳理天梯工坊移动首屏信息优先级。

完成标准：

- 手机端打开 `/sky` 有移动导航和页面容器。
- 桌面端 `/sky`、`/sky/learning` 无明显回归。
- 320px 到 412px 无基础壳层溢出。

### M2：P0 学习闭环

预计：4 到 6 天

成员 A：

- 完成登录/账号移动端。
- 修复 safe-area、键盘遮挡、底部导航遮挡。
- 完成 mobile smoke e2e。

成员 B：

- 完成移动首页。
- 完成 AI 授课提交和生成进度。
- 完成课堂移动消费视图。
- 完成 AI 助手移动聊天。
- 完成天梯工坊移动闭环。

完成标准：

```text
登录 -> 首页 -> AI 授课 -> 生成进度 -> 课堂 -> 助手追问
```

以及：

```text
首页 -> 天梯工坊 -> 开始今日任务 -> 查看完整画像 -> 返回天梯工坊
```

均可在手机端完成。

### M3：P1 学习工具

预计：4 到 6 天

成员 A：

- 补齐 PWA manifest。
- 补齐移动端公共组件缺口。
- 扩展移动端测试。

成员 B：

- 完成解题、拍照、上传、错题。
- 完成测验和记忆卡片。
- 完成课件移动预览。

完成标准：

```text
拍题/上传 -> 解题 -> 加入错题 -> 复习
```

可在手机端完成；手机端可查看测验结果和课件预览。

### M4：联调与稳定性收口

预计：2 到 3 天

共同任务：

- 检查桌面端回归。
- 修复横向滚动、遮挡、白屏、输入框、弹层、错误态。
- 跑质量命令。
- 补 PR 截图和手测记录。

完成标准：

- P0 路径通过移动端手测和 e2e。
- P1 至少完成一个学习工具闭环。
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
- `components/sky/layout/app-shell.tsx`

验收：

- `/sky` 手机端有移动导航。
- 桌面端无明显回归。
- safe-area 初步可用。

### PR 2：账号、移动首页与 PWA 基础

标题：

```text
feat: add mobile account home and pwa basics
```

负责人：成员 A 主责，成员 B 补首页业务内容

范围：

- `/auth/*`
- `/account`
- `/sky`
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

### PR 4：AI 助手、天梯工坊与复习闭环

标题：

```text
feat: adapt assistant workshop and review flows for mobile
```

负责人：成员 B

范围：

- `/sky/assistant`
- `/sky/learning`
- `components/sky/learning/workshop-page.tsx`
- 错题、复习、画像、今日任务

验收：

- AI 助手可稳定聊天。
- 天梯工坊正式页移动端可用。
- 今日任务和完整画像闭环可用。

### PR 5：解题、测验、记忆卡片与课件预览

标题：

```text
feat: adapt solve quiz memory and slides for mobile
```

负责人：成员 B 主责，成员 A 补公共组件和测试

范围：

- `/sky/solve`
- `/sky/cloud-mind/solve`
- `/sky/cloud-mind/quiz`
- `/sky/cloud-mind/memory`
- `/sky/slides`
- `/sky/cloud-mind/slides`

验收：

- 可解题、可加入错题、可复习。
- 可答题、可看记忆卡片。
- 可查看课件预览。

### PR 6：稳定性、e2e 与视觉收口

标题：

```text
fix: polish mobile stability and regression coverage
```

负责人：共同

范围：

- e2e 补全
- 视觉缺陷修复
- 桌面回归修复
- 已知限制记录

验收：

- 质量命令通过。
- P0 移动路径稳定。
- 关键页面有移动截图或手测记录。

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

说明：如果主干当前已有无关类型错误，PR 描述必须列明“本 PR 改动文件已通过哪些局部检查”和“全量检查失败的已知外部原因”。不要把无关失败伪装成通过。

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
e2e/tests/mobile/learning-workshop.spec.ts
```

覆盖：

- 打开 `/sky`。
- 底部导航切换。
- 登录页输入。
- AI 授课表单可输入。
- 生成进度页可打开。
- 课堂页可打开。
- AI 助手可输入并发送。
- 天梯工坊今日任务按钮可点击。
- 完整画像可打开并返回天梯工坊。

### 9.4 P1 自动化或手测用例

建议覆盖：

- 拍照/相册上传入口可用。
- 图片预览、删除、重新选择。
- 解题结果页展示。
- 加入错题。
- 错题复习。
- 测验答题和提交。
- 记忆卡片翻面。
- 课件预览切页。

### 9.5 视觉检查清单

每个移动页面提交前检查：

- 是否横向滚动。
- 是否底部遮挡。
- 是否顶部栏遮挡内容。
- 文字是否溢出卡片。
- 按钮文字是否被挤压。
- 弹层内容是否可滚动。
- loading 态是否撑破布局。
- error 态是否有重试。
- 深色模式是否可读。
- 桌面端是否回归。

## 10. 验收标准

移动端第一阶段可验收时，必须满足：

- 手机端有清晰移动布局，不是桌面端压缩版。
- 用户可以完成 P0 学习闭环。
- 用户可以完成天梯工坊移动闭环。
- 用户至少可以完成一个 P1 学习工具闭环，推荐“拍题/上传 -> 解题 -> 加入错题 -> 复习”。
- 课堂结果能在手机端查看和轻控制。
- AI 助手能在手机端稳定多轮对话。
- 课件能在手机端预览。
- 320px 到 430px 主流宽度无关键排版错误。
- 弹层、输入框、底部导航、底部按钮没有遮挡问题。
- 失败状态不会白屏，均可提示或重试。
- 桌面端主要页面无明显回归。
- 质量命令通过，或明确记录主干已有的无关失败。
- 移动端核心路径有 e2e 或明确手测记录。

## 11. 风险与应对

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 桌面端回归 | 影响现有 Web 体验 | 壳层用 CSS 断点隔离，PR 必测桌面视口 |
| Hydration mismatch | 首屏报错或样式不一致 | mount gate 处理 theme、尺寸、随机数、时间 |
| 底部导航遮挡内容 | 表单和按钮不可点 | 统一 `MobilePage` 底部 padding 和 safe-area |
| 软键盘遮挡输入 | 聊天和表单不可用 | `useKeyboardInset`，底部输入栏动态上移 |
| 课堂/课件过重 | 手机卡顿 | 按需加载、固定比例预览、复杂编辑降级 |
| AI 生成耗时长 | 用户误以为失败 | 任务状态可恢复，首页展示最近任务 |
| 相机权限失败 | 无法拍题 | 降级文件上传 |
| 弱网络 | 白屏或卡死 | loading、error、retry 全覆盖 |
| PWA 缓存不当 | 旧资源污染 | 第一阶段只做基础 manifest，谨慎启用 aggressive cache |

## 12. 后续演进

第一阶段稳定后再考虑：

- 推送通知：生成完成、复习提醒、打卡提醒。
- 离线阅读：已生成课堂、知识卡片、错题离线查看。
- 移动端语音问答。
- 移动端课件轻编辑增强。
- 更完整的题库管理移动端。
- 原生壳包装。
- 教师端移动管理能力。
