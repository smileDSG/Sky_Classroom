# PPT 生成链路 Bug 根因分析与修复方案

> 针对 `springai_科技暗蓝_1780741956824.pptx` 质检发现的 5 类问题

---

## 一、Bug 清单与根因映射

### Bug 1 — 内容截断（Slide 10 / 18 subtitle 末尾缺失；Slide 16 标题缩写）

**现象：**
- Slide 10 subtitle：`"...实现模型无缝切换与组合编排，奠"`（应为"奠定基础"）
- Slide 18 subtitle：`"...帮助掌握将Spring AI落地为"`（句子不完整）
- Slide 16 标题：`"Chat 与 Emb"`（应为 Embedding）

**根因定位：**
1. `lib/slides/agent/section-agent.ts:688` 的 token 预算公式：
   ```ts
   maxOutputTokens: Math.min(8192, section.pages.length * 1400 + 400)
   ```
   中文信息密度远高于英文，"每页 1400 token" 的估算对长描述页（concept/case）不足。LLM 在逼近上限时强行截断正在输出的句子。
2. `content-schemas.ts` 的 `chapterContentSchema` 把 subtitle 上限设为 80 字，但截断发生在 **LLM 输出层**（token 用完），而非 schema 校验层。schema 的 `trunc` 只能处理超长，无法修复 LLM 主动截断的不完整句子。

**影响链路：** SectionAgent → Content JSON（已残缺）→ PageDesignAgent（基于残缺内容生成指令）→ PPTX

---

### Bug 2 — 拼写错误（Slide 12 "Respons" / Slide 14 "Ollam"）

**现象：**
- Slide 12 标题：`"从 Prompt 到 Respons"`（应为 Response）
- Slide 14 标题：`"从 OpenAI 迁移到本地 Ollam"`（应为 Ollama）

**根因定位：**
1. `section-agent.ts` 的 system prompt 中没有任何**专有名词拼写校验**要求。
2. LLM（尤其是中文场景下）对英文技术专有名词的拼写不稳定，"Ollama" 常误写为 "Ollam"，"Response" 常误写为 "Respons"。
3. `autoFixContent` 和 `postProcessContent` 都没有针对常见技术术语的拼写纠正表。

---

### Bug 3 — `[Formula]` 占位符未替换（Slide 11 ×3 处 / Slide 16 ×1 处）

**现象：**
- Slide 11 出现 `ChatModel 核心方法签名 [Formula]` 等 3 处占位符
- Slide 16 出现 `组合调用伪代码：[Formula]` 占位符
- 最终页面上占位符被过滤为空白，公式完全没有渲染

**根因定位（三层都有责任）：**

| 层级 | 文件 | 问题 |
|------|------|------|
| **Content 生成层** | `section-agent.ts` | LLM 在生成 `formulas` 数组时，把 `latex` 字段错误地填为 `[Formula]` 占位符，而不是实际 LaTeX |
| **Schema 修复层** | `content-schemas.ts:188-194` | `autoFixContent` 只对空 `latex` 做兜底（替换为 `\text{label}`），但 `[Formula]` 是非空字符串，被原样保留 |
| **指令渲染层** | `page-design-agent.ts` | Prompt 虽明确禁止 `[Formula]`，但当 content 中 `formulas[].latex === '[Formula]'` 时，它无法生成有效的 `addFormula` 指令，只能把 label + `[Formula]` 作为普通文本输出 |
| **指令执行层** | `instruction-executor.ts:345-358` | 检测到独立 `[Formula]` 后执行 `break`（过滤不渲染），这是最后一道防线，但结果仍然是公式区域空白 |

---

### Bug 4 — 章节规划与实际内容脱节（Slide 17 preview 预告"Prompt 工程"章节，实际第三章是"高级特性"）

**现象：**
- Slide 17（第二章 summary）preview：`"下一章将深入 Spring AI 的 Prompt 工程与模板化能力"`
- 实际第三章标题：`"Spring AI 高级特性与工程实践"`，正文完全没有"Prompt 工程"内容

**根因定位：**
1. `section-agent.ts:126-145` 的 `buildUserPrompt` 只传入**当前章节**的信息：
   ```ts
   return `主题：${topic}
   章节编号：${section.sectionId}
   章节标题：${section.title}...`;
   ```
2. LLM 在生成 summary 页面的 `preview` 字段时，**没有下一章的实际标题/内容作为参考**，只能基于主题自行推断。它推断出了"Prompt 工程"，但 planning-agent 实际规划的是"高级特性与工程实践"。
3. `pipeline.ts:243` 调用 `generateSectionContent` 时，没有把整个 `outline` 的章节列表作为上下文传入。

---

### Bug 5 — 内容密度过高、主题分配失衡（Slide 21 纯文字堆砌 / Slide 23 硬塞两主题 / 第三章缺少 Agent/安全独立页）

**现象：**
- Slide 21：一个 case 页硬塞了 200+ 字的解决方案 + 3 个技术关键词备注
- Slide 23：把"以图搜图（多模态）"和"双重安全防护"两大主题挤在同一页
- Slide 24 总结提到了"函数调用与Agent机制""输入过滤/输出审核/防注入"，但正文中没有任何独立展开页

**根因定位：**
1. `planning-agent.ts:209-248` Layer2 的 prompt 只有**内容密度下限**（如 concept 的 focus 至少3个知识点），没有**单页内容量上限**约束。
2. `section-agent.ts:85-93` 的 density rules 同样只有下限，没有上限。LLM 在生成时会尽可能多地填充内容，导致单页文字量爆炸。
3. `planning-agent.ts` 的 Layer1 骨架规划没有建立**"总结中提到的每个主题必须在正文中有独立展开页"**的硬性规则。

---

## 二、修复方案（按优先级排序）

### 方案 A — 根治内容截断（P0）

**修改文件：** `lib/slides/agent/section-agent.ts`

1. **提高 token 预算**：将 `maxOutputTokens` 从 `section.pages.length * 1400 + 400` 提高到 `section.pages.length * 1800 + 600`。
   - 依据：质检中截断的章节（第二章 7 页，第三章 7 页）都恰好在长描述页被截断，1400 token/页对中文长文本不足。
2. **增加截断自检 prompt 要求**：在 system prompt 的"重要规则"中新增一条：
   > "所有字段必须输出完整句子，严禁在句子中间截断。如果受长度限制无法完整展开，优先精简内容，而不是输出不完整的半句话。"
3. **JSON 修复后增加完整性校验**：在 `generateSectionContent` 的解析成功后，扫描所有字符串字段，检测末尾是否为常见截断标志（如`"奠"`、`"落地为"`、`"是"`、`"和"`等介词/动词结尾），如果是则触发 section 级重试。

---

### 方案 B — 专有名词拼写兜底（P0）

**修改文件：**
- `lib/slides/agent/section-agent.ts`（prompt 层）
- `lib/slides/agent/content-schemas.ts`（autoFixContent 层）

1. **Prompt 层强化**：在 section-agent system prompt 中增加：
   > "技术专有名词必须拼写正确：Ollama（不是 Ollam）、Response（不是 Respons）、Embedding（不是 Emb）、OpenAI、Azure、HuggingFace、Spring Boot、ChatGPT、GPT-4 等。"
2. **AutoFix 层兜底**：在 `postProcessContent` 或 `autoFixContent` 中增加技术术语拼写纠正表：
   ```ts
   const TECH_SPELLING_FIXES: Record<string, string> = {
     'Respons': 'Response',
     'Ollam ': 'Ollama ',
     'Ollam,': 'Ollama,',
     'Ollam.': 'Ollama.',
     ' Emb ': ' Embedding ',
     ' Emb,': ' Embedding,',
     ' Emb.': ' Embedding.',
   };
   ```
   对 title、subtitle、summary 等关键字段做全局替换。

---

### 方案 C — 彻底消灭 `[Formula]` 占位符（P0）

**修改文件：**
- `lib/slides/agent/section-agent.ts`（prompt 层）
- `lib/slides/agent/content-schemas.ts`（schema 修复层）
- `lib/slides/agent/page-design-agent.ts`（渲染层）

1. **Prompt 层**：在 section-agent system prompt 的公式规则中新增硬规则：
   > "`formulas[].latex` 字段必须是有效的 LaTeX 代码（如 `ChatResponse call(Prompt prompt)` 的代码型公式应写成 `\\texttt{ChatResponse call(Prompt prompt)}`），绝对禁止输出 `[Formula]`、`[formula]`、`【公式】` 等占位符。"
2. **Schema 修复层**：在 `autoFixContent` 的 formula 处理逻辑中（第188-194行），增加对占位符的识别：
   ```ts
   if (!obj.latex || typeof obj.latex !== 'string' || /\[\s*formula\s*\]/i.test(obj.latex) || obj.latex.trim() === '') {
     obj.latex = `\\text{${obj.label as string}}`;
   }
   ```
3. **渲染层**：在 page-design-agent 的 system prompt 中，对 formulas 数组的渲染规则做更具体的示例：
   > "如果 content.formulas 存在，每个 formula 必须生成两条指令：addText(label) + addFormula(latex)。如果 latex 为空或无效，只渲染 label 文本，不要输出占位符。"

---

### 方案 D — summary preview 与实际下一章对齐（P1）

**修改文件：**
- `lib/slides/agent/section-agent.ts`
- `lib/slides/agent/pipeline.ts`

1. **修改 `generateSectionContent` 签名**：增加 `nextSectionTitle?: string` 参数。
2. **修改 `buildUserPrompt`**：如果存在 `nextSectionTitle`，在 prompt 中追加：
   > "下一章标题：${nextSectionTitle}。summary 页面的 preview 字段必须基于下一章实际标题来写，不要自行推测。"
3. **修改 `pipeline.ts:243`**：在调用 `generateSectionContent` 时，传入 `outline.sections[i + 1]?.title` 作为 `nextSectionTitle`。

---

### 方案 E — 内容密度上限 + 主题全覆盖校验（P1）

**修改文件：**
- `lib/slides/agent/planning-agent.ts`
- `lib/slides/agent/section-agent.ts`

1. **Planning Layer2 增加上限约束**：在 buildLayer2SystemPrompt 中新增：
   > "单页内容量上限：concept 的每个 card.desc 不超过 160 字；case 的每个 scenario 的 problem+solution 合计不超过 500 字；process 的每个 step.desc 不超过 140 字。"
2. **Section-agent density rules 同步增加上限**：在 system prompt 中，将现有的密度规则从纯下限改为上下限：
   > "concept 类型：cards 至少3个，每个 card.desc 40-160字，summary 30-150字"
3. **Planning Layer1 增加主题覆盖校验**：在生成 skeleton 后，校验规则：
   > "每个章节的 summary 页面提到的主题，必须在正文内容页中有至少一个独立展开页。"
   如果 planning-agent 生成的 skeleton 中第三章只有 RAG/多模态页，但 summary 提到了 Agent/安全，则自动增加对应页型。

---

## 三、不修复的项（设计层面建议）

以下问题属于**教学设计/审美层面**，不是代码 bug，建议用户确认是否在本次修复范围内：

| 问题 | 说明 |
|------|------|
| Slide 25 结尾页过于简陋 | 只有 slogan + 感谢语，无讲师信息/Q&A/延伸阅读 |
| Slide 4/7/9 底部大段总结文字 | 属于教学风格选择（有人喜欢要点+总结，有人喜欢纯要点） |
| Slide 2 目录未标注每章页数 | 信息层级问题，非技术 bug |

---

## 四、验证方式

1. 使用相同主题 `"Spring AI"` 重新生成一份 PPT
2. 解压 PPTX，检查：
   - 所有 chapter subtitle 是否完整句子
   - 所有标题中的专有名词拼写是否正确
   - `[Formula]` 是否不再出现在任何 slide 文本中
   - summary 页面的 preview 是否与下一章标题一致
3. 人工抽查内容密度最高的 3-5 页，确认单页文字量是否可接受

---

## 五、涉及修改的文件清单

| 文件 | 修改点 | 优先级 |
|------|--------|--------|
| `lib/slides/agent/section-agent.ts` | token 预算、prompt 规则（完整性/拼写/公式）、`buildUserPrompt` 传入 nextSectionTitle | P0 |
| `lib/slides/agent/content-schemas.ts` | `autoFixContent` 识别 `[Formula]` 占位符、增加拼写纠正 | P0 |
| `lib/slides/agent/page-design-agent.ts` | prompt 中 formulas 渲染规则细化 | P0 |
| `lib/slides/agent/pipeline.ts` | 调用 `generateSectionContent` 时传入 `nextSectionTitle` | P1 |
| `lib/slides/agent/planning-agent.ts` | Layer2 prompt 增加单页内容量上限、Layer1 增加主题覆盖校验 | P1 |
