# 概况页 UI/UX 重构设计

## 概述

将概况页（/sky）从基础白色卡片升级为科技感数据仪表盘，新增学习趋势图和能力雷达图，并为所有元素添加精致的动效。

## 视觉风格

**背景**：深色渐变 `#0f172a → #1e293b`
**卡片**：`bg-slate-900/50` + `backdrop-blur` + `border-slate-700/50`
**主渐变色**：`#8B5CF6`（紫）→ `#06B6D4`（青）
**语义色**：成功 `#10B981`，警告 `#F59E0B`，错误 `#EF4444`

## 布局（从上到下）

1. **问候语** + 时间脉冲点（右上角呼吸光点）
2. **3 张统计卡片**：今日搜题（环形计数）、待复习（进度条）、掌握度（进度环）
3. **双列图表**：左侧 7 天趋势折线图 + 右侧 5 维能力雷达图
4. **快捷操作**：横向排列 4 个图标按钮
5. **活动时间线**：左侧彩色线，每条带错误类型标签

## 动效

| 元素 | 动画 |
|------|------|
| 数字 | `useAnimationFrame` + ease-out-cubic，0→目标值 |
| 环形进度 | `stroke-dashoffset` 动画 |
| 折线图 | `pathLength` 从左到右绘制，数据点逐个淡入 |
| 雷达图 | 从中心按顶点逐个扩散展开 |
| 卡片入场 | `staggerChildren` 底部滑入 + 淡入 |
| 脉冲点 | `animate-scale` + `opacity` 循环 |
| 悬停 | `scale(1.02)` + 边框渐变发光 |
| 活动条目 | 滑入淡入 |

## 组件结构

```
app/sky/page.tsx                        — 页面入口
components/sky/dashboard/stat-cards.tsx  — 重构：3 张卡片 + 快捷操作 + 活动线
components/sky/dashboard/learning-trend-chart.tsx  — 新增：7 天折线图
components/sky/dashboard/ability-radar.tsx         — 新增：5 维雷达图
lib/hooks/use-animated-number.ts         — 新增：数字动画 hook
```

## 数据流

- `StatCards`：从 `mistakes` 派生（保持现有逻辑）
- `LearningTrendChart`：从 store 新增 `solveHistory` 数组按天分组
- `AbilityRadar`：复用 `buildKnowledgeGraph` + `getMasterySummary`

## 雷达图维度（5 维）

代数、几何、函数、概率、统计

## 趋势图数据

新增 `solveHistory` 存储到 store，记录每次搜题（含结果），趋势图展示近 7 天每日搜题数。

## 技术方案

- 零新增依赖：所有图表手写 SVG + 已有 `motion/react`
- 数字动画：`useAnimationFrame` 手写（精确控制 ease-out-cubic 缓动）
- 环形进度：SVG `stroke-dashoffset`
- 折线图：SVG `<path>` + CSS `pathLength` + JS 控制
- 雷达图：SVG `<polygon>` + 渐变填充
