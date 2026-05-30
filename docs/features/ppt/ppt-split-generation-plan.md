# 方案A：分步生成（Split-Generation）详细方案

## 一、问题背景

当前 Template Pack 生成流程是**单步生成**：一次 LLM 调用同时输出 cover + toc + chapter + content_a + content_b + table + end（约 3000+ tokens）。

**问题**：LLM 在生成长 JSON 时，会"遗忘" system prompt 中的主题约束，从训练记忆中调用"教学内容设计"的通用模板（恰好是编程语言内容），导致跑题。

## 二、方案核心思路

**把单步生成拆成两步**：

```
用户输入主题 ──→ Step 1: LLM生成大纲 ──→ Step 2: LLM根据大纲生成正文 ──→ 填充PPT
                (cover+toc+end)            (chapter+content_a+content_b+table)
```

**为什么能解决跑题**：
- Step 2 的 LLM 明确收到了"大纲要求"，知道目录是"电路"不是"编程语言"
- Step 2 的输出量减半（~1500 tokens），注意力更集中，不会调用通用模板
- 每一步的 prompt 更聚焦，约束更容易被遵守

## 三、详细技术实现

### 3.1 整体数据流

```
前端 POST /api/sky/slides/generate
  │
  ▼
后端 generate/route.ts
  │
  ├──► generateWithTemplatePack()
  │      │
  │      ├──► Step 1: generateOutline()
  │      │      调用 LLM → 返回 { cover, toc, end }
  │      │
  │      ├──► 校验大纲质量
  │      │      - 目录项完整性（title + desc）
  │      │      - 主题相关性（关键词密度）
  │      │      - 不合格 → 重试（最多2次）
  │      │
  │      ├──► Step 2: generateContentFromOutline()
  │      │      传入 outline → 调用 LLM → 返回 { chapter, content_a, content_b, table }
  │      │
  │      ├──► 校验正文质量
  │      │      - 主题相关性
  │      │      - 目录-正文一致性
  │      │      - LLM二次校验（可选）
  │      │
  │      ├──► 合并 JSON
  │      │      { ...outline, ...content }
  │      │
  │      └──► 调用 Python 填充引擎
  │
  └──► 返回 { pptxUrl, slideImages, ... }
```

### 3.2 Step 1：生成大纲（Prompt设计）

**System Prompt**:
```
你是一位资深教学内容设计师。请为以下主题设计一份教学课件的大纲。

## 核心约束（必须严格遵守）
1. 所有内容必须 STRICTLY 围绕"${topic}"展开
2. 严禁引入与"${topic}"无关的学科知识
3. 目录必须包含3个不同方面的章节，内容不要重叠

## 输出格式
只输出纯JSON，不要markdown代码块：
{
  "cover": { "en_tag": "...", "title": "...", "subtitle": "..." },
  "toc": {
    "title": "目录",
    "items": [
      { "num": "01", "title": "章节1≤6字", "desc": "描述≤15字" },
      { "num": "02", "title": "章节2≤6字", "desc": "描述≤15字" },
      { "num": "03", "title": "章节3≤6字", "desc": "描述≤15字" }
    ]
  },
  "end": { "end_en": "...", "slogan": "...", "subtitle": "..." }
}
```

**User Prompt**:
```
主题：${topic}
学段：${difficulty}

${difficultyGuide}

请设计3个章节，覆盖"${topic}"的3个不同方面。
```

**预期输出量**：~300-500 tokens（非常少，LLM不会跑偏）

### 3.3 Step 1 校验层

```typescript
function validateOutline(outline: object, topic: string): { valid: boolean; reason?: string } {
  // 1. 目录项完整性
  const toc = outline.toc;
  for (const item of toc.items) {
    if (!item.title || item.title.trim().length < 2) return { valid: false, reason: '目录标题过短' };
    if (!item.desc || item.desc.trim().length < 2 || /^\d+$/.test(item.desc)) {
      return { valid: false, reason: '目录描述无效' };
    }
  }
  
  // 2. 主题相关性（关键词密度）
  const text = JSON.stringify(outline);
  const density = calculateKeywordDensity(text, topic);
  if (density < 0.005) return { valid: false, reason: '大纲主题相关性不足' };
  
  // 3. 黑名单检查
  const found = getBlacklist(topic).filter(term => text.includes(term));
  if (found.length >= 2) return { valid: false, reason: `包含无关内容: ${found.join(', ')}` };
  
  return { valid: true };
}
```

**重试策略**：校验失败 → 重试（最多2次），仍失败 → 使用默认大纲兜底。

### 3.4 Step 2：根据大纲生成正文（Prompt设计）

**System Prompt**:
```
你是一位资深教学内容设计师。请根据以下大纲，生成详细的课件内容。

## 核心约束
1. 你必须严格按照大纲中的章节标题展开内容
2. 每个章节的内容必须与标题语义一致
3. 所有内容必须围绕"${topic}"主题
4. 严禁引入与"${topic}"无关的内容

## 输出格式
只输出纯JSON，不要markdown代码块：
{
  "chapter": { "num": "01", "en": "CHAPTER ONE", "title": "...", "subtitle": "..." },
  "content_a": {
    "tag": "CONCEPT", "title": "...", "cards": [...], "summary": "..."
  },
  "content_b": {
    "tag": "EXAMPLE", "title": "...", "cards": [...], "featured": {...}, "summary": "..."
  },
  "table": {
    "tag": "DATA", "title": "...", "headers": [...], "rows": [...], "summary": "..."
  }
}
```

**User Prompt**:
```
主题：${topic}
学段：${difficulty}

${difficultyGuide}

## 大纲（必须严格遵循）
${JSON.stringify(outline, null, 2)}

## 联动规则
- content_a 的标题必须是 toc.items[0].title 的具体展开
- content_b 的标题必须是 toc.items[1].title 的具体展开
- table 的标题必须是 toc.items[2].title 的具体展开
- content_a 和 content_b 的标题不能重复

## 容量限制
- content_a 最多 ${capacity.contentACards} 个卡片
- content_b 最多 ${capacity.contentBCards} 个卡片
- table ${capacity.tableCols} 列 ${capacity.tableRows} 行
```

**预期输出量**：~1500-2500 tokens（比原来少，因为不需要生成 cover/toc/end）

### 3.5 Step 2 校验层

和当前已有的校验层相同：
- 主题相关性（关键词密度 + 黑名单）
- 目录-正文一致性
- LLM二次校验（可选，因为Step 2的prompt已经很聚焦）

### 3.6 合并与填充

```typescript
const fullJson = { ...outline, ...content };
// 调用 Python 填充引擎
```

## 四、代码改动清单

| 文件 | 改动类型 | 改动内容 |
|------|---------|---------|
| `lib/slides/template-packs/generator.ts` | 重写 | 拆分 `generateWithTemplatePack` 为 `generateOutline` + `generateContentFromOutline` |
| `lib/slides/template-packs/generator.ts` | 新增 | Step 1 和 Step 2 的独立 prompt 构建函数 |
| `lib/slides/template-packs/generator.ts` | 新增 | 大纲校验函数 `validateOutline` |
| `app/api/sky/slides/generate/route.ts` | 无改动 | 入口不变，内部调用 `generateWithTemplatePack` |
| `components/sky/slides/slides-page.tsx` | 无改动 | 前端无感知 |

## 五、Prompt 示例（完整版）

### Step 1 Prompt（以"电路"为例）

```
System:
你是一位资深教学内容设计师。请为以下主题设计一份教学课件的大纲。

## 核心约束（必须严格遵守）
1. 所有内容必须 STRICTLY 围绕"电路"展开
2. 严禁引入与"电路"无关的学科知识
3. 目录必须包含3个不同方面的章节，内容不要重叠
4. 【反例】绝对不能写"编程语言、Python、Fortran、代码、算法"等计算机内容

## 输出格式
只输出纯JSON...

User:
主题：电路
学段：高中

## 教学要求（高中）
- 侧重公式应用和典型例题
- 需要展示完整的解题步骤和思路
- 适度引入数学推导，但不要过于抽象

请设计3个章节，覆盖"电路"的3个不同方面。
```

### Step 1 预期输出：
```json
{
  "cover": {
    "en_tag": "ELECTRIC CIRCUITS",
    "title": "电路分析基础",
    "subtitle": "掌握欧姆定律与基尔霍夫定律的应用"
  },
  "toc": {
    "title": "目录",
    "items": [
      { "num": "01", "title": "基本电路量", "desc": "电流、电压与电阻的关系" },
      { "num": "02", "title": "欧姆定律", "desc": "定律内容与典型计算" },
      { "num": "03", "title": "电路分析方法", "desc": "串联并联与等效电阻" }
    ]
  },
  "end": {
    "end_en": "THE END",
    "slogan": "精通电路，驾驭电磁",
    "subtitle": "在电子世界中探索无限可能"
  }
}
```

### Step 2 Prompt（以上述大纲为例）

```
System:
你是一位资深教学内容设计师。请根据以下大纲，生成详细的课件内容。

## 核心约束
1. 你必须严格按照大纲中的章节标题展开内容
2. 每个章节的内容必须与标题语义一致
3. 所有内容必须围绕"电路"主题
4. 严禁引入与"电路"无关的内容

User:
主题：电路
学段：高中

## 大纲（必须严格遵循）
{
  "toc": {
    "items": [
      { "num": "01", "title": "基本电路量", "desc": "电流、电压与电阻的关系" },
      { "num": "02", "title": "欧姆定律", "desc": "定律内容与典型计算" },
      { "num": "03", "title": "电路分析方法", "desc": "串联并联与等效电阻" }
    ]
  }
}

## 联动规则
- content_a 的标题必须是"基本电路量"的具体展开
- content_b 的标题必须是"欧姆定律"的具体展开
- table 的标题必须是"电路分析方法"的具体展开
```

### Step 2 预期输出：
```json
{
  "chapter": { "num": "01", "en": "CHAPTER ONE", "title": "基本电路量", "subtitle": "理解电流、电压与电阻的本质" },
  "content_a": {
    "tag": "CONCEPT",
    "title": "电路三要素",
    "cards": [
      { "title": "电流", "desc": "电荷定向移动形成的物理量，单位安培(A)..." },
      { "title": "电压", "desc": "电路两点间的电势差，单位伏特(V)..." },
      { "title": "电阻", "desc": "导体对电流阻碍作用的大小，单位欧姆(Ω)..." }
    ],
    "summary": "电流、电压、电阻是分析电路的三个基本物理量..."
  },
  "content_b": {
    "tag": "EXAMPLE",
    "title": "欧姆定律应用",
    "cards": [
      { "title": "例题1", "desc": "已知电阻R=10Ω，电流I=2A，求电压U=？" },
      { "title": "例题2", "desc": "串联电路中总电阻等于各电阻之和..." }
    ],
    "featured": { "body": "欧姆定律是电路分析的基础...", "highlight": "V = I × R" },
    "summary": "通过典型例题掌握欧姆定律的应用方法"
  },
  "table": {
    "tag": "DATA",
    "title": "串并联电路对比",
    "headers": ["特性", "串联电路", "并联电路"],
    "rows": [
      ["电流", "各处相等", "干路等于支路之和"],
      ["电压", "总电压等于各部分之和", "各支路相等"],
      ["电阻", "总电阻等于各电阻之和", "总电阻倒数等于各电阻倒数之和"]
    ],
    "summary": "掌握串并联电路的特性是分析复杂电路的基础"
  }
}
```

## 六、预期效果

### 跑题问题解决

| 指标 | 优化前 | 方案A预期 |
|------|--------|----------|
| 跑题页数 | 3/7 | **0/7** |
| 目录完整性 | 第3项缺失 | **3项完整** |
| 标题-内容一致性 | 严重不匹配 | **严格匹配** |

### 理论依据

**为什么分步生成能根治跑题**：

1. **注意力机制**：LLM 的注意力窗口有限。单步生成时，system prompt 中的约束在输出 3000+ tokens 后被"稀释"。分步生成后，每步只输出 500-1500 tokens，约束始终处于注意力范围内。

2. **上下文锚定**：Step 2 的 prompt 中明确传入了大纲 JSON，LLM 在生成正文时会不断"回顾"大纲内容，不会偏离。

3. **输出量减少**：Step 1 输出 ~500 tokens，Step 2 输出 ~1500 tokens，每步的复杂度降低，LLM 更容易遵守约束。

## 七、性能影响

| 指标 | 单步生成 | 分步生成 | 变化 |
|------|---------|---------|------|
| LLM 调用次数 | 1次 | 2次 | +1次 |
| LLM 总输出 tokens | ~3000 | ~500 + ~1500 = ~2000 | **-33%** |
| LLM 总耗时 | ~30s | ~10s + ~20s = ~30s | 基本持平 |
| Python 填充 | ~0.02s | ~0.02s | 不变 |
| 总耗时 | ~30s | ~30s | 基本持平 |

**结论**：分步生成不会显著增加总耗时，因为虽然多了一次 LLM 调用，但每次的输出量减少了，且可以并行预热。

## 八、风险与兜底

| 风险 | 概率 | 应对方案 |
|------|------|---------|
| Step 1 大纲生成失败 | 低 | 重试2次，仍失败则使用默认大纲 |
| Step 2 正文生成失败 | 低 | 重试2次，仍失败则返回错误 |
| 大纲质量好但正文跑偏 | 极低 | Step 2 的 prompt 中有大纲锚定，基本不可能 |
| 总耗时增加 | 中 | 两次调用串行，总耗时约 +5s（可接受） |

## 九、验收标准

生成 5 份不同主题的 PPT，人工检查：

| 主题 | 模板 | 检查项 | 通过标准 |
|------|------|--------|---------|
| 电路 | tech | 正文是否跑题 | 0页跑题 |
| 勾股定理 | modern-geometric | 正文是否跑题 | 0页跑题 |
| 荷塘月色 | humanistic | 正文是否跑题 | 0页跑题 |
| 牛顿定律 | modern-geometric | 正文是否跑题 | 0页跑题 |
| 光合作用 | nature | 正文是否跑题 | 0页跑题 |

每份 PPT 同时检查：
- 目录3项是否都有完整 title + desc
- content_a/content_b/table 的标题是否与目录对应
- 内容是否与主题高度相关

---

**请确认这个方案，确认后我立即开始执行。**
