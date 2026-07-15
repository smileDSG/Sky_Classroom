# 天梯工坊优化方案

> **模块**：天梯工坊（`app/sky/learning`）
> **目标**：修复核心算法缺陷、补全未完成功能、消除"假数据"感
> **状态**：🔴 未开始

---

## 一、现状分析

### 1.1 各 Tab 功能矩阵

| Tab | 组件 | 数据来源 | 完成度 | 问题 |
|-----|------|----------|--------|------|
| 错题本 | `MistakeBook` | Store + API | ✅ 完善 | 无明显问题 |
| 复习计划 | `ReviewPlan` | Store + API | ✅ 完善 | 无明显问题 |
| 知识图谱 | `KnowledgeGraphView` | Store → `buildKnowledgeGraph` | ⚠️ 有硬伤 | mastery 算法、边生成、学习路径未展示 |
| 学习统计 | `LearningStats` | Store + localStorage | ⚠️ 单薄 | 缺时间趋势、学科维度 |
| 学情分析 | `StudentProfilePage` | API → `profile-builder` | ✅ 不在本次优化范围 | — |

### 1.2 核心问题清单

| # | 问题 | 严重度 | 位置 |
|---|------|--------|------|
| 1 | mastery 算法只看错题数量，忽略复习进度 | 🔴 高 | `lib/mistakes/knowledge-graph.ts:57` |
| 2 | 知识图谱边几乎无法生成（依赖共现，实际很少触发） | 🔴 高 | `lib/mistakes/knowledge-graph.ts:82-101` |
| 3 | `recommendLearningPath` 已实现但 UI 从未调用 | 🟡 中 | `lib/mistakes/knowledge-graph.ts:121` |
| 4 | 学习统计缺少时间趋势和学科维度 | 🟡 中 | `components/sky/learning/learning-stats.tsx` |
| 5 | 薄弱点识别后无闭环（不能直接生成同类题） | 🟡 中 | `components/sky/learning/knowledge-graph-view.tsx` |
| 6 | 记忆卡片数据是 localStorage 孤岛 | 🟢 低 | `components/sky/learning/learning-stats.tsx:47` |

---

## 二、优化任务

### `LW-001` 重写 mastery 算法

> **优先级**：P0
> **状态**：🔴 未开始

**现状**：

```typescript
// lib/mistakes/knowledge-graph.ts:57
mastery: Math.max(0, 100 - mistakeCount * 20)
```

问题：一个错 5 次但已复习 6 轮掌握的知识点（reviewCount=6, reviewed=true），和一个刚错还没复习的知识点（reviewCount=0），mastery 都是 0。

**目标算法**：

对每个知识点，收集其关联的所有错题，按以下公式计算：

```
基础分 = 100
错题惩罚 = mistakeCount × 10          // 每次扣 10 分（而非 20）
复习加分 = 平均复习进度 × 60          // reviewCount/6 × 60，6 轮满分
时间衰减 = 超过 7 天未复习的错题数 × 5 // 鼓励持续复习
mastery = clamp(0, 100, 基础分 - 错题惩罚 + 复习加分 - 时间衰减)
```

**具体逻辑**：

```typescript
function calcNodeMastery(mistakesForKP: MistakeRecord[]): number {
  const count = mistakesForKP.length;
  if (count === 0) return 100;

  const penalty = count * 10;

  // 复习进度加分：每个错题的 reviewCount / 6，取平均
  const avgReviewProgress = mistakesForKP.reduce((sum, m) => {
    return sum + Math.min(m.reviewCount / 6, 1);
  }, 0) / count;
  const reviewBonus = avgReviewProgress * 60;

  // 时间衰减：超过 7 天未复习的错题
  const now = Date.now();
  const staleCount = mistakesForKP.filter((m) => {
    if (m.reviewed) return false; // 已掌握的不衰减
    if (!m.lastReview) return false; // 新错题不衰减
    return (now - m.lastReview) > 7 * 86400000;
  }).length;
  const decay = staleCount * 5;

  return Math.max(0, Math.min(100, Math.round(100 - penalty + reviewBonus - decay)));
}
```

**涉及文件**：

- `lib/mistakes/knowledge-graph.ts` — 重写节点构建逻辑，接收完整 `MistakeRecord[]` 而非仅 `mistakeCount`
- `lib/graph/builder.ts` — 同步修改（该文件与上面有重复逻辑）
- `lib/mistakes/types.ts` — `KnowledgeNode` 增加 `reviewProgress: number` 字段（可选，用于 tooltip 展示）

**验收标准**：

- [ ] 错 5 次已掌握（reviewCount=6）的知识点 mastery ≥ 80
- [ ] 刚错未复习的知识点 mastery ≤ 50
- [ ] 错 3 次复习 2 次的知识点 mastery 在 50-70 之间
- [ ] 现有单元测试通过（`tests/mistakes/knowledge-graph.test.ts`）

---

### `LW-002` 增强知识图谱边生成

> **优先级**：P0
> **状态**：🔴 未开始

**现状**：

当前只有两种边：
1. **共现边** — 同一道题出现多个知识点才连边（实际一道题通常只关联 1-2 个 KP，几乎不触发）
2. **前缀边** — `b.startsWith(a)` 才有 prerequisite（"二次函数"→"二次函数图像"可以，但"因式分解"→"一元二次方程"不行）

结果：图谱基本是孤立节点，看不出知识点之间的关系。

**方案**：引入**知识点关联映射表**，覆盖初高中常见知识点的先修/关联关系。

**新建文件**：`lib/mistakes/knowledge-relations.ts`

```typescript
/**
 * 知识点关联映射表
 * 覆盖初高中数学、物理、化学常见知识点
 */
export const KNOWLEDGE_RELATIONS: Record<string, {
  prereqs?: string[];   // 先修知识点
  related?: string[];   // 关联知识点
}> = {
  // ── 代数 ──
  '因式分解': { related: ['整式乘法', '一元二次方程'] },
  '一元一次方程': { related: ['等式性质'] },
  '一元二次方程': { prereqs: ['因式分解', '一元一次方程'], related: ['二次函数', '判别式'] },
  '二次函数': { prereqs: ['一元二次方程', '函数概念'], related: ['抛物线', '顶点坐标'] },
  '不等式': { prereqs: ['一元一次方程'], related: ['线性规划'] },
  '数列': { prereqs: ['函数概念'], related: ['等差数列', '等比数列'] },

  // ── 几何 ──
  '三角形': { related: ['全等三角形', '相似三角形', '三角函数'] },
  '全等三角形': { prereqs: ['三角形'], related: ['相似三角形'] },
  '相似三角形': { prereqs: ['全等三角形'], related: ['三角函数'] },
  '圆': { prereqs: ['三角形'], related: ['圆周角', '切线'] },
  '三角函数': { prereqs: ['直角三角形', '相似三角形'], related: ['正弦定理', '余弦定理'] },

  // ── 概率统计 ──
  '概率': { related: ['统计', '排列组合'] },
  '统计': { related: ['概率', '平均数', '方差'] },

  // ── 物理 ──
  '牛顿第二定律': { prereqs: ['力的概念', '加速度'], related: ['牛顿第三定律'] },
  '动能定理': { prereqs: ['牛顿第二定律', '功'], related: ['机械能守恒'] },
  '欧姆定律': { prereqs: ['电流', '电压'], related: ['电功率', '串并联'] },

  // ── 化学 ──
  '氧化还原反应': { prereqs: ['化合价'], related: ['离子反应'] },
  '化学平衡': { prereqs: ['化学反应速率'], related: ['勒夏特列原理'] },
};
```

**修改** `lib/mistakes/knowledge-graph.ts` 的边构建逻辑：

```typescript
// 现有逻辑（保留作为补充）
// 3a. 共现边
// 3b. 前缀边

// 新增：3c. 映射表边
for (const [kp, rels] of Object.entries(KNOWLEDGE_RELATIONS)) {
  if (!kpSet.has(kp)) continue;
  for (const prereq of rels.prereqs ?? []) {
    if (kpSet.has(prereq)) addEdge(prereq, kp, 'prerequisite');
  }
  for (const related of rels.related ?? []) {
    if (kpSet.has(related)) addEdge(kp, related, 'related');
  }
}
```

**涉及文件**：

- 新建 `lib/mistakes/knowledge-relations.ts` — 关联映射表
- `lib/mistakes/knowledge-graph.ts` — 边构建逻辑增加映射表查询
- `lib/graph/builder.ts` — 同步修改

**验收标准**：

- [ ] 映射表中相邻知识点在图谱中可见连线
- [ ] 共现边 + 前缀边 + 映射表边三种来源正确去重合并
- [ ] 现有单元测试通过

---

### `LW-003` 学习统计增加时间趋势图

> **优先级**：P1
> **状态**：🔴 未开始

**现状**：`LearningStats` 只有错题总数、复习率、错因分布三个维度，没有时间维度。

**方案**：增加"最近 14 天错题趋势"折线图。

**数据来源**：`mistakes[].solvedAt` 按天聚合。

**具体逻辑**：

```typescript
// 在 LearningStats 组件内
const trendData = useMemo(() => {
  const now = new Date();
  const days: { date: string; total: number; reviewed: number }[] = [];

  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 86400000;

    const dayMistakes = mistakes.filter((m) => {
      const t = new Date(m.solvedAt).getTime();
      return t >= dayStart && t < dayEnd;
    });

    days.push({
      date: dateStr,
      total: dayMistakes.length,
      reviewed: dayMistakes.filter((m) => m.reviewed).length,
    });
  }
  return days;
}, [mistakes]);
```

**UI 渲染**：SVG 折线图，复用 `ReviewPlan` 中已有的 SVG 画法风格。双线：红色=总错题，绿色=已复习。

**涉及文件**：

- `components/sky/learning/learning-stats.tsx` — 增加趋势图区块

**验收标准**：

- [ ] 无数据时显示空状态提示
- [ ] 有数据时正确展示最近 14 天趋势
- [ ] 双线（总错题 / 已复习）正确区分

---

### `LW-004` 学习统计增加学科维度

> **优先级**：P1
> **状态**：🔴 未开始

**现状**：没有按学科（数学/物理/化学等）分组统计。

**方案**：提取 `profile-builder.ts` 中的 `inferSubject` 为共享函数，增加学科维度统计。

**新建文件**：`lib/mistakes/subject-inference.ts`

```typescript
export type Subject =
  | 'math' | 'physics' | 'chemistry' | 'biology'
  | 'chinese' | 'english' | 'history' | 'geography'
  | 'politics' | 'unknown';

export function inferSubject(knowledgePoint: string): Subject {
  if (/方程|函数|代数|几何|三角|概率|统计|微积分|数列/.test(knowledgePoint)) return 'math';
  if (/力|电|磁|光|热|原子|牛顿|能量|动量|速度|加速度/.test(knowledgePoint)) return 'physics';
  if (/元素|反应|化学键|摩尔|氧化还原|离子|溶液|有机/.test(knowledgePoint)) return 'chemistry';
  if (/细胞|基因|生态|遗传|酶|蛋白质|DNA|进化/.test(knowledgePoint)) return 'biology';
  if (/诗|词|文言|修辞|作文|标点|病句/.test(knowledgePoint)) return 'chinese';
  if (/语法|时态|从句|单词|阅读.*英/.test(knowledgePoint)) return 'english';
  if (/朝代|事件|人物|革命|战争|条约/.test(knowledgePoint)) return 'history';
  if (/地形|气候|洋流|人口|城市|资源/.test(knowledgePoint)) return 'geography';
  if (/政治|经济|哲学|法律|文化|社会/.test(knowledgePoint)) return 'politics';
  return 'unknown';
}

const SUBJECT_LABELS: Record<Subject, string> = {
  math: '数学', physics: '物理', chemistry: '化学', biology: '生物',
  chinese: '语文', english: '英语', history: '历史', geography: '地理',
  politics: '政治', unknown: '其他',
};

export function getSubjectLabel(subject: Subject): string {
  return SUBJECT_LABELS[subject] ?? '其他';
}
```

**在 `LearningStats` 中增加学科统计**：

```typescript
const subjectStats = useMemo(() => {
  const map = new Map<Subject, { total: number; reviewed: number }>();
  for (const m of mistakes) {
    for (const kp of m.knowledgePoints) {
      const subj = inferSubject(kp);
      const entry = map.get(subj) ?? { total: 0, reviewed: 0 };
      entry.total++;
      if (m.reviewed) entry.reviewed++;
      map.set(subj, entry);
    }
  }
  return [...map.entries()]
    .filter(([s]) => s !== 'unknown')
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([subject, data]) => ({
      subject,
      label: getSubjectLabel(subject),
      ...data,
      rate: data.total > 0 ? Math.round(data.reviewed / data.total * 100) : 0,
    }));
}, [mistakes]);
```

**UI**：横向柱状图，每行一个学科，展示错题数和复习率。

**涉及文件**：

- 新建 `lib/mistakes/subject-inference.ts` — 共享的学科推断函数
- `lib/student/profile-builder.ts` — 改为从共享函数 import（消除重复代码）
- `components/sky/learning/learning-stats.tsx` — 增加学科维度统计区块

**验收标准**：

- [ ] 无学科数据时显示空状态
- [ ] 横向柱状图正确展示各学科错题数
- [ ] `profile-builder.ts` 改为引用共享函数后功能不变

---

### `LW-005` 展示学习路径

> **优先级**：P1
> **状态**：🔴 未开始

**现状**：`recommendLearningPath(graph)` 函数已在 `lib/mistakes/knowledge-graph.ts:121` 实现，但 UI 从未调用。

**方案**：在知识图谱组件中增加"推荐学习路径"面板。

**UI 设计**：

1. 在图谱 canvas 下方增加"推荐学习路径"卡片
2. 调用 `recommendLearningPath(graph)` 获取路径
3. 在 canvas 上高亮路径节点和边：
   - 路径节点：描边高亮（白色虚线边框 + 更大半径）
   - 路径边：高亮颜色（蓝色加粗）
4. 路径卡片中展示文字："因式分解 → 一元二次方程 → 二次函数"
5. 点击路径中的节点名称，canvas 自动平移+缩放到该节点居中

**涉及文件**：

- `components/sky/learning/knowledge-graph-view.tsx` — 增加路径渲染 + 路径面板

**验收标准**：

- [ ] 有薄弱知识点时，路径面板可见
- [ ] 路径节点在 canvas 上有视觉高亮
- [ ] 点击路径节点名称可定位到该节点

---

### `LW-006` 薄弱点闭环

> **优先级**：P2
> **状态**：🔴 未开始

**现状**：知识图谱识别出薄弱点后，只能跳转到云端记忆/出题页面（`/sky/cloud-mind/memory` 和 `/sky/cloud-mind/quiz`），没有直接在本模块内生成针对性练习的能力。

**方案**：在薄弱点区域增加操作按钮。

**改动 1**：知识图谱组件中的薄弱知识点 tooltip 增加操作按钮
- "生成同类题" → 跳转 `/sky/cloud-mind/quiz?topic={知识点}`
- "标记优先复习" → 将该知识点关联的错题 `nextReview` 设为 `Date.now()`

**改动 2**：`app/sky/learning/page.tsx` 中已有的薄弱点区域（`weakPoints.length > 0`）增加：
- "全部加入复习" 按钮 → 批量将薄弱点关联错题的 `nextReview` 设为 `now`
- 现有的"生成记忆卡片"和"针对出题"按钮保留

**涉及文件**：

- `components/sky/learning/knowledge-graph-view.tsx` — tooltip 增加操作按钮
- `app/sky/learning/page.tsx` — 薄弱点区域增加"全部加入复习"
- `lib/store/use-sky-classroom-store.ts` — 增加 `prioritizeReview(ids: string[])` action（可选）

**验收标准**：

- [ ] 点击"生成同类题"正确跳转到出题页且 topic 已填入
- [ ] 点击"标记优先复习"后，对应错题出现在"今日待复习"中
- [ ] "全部加入复习"批量操作正确

---

### `LW-007` 记忆卡片数据打通

> **优先级**：P2
> **状态**：🔴 未开始

**现状**：`LearningStats` 从 `localStorage` 独立读 `memory-progress`，数据来源孤立。

**方案**：在 Zustand store 中增加 `MemorySlice`，统一管理。

**在 `lib/store/use-sky-classroom-store.ts` 中增加**：

```typescript
interface MemorySlice {
  memoryProgress: {
    totalFlipped: number;
    topicCount: number;
    lastStudied: number | null;
  };
  updateMemoryProgress: (data: Partial<MemorySlice['memoryProgress']>) => void;
}
```

- 记忆卡片页面写入时同步 `updateMemoryProgress`
- `LearningStats` 改为从 store 读取
- localStorage 作为持久化后端（通过 zustand `persist` middleware）

**涉及文件**：

- `lib/store/use-sky-classroom-store.ts` — 增加 MemorySlice
- `components/sky/learning/learning-stats.tsx` — 改为从 store 读
- 记忆卡片相关组件 — 写入时同步 store

**验收标准**：

- [ ] 记忆卡片翻牌后，学习统计中数据实时更新
- [ ] 刷新页面后数据持久化

---

## 三、文件变更总览

| 文件 | 操作 | 关联任务 |
|------|------|----------|
| `lib/mistakes/knowledge-graph.ts` | 修改 | LW-001, LW-002 |
| `lib/graph/builder.ts` | 修改 | LW-001, LW-002 |
| `lib/mistakes/types.ts` | 修改 | LW-001（可选增加字段） |
| `lib/mistakes/knowledge-relations.ts` | **新建** | LW-002 |
| `lib/mistakes/subject-inference.ts` | **新建** | LW-004 |
| `lib/student/profile-builder.ts` | 修改 | LW-004（改 import） |
| `components/sky/learning/learning-stats.tsx` | 修改 | LW-003, LW-004, LW-007 |
| `components/sky/learning/knowledge-graph-view.tsx` | 修改 | LW-005, LW-006 |
| `app/sky/learning/page.tsx` | 修改 | LW-006 |
| `lib/store/use-sky-classroom-store.ts` | 修改 | LW-007 |
| `tests/mistakes/knowledge-graph.test.ts` | 修改 | LW-001, LW-002 |

---

## 四、实施顺序

```
LW-001 (mastery 算法) ──→ LW-002 (边生成) ──→ LW-005 (学习路径)
                                                    ↓
LW-003 (时间趋势) ──→ LW-004 (学科维度)     LW-006 (薄弱点闭环)
                                                    ↓
                                            LW-007 (数据打通)
```

- LW-001 和 LW-003 可并行
- LW-002 依赖 LW-001（mastery 变了，边的展示才有意义）
- LW-005 依赖 LW-002（边多了，路径才能可视化）
- LW-006 和 LW-007 可并行，互相无依赖

---

## 五、测试策略

### 5.1 单元测试

每个任务完成后运行已有测试 + 补充新测试：

```bash
# 运行已有知识图谱测试
npx vitest run tests/mistakes/knowledge-graph.test.ts

# 运行复习计划相关测试
npx vitest run tests/mistakes/

# 全量前端测试
npm run test
```

### 5.2 各任务测试要点

| 任务 | 测试要点 |
|------|----------|
| LW-001 | mastery 计算边界值：全错未复习=低分、全错已掌握=高分、混合状态=中间值 |
| LW-002 | 映射表中相邻知识点生成边、去重逻辑正确、不影响已有边 |
| LW-003 | 14天数据聚合正确、空数据不崩溃、单日多题正确计数 |
| LW-004 | 学科推断覆盖常见 KP、多 KP 一道题不重复计数 |
| LW-005 | 路径为空时不显示面板、路径节点高亮正确 |
| LW-006 | 跳转 URL 参数正确、nextReview 设为 now 后出现在今日待复习 |
| LW-007 | store 更新后 UI 实时刷新、页面刷新后数据持久化 |

### 5.3 手动验证

每完成一个任务，在浏览器中打开 `/sky/learning` 页面，切换到对应 Tab 验证：

1. **错题本**：有错题时正常展示，筛选/搜索/分页正常
2. **复习计划**：遗忘曲线、今日待复习、交互式复习正常
3. **知识图谱**：节点颜色反映 mastery、边可见、路径可展示
4. **学习统计**：趋势图和学科图正确渲染
5. **空状态**：无错题时各 Tab 显示空状态提示

---

## 六、风险与注意事项

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| mastery 算法变更导致已有数据的图谱展示大幅变化 | 用户困惑 | 变更前截图对比，确保变化方向合理 |
| 知识点映射表维护成本 | 新增知识点需要手动更新 | 先覆盖高频知识点（约 50 个），后续可从题库自动提取 |
| `inferSubject` 正则匹配可能误判 | 学科统计不准 | 对 "unknown" 类别单独展示，不隐藏 |
| `lib/graph/builder.ts` 与 `lib/mistakes/knowledge-graph.ts` 重复代码 | 改一处忘改另一处 | 本次优化后统一为一个入口，废弃另一个 |

---

## 七、总结

本次优化共 7 个任务，涉及 **2 个新建文件** 和 **9 个修改文件**。

核心收益：

1. **mastery 算法真实化** — 知识图谱颜色和掌握度真正反映学习进度，而非仅看错题数量
2. **知识图谱可读性提升** — 通过映射表让知识点之间有连线，图谱从"散点图"变为"关系图"
3. **学习统计从 3 个维度扩展到 5 个维度** — 新增时间趋势和学科维度
4. **学习路径可视化** — 已有算法终于落地到 UI
5. **薄弱点闭环** — 识别 → 复习/出题 一步到位
