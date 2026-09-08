/**
 * Section Agent — generates pure content JSON for a section's pages.
 *
 * Receives a SectionPlan (page-level outline with contentOutlines) and
 * outputs content JSON for each page. Does NOT generate layout/design.
 */
import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import type { LanguageModel } from 'ai';
import type { DesignDNA } from './design-dna';
import type { SectionPlan } from './planning-agent';
import { z } from 'zod';
import {
  SCHEMA_DESCRIPTIONS,
  CONTENT_SCHEMAS,
  autoFixContent,
  convertInlineLatexToUnicode,
  cleanJsonText,
  unicodeMathToLatex,
  extractFormulasFromText,
} from './content-schemas';

const log = createLogger('SectionAgent');

// ── Content Schemas per page type ─────────────────────────────────────

const pageContentSchema = z.object({
  pageNum: z.number(),
  pageType: z.string(),
  content: z.record(z.string(), z.unknown()),
});

export const sectionOutputSchema = z.object({
  sectionId: z.number(),
  pages: z.array(pageContentSchema),
});

export type SectionOutput = z.infer<typeof sectionOutputSchema>;

// ── Prompt ────────────────────────────────────────────────────────────

export function buildSystemPrompt(
  topic: string,
  difficulty: string,
  designDNA: DesignDNA,
  pageTypes: string[],
  educationLevel?: string,
): string {
  // Only inject schemas relevant to this section
  const relevantSchemas = [...new Set(pageTypes)]
    .filter((t) => SCHEMA_DESCRIPTIONS[t])
    .map((t) => `### ${t}\n${SCHEMA_DESCRIPTIONS[t]}`)
    .join('\n\n');

  return `## 角色
你是一位${difficulty}学科教师${educationLevel ? `，面向${educationLevel}学生授课` : ''}，正在编写"${topic}"课程的课件内容。

## 风格
- 风格名：${designDNA.styleName}
- 氛围：${designDNA.mood}

## 内容 Schema（必须严格遵守，违反会导致页面不合格）

${relevantSchemas}

## 重要规则
1. 严格遵循 contentOutline 的 focus 和 keyConcepts
2. 所有内容必须围绕"${topic}"，严禁引入无关学科内容
3. 技术术语用 LaTeX 格式（如 $a^2+b^2=c^2$）
4. 严格按照上面的 Schema 格式输出，字段名和类型必须完全匹配
5. 字符串不能超过 Schema 中标注的字数上限
6. 数组长度必须在 Schema 标注的范围内
7. 匹配 ${difficulty} 内容难度${educationLevel ? `，且内容必须适合${educationLevel}学生的认知水平` : ''}
8. **公式输出规则（硬规则，不可违反）**
   - **formula 类型页面**（整页展示单一公式）：使用字段 mainFormula（主公式，标准 LaTeX）、derivation（推导说明）、application（应用说明）。禁止输出 formulas 字段。
   - **其他类型页面**（概念/案例/总结/流程等）：如需展示公式，使用 formulas 数组：[{ "label": "公式名≤20字", "latex": "标准 LaTeX，≤200字" }]。formulas 是可选字段，最多 3 条。
   - 公式字段中的 LaTeX 直接输出原始字符串（如 \\frac{a}{b}），不要转义，不要用 $...$ 包裹。
   - 正文中仍可保留 $...$ 形式的简单数学表达式。
   - 当 focus 或 keyConcepts 中出现"反应式"、"方程式"、"公式"、"化学式"、"总反应"、"电极反应"等关键词时，必须在对应页面按上述规则输出完整 LaTeX 方程式。禁止只用文字描述代替公式。
   - **当页面 title 包含"方程式"、"反应式"或"总反应"时，该页面必须包含 formulas 数组（至少1条），且卡片描述中必须写出 LaTeX 格式的化学方程式，严禁只用文字描述反应物和产物。**
   - **关键规则**：如果 summary 的 keyPoints 或 concept 的 card.desc 中出现"方程式"、"反应式"、"总反应"等字样，必须在同一文本中写出完整的 LaTeX 化学方程式（含 = → ← ⇌ 等运算符），严禁只输出标签文字（如"光反应总方程式"这种纯标签是严重错误）。
   - **绝对禁止**在 formulas[].latex 字段中输出 [Formula]、[formula]、【公式】等任何形式的占位符。如果是代码型公式（如方法签名），用 \\texttt{...} 包裹。
   - 化学方程式的 LaTeX 示例：\\(6CO_2 + 6H_2O \\rightarrow C_6H_{12}O_6 + 6O_2\\)（直接写原始字符串，不加外层 $）
9. **内容差异化规则**
   - concept 类型的 cards 中，每个 card.desc 必须围绕该 card.title 独立展开，内容不得与其他卡片重复
   - 若 keyConcepts 信息不足以支撑差异化，请基于 focus 和 title 进行合理推断和扩展
10. **chapter 页面规则**
    - num 字段必须与 sectionId 一致（如 sectionId=1 则 num="1"）。
    - subtitle 必须基于 contentOutline.focus（核心内容），面向学生输出。
    - 严禁在 subtitle 中包含"创作指引""设计说明""章节封面页"等面向设计师的指令文本。
11. **创作指引隔离规则（硬规则）**
    - contentOutline.notes 是创作指引，仅用于设计参考，严禁放入任何学生可见字段（如 card.desc、keyPoints、scenarios.problem/solution）
    - card.desc 必须面向学生，使用教学语气，禁止出现"必须展示""强调""请"等指令性词汇
12. **内容完整性规则（硬规则）**
    - 所有字段必须输出完整句子，严禁在句子中间截断。如果受长度限制无法完整展开，优先精简内容，而不是输出不完整的半句话。
    - 常见截断错误：以"奠""为""和""是"等介词/动词结尾 → 必须补全为完整表述。
13. **专有名词拼写规则（硬规则）**
    - 技术专有名词必须拼写正确：Ollama（不是 Ollam）、Response（不是 Respons）、Embedding（不是 Emb）、OpenAI、Azure、HuggingFace、Spring Boot、ChatGPT、GPT-4、Anthropic、Claude、LangChain、Pgvector、Chroma、Milvus、Pinecone、Weaviate、TensorFlow、PyTorch。
    - 如果标题中出现英文技术术语，必须完整拼写，严禁缩写或截断。

## 内容密度硬规则（违反会导致页面被判定为不合格并重试）
- **concept 类型**：cards 至少3个，每个 card.desc 40-160字，summary 30-150字。严禁一句话概括。
- **case 类型**：每个 scenario 的 problem 30-200字，solution 30-200字。单个 scenario 的 problem+solution 合计不超过 400字。
- **summary 类型**：keyPoints 至少4个、最多6个，每个 20-120字，必须覆盖本章全部核心内容。
- **process 类型**：steps 至少3个、最多6个，每个 step.desc 30-140字。
- **compare 类型**：left.items 和 right.items 各至少3条、最多6条，每条 15-100字；conclusion 30-150字。
- **formula 类型**：derivation 50-400字，application（如有）30-300字。
- **timeline 类型**：events 至少3个、最多6个，每个 content 20-120字。
- **通用规则**：禁止生成"一句话概括""详见教材""核心要点"等空洞内容。每个字段必须面向学生充分展开论述，有具体知识点、例子或分析。同时禁止无节制填充——单页总文字量应控制在合理范围内，确保PPT页面不会变成纯文字堆砌。

## 好例子 vs 坏例子

[坏例子 concept]
标题: "锦瑟情感分析"
cards[0].desc: "锦瑟无端五十弦，一弦一柱思华年。" (仅引用诗句，无分析，<40字，不合格)
cards[1].desc: "庄生晓梦迷蝴蝶，望帝春心托杜鹃。" (仅引用诗句，无分析，<40字，不合格)
cards[2].desc: "沧海月明珠有泪，蓝田日暖玉生烟。" (仅引用诗句，无分析，<40字，不合格)
summary: "本联描写了诗人的情感。" (仅一句话，<30字，不合格)
→ 错误原因：card.desc 只是引用诗句原文，完全没有展开分析；summary 一句话带过。

[好例子 concept]
标题: "锦瑟情感的递进：由近及远，由实入虚"
cards[0].title: "首联：锦瑟起兴，触物生情"
cards[0].desc: "诗人以锦瑟起兴，由眼前实物触发对往昔年华的追忆。无端二字蕴含无限怅惘，五十弦暗喻人生半百，每一弦每一柱都勾起对逝去岁月的深切思念。这种由物及情的写法，奠定了全诗感伤追忆的基调。" (约90字，展开分析)
cards[1].title: "颔联：人生如梦，往事如烟"
cards[1].desc: "借用庄周梦蝶和望帝化鹃的典故，表达人生虚幻、往事难追的感慨。迷字写出对往事的痴迷与困惑，托字则表现出将深情寄托于外物的无奈。诗人从个人体验上升到对人生本质的哲学思考。" (约90字，有分析)
cards[2].title: "颈联：沧海遗珠，此情可待"
cards[2].desc: "以沧海明珠和蓝田美玉为喻，写美好事物在悲凉境遇中的闪耀。珠有泪、玉生烟，既是视觉意象，更是情感投射。诗人将个人失落与天地苍茫融为一体，情感由个人扩展至宇宙，意境更加宏阔深远。" (约90字，有分析)
summary: "全诗情感由锦瑟起兴，经人生梦幻、沧海遗珠，最终归于此情可待成追忆的怅惘。情感层层递进，由近及远，由实入虚，展现了李商隐诗歌深情绵邈的独特风格。" (约80字，充分总结)
→ 成功原因：每个 card.desc 都有具体分析和情感解读，summary 完整概括全诗脉络。

[好例子 case]
标题: "锦瑟典故赏析案例分析"
scenarios[0].problem: "为什么李商隐在锦瑟中要选择庄生梦蝶和望帝啼鹃这两个典故？这两个典故分别表达了什么情感？" (提出问题)
scenarios[0].solution: "选择这两个典故并非偶然。庄生梦蝶出自庄子，表达人生如梦、虚实难辨的哲学困惑，对应诗人对往昔岁月的追忆与迷茫；望帝啼鹃出自华阳国志，写蜀帝杜宇死后化为杜鹃，春心不死、哀鸣不止，对应诗人对理想与爱情的执着追求。两个典故一虚一实，一哲一情，共同构成了诗人复杂而深沉的内心世界。" (详细解答，约130字)

## 输出格式
只输出纯 JSON：
{ "sectionId": number, "pages": [{ "pageNum": number, "pageType": "concept", "content": { ... } }] }`;
}

export function buildUserPrompt(
  section: SectionPlan,
  topic: string,
  nextSectionTitle?: string,
  educationLevel?: string,
): string {
  const pagesDesc = section.pages
    .map((p) => {
      const concepts = p.contentOutline.keyConcepts?.length
        ? `\n    - keyConcepts: ${p.contentOutline.keyConcepts.join(' / ')}`
        : '';
      const notes = p.contentOutline.notes
        ? `\n    - notes: [创作指引，仅设计师可见，禁止混入正文] ${p.contentOutline.notes}`
        : '';
      return `- Page ${p.pageNum} [${p.type}]: "${p.title}"\n    - focus: ${p.contentOutline.focus}${concepts}${notes}`;
    })
    .join('\n\n');

  const nextChapterHint = nextSectionTitle
    ? `\n## 下一章信息\nsummary 页面的 preview 字段必须基于下一章实际标题来写："${nextSectionTitle}"。严禁自行推测不存在的章节主题。`
    : '';

  return `主题：${topic}${educationLevel ? `\n目标受众：${educationLevel}` : ''}
章节编号：${section.sectionId}（本章在所有章节中的顺序编号，chapter 类型页面的 content.num 必须与此一致，如本章是第3章则 num="03"）
章节标题：${section.title}（共 ${section.pages.length} 页）

## 本章大纲
${pagesDesc}${nextChapterHint}

请逐页生成完整内容JSON。`;
}

// ── JSON Cleanup ────────────────────────────────────────────────────

/** Recursively convert inline LaTeX ($...$) in content object to Unicode.
 *  IMPORTANT: preserves formulas[].latex as raw LaTeX for downstream addFormula.
 */
export function convertContentLatex(content: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content)) {
    // 保留完整 LaTeX 公式字段，不做 Unicode 转换（下游走图片渲染）
    if (key === 'mainFormula' || key === 'derivation' || key === 'application') {
      result[key] = value;
      continue;
    }
    if (key === 'formulas' && Array.isArray(value)) {
      // Preserve latex field; only convert label
      result[key] = (value as unknown[]).map((item) => {
        if (typeof item === 'object' && item !== null) {
          const obj = { ...(item as Record<string, unknown>) };
          if (typeof obj.label === 'string') {
            obj.label = convertInlineLatexToUnicode(obj.label);
          }
          // latex stays raw
          return obj;
        }
        return item;
      });
    } else if (typeof value === 'string') {
      result[key] = convertInlineLatexToUnicode(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'string'
          ? convertInlineLatexToUnicode(item)
          : typeof item === 'object' && item !== null
            ? convertContentLatex(item as Record<string, unknown>)
            : item,
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = convertContentLatex(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ── Post-Process: auto-fix content quality issues ────────────────────

export function postProcessContent(
  pageType: string,
  content: Record<string, unknown>,
): Record<string, unknown> {
  // A. 概念卡片重复自动修复（标题+描述双重检测）
  if (pageType === 'concept') {
    const cards = (content.cards as Array<{ title: string; desc: string }>) || [];
    if (cards.length > 1) {
      // A1. 描述重复修复
      const descs = cards.map((c) => c.desc?.trim());
      for (let i = 0; i < cards.length; i++) {
        const sameCount = descs.filter((d) => d === descs[i]).length;
        if (sameCount > 1) {
          cards[i].desc = `${cards[i].title}：${cards[i].desc}`;
        }
      }
      // A2. 标题重复去重
      const titleCounts: Record<string, number> = {};
      for (const card of cards) {
        titleCounts[card.title] = (titleCounts[card.title] || 0) + 1;
      }
      for (let i = 0; i < cards.length; i++) {
        if (titleCounts[cards[i].title] > 1) {
          // 保留第一个，后续重复的追加序号
          let dupIndex = 0;
          for (let j = 0; j < i; j++) {
            if (cards[j].title === cards[i].title) dupIndex++;
          }
          if (dupIndex > 0) {
            cards[i].title = `${cards[i].title}(${dupIndex + 1})`;
          }
        }
      }
      content.cards = cards;
    }
  }

  // B. 公式缺失自动修复：智能从全量文本中提取并转换
  // 只对支持公式的页面类型进行公式提取（toc/chapter/cover/end/compare/table/timeline/quiz 等跳过）
  const formulaEligibleTypes = ['concept', 'case', 'formula', 'process'];
  if (!formulaEligibleTypes.includes(pageType)) {
    delete (content as Record<string, unknown>).formulas;
    delete (content as Record<string, unknown>).mainFormula;
    return content;
  }

  const contentStr = JSON.stringify(content);
  const hasFormulaKeyword =
    /反应式|方程式|公式|化学式|总反应|电极反应|电势|能斯特|半反应|氧化还原|浓度商|吉布斯|自由能|能量传递|电荷分离|量子效率|荧光量子|电子传递|光合磷酸化|光抑制|光氧化|光系统/.test(
      contentStr,
    );
  if (hasFormulaKeyword) {
    const hasFormulas =
      Array.isArray(content.formulas) && (content.formulas as Array<unknown>).length > 0;
    const hasMainFormula =
      typeof (content as { mainFormula?: string }).mainFormula === 'string' &&
      (content as { mainFormula?: string }).mainFormula!.length > 0;

    // ── 增强型公式提取：扫描所有文本字段 ──
    const formulas: Array<{ label: string; latex: string }> = [];

    // Helper: 从任意文本中提取公式，如果只有标签则尝试构建示意公式
    function extractOrBuildFormula(
      text: string,
      label: string,
    ): { label: string; latex: string } | null {
      // 1. 尝试提取已有公式
      const extracted = extractFormulasFromText(text);
      if (extracted.length > 0) {
        return { label, latex: extracted[0] };
      }
      // 2. 从文本中提取化学符号，构建示意公式
      const chemSymbols = [
        ...text.matchAll(
          /(?:CO_2|CO₂|H_2O|H₂O|O_2|O₂|N_2|N₂|CH_4|CH₄|NH_3|NH₃|C_6H_{12}O_6|C₆H₁₂O₆|ATP|ADP|NADPH|NADP\+|NADP⁺|NADH|FADH2|葡萄糖|RuBP|3-PGA|G3P|PEP|Pi|P_i|H\+|H⁺|e\-|e⁻|H_2|H₂|C_5|C_3|C_4|C_6|Fe|Ca|Mg|SiO₂|Al₂O₃)/gi,
        ),
      ].map((m) => m[0]);
      const uniqueSymbols = [...new Set(chemSymbols)].slice(0, 6);
      if (uniqueSymbols.length >= 2) {
        const latexParts = uniqueSymbols.map((s) =>
          s
            .replace(/CO₂/gi, 'CO_2')
            .replace(/H₂O/gi, 'H_2O')
            .replace(/O₂/gi, 'O_2')
            .replace(/N₂/gi, 'N_2')
            .replace(/CH₄/gi, 'CH_4')
            .replace(/NH₃/gi, 'NH_3')
            .replace(/C₆H₁₂O₆/gi, 'C_6H_{12}O_6')
            .replace(/葡萄糖/gi, 'C_6H_{12}O_6')
            .replace(/NADP⁺/gi, 'NADP^+')
            .replace(/NADP\+/gi, 'NADP^+')
            .replace(/FADH2/gi, 'FADH_2')
            .replace(/P_i/gi, 'P_i')
            .replace(/Pi/gi, 'P_i')
            .replace(/H⁺/gi, 'H^+')
            .replace(/H\+/gi, 'H^+')
            .replace(/e⁻/gi, 'e^-')
            .replace(/e\-/gi, 'e^-')
            .replace(/H₂/gi, 'H_2')
            .replace(/C_5/gi, 'C_5')
            .replace(/C_3/gi, 'C_3')
            .replace(/C_4/gi, 'C_4')
            .replace(/C_6/gi, 'C_6')
            .replace(/SiO₂/gi, 'SiO_2')
            .replace(/Al₂O₃/gi, 'Al_2O_3'),
        );
        return { label, latex: latexParts.join(' + ') + ' \\rightarrow \\text{产物}' };
      }
      // 3. 如果只有一个化学符号，也尝试构建一个简单公式
      if (uniqueSymbols.length === 1) {
        const s = uniqueSymbols[0];
        const latex = s
          .replace(/CO₂/gi, 'CO_2')
          .replace(/H₂O/gi, 'H_2O')
          .replace(/O₂/gi, 'O_2')
          .replace(/C₆H₁₂O₆/gi, 'C_6H_{12}O_6')
          .replace(/NADP⁺/gi, 'NADP^+')
          .replace(/NADP\+/gi, 'NADP^+')
          .replace(/H⁺/gi, 'H^+')
          .replace(/e⁻/gi, 'e^-')
          .replace(/SiO₂/gi, 'SiO_2')
          .replace(/Al₂O₃/gi, 'Al_2O_3');
        return { label, latex: latex + ' \\rightarrow \\text{产物}' };
      }
      // 4. 兜底：如果标签包含已知反应类型，构建通用示意公式
      if (/卡尔文|暗反应|羧化|还原|光合|光反应/.test(label)) {
        return { label, latex: '6CO_2 + 6H_2O \\xrightarrow{\\text{光}} C_6H_{12}O_6 + 6O_2' };
      }
      if (/呼吸| glycolysis |发酵/.test(label)) {
        return { label, latex: 'C_6H_{12}O_6 + 6O_2 \\rightarrow 6CO_2 + 6H_2O + \\text{能量}' };
      }
      if (/C3|C4|CAM/.test(label)) {
        return { label, latex: 'CO_2 + RuBP \\xrightarrow{Rubisco} 2 \\times 3-PGA' };
      }
      return null;
    }

    // Helper: 检查文本是否只有标签（如"光反应总方程式"），没有实际公式内容
    function isBareLabel(text: string): boolean {
      return /方程式|反应式|总反应/.test(text) && !/[=→←⇌↔]/.test(text);
    }

    if (pageType === 'concept' && Array.isArray(content.cards)) {
      for (const card of content.cards as Array<{ title: string; desc: string }>) {
        const titleHasFormulaKw = /反应式|方程式|公式|化学式|总反应|电极反应|电势|能斯特/.test(
          card.title,
        );
        const descHasFormulaKw = /反应式|方程式|公式|化学式|总反应/.test(card.desc || '');
        const descHasMath =
          /[=→←⇌↔][^。，]{3,60}/.test(card.desc || '') ||
          /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻₀₁₂₃₄₅₆₇₈₉][A-Za-z]|[A-Za-z][⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻₀₁₂₃₄₅₆₇₈₉]/.test(card.desc || '');

        if (titleHasFormulaKw || descHasFormulaKw) {
          const built = extractOrBuildFormula(
            (card.desc || '') + ' ' + (card.title || ''),
            card.title || '相关方程式',
          );
          if (built) formulas.push(built);
          else
            formulas.push({
              label: card.title || '相关方程式',
              latex: `\\text{${card.title || '方程式'}（详见教材）}`,
            });
        } else if (descHasMath) {
          const extracted = extractFormulasFromText(card.desc || '');
          for (const latex of extracted.slice(0, 1)) {
            formulas.push({ label: card.title || '相关公式', latex });
          }
        }
      }
    }

    if (pageType === 'compare') {
      const left = content.left as { title?: string; bullets?: string[] } | undefined;
      const right = content.right as { title?: string; bullets?: string[] } | undefined;
      const allBullets = [...(left?.bullets || []), ...(right?.bullets || [])];
      for (const bullet of allBullets) {
        if (isBareLabel(bullet)) {
          const context = allBullets.join(' ');
          const built = extractOrBuildFormula(context, bullet.replace(/[：:]$/, '') || '相关公式');
          if (built) {
            formulas.push(built);
          } else {
            const allChem = [
              ...context.matchAll(
                /(?:CO₂|H₂O|O₂|ATP|ADP|NADPH|NADP⁺|Fe|Ca|Mg|SiO₂|Al₂O₃|C₆H₁₂O₆|H⁺|e⁻|C_5|C_3|C_4)/gi,
              ),
            ].map((m) => m[0]);
            const uniqChem = [...new Set(allChem)].slice(0, 4);
            if (uniqChem.length >= 2) {
              const latex =
                uniqChem
                  .map((s) =>
                    s
                      .replace(/CO₂/gi, 'CO_2')
                      .replace(/H₂O/gi, 'H_2O')
                      .replace(/O₂/gi, 'O_2')
                      .replace(/SiO₂/gi, 'SiO_2')
                      .replace(/Al₂O₃/gi, 'Al_2O_3')
                      .replace(/C₆H₁₂O₆/gi, 'C_6H_{12}O_6')
                      .replace(/NADP⁺/gi, 'NADP^+')
                      .replace(/H⁺/gi, 'H^+')
                      .replace(/e⁻/gi, 'e^-')
                      .replace(/Fe/gi, 'Fe'),
                  )
                  .join(' + ') + ' \\rightarrow \\text{产物}';
              formulas.push({ label: bullet.replace(/[：:]$/, '') || '相关公式', latex });
            } else if (uniqChem.length === 1) {
              const latex = uniqChem[0]
                .replace(/CO₂/gi, 'CO_2')
                .replace(/H₂O/gi, 'H_2O')
                .replace(/O₂/gi, 'O_2')
                .replace(/NADP⁺/gi, 'NADP^+')
                .replace(/H⁺/gi, 'H^+')
                .replace(/e⁻/gi, 'e^-');
              formulas.push({
                label: bullet.replace(/[：:]$/, '') || '相关公式',
                latex: latex + ' \\rightarrow \\text{产物}',
              });
            } else {
              formulas.push({
                label: bullet.replace(/[：:]$/, '') || '相关公式',
                latex: `\\text{${bullet}（详见教材）}`,
              });
            }
          }
        } else {
          const extracted = extractFormulasFromText(bullet);
          for (const latex of extracted.slice(0, 1)) {
            formulas.push({ label: '相关公式', latex });
          }
        }
      }
    }

    if (pageType === 'case' && Array.isArray(content.scenarios)) {
      for (const scenario of content.scenarios as Array<{ problem: string; solution: string }>) {
        const combined = `${scenario.problem || ''} ${scenario.solution || ''}`;
        const extracted = extractFormulasFromText(combined);
        for (const latex of extracted.slice(0, 2)) {
          formulas.push({ label: '计算式', latex });
        }
      }
    }

    if (pageType === 'summary' && Array.isArray(content.keyPoints)) {
      const keyPoints = content.keyPoints as string[];
      for (let i = 0; i < keyPoints.length; i++) {
        const point = keyPoints[i];
        // 如果当前 keyPoint 只有标签，尝试从相邻 keyPoints 提取上下文构建公式
        if (isBareLabel(point)) {
          // 扩大上下文范围到所有 keyPoints，提取化学符号构建公式
          const context = keyPoints.join(' ');
          const built = extractOrBuildFormula(context, point.replace(/[：:]$/, '') || '核心公式');
          if (built) {
            formulas.push(built);
          } else {
            // 从全文提取常见化学式作为兜底
            const allChem = [
              ...context.matchAll(
                /(?:CO₂|H₂O|O₂|ATP|ADP|NADPH|NADP⁺|RuBP|3-PGA|G3P|PEP|C₆H₁₂O₆|H⁺|e⁻|C_5|C_3|C_4)/gi,
              ),
            ].map((m) => m[0]);
            const uniqChem = [...new Set(allChem)].slice(0, 4);
            if (uniqChem.length >= 2) {
              const latex =
                uniqChem
                  .map((s) =>
                    s
                      .replace(/CO₂/gi, 'CO_2')
                      .replace(/H₂O/gi, 'H_2O')
                      .replace(/O₂/gi, 'O_2')
                      .replace(/C₆H₁₂O₆/gi, 'C_6H_{12}O_6')
                      .replace(/NADP⁺/gi, 'NADP^+')
                      .replace(/H⁺/gi, 'H^+')
                      .replace(/e⁻/gi, 'e^-'),
                  )
                  .join(' + ') + ' \\rightarrow \\text{产物}';
              formulas.push({ label: point.replace(/[：:]$/, '') || '核心公式', latex });
            } else if (uniqChem.length === 1) {
              const latex = uniqChem[0]
                .replace(/CO₂/gi, 'CO_2')
                .replace(/H₂O/gi, 'H_2O')
                .replace(/O₂/gi, 'O_2')
                .replace(/NADP⁺/gi, 'NADP^+')
                .replace(/H⁺/gi, 'H^+')
                .replace(/e⁻/gi, 'e^-');
              formulas.push({
                label: point.replace(/[：:]$/, '') || '核心公式',
                latex: latex + ' \\rightarrow \\text{产物}',
              });
            } else {
              formulas.push({
                label: point.replace(/[：:]$/, '') || '核心公式',
                latex: `\\text{${point}（详见教材）}`,
              });
            }
          }
        } else {
          const extracted = extractFormulasFromText(point);
          for (const latex of extracted.slice(0, 1)) {
            formulas.push({ label: '核心公式', latex });
          }
        }
      }
    }

    if (pageType === 'formula') {
      if (
        !content.mainFormula ||
        typeof content.mainFormula !== 'string' ||
        (content.mainFormula as string).length === 0
      ) {
        content.mainFormula = '\\text{公式内容详见教材}';
      }
      if (
        !content.derivation ||
        typeof content.derivation !== 'string' ||
        (content.derivation as string).length === 0
      ) {
        content.derivation = '推导过程详见教材。';
      }
    }

    if (pageType === 'process' && Array.isArray(content.steps)) {
      for (const step of content.steps as Array<{ title: string; desc: string }>) {
        const extracted = extractFormulasFromText(step.desc || '');
        for (const latex of extracted.slice(0, 1)) {
          formulas.push({ label: step.title || '步骤公式', latex });
        }
      }
    }

    const uniqueFormulas = formulas
      .filter((f, i, arr) => arr.findIndex((x) => x.latex === f.latex) === i)
      .slice(0, 3);

    if (uniqueFormulas.length > 0) {
      content.formulas = uniqueFormulas;
    }

    // D. Title 级公式强制兜底：若 title 含"方程式/反应式"但无任何公式，从全文提取或注入占位
    const titleHasFormulaKw = /方程式|反应式|总反应/.test(content.title as string);
    const nowHasFormulas =
      Array.isArray(content.formulas) && (content.formulas as Array<unknown>).length > 0;
    if (titleHasFormulaKw && !nowHasFormulas && !hasMainFormula) {
      let allText = String(content.title || '') + ' ';
      if (pageType === 'concept' && Array.isArray(content.cards)) {
        for (const card of content.cards as Array<{ title: string; desc: string }>) {
          allText += (card.title || '') + ' ' + (card.desc || '') + ' ';
        }
      }
      if (pageType === 'summary' && Array.isArray(content.keyPoints)) {
        for (const point of content.keyPoints as string[]) {
          allText += point + ' ';
        }
      }
      const built = extractOrBuildFormula(allText, String(content.title || '相关方程式'));
      if (built) {
        content.formulas = [built];
      } else {
        content.formulas = [
          {
            label: String(content.title || '相关方程式'),
            latex: `\\text{${String(content.title || '方程式')}（详见教材）}`,
          },
        ];
      }
    }
  }

  // F. [Formula] 占位符全局清理（硬规则，不可绕开）
  const FORMULA_PLACEHOLDER_RE = /^\s*[\[(【]\s*[Ff]ormula\s*[\])】]\s*$/;
  // 1. 清理 formulas 数组中的占位符
  if (Array.isArray(content.formulas)) {
    const cleaned = (content.formulas as Array<{ label: string; latex: string }>)
      .map((f) => {
        if (FORMULA_PLACEHOLDER_RE.test(f.latex)) {
          // 优先从 label 中提取实际公式
          const extracted = extractFormulasFromText(f.label);
          if (extracted.length > 0) return { ...f, latex: extracted[0] };
          // 其次尝试从页面标题或正文中提取
          const pageText = [
            content.title,
            content.summary,
            ...((content.keyPoints as string[]) || []),
          ]
            .filter(Boolean)
            .join(' ');
          const pageExtracted = extractFormulasFromText(pageText);
          if (pageExtracted.length > 0) return { ...f, latex: pageExtracted[0] };
          // 兜底：用 label 生成文本公式
          return { ...f, latex: `\\text{${f.label || '公式'}}` };
        }
        return f;
      })
      .filter((f) => f.latex && !FORMULA_PLACEHOLDER_RE.test(f.latex));
    if (cleaned.length > 0) {
      content.formulas = cleaned;
    } else {
      delete (content as Record<string, unknown>).formulas;
    }
  }
  // 2. 清理 mainFormula 中的占位符
  if (typeof content.mainFormula === 'string' && FORMULA_PLACEHOLDER_RE.test(content.mainFormula)) {
    const searchText = String(content.derivation || '') + ' ' + String(content.title || '');
    const extracted = extractFormulasFromText(searchText);
    if (extracted.length > 0) {
      content.mainFormula = extracted[0];
    } else {
      content.mainFormula = `\\text{${String(content.title || '主公式')}}`;
    }
  }
  // 3. formula 类型页面 derivation/application 去重防堆叠
  if (pageType === 'formula') {
    const derivation = String(content.derivation || '');
    const application = String(content.application || '');
    // application 若与 derivation 高度重复则清空
    if (
      application.length > 20 &&
      derivation.includes(application.slice(0, Math.min(application.length, 40)))
    ) {
      content.application = '';
    }
    // derivation 内部段落去重（LLM 常把同一段话写两遍）
    const paragraphs = derivation.split(/(?<=[。！？])\s+/);
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const p of paragraphs) {
      const key = p.trim().slice(0, 50);
      if (key.length > 10 && seen.has(key)) continue;
      seen.add(key);
      deduped.push(p);
    }
    if (deduped.length < paragraphs.length) {
      content.derivation = deduped.join('');
    }
  }

  // C. 创作指引混入自动修复（增强版）
  const directivePatterns = [
    /^(必须|严禁|请|强调|展示|注意|要求|确保|需要|应当)/,
    /^(使用一个|激发|标题醒目|副标题可点明|需完整呈现|应分步|逻辑清晰|强调物理意义|面向学生|仅设计师可见|禁止混入|创作指引|设计说明)/,
    /^(本页|本节|本章|此处).{0,5}(必须|应该|需要|应当)/,
  ];

  function sanitizeDirectiveText(text: string, fallback: string): string {
    if (!text) return fallback;
    let result = text;
    for (const pattern of directivePatterns) {
      if (pattern.test(result)) {
        result = result.replace(pattern, '').replace(/^[：，。\s]+/, '');
      }
    }
    if (
      result.length < 10 ||
      /需完整呈现|应分步展示|逻辑清晰|强调物理意义|面向学生|禁止混入|仅设计师|创作指引|设计说明/.test(
        result,
      )
    ) {
      result = fallback;
    }
    return result || fallback;
  }

  if (pageType === 'concept') {
    const cards = (content.cards as Array<{ title: string; desc: string }>) || [];
    for (const card of cards) {
      card.desc = sanitizeDirectiveText(
        card.desc,
        `${card.title}是本节的重要知识点，涉及核心概念的定义、原理机制及其在实际情境中的应用。理解这一知识点有助于建立完整的知识框架，为后续学习奠定基础。`,
      );
    }
    content.cards = cards;
  }

  if (pageType === 'case') {
    const scenarios = (content.scenarios as Array<{ problem: string; solution: string }>) || [];
    for (const s of scenarios) {
      s.problem = sanitizeDirectiveText(
        s.problem,
        '请结合本节所学知识，分析以下问题：某情境中出现了特定现象，需要运用相关原理进行解释和计算。',
      );
      s.solution = sanitizeDirectiveText(
        s.solution,
        '针对上述问题，首先明确已知条件和待求量，然后选择适当的公式或方法进行分析，最后给出完整的解答过程和结论。',
      );
    }
    content.scenarios = scenarios;
  }

  if (pageType === 'summary' && Array.isArray(content.keyPoints)) {
    content.keyPoints = (content.keyPoints as string[]).map((p) =>
      sanitizeDirectiveText(
        p,
        '本节核心内容要点，涵盖关键概念、重要原理及其应用场景，需要重点掌握。',
      ),
    );
  }

  // D. 专有名词拼写纠正（兜底修复）
  const TECH_SPELLING_FIXES: Record<string, string> = {
    Respons: 'Response',
    'Ollam ': 'Ollama ',
    'Ollam,': 'Ollama,',
    'Ollam.': 'Ollama.',
    'Ollam"': 'Ollama"',
    'Emb ': 'Embedding ',
    'Emb,': 'Embedding,',
    'Emb.': 'Embedding.',
    'Emb"': 'Embedding"',
  };
  function fixSpelling(text: string): string {
    let result = text;
    for (const [wrong, right] of Object.entries(TECH_SPELLING_FIXES)) {
      result = result.split(wrong).join(right);
    }
    return result;
  }
  if (typeof content.title === 'string') content.title = fixSpelling(content.title);
  if (typeof content.subtitle === 'string') content.subtitle = fixSpelling(content.subtitle);
  if (typeof content.summary === 'string') content.summary = fixSpelling(content.summary);
  if (typeof content.preview === 'string') content.preview = fixSpelling(content.preview);
  if (typeof content.slogan === 'string') content.slogan = fixSpelling(content.slogan);
  if (typeof content.highlight === 'string') content.highlight = fixSpelling(content.highlight);
  if (Array.isArray(content.keyPoints)) {
    content.keyPoints = (content.keyPoints as string[]).map(fixSpelling);
  }
  if (Array.isArray(content.cards)) {
    for (const card of content.cards as Array<{ title?: string; desc?: string }>) {
      if (typeof card.title === 'string') card.title = fixSpelling(card.title);
      if (typeof card.desc === 'string') card.desc = fixSpelling(card.desc);
    }
  }
  if (Array.isArray(content.steps)) {
    for (const step of content.steps as Array<{ title?: string; desc?: string }>) {
      if (typeof step.title === 'string') step.title = fixSpelling(step.title);
      if (typeof step.desc === 'string') step.desc = fixSpelling(step.desc);
    }
  }
  if (Array.isArray(content.scenarios)) {
    for (const s of content.scenarios as Array<{ problem?: string; solution?: string }>) {
      if (typeof s.problem === 'string') s.problem = fixSpelling(s.problem);
      if (typeof s.solution === 'string') s.solution = fixSpelling(s.solution);
    }
  }

  // E. 句子截断检测与修复
  const TRUNCATED_ENDINGS = /[奠为和是与在而但或虽则]$|[着了的吗呢吧]$|，$/;
  function fixTruncatedSentence(text: string): string {
    if (!text || typeof text !== 'string') return text;
    const trimmed = text.trim();
    // 如果以明显截断标志结尾，尝试补全常见表述
    if (/[奠]$/.test(trimmed)) return trimmed + '定基础';
    if (/[为]$/.test(trimmed) && !/成为|作为|因为|为了/.test(trimmed.slice(-4)))
      return trimmed + '生产级应用';
    if (/[在]$/.test(trimmed) && !/正在|存在|处在/.test(trimmed.slice(-4)))
      return trimmed + '实践中';
    if (/[和]$/.test(trimmed)) return trimmed + '优化';
    if (/[是]$/.test(trimmed) && !/可是|但是|还是|就是/.test(trimmed.slice(-4)))
      return trimmed + '企业级AI开发的重要工具';
    if (/[，,]$/.test(trimmed)) return trimmed.slice(0, -1) + '。';
    return text;
  }
  if (typeof content.subtitle === 'string')
    content.subtitle = fixTruncatedSentence(content.subtitle);
  if (typeof content.summary === 'string') content.summary = fixTruncatedSentence(content.summary);
  if (typeof content.preview === 'string') content.preview = fixTruncatedSentence(content.preview);
  if (typeof content.conclusion === 'string')
    content.conclusion = fixTruncatedSentence(content.conclusion);
  if (typeof content.highlight === 'string')
    content.highlight = fixTruncatedSentence(content.highlight);

  return content;
}

/**
 * Scan backwards from the error position to find an unescaped quote that
 * is likely inside a JSON string value, and escape it.  Used as a last-resort
 * repair when JSON.parse reports "Expected ',' or '}' after property value".
 */
function repairQuoteAtPos(text: string, errorPos: number): string {
  // Scan backwards from errorPos to find the nearest unescaped quote
  let escape = false;
  for (let i = errorPos - 1; i >= 0; i--) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\') {
      escape = true;
      continue;
    }
    if (c === '"') {
      // Found a candidate quote.  Check whether it looks like it ends a string
      // (next non-space char is a JSON delimiter) or is inside the string.
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      const next = text[j];
      if (!next || /[,:\}\]]/.test(next)) {
        // This quote legitimately ends a string; keep scanning backwards
        continue;
      }
      // This quote is inside a string value — escape it
      return text.slice(0, i) + '\\"' + text.slice(i + 1);
    }
  }
  return text;
}

// ── Public API ──────────────────────────────────────────────────────

export interface SectionResult {
  success: boolean;
  output?: SectionOutput;
  error?: string;
}

export async function generateSectionContent(
  section: SectionPlan,
  topic: string,
  difficulty: string,
  designDNA: DesignDNA,
  languageModel: LanguageModel,
  nextSectionTitle?: string,
  educationLevel?: string,
): Promise<SectionResult> {
  const pageTypes = section.pages.map((p) => p.type);
  const system = buildSystemPrompt(topic, difficulty, designDNA, pageTypes, educationLevel);
  const user = buildUserPrompt(section, topic, nextSectionTitle, educationLevel);

  log.info(
    `Generating content for section ${section.sectionId} (${section.pages.length} pages) [types: ${pageTypes.join(',')}]`,
  );

  // Validate function checks per-page schema correctness so callLLM retries
  // on actual content errors, not just format.
  const validateSectionOutput = (text: string): boolean => {
    const t = text.trim();
    const minLen = section.pages.length * 120 + 200;
    if (t.length <= minLen || !t.includes('pages') || !(t.endsWith('}') || t.endsWith('}]'))) {
      return false;
    }
    try {
      const parsed = JSON.parse(cleanJsonText(t));
      const pages = parsed.pages as Array<{ pageType: string; content: Record<string, unknown> }>;
      if (!Array.isArray(pages)) return false;
      if (pages.length !== section.pages.length) return false;
      return pages.every((page) => {
        const schema = CONTENT_SCHEMAS[page.pageType];
        if (!schema || !schema.safeParse(page.content).success) return false;

        const content = page.content;

        // 内容质量校验 A：概念卡片重复检测
        if (page.pageType === 'concept') {
          const cards = (content as { cards?: Array<{ desc?: string }> }).cards;
          if (cards && cards.length > 1) {
            const descs = cards.map((c) => c.desc?.trim()).filter(Boolean) as string[];
            if (new Set(descs).size < descs.length) return false;
          }
        }

        // 内容质量校验 B：公式缺失检测
        const contentStr = JSON.stringify(content);
        if (/反应式|方程式|公式|化学式|总反应|电极反应/.test(contentStr)) {
          const hasFormulas =
            Array.isArray(content.formulas) && (content.formulas as Array<unknown>).length > 0;
          const hasMainFormula =
            typeof (content as { mainFormula?: string }).mainFormula === 'string' &&
            (content as { mainFormula?: string }).mainFormula!.length > 0;
          if (!hasFormulas && !hasMainFormula) return false;
        }

        // 内容质量校验 C：创作指引混入检测
        const directivePatterns = [
          /^(必须|严禁|请|强调|展示|注意|要求|确保|需要|应当)/,
          /^(使用一个|激发|标题醒目|副标题可点明|需完整呈现|应分步|逻辑清晰|强调物理意义|面向学生|仅设计师可见|禁止混入|创作指引|设计说明)/,
        ];
        if (page.pageType === 'concept') {
          const cards = (content as { cards?: Array<{ desc?: string }> }).cards;
          if (cards?.some((c) => directivePatterns.some((p) => p.test(c.desc || '')))) return false;
        }
        if (page.pageType === 'case') {
          const scenarios = (
            content as { scenarios?: Array<{ problem?: string; solution?: string }> }
          ).scenarios;
          if (
            scenarios?.some((s) =>
              directivePatterns.some((p) => p.test(s.problem || '') || p.test(s.solution || '')),
            )
          )
            return false;
        }

        // 内容质量校验 D：内容密度检测（防止空洞页面）
        if (page.pageType === 'concept') {
          const cards = (content as { cards?: Array<{ desc?: string }> }).cards;
          if (!cards || cards.length < 3) return false;
          const totalDescLen = cards.reduce((sum, c) => sum + (c.desc?.length || 0), 0);
          if (totalDescLen < 120) return false;
          // 每个 card.desc 单独检查，防止一个很长其他很短
          const shortDescs = cards.filter((c) => (c.desc?.length || 0) < 30).length;
          if (shortDescs > 0) return false;
          const summary = (content as { summary?: string }).summary;
          if (!summary || summary.length < 30) return false;
        }
        if (page.pageType === 'summary') {
          const keyPoints = (content as { keyPoints?: string[] }).keyPoints;
          if (!keyPoints || keyPoints.length < 4) return false;
          const totalLen = keyPoints.reduce((sum, p) => sum + (p?.length || 0), 0);
          if (totalLen < 100) return false;
          const shortPoints = keyPoints.filter((p) => (p?.length || 0) < 20).length;
          if (shortPoints > 1) return false;
        }
        if (page.pageType === 'case') {
          const scenarios = (
            content as { scenarios?: Array<{ problem?: string; solution?: string }> }
          ).scenarios;
          if (!scenarios || scenarios.length === 0) return false;
          const totalLen = scenarios.reduce(
            (sum, s) => sum + (s.problem?.length || 0) + (s.solution?.length || 0),
            0,
          );
          if (totalLen < 80) return false;
          for (const s of scenarios) {
            if ((s.problem?.length || 0) < 30) return false;
            if ((s.solution?.length || 0) < 30) return false;
          }
        }
        if (page.pageType === 'process') {
          const steps = (content as { steps?: Array<{ desc?: string }> }).steps;
          if (!steps || steps.length < 3) return false;
          for (const s of steps) {
            if ((s.desc?.length || 0) < 30) return false;
          }
        }
        if (page.pageType === 'compare') {
          const left = (content as { left?: { title?: string; items?: string[] } }).left;
          const right = (content as { right?: { title?: string; items?: string[] } }).right;
          if (!left || !Array.isArray(left.items) || left.items.length < 3) return false;
          if (!right || !Array.isArray(right.items) || right.items.length < 3) return false;
          const leftShort = left.items.filter((item) => (item?.length || 0) < 15).length;
          const rightShort = right.items.filter((item) => (item?.length || 0) < 15).length;
          if (leftShort > 0 || rightShort > 0) return false;
          const conclusion = (content as { conclusion?: string }).conclusion;
          if (!conclusion || conclusion.length < 30) return false;
        }
        if (page.pageType === 'formula') {
          const derivation = (content as { derivation?: string }).derivation;
          if (!derivation || derivation.length < 50) return false;
        }
        if (page.pageType === 'timeline') {
          const events = (content as { events?: Array<{ content?: string }> }).events;
          if (!events || events.length < 3) return false;
          for (const e of events) {
            if ((e.content?.length || 0) < 20) return false;
          }
        }
        if (page.pageType === 'table') {
          const headers = (content as { headers?: unknown[] }).headers;
          const rows = (content as { rows?: unknown[] }).rows;
          if (!Array.isArray(headers) || headers.length === 0) return false;
          if (!Array.isArray(rows) || rows.length === 0) return false;
          // Quality check: each row must have same column count as headers
          const colCount = headers.length;
          for (const row of rows) {
            if (!Array.isArray(row)) return false;
            if (row.length !== colCount) return false;
            // Allow empty strings (will be rendered as '—'), but reject null/undefined cells
            for (const cell of row) {
              if (cell === null || cell === undefined) return false;
            }
          }
        }

        return true;
      });
    } catch (parseErr) {
      const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      const posMatch = errMsg.match(/position\s+(\d+)/i);
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        const ctx = t.slice(Math.max(0, pos - 30), Math.min(t.length, pos + 30));
        log.warn(`[validateSectionOutput] JSON parse failed at pos=${pos}: ...${ctx}...`);
      }
      return false;
    }
  };

  try {
    const result = await callLLM(
      {
        model: languageModel,
        system,
        prompt: user,
        maxOutputTokens: Math.min(8192, section.pages.length * 1800 + 600),
        temperature: 0.5,
      },
      `section-agent-${section.sectionId}`,
      { retries: 2, timeoutMs: 600_000, validate: validateSectionOutput },
      { mode: 'disabled', enabled: false },
    );

    let jsonText = cleanJsonText(result.text);
    let parsed: unknown;
    let lastParseErr: unknown = null;
    const MAX_REPAIR_ROUNDS = 5;

    for (let repairRound = 0; repairRound < MAX_REPAIR_ROUNDS; repairRound++) {
      try {
        parsed = JSON.parse(jsonText);
        if (repairRound > 0) {
          log.info(
            `Section ${section.sectionId} JSON parse succeeded after ${repairRound} repair round(s)`,
          );
        }
        break; // success
      } catch (parseErr) {
        lastParseErr = parseErr;
        const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        const posMatch = errMsg.match(/position\s+(\d+)/i);
        const pos = posMatch ? parseInt(posMatch[1], 10) : -1;

        if (pos <= 0 || pos >= jsonText.length) {
          // No position info or out of bounds — can't repair
          break;
        }

        const ctx = jsonText.slice(Math.max(0, pos - 40), Math.min(jsonText.length, pos + 40));
        log.warn(
          `Section ${section.sectionId} JSON parse failed at pos=${pos} (round ${repairRound + 1}). Context: ...${ctx}...`,
        );

        let repaired = false;

        // ── Strategy 1: unescaped quote just before error position ──
        if (jsonText[pos - 1] === '"') {
          const candidate = jsonText.slice(0, pos - 1) + '\\"' + jsonText.slice(pos);
          try {
            JSON.parse(candidate); // test only
            jsonText = candidate;
            log.info(
              `Section ${section.sectionId} JSON repaired by escaping quote at pos=${pos - 1} (round ${repairRound + 1})`,
            );
            repaired = true;
          } catch {
            // Try backward scan for the nearest unescaped quote
            const repaired2 = repairQuoteAtPos(jsonText, pos);
            try {
              JSON.parse(repaired2); // test only
              jsonText = repaired2;
              log.info(
                `Section ${section.sectionId} JSON repaired by backward quote scan (round ${repairRound + 1})`,
              );
              repaired = true;
            } catch {
              /* fall through */
            }
          }
        }

        // ── Strategy 2: wrong terminator (} vs ]) ──
        if (
          !repaired &&
          (errMsg.includes("Expected ',' or ']' after array element") ||
            errMsg.includes("Expected ',' or '}' after property value"))
        ) {
          if (errMsg.includes("Expected ',' or ']' after array element") && jsonText[pos] === '}') {
            const candidate = jsonText.slice(0, pos) + ']' + jsonText.slice(pos + 1);
            try {
              JSON.parse(candidate);
              jsonText = candidate;
              log.info(
                `Section ${section.sectionId} JSON repaired by replacing '}' with ']' at pos=${pos} (round ${repairRound + 1})`,
              );
              repaired = true;
            } catch {
              /* fall through */
            }
          }
          if (
            !repaired &&
            errMsg.includes("Expected ',' or '}' after property value") &&
            jsonText[pos] === ']'
          ) {
            const candidate = jsonText.slice(0, pos) + '}' + jsonText.slice(pos + 1);
            try {
              JSON.parse(candidate);
              jsonText = candidate;
              log.info(
                `Section ${section.sectionId} JSON repaired by replacing ']' with '}' at pos=${pos} (round ${repairRound + 1})`,
              );
              repaired = true;
            } catch {
              /* fall through */
            }
          }

          // ── Strategy 3: missing comma between values ──
          if (!repaired) {
            for (let i = pos - 1; i >= 0; i--) {
              if (jsonText[i] === '}' || jsonText[i] === ']' || jsonText[i] === '"') {
                const candidate = jsonText.slice(0, i + 1) + ',' + jsonText.slice(i + 1);
                try {
                  JSON.parse(candidate);
                  jsonText = candidate;
                  log.info(
                    `Section ${section.sectionId} JSON repaired by inserting comma at pos=${i + 1} (round ${repairRound + 1})`,
                  );
                  repaired = true;
                  break;
                } catch {
                  continue;
                }
              }
            }
          }
        }

        // ── Strategy 4: generic quote scan when error message suggests a string issue ──
        if (!repaired && errMsg.includes('Unexpected token') && jsonText[pos] === '"') {
          // An unexpected quote often means a missing comma before a new key
          const candidate = jsonText.slice(0, pos) + ',' + jsonText.slice(pos);
          try {
            JSON.parse(candidate);
            jsonText = candidate;
            log.info(
              `Section ${section.sectionId} JSON repaired by inserting comma before quote at pos=${pos} (round ${repairRound + 1})`,
            );
            repaired = true;
          } catch {
            /* fall through */
          }
        }

        if (!repaired) {
          log.warn(
            `Section ${section.sectionId} no viable repair strategy for pos=${pos}, giving up after ${repairRound + 1} round(s)`,
          );
          break; // Can't repair further
        }
        // If repaired, loop again to parse the patched text
      }
    }

    if (parsed === undefined) {
      const finalErr = lastParseErr instanceof Error ? lastParseErr.message : String(lastParseErr);
      log.error(
        `Section ${section.sectionId} JSON parse failed after all repair attempts: ${finalErr}`,
      );
      return {
        success: false,
        error: `Section ${section.sectionId} "${section.title}" failed: ${finalErr}`,
      };
    }
    const validated = sectionOutputSchema.safeParse(parsed);

    if (!validated.success) {
      log.error(`Section ${section.sectionId} output validation failed`);
      return { success: false, error: validated.error.message };
    }

    // ── Convert inline LaTeX to Unicode + post-process auto-fix ──
    for (const page of validated.data.pages) {
      page.content = convertContentLatex(page.content);
      page.content = postProcessContent(page.pageType, page.content);
    }

    // ── 全局 [Formula] 占位符最终清理（不可绕过的硬兜底）──
    const FORMULA_PH_RE = /^\s*[\[(【]\s*[Ff]ormula\s*[\])】]\s*$/;
    for (const page of validated.data.pages) {
      if (Array.isArray(page.content.formulas)) {
        const cleaned = (page.content.formulas as Array<{ label: string; latex: string }>)
          .map((f) =>
            FORMULA_PH_RE.test(f.latex) ? { ...f, latex: `\\text{${f.label || '公式'}}` } : f,
          )
          .filter((f) => !FORMULA_PH_RE.test(f.latex));
        if (cleaned.length > 0) {
          page.content.formulas = cleaned;
        } else {
          delete page.content.formulas;
        }
      }
      if (
        typeof page.content.mainFormula === 'string' &&
        FORMULA_PH_RE.test(page.content.mainFormula)
      ) {
        page.content.mainFormula = `\\text{${String(page.content.title || '主公式')}}`;
      }
    }

    // ── 硬修正：chapter 页面的 num 必须与 sectionId 对齐 ──
    const expectedNum = String(section.sectionId).padStart(2, '0');
    for (const page of validated.data.pages) {
      if (page.pageType === 'chapter') {
        const actualNum = (page.content as { num?: string }).num;
        if (actualNum !== expectedNum) {
          log.warn(
            `Section ${section.sectionId} Page ${page.pageNum} chapter num mismatch: "${actualNum}" → "${expectedNum}"`,
          );
          (page.content as { num: string }).num = expectedNum;
        }
      }
    }

    // ── 二次校验：强制兜底，确保公式不缺失 ──
    const formulaEligibleTypes = ['concept', 'case', 'formula', 'process'];
    for (const page of validated.data.pages) {
      if (!formulaEligibleTypes.includes(page.pageType)) {
        delete page.content.formulas;
        delete (page.content as Record<string, unknown>).mainFormula;
        continue;
      }
      const contentStr = JSON.stringify(page.content);
      if (
        /反应式|方程式|公式|化学式|总反应|电极反应|电势|能斯特|半反应|氧化还原|浓度商|吉布斯|自由能/.test(
          contentStr,
        )
      ) {
        const hasFormulas =
          Array.isArray(page.content.formulas) &&
          (page.content.formulas as Array<unknown>).length > 0;
        const hasMainFormula =
          typeof (page.content as { mainFormula?: string }).mainFormula === 'string' &&
          (page.content as { mainFormula?: string }).mainFormula!.length > 0;
        if (!hasFormulas && !hasMainFormula) {
          log.warn(
            `Section ${section.sectionId} Page ${page.pageNum} still missing formulas after postProcess, injecting placeholder`,
          );
          // Extract the most relevant text snippet as the formula placeholder
          const fallbackFormula =
            (page.content as { focus?: string; notes?: string }).focus ||
            (page.content as { focus?: string; notes?: string }).notes ||
            '\\text{待补充公式}';
          if (page.pageType === 'formula') {
            page.content.mainFormula = `\\text{${fallbackFormula.slice(0, 60)}}`;
            if (!page.content.derivation) page.content.derivation = '推导过程待补充。';
          } else {
            page.content.formulas = [
              { label: '相关方程式', latex: `\\text{${fallbackFormula.slice(0, 60)}}` },
            ];
          }
        }
      }
    }

    // ── Per-page content schema validation + auto-fix ──
    let fixCount = 0;
    for (const page of validated.data.pages) {
      const schema = CONTENT_SCHEMAS[page.pageType];
      if (!schema) {
        const errMsg = `Section ${section.sectionId} Page ${page.pageNum} unknown pageType: ${page.pageType}`;
        log.error(errMsg);
        return { success: false, error: errMsg };
      }
      const contentResult = schema.safeParse(page.content);
      if (!contentResult.success) {
        log.warn(
          `Section ${section.sectionId} Page ${page.pageNum} (${page.pageType}) content failed schema, auto-fixing`,
        );
        page.content = autoFixContent(page.pageType, page.content as Record<string, unknown>);
        fixCount++;
        // Re-validate after fix — if still failing, return error
        const reResult = schema.safeParse(page.content);
        if (!reResult.success) {
          const issues = reResult.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
          const errMsg = `Section ${section.sectionId} Page ${page.pageNum} (${page.pageType}) auto-fix failed: ${issues.slice(0, 200)}`;
          log.error(errMsg);
          return { success: false, error: errMsg };
        }
      }
    }
    if (fixCount > 0) {
      log.info(`Section ${section.sectionId}: auto-fixed ${fixCount} pages`);
    }

    return { success: true, output: validated.data };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const msg = rawMsg.includes('Failed to process successful response')
      ? 'LLM 响应处理失败（可能是响应过大或格式异常），请重试'
      : rawMsg.includes('timeout') || rawMsg.includes('超时')
        ? 'LLM 调用超时，请稍后重试'
        : /terminated|aborted|ECONNRESET|ETIMEDOUT/i.test(rawMsg)
          ? 'LLM 连接被中断（并发过高或网络波动），系统会自动重试'
          : rawMsg;
    log.error(`Section ${section.sectionId} failed: ${msg}`);
    return { success: false, error: msg };
  }
}
