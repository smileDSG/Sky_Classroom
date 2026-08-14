# 队员 A 移动端基础设施交接文档

> 适用对象：队长、队员 A、队员 B  
> 当前状态：队员 A 的移动端基础设施已完成第一轮搭建，但移动端整体产品与视觉方向仍需统一后再继续扩展业务页面。

## 1. 交接结论

本次 PR 交付的是“移动端地基”，不是完整移动端业务闭环。

已经完成：

- 移动端壳层：顶部栏、底部导航、页面容器、安全区留白。
- 移动端公共组件：空态、错误态、骨架屏、来源列表、置信度标识、Agent 进度、底部抽屉、上传入口、更多操作菜单。
- 移动端 Hooks：移动视口判断、视口尺寸、软键盘 inset。
- `/sky` 壳层接入：桌面端继续使用原桌面壳层，移动端使用 `MobileSkyShell`。
- `/account` 移动适配：移动端用横向分段入口替代固定侧栏。
- PWA 基础 manifest。
- 移动端单元测试与 smoke e2e 初稿。
- 组件使用说明：`components/mobile/README.md`。

尚未完成：

- 软件杯主线工作台的业务页面。
- 移动端首页的信息架构重做。
- AI 授课、课堂、助手、天梯工坊、解题、测验、记忆卡片、课件等业务页统一移动设计。
- 统一视觉方向、页面模板、信息密度标准和示例页面。
- 移动端真机/截图验收。

## 2. 当前最大问题

现在移动端缺少统一设计方向，容易出现这些问题：

- 每个业务页都按自己的想法堆卡片，页面风格不统一。
- 桌面端组件直接压缩到手机端，信息层级不清楚。
- 顶部栏、底部栏、固定按钮、弹层之间容易互相遮挡。
- 业务组件可能重复实现空态、错误态、进度、来源和置信度样式。
- 比赛主线和日常学习入口混在一起，用户第一眼不知道该做什么。

因此，队员 B 在继续大规模写业务页面前，建议先由队长确认下面的设计方向。

## 3. 建议统一设计方向

### 3.1 产品定位

移动端应定位为：

> 面向学生的“可信 AI 学习工作台”，不是官网、不是营销页，也不是桌面端的缩小版。

第一屏优先回答三个问题：

- 今天我该学什么？
- 这个推荐为什么适合我？
- 我点哪里开始？

### 3.2 视觉方向

建议采用“克制、清晰、学习工具感”的方向：

- 主体背景：浅色为主，深色模式可用，但不要依赖大面积渐变。
- 主色：天空课堂现有 sky/blue 作为主强调色。
- 状态色：
  - green/emerald：完成、可信、通过。
  - amber：提醒、待复核、需补充。
  - rose：失败、危险操作。
  - slate：普通文本、边框、弱信息。
- 形状：卡片圆角控制在 `rounded-xl` 以下，避免过多大圆角装饰。
- 阴影：轻量阴影，只用于浮层、底部导航、关键行动卡。
- 装饰：不新增大面积装饰球、复杂背景、无意义插画。
- 动效：只在加载、Agent 进度、按钮反馈中使用，避免页面整体跳动。

### 3.3 信息架构

移动端页面统一使用单列结构：

```text
顶部栏
  -> 页面标题 / 当前状态
  -> 主行动卡
  -> 关键内容区
  -> 次级信息折叠或进入 Sheet
  -> 底部导航 / 固定主操作
```

不要在手机端复刻桌面多栏布局。桌面侧栏在手机端统一改为：

- 横向分段 tab。
- `MobileSheet`。
- 页面内折叠区域。

### 3.4 页面优先级

P0 页面优先做这些：

1. `/sky` 移动首页：今日建议、继续学习、比赛主线入口。
2. `/sky/study-lab` 个性化学习工作台：画像、知识库、资源生成、审核、路径。
3. `/sky/learning` 天梯工坊：今日任务、画像、错题、复习。
4. `/sky/assistant` AI 助手：移动聊天、历史抽屉、上下文追问。
5. `/account` 我的：账号、开源说明、退出登录。

P1 页面再做：

- AI 授课和课堂消费。
- 拍题/解题/加入错题。
- 测验、记忆卡片、课件预览。

## 4. 组件使用约定

队员 B 后续业务页面必须优先使用 `components/mobile`。

### 页面容器

```tsx
import { MobilePage } from "@/components/mobile";

<MobilePage title="个性化学习工作台" description="根据你的画像生成学习资源">
  {children}
</MobilePage>;
```

用于：

- 页面标题。
- 统一左右边距。
- 底部导航留白。
- 移动端正文垂直节奏。

### Agent 进度

```tsx
import { MobileAgentProgress } from "@/components/mobile";

<MobileAgentProgress
  stages={[
    { id: "profile", label: "画像分析", status: "done" },
    { id: "generate", label: "资源生成", status: "active" },
  ]}
/>;
```

用于：

- 多智能体资源生成。
- AI 授课生成。
- 课件生成。
- 长任务进度。

### 来源和可信度

```tsx
import { MobileConfidenceBadge, MobileSourceList } from '@/components/mobile';

<MobileConfidenceBadge value={0.82} />
<MobileSourceList sources={sources} />
```

用于：

- 可信审核。
- RAG 来源引用。
- 需复核提示。
- 学术结论出处展示。

### 抽屉和操作

```tsx
import { MobileSheet, MobileActionMenu } from "@/components/mobile";
```

用于：

- 历史会话。
- 筛选条件。
- 章节目录。
- 更多操作。

不要在业务页面里复制一套抽屉、错误态、空态、置信度 UI。如果组件能力不够，由队员 A 扩展公共组件。

## 5. 文件归属

队员 A 继续维护：

- `components/mobile/**`
- `lib/mobile/**`
- `components/sky/layout/app-shell.tsx`
- `components/sky/auth/auth-layout.tsx`
- `app/account/page.tsx`
- `public/manifest.json`
- `tests/mobile/**`
- `e2e/tests/mobile/**`

队员 B 主责：

- `app/sky/page.tsx`
- `app/sky/study-lab/**`
- `components/sky/study-lab/**`
- `app/sky/learning/**`
- `components/sky/learning/**`
- `app/sky/assistant/**`
- `app/sky/cloud-mind/**`
- `app/classroom/[id]/**`

交叉文件：

- `components/sky/layout/app-shell.tsx`：队员 A 主责，队员 B 不直接改壳层逻辑。
- `app/sky/page.tsx`：队员 A 提供容器能力，队员 B 填业务内容。
- `e2e/tests/mobile/**`：队员 A 建框架，队员 B 补业务路径断言。

## 6. 已知风险

### 6.1 `SkyAppShell` 双重挂载风险

当前 `SkyAppShell` 同时渲染桌面壳层和移动壳层，再用 CSS 隐藏：

```tsx
<div className="hidden md:block">
  <DesktopSkyShell>{children}</DesktopSkyShell>
</div>
<div className="md:hidden">
  <MobileSkyShell>{children}</MobileSkyShell>
</div>
```

风险：

- 业务页面的 `useEffect` 可能执行两次。
- 轮询、生成任务恢复、埋点、数据请求可能重复触发。
- 表单初始化或全局 store 写入可能出现重复副作用。

建议：

- 在业务页大规模接入前，由队长决定是否接受此模式。
- 如果不接受，后续应改成 mount 后选择性渲染或将壳层拆为只包 UI chrome、不重复挂载业务 children 的结构。

### 6.2 登录默认跳转仍偏桌面

当前直接访问 `/auth/login` 登录后默认跳转 `/`。如果要移动端优先，应改为：

```text
/auth/login?redirect=/sky
```

或在移动端入口强制带 redirect 参数。是否把默认值改为 `/sky` 需要队长确认，因为会影响桌面端登录习惯。

### 6.3 `/about` 入口未确认

`/account` 中加入了“关于 智眸无界 / 开源协议”入口，当前指向 `/about`。如果项目没有正式 `/about` 页面，需要后续补齐或改到已有设置/说明页。

## 7. 队员 B 开工前确认清单

队长确认后再继续大规模业务移动化：

- [ ] 移动端定位采用“可信 AI 学习工作台”。
- [ ] 移动端不做营销页，不复制桌面多栏布局。
- [ ] P0 首页第一屏突出“今日主行动”和“比赛主线入口”。
- [ ] 所有长任务统一使用 `MobileAgentProgress`。
- [ ] 所有来源/可信审核统一使用 `MobileSourceList` 和 `MobileConfidenceBadge`。
- [ ] 桌面侧栏在移动端统一使用 tab、折叠或 `MobileSheet`。
- [ ] 业务页面不得复制移动端公共组件实现。
- [ ] 队长决定是否修正 `SkyAppShell` 双重挂载模式。
- [ ] 队长决定登录默认 redirect 是否从 `/` 改为 `/sky`。
- [ ] 队长确认 `/about` 或开源说明页最终路由。

## 8. 验收方式

本 PR 的验收重点不是业务闭环，而是地基是否可用：

- 打开 `/sky`，移动视口下出现移动顶部栏和底部导航。
- 打开 `/account`，移动视口下不出现桌面侧栏，能切换账号分区。
- `components/mobile/README.md` 能指导队员 B 使用组件。
- `tests/mobile` 单元测试通过。
- `e2e/tests/mobile/smoke.spec.ts` 存在，并覆盖移动导航和登录输入。
- PR 描述中明确列出未解决的设计方向和后续决策点。

## 9. 建议后续 PR 顺序

1. 队长确认移动端设计方向和双重挂载策略。
2. 队员 A 修正壳层风险、登录 redirect、开源说明路由。
3. 队员 B 开始 `/sky` 移动首页重组。
4. 队员 B 开始 `/sky/study-lab` 比赛主线工作台。
5. 队员 A 配合补公共组件能力和移动端 e2e。
