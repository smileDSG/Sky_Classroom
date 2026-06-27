# 摘星锦囊优化方案

> **模块**：摘星锦囊（`app/sky/page.tsx`）
> **目标**：从"静态仪表盘"升级为"智能学习助手首页"，增加主动引导、个性化建议和游戏化激励
> **状态**：✅ 全部完成

相关取舍文档：[`docs/star-tips-redundancy-audit.md`](./star-tips-redundancy-audit.md)

---

## 一、现状分析

### 1.1 页面结构

| 区块 | 组件 | 数据来源 | 完成度 | 问题 |
|------|------|----------|--------|------|
| 问候语 | 内联 | `new Date().getHours()` | ✅ 完善 | 仅按时段，无个性化 |
| 快速统计 | `QuickStatsRow` | `/api/sky/learning-stats` | ✅ 完善 | 指标少，展示空间利用率低 |
| 云端智囊卡片 | `CloudMindMiniCard` | 静态 | ✅ 完善 | 无问题 |
| 统计卡片 | `StatCards` | Store → `mistakes` | ✅ 完善 | 无问题 |
| 趋势图 | `LearningTrendChart` | Store → `mistakes` | ⚠️ 单薄 | 只有 7 天、单维度（错题数） |
| 能力雷达 | `AbilityRadar` | Store → `buildKnowledgeGraph` | ⚠️ 有硬伤 | 维度固定 5 个，mastery 算法有缺陷（同天梯工坊 LW-001） |
| 快捷操作 | `QuickActions` | 静态 | ✅ 完善 | 无问题 |
| 活动时间线 | `ActivityTimeline` | Store → `mistakes` | ⚠️ 单薄 | 只展示最近 5 条，无交互 |

### 1.2 核心问题

| # | 问题 | 严重度 | 说明 |
|---|------|--------|------|
| 1 | **无主动引导** | 🔴 高 | 用户打开页面后不知道该做什么，没有"下一步"建议 |
| 2 | **缺少个性化** | 🔴 高 | 问候语按时段、统计是聚合值，不基于用户学习行为 |
| 3 | **无目标/激励机制** | 🟡 中 | 连续打卡只是数字，没有里程碑、徽章等游戏化元素 |
| 4 | **趋势图维度单一** | 🟡 中 | 只展示错题数量，不区分学科、不展示复习完成情况 |
| 5 | **活动时间线无交互** | 🟡 中 | 只能看，不能点击跳转到错题详情或复习页 |
| 6 | **空状态体验差** | 🟢 低 | 新用户打开页面看到大量"暂无数据"，无引导操作 |

---

## 二、优化任务

### `ST-001` 智能每日建议卡片

> **优先级**：P0
> **状态**：✅ 完成
> **工期**：2 天

**目标**：在问候语下方插入 AI 生成的个性化学习建议卡片，给用户明确的"下一步"。

**前端组件**：新建 `components/sky/dashboard/daily-suggest-card.tsx`

```
┌─────────────────────────────────────────────────────────┐
│ ✨ 今日学习建议                          [换一批]       │
│                                                         │
│ 📌 你的二次函数错题集中在"顶点坐标"，建议今天重点复习   │
│ 📌 连续打卡 5 天了，再坚持 2 天解锁铜星徽章！           │
│ 📌 概率统计模块掌握度 35%，低于平均，推荐做 3 道同类题   │
│                                                         │
│ [开始复习]  [去出题]  [查看详情]                        │
└─────────────────────────────────────────────────────────┘
```

**建议生成逻辑**（前端纯计算，无需后端 API）：

```typescript
function generateSuggestions(mistakes: MistakeRecord[], stats: LearningStats): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // 1. 薄弱知识点建议：找出错题最多且未掌握的知识点
  const kpStats = aggregateByKnowledgePoint(mistakes);
  const weakest = kpStats
    .filter(kp => kp.mastery < 50)
    .sort((a, b) => a.mastery - b.mastery)[0];
  if (weakest) {
    suggestions.push({
      icon: '📌',
      text: `你的${weakest.name}错题集中在"${weakest.topCause}"，建议今天重点复习`,
      action: { label: '开始复习', href: '/sky/learning?tab=review' },
    });
  }

  // 2. 打卡激励：连续打卡接近里程碑时提醒
  const streakMilestones = [3, 7, 14, 30, 60, 100];
  const nextMilestone = streakMilestones.find(m => m > stats.streakDays);
  if (nextMilestone && nextMilestone - stats.streakDays <= 3) {
    const remaining = nextMilestone - stats.streakDays;
    suggestions.push({
      icon: '🔥',
      text: `连续打卡 ${stats.streakDays} 天了，再坚持 ${remaining} 天解锁${getMilestoneName(nextMilestone)}徽章！`,
      action: { label: '查看详情', href: '/sky/learning?tab=stats' },
    });
  }

  // 3. 掌握度预警：某模块掌握度显著低于平均
  const avgMastery = kpStats.reduce((s, k) => s + k.mastery, 0) / kpStats.length;
  const outliers = kpStats.filter(k => k.mastery < avgMastery * 0.6);
  if (outliers.length > 0) {
    const target = outliers[0];
    suggestions.push({
      icon: '📊',
      text: `${target.name}模块掌握度 ${target.mastery}%，低于平均，推荐做 ${Math.min(outliers.length, 5)} 道同类题`,
      action: { label: '去出题', href: `/sky/cloud-mind/quiz?topic=${encodeURIComponent(target.name)}` },
    });
  }

  // 4. 今日待复习提醒
  const dueToday = mistakes.filter(m => !m.reviewed && isDueToday(m));
  if (dueToday.length > 0) {
    suggestions.push({
      icon: '⏰',
      text: `今天有 ${dueToday.length} 道题需要复习，花 10 分钟巩固一下吧`,
      action: { label: '去复习', href: '/sky/learning?tab=review' },
    });
  }

  return suggestions.slice(0, 3); // 最多展示 3 条
}
```

**"换一批"逻辑**：维护一个 `startIndex`，每次点击 +3 循环取下一批建议（建议总数通常 3-6 条）。

**涉及文件**：

- 新建 `components/sky/dashboard/daily-suggest-card.tsx` — 建议卡片组件
- `app/sky/page.tsx` — 在问候语和 QuickStatsRow 之间插入 `<DailySuggestCard />`
- `lib/mistakes/suggestions.ts`（可选）— 将建议生成逻辑抽为独立函数，便于测试

**验收标准**：

- [ ] 有错题数据时，展示 2-3 条个性化建议
- [ ] 无错题时，展示默认引导（"去搜题页开始练习"）
- [ ] "换一批"点击后展示不同建议
- [ ] 操作按钮点击正确跳转到对应页面
- [ ] 建议文案中知识点名称、数字正确

---

### `ST-002` 学习目标与进度条

> **优先级**：P1
> **状态**：✅ 完成
> **工期**：2 天

**目标**：将"连续打卡"从数字升级为可视化的里程碑进度条，增加目标感。

**前端组件**：新建 `components/sky/dashboard/streak-milestone.tsx`

```
┌─────────────────────────────────────────────────────────┐
│ 🔥 学习连续性                                             │
│                                                         │
│ ●━━━━━━━━━━━━━━━━━●─────────○─────────○────→           │
│   0      3天       7天      14天      30天              │
│          ✓        当前:5天                              │
│                                                         │
│ 🏅 铜星已解锁  ⬜ 银星（还差 2 天）  ⬜ 金星            │
└─────────────────────────────────────────────────────────┘
```

**里程碑定义**：

```typescript
const STREAK_MILESTONES = [
  { days: 3,  name: '铜星', icon: '🥉', color: 'text-amber-600' },
  { days: 7,  name: '银星', icon: '🥈', color: 'text-slate-400' },
  { days: 14, name: '金星', icon: '🥇', color: 'text-yellow-500' },
  { days: 30, name: '白金星', icon: '💎', color: 'text-cyan-400' },
  { days: 60, name: '钻石星', icon: '⭐', color: 'text-violet-400' },
  { days: 100, name: '传奇星', icon: '🌟', color: 'text-rose-400' },
];
```

**数据来源**：复用 `/api/sky/learning-stats` 返回的 `streakDays`，无需新增接口。

**涉及文件**：

- 新建 `components/sky/dashboard/streak-milestone.tsx` — 里程碑组件
- `app/sky/page.tsx` — 在 QuickStatsRow 下方替换或补充连续打卡展示

**验收标准**：

- [ ] 进度条正确反映当前打卡天数在里程碑中的位置
- [ ] 已解锁的里程碑有视觉高亮（图标变亮、文字变色）
- [ ] 当前位置有脉冲动画指示
- [ ] 下一个未解锁里程碑显示"还差 N 天"
- [ ] streakDays=0 时展示"开始你的第一天打卡"引导

---

### `ST-003` 趋势图升级为双维度

> **优先级**：P1
> **状态**：✅ 完成
> **工期**：1.5 天

**目标**：趋势图从单线（错题数）升级为双线（错题数 + 已复习数），时间窗口从 7 天扩展到 14 天。

**改动**：修改 `components/sky/dashboard/learning-trend-chart.tsx`

**数据结构调整**：

```typescript
// 之前
interface DayData { day: string; count: number }

// 之后
interface DayData {
  day: string;
  total: number;      // 当日错题总数
  reviewed: number;   // 当日已复习数
}
```

**数据聚合逻辑**（在 `app/sky/page.tsx` 中）：

```typescript
const trendData = useMemo(() => {
  const now = new Date();
  const days: DayData[] = [];

  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 86400000;

    const dayMistakes = mistakes.filter(m => {
      const t = new Date(m.solvedAt).getTime();
      return t >= dayStart && t < dayEnd;
    });

    days.push({
      day: DAY_NAMES[d.getDay()],
      total: dayMistakes.length,
      reviewed: dayMistakes.filter(m => m.reviewed).length,
    });
  }
  return days;
}, [mistakes]);
```

**SVG 双线渲染**：

- 红色线 = `total`（错题数）
- 绿色线 = `reviewed`（已复习数）
- 图例在右上角：`— 错题 — 已复习`
- 两条线共享同一个 Y 轴刻度（取两者最大值）

**涉及文件**：

- `components/sky/dashboard/learning-trend-chart.tsx` — 重写为双线图
- `app/sky/page.tsx` — 调整传入数据结构

**验收标准**：

- [ ] 两条线正确绘制，颜色区分明显
- [ ] 图例清晰标注"错题"和"已复习"
- [ ] hover tooltip 同时展示当日错题数和已复习数
- [ ] 无数据的天数两条线都为 0
- [ ] 空状态展示"暂无数据，去搜题页开始练习"

---

### `ST-004` 活动时间线可交互

> **优先级**：P1
> **状态**：✅ 完成
> **工期**：1 天

**目标**：活动时间线的每条记录可点击，跳转到对应错题的复习或详情页。

**改动**：修改 `components/sky/dashboard/stat-cards.tsx` 中的 `ActivityTimeline` 组件

**交互设计**：

- 点击某条活动 → 展开内联详情（题目、我的答案、正确答案、错因标签）
- 展开后显示两个操作按钮："去复习" / "查看详情"
- "去复习" → 跳转 `/sky/learning?tab=review&highlight={mistakeId}`
- "查看详情" → 跳转 `/sky/learning?tab=mistakes&highlight={mistakeId}`
- 再次点击收起详情

**涉及文件**：

- `components/sky/dashboard/stat-cards.tsx` — `ActivityTimeline` 增加展开/交互逻辑

**验收标准**：

- [ ] 点击某条活动可展开详情
- [ ] 详情中展示题目、用户答案、正确答案
- [ ] "去复习"按钮点击后正确跳转
- [ ] 展开/收起有过渡动画
- [ ] 空状态展示引导文案不变

---

### `ST-005` 空状态引导优化

> **优先级**：P2
> **状态**：✅ 完成
> **工期**：0.5 天

**目标**：新用户（无错题数据）打开摘星锦囊时，展示友好的引导页面而非大量"暂无数据"。

**改动**：在 `app/sky/page.tsx` 中，当 `mistakes.length === 0` 时渲染引导视图

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│            ⭐ 欢迎来到摘星锦囊                           │
│                                                         │
│     这里是你的学习驾驶舱，开始使用后会展示：             │
│                                                         │
│     📊 学习数据统计    📈 知识掌握趋势                   │
│     🧠 能力雷达图      📝 最近学习活动                   │
│                                                         │
│            [ 📸 拍照搜题开始学习 ]                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**涉及文件**：

- `app/sky/page.tsx` — 增加空状态条件渲染

**验收标准**：

- [ ] 无错题时展示引导视图，不展示图表
- [ ] 引导视图有"拍照搜题"按钮，点击跳转 `/sky/solve`
- [ ] 有错题数据后自动切换为正常仪表盘视图

---

### `ST-006` 能力雷达维度动态化

> **优先级**：P2
> **状态**：✅ 完成
> **工期**：1 天

**目标**：雷达图维度从固定 5 个（代数/几何/函数/概率/统计）改为从实际错题知识点中动态提取。

**现状**（`app/sky/page.tsx:227`）：

```typescript
const dimensions = ['代数', '几何', '函数', '概率', '统计']; // 硬编码
```

**改为**：

```typescript
const radarData = useMemo(() => {
  if (mistakes.length === 0) return [];
  const graph = buildKnowledgeGraph(mistakes);
  const categoryMastery = new Map<string, { total: number; count: number }>();
  for (const node of graph.nodes) {
    const existing = categoryMastery.get(node.category) ?? { total: 0, count: 0 };
    existing.total += node.mastery;
    existing.count++;
    categoryMastery.set(node.category, existing);
  }
  // 动态取 top 5-8 个分类，按错题数排序
  return [...categoryMastery.entries()]
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 8)
    .map(([name, data]) => ({
      name,
      value: Math.round(data.total / data.count),
    }));
}, [mistakes]);
```

**涉及文件**：

- `app/sky/page.tsx` — 修改 `radarData` 计算逻辑
- `components/sky/dashboard/ability-radar.tsx` — 确保支持动态数量的维度（通常 5-8 个）

**验收标准**：

- [ ] 雷达图维度从实际错题数据中提取，非硬编码
- [ ] 维度数量 5-8 个，按错题数降序排列
- [ ] 无错题时雷达图不渲染（或展示空状态）
- [ ] 维度数量变化时雷达图自适应

---

## 三、文件变更总览

| 文件 | 操作 | 关联任务 |
|------|------|----------|
| `app/sky/page.tsx` | 修改 | ST-001, ST-002, ST-003, ST-005, ST-006 |
| `components/sky/dashboard/daily-suggest-card.tsx` | **新建** | ST-001 |
| `lib/mistakes/suggestions.ts` | **新建**（可选） | ST-001 |
| `components/sky/dashboard/streak-milestone.tsx` | **新建** | ST-002 |
| `components/sky/dashboard/learning-trend-chart.tsx` | 修改 | ST-003 |
| `components/sky/dashboard/stat-cards.tsx` | 修改 | ST-004 |
| `components/sky/dashboard/ability-radar.tsx` | 修改 | ST-006 |

---

## 四、实施顺序

```
ST-001 (智能建议) ──→ ST-002 (里程碑)
                           ↓
ST-005 (空状态) ──→ ST-003 (双线趋势图) ──→ ST-006 (雷达动态化)
                                               ↓
                                       ST-004 (时间线交互)
```

- ST-001、ST-005 可并行（改动区域不重叠）
- ST-002 依赖 ST-001 的建议生成逻辑（打卡建议需要里程碑数据）
- ST-003 和 ST-006 可并行（趋势图和雷达图是独立组件）
- ST-004 独立，任意时间可做

---

## 五、测试策略

### 5.1 单元测试

| 任务 | 测试要点 |
|------|----------|
| ST-001 | 建议生成：空错题返回默认建议、有薄弱点返回复习建议、打卡接近里程碑返回激励建议 |
| ST-002 | 里程碑计算：streakDays=0 展示引导、streakDays=5 正确显示位置、所有里程碑解锁状态正确 |
| ST-003 | 数据聚合：14 天聚合正确、双线数据独立、空数据不崩溃 |
| ST-004 | 展开/收起状态切换、点击事件触发正确跳转 |
| ST-005 | 空状态条件判断、有数据后自动切换 |
| ST-006 | 动态维度提取、top N 排序正确、无错题时返回空数组 |

### 5.2 手动验证

1. **新用户视角**：清空所有错题数据，打开 `/sky`，确认展示引导视图
2. **有数据视角**：导入几道错题，确认建议卡片、趋势图、雷达图正确渲染
3. **交互测试**：点击建议按钮、展开时间线、点击里程碑
4. **深色模式**：所有新增组件在深色模式下样式正确
5. **响应式**：移动端（<768px）布局不溢出

---

## 六、风险与注意事项

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 建议生成逻辑纯前端计算，错题量大时可能卡顿 | 页面加载慢 | `useMemo` 缓存，错题超过 500 条时只取最近 200 条计算 |
| 双线趋势图 Y 轴刻度取两者最大值，差距大时细节丢失 | 复习线贴底部 | 当两者差距 >3 倍时使用双 Y 轴 |
| 里程碑徽章数据需要持久化 | 刷新后丢失 | 存储在 `user_stats` 表中，复用现有接口 |
| 能力雷达维度动态化后可能只有 1-2 个维度 | 雷达图退化为线段 | 维度 <3 时改用柱状图展示 |

---

## 七、与天梯工坊优化的关系

本方案与 `docs/learning-workshop-optimization.md` 有以下关联：

| 关联点 | 摘星锦囊 | 天梯工坊 | 说明 |
|--------|----------|----------|------|
| mastery 算法 | ST-006 依赖正确的 mastery | LW-001 重写算法 | **LW-001 应先完成**，否则雷达图数据不准 |
| 知识图谱 | ST-001 建议基于知识点聚合 | LW-002 增强边生成 | 共享 `buildKnowledgeGraph` 函数 |
| 学科推断 | ST-001 建议中可引用学科 | LW-004 新增学科维度 | 可共享 `inferSubject` 函数 |

**建议**：先完成 LW-001（mastery 算法），再做 ST-006（雷达动态化），否则雷达图展示的是错误数据。

---

## 八、总结

本次优化共 6 个任务，涉及 **3 个新建文件** 和 **4 个修改文件**。

核心收益：

1. **从被动展示到主动引导** — 智能建议卡片告诉用户"下一步做什么"
2. **游戏化激励** — 里程碑进度条让打卡有目标感
3. **数据更丰富** — 双线趋势图 + 动态雷达维度，信息量翻倍
4. **交互闭环** — 活动时间线可点击、可操作
5. **新用户友好** — 空状态引导，降低使用门槛
