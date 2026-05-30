# PPT 内容质量优化方案

## 一、问题根因深度分析

### 1.1 Prompt 缺乏主题约束（核心根因）

当前 `buildTemplateFillPrompt` 的 system prompt 只有一句话：

> "你是一位资深教学内容设计师。请为以下主题生成一份教学课件的内容文本。"

**问题**：LLM 接收到的指令过于宽泛。当主题输入为"电路"时，LLM 没有收到"必须严格围绕电路展开"的强约束，于是从训练记忆中调用了"教学内容设计"的通用模板——而这个通用模板恰好是关于"编程语言"的（因为互联网上的教学课件资源中，编程类内容占比极高）。

**证据**：
- 第4页"电路基本量" → 实际内容是"编程语言的定义、分类、发展历程"
- 第5页"欧姆定律应用" → 实际内容是"Python 特性介绍"
- 第6页"基本电路元件对比" → 实际内容是"编程语言对比（TIOBE/Stack Overflow）"

这三页的内容结构高度一致（定义→分类→发展→应用），说明 LLM 复制了同一个内部模板。

### 1.2 目录和正文生成脱节

目录（toc）和正文（content_a/content_b/table）是在同一个 prompt 中要求一次性生成的。LLM 在生成长 JSON 时，容易"遗忘"前面的目录内容，导致：
- 目录第1项"欧姆与基尔霍夫定律" → 正文第4页标题是"电路基本量"（对不上）
- 目录第3项只有数字"2"和"3" → 完全缺失标题和描述

### 1.3 学段区分形同虚设

prompt 中虽然有 `${difficulty}` 变量，但只在开头提了一句"学段：${difficulty}"，没有注入具体的难度要求。初中、高中、大学对"电路"这个主题的要求完全不同，但 LLM 收到的指令没有区分。

### 1.4 无内容校验机制

生成后的校验只有两条：
- `text.trim().length > 200`
- `text.includes('{')`

这是**格式校验**，不是**内容质量校验**。即使 LLM 生成了完全跑题的内容，只要满足这两个条件，系统就会直接填充到 PPT 里。

---

## 二、优化方案总览

| 优先级 | 措施 | 改动文件 | 改动量 | 预期收益 |
|--------|------|---------|--------|---------|
| **P0** | 2.1 增加强主题约束 + 反例警示 | `generator.ts` | 小 | **根治跑题问题** |
| **P0** | 2.2 目录-正文联动约束 | `generator.ts` | 小 | 解决目录混乱 |
| **P0** | 2.3 学段难度深度注入 | `generator.ts` | 小 | 提升内容深度 |
| **P1** | 3.1 主题相关性校验层 | `generator.ts` | 中 | 自动拦截跑题 |
| **P1** | 3.2 目录-正文一致性校验 | `generator.ts` | 中 | 解决目录混乱 |
| **P1** | 4.1 分步生成（目录→正文） | `generator.ts` + API | 中 | 大幅提升一致性 |
| **P2** | 5.1 学科知识框架注入 | `template-packs/index.ts` | 中 | 提升专业性 |
| **P2** | 5.2 异常内容黑名单拦截 | `generator.ts` | 小 | 兜底防护 |

---

## 三、具体实施方案

### P0-1：增加强主题约束 + 反例警示

**目标**：让 LLM 明确知道"绝对不能跑题"

**实现**：在 `system` prompt 中增加核心约束段落：

```
## 核心约束（违反任何一条都会导致内容不合格）
1. 你正在为一节关于"${topic}"的课程设计课件。
2. 所有文本内容必须 STRICTLY 围绕"${topic}"展开。
3. 严禁引入与"${topic}"无关的学科知识。
4. 每个页面的标题和内容必须语义一致。
5. 【反例警示】如果主题是"电路"，你绝对不能写"编程语言、Python、Fortran、代码、算法"等内容；你应该写"电流、电压、电阻、欧姆定律、基尔霍夫定律、串联、并联"等电学内容。
```

**原理**：LLM 对"反例"（negative examples）非常敏感。明确告诉它"什么不能做"，比告诉它"要做什么"更有效。

---

### P0-2：目录-正文联动约束

**目标**：让目录和正文严格对应

**实现**：在 `user` prompt 的 JSON 说明中增加联动规则：

```
## 目录-正文联动规则
- toc.items[0] 的标题 → 必须是 content_a 的标题的主题
- toc.items[1] 的标题 → 必须是 content_b 的标题的主题
- toc.items[2] 的标题 → 必须是 table 的标题的主题
- content_a 的标题不能和 content_b 的标题重复
- 每个 toc item 必须有完整的 title 和 desc，严禁只写数字
```

**原理**：把"软约束"变成"硬规则"，LLM 在生成时会优先满足显式规则。

---

### P0-3：学段难度深度注入

**目标**：让初中/高中/大学的课件有明显区分

**实现**：在 `user` prompt 中根据 difficulty 注入不同的教学要求：

```typescript
const DIFFICULTY_GUIDANCE: Record<string, string> = {
  '初中': `## 教学要求（初中）
- 侧重直观理解和生活实例，避免复杂公式推导
- 多用比喻和类比帮助学生建立直觉
- 每个概念必须配一个生活中的例子
- 公式只需记住结论，不要求推导过程`,
  
  '高中': `## 教学要求（高中）
- 侧重公式应用和典型例题
- 需要展示完整的解题步骤
- 适度引入数学推导，但不要过于抽象
- 强调知识点的考试重点和常见题型`,
  
  '大学': `## 教学要求（大学）
- 侧重理论深度和数学建模
- 需要展示严谨的推导过程
- 可以引入前沿应用和研究背景
- 强调知识体系的完整性和内在逻辑`,
};
```

然后把这个 guidance 拼接到 user prompt 中。

---

### P1-1：主题相关性校验层

**目标**：生成后自动检测是否跑题，跑题则触发重试

**实现**：在 `generateWithTemplatePack` 中，JSON 解析成功后增加校验：

```typescript
function validateContentRelevance(contentJson: any, topic: string): { valid: boolean; reason?: string } {
  const allText = JSON.stringify(contentJson);
  
  // 1. 主题关键词密度检查
  const topicLower = topic.toLowerCase();
  const keywordMatches = [
    topicLower,
    ...getRelatedKeywords(topic), // 如"电路"→["电流","电压","电阻","欧姆"]
  ];
  const matchCount = keywordMatches.reduce((sum, kw) => {
    const regex = new RegExp(kw, 'gi');
    const matches = allText.match(regex);
    return sum + (matches ? matches.length : 0);
  }, 0);
  
  const density = matchCount / allText.length;
  if (density < 0.003) {
    return { valid: false, reason: `主题关键词密度过低 (${(density*100).toFixed(2)}%)，内容可能跑题` };
  }
  
  // 2. 黑名单检查（常见跑题方向）
  const blacklistedTerms = getBlacklistForTopic(topic);
  const found = blacklistedTerms.filter(term => allText.includes(term));
  if (found.length > 0) {
    return { valid: false, reason: `包含与主题无关的内容: ${found.join(', ')}` };
  }
  
  return { valid: true };
}
```

**黑名单维护策略**：
- 不维护全局黑名单，而是根据 topic 动态生成
- "电路"主题的黑名单：`["Python", "JavaScript", "Fortran", "编程语言", "代码", "算法", "Django", "Flask", "Pandas"]`
- 黑名单可以从模板的 `subjectTags` 反向推导：如果模板是 tech，topic 是"电路"，则 tech 相关的编程词汇就是潜在的"误报"黑名单

**更聪明的方案**：用 LLM 做二次校验（self-critique）

```
System: 你是一位严格的教学督导。请检查以下内容是否围绕"${topic}"主题。
User: ${contentJsonText}
要求：只回答"合格"或"不合格: 原因"。
```

这是一个轻量级的二次调用（~200 tokens），成本极低，但准确度远高于关键词匹配。

---

### P1-2：目录-正文一致性校验

**目标**：自动检测目录和正文是否对不上

**实现**：

```typescript
function validateTocConsistency(contentJson: any): { valid: boolean; reason?: string } {
  const toc = contentJson.toc;
  const contentA = contentJson.content_a;
  const contentB = contentJson.content_b;
  const table = contentJson.table;
  
  const issues: string[] = [];
  
  // 1. 检查 toc item 完整性
  for (const item of toc.items) {
    if (!item.title || item.title.trim().length < 2) {
      issues.push(`目录第${item.num}项标题过短或为空`);
    }
    if (!item.desc || item.desc.trim().length < 2) {
      issues.push(`目录第${item.num}项描述过短或为空`);
    }
  }
  
  // 2. 检查内容页标题和目录的对应关系（语义相似度）
  const tocTitles = toc.items.map((i: any) => i.title);
  const contentTitles = [contentA?.title, contentB?.title, table?.title].filter(Boolean);
  
  // 简单检查：内容页标题是否包含目录关键词
  for (let i = 0; i < Math.min(tocTitles.length, contentTitles.length); i++) {
    const tocTitle = tocTitles[i];
    const contentTitle = contentTitles[i];
    // 如果内容页标题和目录标题完全没有共同词，报warning
    const tocWords = extractKeywords(tocTitle);
    const hasOverlap = tocWords.some(w => contentTitle.includes(w));
    if (!hasOverlap) {
      issues.push(`内容页标题"${contentTitle}"与目录项"${tocTitle}"不对应`);
    }
  }
  
  if (issues.length > 0) {
    return { valid: false, reason: issues.join('; ') };
  }
  return { valid: true };
}
```

---

### P1-3：分步生成（目录→正文）

**目标**：大幅提升目录和正文的一致性

**实现**：把一次 LLM 调用拆成两次：

**Step 1：生成大纲（目录 + 封面 + 结束页）**

```
System: 你是一位资深教学内容设计师。请为"${topic}"设计课件大纲。
要求：
1. 输出一个JSON，包含 cover、toc、end 三个字段
2. toc 必须包含3个章节，每个章节有 title（≤6字）和 desc（≤15字）
3. 所有内容必须围绕"${topic}"

Output format:
{
  "cover": { "en_tag": "...", "title": "...", "subtitle": "..." },
  "toc": { "title": "目录", "items": [...] },
  "end": { "end_en": "...", "slogan": "...", "subtitle": "..." }
}
```

**Step 2：根据大纲生成正文**

```
System: 你是一位资深教学内容设计师。请根据以下大纲，生成详细的课件内容。
要求：
1. 严格按照大纲中的章节标题展开内容
2. 每个章节的内容必须与标题语义一致
3. 输出JSON包含 chapter、content_a、content_b、table

大纲：${outlineJson}
```

**收益**：
- 目录和正文的一致性提升 80%+
- LLM 在第二步能"看到"第一步的结果，不会跑偏

**代价**：
- 多一次 LLM 调用（+5~10s）
- 但总耗时仍然可控，因为两次调用可以串行（总时间 < 50s）

**折中方案**：在同一个 prompt 中要求 LLM 先输出大纲部分，再输出正文部分，用注释分隔。这样只需要一次 LLM 调用：

```
请按以下顺序生成内容：
1. 先生成 cover + toc + end
2. 再根据 toc 生成 chapter + content_a + content_b + table
3. 最终输出一个完整的JSON
```

---

### P2-1：学科知识框架注入

**目标**：提升内容的专业性和深度

**实现**：在 `template-packs/index.ts` 中为每个模板增加 `knowledgeFramework` 字段：

```typescript
{
  id: 'modern-geometric',
  name: '现代几何风',
  subjectTags: ['数学', '几何', '物理', '逻辑', '编程'],
  knowledgeFramework: `如果是数学主题：数与式→方程与不等式→函数→几何→统计与概率
如果是物理主题：力学→热学→电磁学→光学→近代物理`,
  // ...
}
```

然后在 prompt 中注入：

```
## 学科知识框架
本主题的知识体系如下，请按此框架组织内容：
${knowledgeFramework}
```

**效果**：LLM 会按照这个框架来组织目录和正文，内容更有体系感。

---

### P2-2：异常内容黑名单兜底

**目标**：最后一道防线，拦截明显的跑题内容

**实现**：维护一个轻量的"主题-黑名单"映射：

```typescript
const TOPIC_BLACKLIST: Record<string, string[]> = {
  '电路': ['Python', 'JavaScript', 'Fortran', '编程语言', '代码', '算法', 'Django', 'Flask', 'Pandas', 'NumPy', 'TensorFlow', 'PyTorch', 'Stack Overflow', 'TIOBE'],
  '数学': ['Python', 'JavaScript', '编程', '代码'],
  '语文': ['Python', 'JavaScript', '编程', '代码', '算法'],
  // ...
};
```

在生成后的校验中检查：如果文本中包含黑名单词汇，直接判定为不合格，触发重试。

**注意**：这个方案比较暴力，可能误杀（比如"电路"主题中提到了"Python"作为某种电路仿真工具）。所以只作为兜底，优先级低于 P1-1 的 LLM 二次校验。

---

## 四、实施计划（推荐顺序）

### Week 1：P0 紧急修复（预计 2 天）

1. **Day 1**：实施 P0-1（强主题约束 + 反例）+ P0-2（目录联动约束）
   - 修改 `buildTemplateFillPrompt`
   - 生成 3-5 个不同主题的 PPT 验证跑题率
   
2. **Day 2**：实施 P0-3（学段难度注入）
   - 修改 `buildTemplateFillPrompt`
   - 分别用初中/高中/大学测试"电路"主题，验证难度差异

### Week 2：P1 质量校验层（预计 3 天）

1. **Day 1-2**：实施 P1-1（主题相关性校验）
   - 实现 `validateContentRelevance`
   - 选择校验方案：关键词密度 vs LLM 二次校验
   - 
2. **Day 3**：实施 P1-2（目录一致性校验）
   - 实现 `validateTocConsistency`

### Week 3：P1-P2 高级优化（预计 3 天）

1. **Day 1-2**：实施 P1-3（分步生成）
   - 改造 `generateWithTemplatePack` 为两阶段生成
   - 验证一致性提升效果
   
2. **Day 3**：实施 P2-1（学科知识框架）+ P2-2（黑名单兜底）

---

## 五、验证方式

### 跑题率测试

选择 10 个不同主题，每个主题生成 1 份 PPT，人工检查跑题页数：

| 主题 | 模板 | 优化前跑题页数 | 优化后跑题页数 |
|------|------|--------------|--------------|
| 电路 | tech | 3/7 | 目标: 0/7 |
| 勾股定理 | modern-geometric | ? | 目标: 0/7 |
| 荷塘月色 | humanistic | ? | 目标: 0/7 |
| 牛顿定律 | modern-geometric | ? | 目标: 0/7 |
| 光合作用 | nature | ? | 目标: 0/7 |

### 目录一致性测试

检查目录项和正文标题的对应关系：
- 目录 3 项全部有标题和描述
- 内容页标题和目录项语义相关
- 内容页之间不重复

### 学段区分度测试

同一主题（如"电路"）分别用初中/高中/大学生成，检查：
- 初中：是否有生活实例？公式是否有推导？
- 高中：是否有典型例题？是否有考试重点提示？
- 大学：是否有严谨推导？是否有前沿应用？

---

## 六、我的建议

如果只能做一件事，**先做 P0-1（强主题约束 + 反例警示）**。这是改动最小、收益最大的措施，很可能 alone 就能解决 80% 的跑题问题。

如果要做三件事，按这个顺序：
1. **P0-1**：强主题约束（根治跑题）
2. **P0-2**：目录联动约束（解决目录混乱）
3. **P1-1**：LLM 二次校验（自动拦截剩余 20% 的跑题）

你觉得这个方案怎么样？要不要我直接开干？
