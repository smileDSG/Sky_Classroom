# 知识图谱模块设计文档

> Sky Classroom — Module C 知识图谱系统

## 概述

知识图谱是 Sky Classroom 的核心分析模块，从学生的错题数据中自动构建知识点关系网络，用于掌握度分析、薄弱点检测和个性化学习路径推荐。

## 系统架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        调用层 (Consumers)                        │
│  app/sky/page.tsx          → 首页知识图谱展示                      │
│  app/sky/learning/page.tsx → 学习页面图谱+路径推荐                  │
│  components/stat-cards.tsx  → 掌握度统计卡片                       │
│  components/learning-stats  → 学习统计数据                         │
│  lib/student/profile-builder → 学生画像构建                        │
│  lib/mistakes/suggestions.ts → 复习建议生成                       │
└───────────────────────────────┬──────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│                     核心引擎 (Single Source of Truth)              │
│  lib/mistakes/knowledge-graph.ts                                 │
│  ├── buildKnowledgeGraph(mistakes) → KnowledgeGraph              │
│  ├── recommendLearningPath(graph)  → LearningPath                │
│  └── getMasterySummary(graph)      → MasterySummary              │
└───────────────────────────────┬──────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│                         数据源                                     │
│  lib/mistakes/knowledge-relations.ts  — 预定义知识关系表            │
│  lib/mistakes/types.ts               — MistakeRecord 类型定义      │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  lib/graph/builder.ts  (API 路由专用，逻辑同上，类型独立)           │
│  └── buildGraphFromMistakes(mistakes) → GraphResponse            │
└──────────────────────────────────────────────────────────────────┘
```

## 数据模型

### 节点 (KnowledgeNode)

```typescript
interface KnowledgeNode {
  id: string;            // 知识点名称（如 "二次函数"）
  name: string;          // 显示名称
  category: string;      // 分类：代数/函数/几何/概率/统计/数列/微积分/集合与逻辑/综合
  mastery: number;       // 掌握度 0-100
  problemCount: number;  // 关联题目总数
  mistakeCount: number;  // 关联错题数（去重）
  children: string[];    // 子知识点 ID 列表
  reviewProgress: number; // 平均复习进度 0-1
}
```

### 边 (KnowledgeEdge)

```typescript
interface KnowledgeEdge {
  from: string;          // 源节点 ID
  to: string;            // 目标节点 ID
  relation: 'prerequisite' | 'related' | 'extension';
}
```

| 关系类型 | 含义 | 示例 |
|----------|------|------|
| `prerequisite` | 前置依赖，学习 A 是学习 B 的基础 | 因式分解 → 一元二次方程 |
| `related` | 相关关联，A 和 B 经常在同一题中出现 | 二次函数 ↔ 抛物线 |
| `extension` | 拓展延伸 | — |

### 学习路径 (LearningPath)

```typescript
interface LearningPath {
  startNode: string;     // 推荐起点（最薄弱知识点）
  nodes: string[];       // 推荐学习顺序（知识点 ID 列表）
  reason: string;        // 推荐理由文本
}
```

## 核心算法

### 1. 图构建 (`buildKnowledgeGraph`)

```
输入: MistakeRecord[]
输出: { nodes, edges, weakPoints }
```

**Step 1 — 收集知识点**

遍历所有错题，提取 `knowledgePoints` 字段，建立索引：
- `kpSet` — 所有知识点集合
- `kpMistakeIds` — 每个知识点关联的错题 ID（去重）
- `kpMistakes` — 每个知识点关联的完整错题记录

**Step 2 — 建节点**

为每个知识点计算属性：
- `category` — 通过正则匹配知识点名称推断
- `mastery` — 掌握度计算（见下方公式）
- `reviewProgress` — 关联错题的平均复习进度

**Step 3 — 建边（三来源）**

```
来源 A: 共现关系
  同一道错题涉及多个知识点 → 双向 related 边

来源 B: 名称前缀
  "二次函数" 是 "二次函数图像" 的前缀 → prerequisite 边
  ⚠️ 注意：此规则可能产生误关联，详见已知问题

来源 C: 预定义关系表
  knowledge-relations.ts 中手动维护的 prerequisite/related 关系
  仅当两端知识点都存在于当前数据中时才添加
```

**Step 4 — 填充 children**

从 prerequisite 边推导父子关系，填充 `children` 字段。

**Step 5 — 标记薄弱点**

掌握度 < 50 的节点记入 `weakPoints`。

### 2. 掌握度计算 (`calcNodeMastery`)

```
mastery = clamp(100 - penalty + reviewBonus - decay, 0, 100)
```

| 分项 | 公式 | 说明 |
|------|------|------|
| `penalty` | `错题数 × 10` | 每道错题扣 10 分 |
| `reviewBonus` | `avg(reviewCount / 6) × 60` | 复习进度越好加分越多，最高 60 分 |
| `decay` | `超期未复习数 × 5` | 7 天以上未复习的错题额外扣分 |

**示例**：3 道错题，平均复习 2 次，1 道超期
- penalty = 3 × 10 = 30
- reviewBonus = (2/6) × 60 = 20
- decay = 1 × 5 = 5
- mastery = 100 - 30 + 20 - 5 = **85**

### 3. 学习路径推荐 (`recommendLearningPath`)

```
1. 找到掌握度最低的节点（最薄弱知识点）
2. 沿 prerequisite 边反向 DFS，收集所有前置依赖
3. 从最薄弱节点正向 BFS，收集后续知识点
4. 合并为完整学习路径：前置 → 起点 → 后续
```

**路径生成示意**：
```
图结构:
  函数概念 → 二次函数 → 二次函数图像
  因式分解 → 一元二次方程 → 二次函数

最薄弱节点: 二次函数 (mastery=30)

反向 DFS: 函数概念, 因式分解, 一元二次方程
正向 BFS: 二次函数, 二次函数图像

最终路径: [函数概念, 因式分解, 一元二次方程, 二次函数, 二次函数图像]
```

## 预定义知识关系表

`lib/mistakes/knowledge-relations.ts` 覆盖高中数学、物理、化学常见知识点：

| 学科 | 知识点数 | 覆盖范围 |
|------|----------|----------|
| 数学 · 代数 | 16 | 方程、函数、数列、集合 |
| 数学 · 几何 | 18 | 三角、圆、解析几何、向量 |
| 数学 · 概率统计 | 6 | 概率、排列组合、方差 |
| 物理 · 力学 | 17 | 牛顿定律、功和能、动量 |
| 物理 · 电学 | 10 | 欧姆定律、电场、磁场 |
| 物理 · 其他 | 4 | 光学、热力学、原子 |
| 化学 | 12 | 氧化还原、化学平衡、有机 |

关系表的作用：当知识点未在同一道错题中共现时，仍能通过预定义关系建立连接。

## API 层

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/sky/knowledge-graph` | GET | 返回当前用户的知识图谱数据 |

API 路由使用 `lib/graph/builder.ts` 中的 `buildGraphFromMistakes` 构建图，逻辑与核心引擎一致，类型定义独立。

## 分类推断规则

知识点按名称中的关键词自动分类：

```
代数: 方程, 不等式, 多项式, 因式, 整式, 分式, 根式, 指数, 对数, 代数
函数: 函数, 映射, 单调, 奇偶, 周期, 反函数, 一次, 二次, 幂, 指对
几何: 几何, 三角, 圆, 向量, 直线, 平面, 立体, 棱, 球, 柱, 锥, 角, 平行, 垂直, 相似, 全等
概率: 概率, 随机, 期望, 方差, 分布, 频率, 事件
统计: 统计, 样本, 总体, 回归, 相关, 抽样, 频率分布, 中位, 众数, 平均
数列: 数列, 等差, 等比, 通项, 求和, 递推
微积分: 导数, 微分, 极限, 积分, 连续, 可导
集合与逻辑: 集合, 逻辑, 充要, 命题, 子集, 交集, 并集, 补集
综合: 以上均不匹配时
```

## 已知限制

### 1. 前缀匹配可能误关联

`b.startsWith(a)` 规则假设名称前缀代表知识前置关系，但存在反例：
- "圆" → "圆锥曲线"（实际无直接前置关系）
- "向量" → "向量空间"（可能无关联）

**缓解方式**：预定义关系表中的 `prerequisite` 边会覆盖自动生成的边。

### 2. 两套类型系统

`lib/mistakes/types.ts` 和 `lib/graph/types.ts` 定义了相似但不同的节点/边类型，API 路由和页面组件使用不同的构建函数。

### 3. 分类推断基于正则

仅通过知识点名称的关键词推断分类，无法处理语义模糊的名称（如"综合题"）。

## 使用示例

```typescript
import { buildKnowledgeGraph, recommendLearningPath, getMasterySummary } from '@/lib/mistakes/knowledge-graph';

// 1. 构建图
const graph = buildKnowledgeGraph(mistakes);

// 2. 查看掌握度汇总
const summary = getMasterySummary(graph);
console.log(`总体掌握度: ${summary.overallMastery}%`);
console.log(`已掌握: ${summary.masteredCount}, 薄弱: ${summary.weakCount}`);

// 3. 获取学习路径
const path = recommendLearningPath(graph);
console.log(`推荐从 "${path.startNode}" 开始学习`);
console.log(`学习顺序: ${path.nodes.join(' → ')}`);
console.log(`理由: ${path.reason}`);
```

## 测试覆盖

测试文件位于 `tests/mistakes/knowledge-graph.test.ts`，覆盖：

- 空数据处理
- 单知识点图构建
- 多知识点共现边生成
- 前缀 prerequisite 边生成
- 掌握度计算（无错题、多错题、复习进度）
- 薄弱点标记
- 学习路径推荐（单节点、多节点、循环依赖）
- 掌握度汇总统计
