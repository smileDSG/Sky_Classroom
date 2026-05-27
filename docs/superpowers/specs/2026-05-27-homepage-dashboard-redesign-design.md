---
title: Homepage Dashboard Redesign
date: 2026-05-27
---

# Homepage Dashboard Redesign — Design Spec

## Purpose

将首页从"线性单列"布局升级为 Dashboard 风格，提升信息密度和视觉丰富度，减少留白，让用户一眼看到更多内容和操作入口。核心功能不变（课堂生成）。

## Architecture

### New Components

**1. `components/sky/home/greeting-section.tsx`**
- 复用 `/sky/page.tsx` 的问候逻辑（`getGreeting`、`getGreetingEmoji`）
- 左侧：问候语 + 副标题
- 右侧：3 个快捷统计卡片（今日学习、连续打卡、知识掌握），用 demo 数据
- 紧凑：`py-6` 而非原版的 `pt-24`

**2. `components/sky/home/quick-access-grid.tsx`**
- 4 个功能卡片：PPT课件、搜题、云端智囊、互动课堂
- 每个卡片有图标、标题、简短描述、hover 动画
- 点击跳转到对应页面

**3. `components/sky/home/generation-status.tsx`**
- 当 `classroomPhase !== 'idle'` 时显示生成进度
- 当空闲时显示新手引导（"开始你的第一个课堂" + 操作提示）
- 复用现有 `classroomPhase` 等状态

### Modified Components

**4. `components/sky/home/hero-input.tsx`**
- 移除 `initial/animate` 延迟（已有外层包裹动画）
- 减少内部 padding（`py-3` → `py-2`）
- 移除 `max-w-3xl`，改为自适应宽度
- 保留全部现有功能

**5. `app/page.tsx`**
- 重组布局：Greeting + QuickStats → HeroInput → QuickAccess → GenerationStatus → ClassroomGrid → Footer
- 替换 `FeatureHighlights` 为 `QuickAccessGrid`
- 收紧垂直间距：`pt-24 pb-12` → `pt-8 pb-8`
- 移除 `AnimatedLogo`（问候语替代品牌展示）

### Unchanged Components

- `MinimalNavbar` — 不变
- `FloatingUserCard` — 不变
- `ClassroomGrid` — 样式微调（减少 gap），逻辑不变
- `SkyBackground` — 不变

## Layout Wireframe

```
Navbar ─────────────────────────────────────────────────────
Greeting (left) | QuickStats ×3 (right)                     │
HeroInput (full width, compact)                             │
QuickAccess ×4 cards │ Generation Status card               │
ClassroomGrid (compact grid, gap-3)                         │
Footer                                                       │
```

## Data Flow

- GreetingSection 使用 `useTheme` 获取暗色模式，计算当前时间问候
- QuickStats 暂时用硬编码 demo 值，标记 `TODO: wire up real data`
- QuickAccessGrid 纯静态路由，无状态
- GenerationStatus 接收 `classroomPhase`、`classroomProgress`、`classroomStep` 等 props
- 所有数据流向是单向的：store → props → component

## Error Handling

- GreetingSection 不依赖外部数据，无错误场景
- QuickStats 用 demo 数据，无外部 API 调用
- GenerationStatus 处理 `idle` / `submitting` / `generating_outline` / `reviewing` / `generating_slides` / `done` 所有 phase
- 课堂列表已有错误处理（`loadClassrooms` 的 try/catch）

## Responsive Design

- Greeting + QuickStats：移动端堆叠（`flex-col md:flex-row`）
- QuickAccessGrid：移动端 2 列，桌面端 4 列
- GenerationStatus：移动端全宽
- HeroInput：移动端自适应宽度，减少 padding
