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
import { SCHEMA_DESCRIPTIONS, CONTENT_SCHEMAS, autoFixContent, convertInlineLatexToUnicode, cleanJsonText, unicodeMathToLatex, extractFormulasFromText } from './content-schemas';

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

function buildSystemPrompt(
  topic: string,
  difficulty: string,
  designDNA: DesignDNA,
  pageTypes: string[],
): string {
  // Only inject schemas relevant to this section
  const relevantSchemas = [...new Set(pageTypes)]
    .filter((t) => SCHEMA_DESCRIPTIONS[t])
    .map((t) => `### ${t}\n${SCHEMA_DESCRIPTIONS[t]}`)
    .join('\n\n');

  return `## 角色
你是一位${difficulty}学科教师，正在编写"${topic}"课程的课件内容。

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
7. 匹配 ${difficulty} 学段难度
8. **公式输出规则（按页型区分）**
   - **formula 类型页面**（整页展示单一公式）：使用字段 mainFormula（主公式，LaTeX）、derivation（推导过程）、application（应用场景）。禁止输出 formulas 字段。
   - **concept / case / summary 类型页面**（概念讲解/案例/总结，附带辅助公式）：如需展示公式，使用 formulas 数组：[{ "label": "公式名≤20字", "latex": "LaTeX≤200字" }]。formulas 是可选字段，最多 3 条。
   - 当 focus 或 keyConcepts 中出现"反应式"、"方程式"、"公式"、"化学式"、"总反应"、"电极反应"等关键词时，必须在对应页面按上述规则输出完整 LaTeX 方程式。禁止只用文字描述代替公式。
9. **内容差异化规则**
   - concept 类型的 cards 中，每个 card.desc 必须围绕该 card.title 独立展开，内容不得与其他卡片重复
   - 若 keyConcepts 信息不足以支撑差异化，请基于 focus 和 title 进行合理推断和扩展
10. **chapter 页面规则**
    - chapter 类型的 subtitle 必须基于 contentOutline.focus（核心内容），面向学生输出
    - 严禁在 subtitle 中包含"创作指引""设计说明""章节封面页"等面向设计师的指令文本
11. **创作指引隔离规则（硬规则）**
    - contentOutline.notes 是创作指引，仅用于设计参考，严禁放入任何学生可见字段（如 card.desc、keyPoints、scenarios.problem/solution）
    - card.desc 必须面向学生，使用教学语气，禁止出现"必须展示""强调""请"等指令性词汇

## 内容质量要求
- 本章各页内容必须相互呼应，案例页的场景必须基于概念页的知识点
- 如内容超过字数上限，优先压缩核心信息，严禁简单截断导致语义不完整
- summary 页的要点必须覆盖本章所有核心内容，不得遗漏

## 输出格式
只输出纯 JSON：
{ "sectionId": number, "pages": [{ "pageNum": number, "pageType": "concept", "content": { ... } }] }`;
}

function buildUserPrompt(section: SectionPlan, topic: string): string {
  const pagesDesc = section.pages.map((p) => {
    const concepts = p.contentOutline.keyConcepts?.length
      ? `\n    - keyConcepts: ${p.contentOutline.keyConcepts.join(' / ')}`
      : '';
    const notes = p.contentOutline.notes
      ? `\n    - notes: [创作指引，仅设计师可见，禁止混入正文] ${p.contentOutline.notes}`
      : '';
    return `- Page ${p.pageNum} [${p.type}]: "${p.title}"\n    - focus: ${p.contentOutline.focus}${concepts}${notes}`;
  }).join('\n\n');

  return `主题：${topic}
章节：${section.title}（共 ${section.pages.length} 页）

## 本章大纲
${pagesDesc}

请逐页生成完整内容JSON。`;
}

// ── Formula Extraction Helpers ──────────────────────────────────────

/** Convert Unicode math symbols back to LaTeX commands. */
function unicodeMathToLatex(text: string): string {
  let result = text;

  // Unicode superscripts → LaTeX ^
  const superMap: Record<string, string> = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5',
    '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-',
  };
  const subMap: Record<string, string> = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5',
    '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  };

  result = result.replace(/([A-Za-z)])([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+)/g, (_, base: string, sup: string) => {
    const digits = sup.split('').map((c: string) => superMap[c] || c).join('');
    return `${base}^{${digits}}`;
  });

  result = result.replace(/([A-Za-z)])([₀₁₂₃₄₅₆₇₈₉]+)/g, (_, base: string, sub: string) => {
    const digits = sub.split('').map((c: string) => subMap[c] || c).join('');
    return `${base}_{${digits}}`;
  });

  // Arrows
  result = result.replace(/→/g, ' \\rightarrow ');
  result = result.replace(/←/g, ' \\leftarrow ');
  result = result.replace(/⇌/g, ' \\rightleftharpoons ');
  result = result.replace(/↔/g, ' \\leftrightarrow ');

  // Greek letters
  const greekMap: Record<string, string> = {
    'Δ': '\\Delta', 'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma',
    'δ': '\\delta', 'ε': '\\epsilon', 'ζ': '\\zeta', 'η': '\\eta',
    'θ': '\\theta', 'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda',
    'μ': '\\mu', 'ν': '\\nu', 'ξ': '\\xi', 'π': '\\pi', 'ρ': '\\rho',
    'σ': '\\sigma', 'τ': '\\tau', 'υ': '\\upsilon', 'φ': '\\phi',
    'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega', 'Γ': '\\Gamma',
    'Θ': '\\Theta', 'Λ': '\\Lambda', 'Σ': '\\Sigma', 'Φ': '\\Phi',
    'Ψ': '\\Psi', 'Ω': '\\Omega',
  };
  for (const [u, l] of Object.entries(greekMap)) {
    result = result.split(u).join(` ${l} `);
  }

  // Degree
  result = result.replace(/°C/g, '^\\circ \\text{C}');
  result = result.replace(/°/g, '^\\circ');

  // Collapse spaces
  result = result.replace(/\s+/g, ' ').trim();
  return result;
}

/** Extract mathematical/chemical formula fragments from plain text. */
function extractFormulasFromText(text: string): string[] {
  if (!text || text.length < 3) return [];
  const formulas: string[] = [];

  // Pattern 1: expressions with = or arrows
  const eqPattern = /[A-Za-z0-9Δαβγδεζηθικλμνξπρστυφχψω⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉⁺⁻]+[^。，；\n]{0,100}[=→←⇌↔][^。，；\n]{0,100}[A-Za-z0-9Δαβγδεζηθικλμνξπρστυφχψω⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉⁺⁻]+/g;
  const eqMatches = text.match(eqPattern);
  if (eqMatches) {
    for (const m of eqMatches) {
      const latex = unicodeMathToLatex(m.trim());
      if (latex.length > 3 && latex.length < 200) formulas.push(latex);
    }
  }

  // Pattern 2: math functions (ln, lg, log)
  const funcPattern = /(?:ln|lg|log|exp|sin|cos|tan)[\s(][A-Za-z0-9Δ^{}_[\]+\\\-\/\s]{2,60}/g;
  const funcMatches = text.match(funcPattern);
  if (funcMatches) {
    for (const m of funcMatches) {
      const latex = unicodeMathToLatex(m.trim());
      if (latex.length > 3 && latex.length < 200 && !formulas.includes(latex)) formulas.push(latex);
    }
  }

  return [...new Set(formulas)];
}

// ── JSON Cleanup ────────────────────────────────────────────────────

/** Recursively convert inline LaTeX ($...$) in content object to Unicode.
 *  IMPORTANT: preserves formulas[].latex as raw LaTeX for downstream addFormula.
 */
function convertContentLatex(content: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content)) {
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

function postProcessContent(
  pageType: string,
  content: Record<string, unknown>,
): Record<string, unknown> {
  // A. 概念卡片重复自动修复
  if (pageType === 'concept') {
    const cards = (content.cards as Array<{ title: string; desc: string }>) || [];
    if (cards.length > 1) {
      const descs = cards.map((c) => c.desc?.trim());
      for (let i = 0; i < cards.length; i++) {
        const sameCount = descs.filter((d) => d === descs[i]).length;
        if (sameCount > 1) {
          cards[i].desc = `${cards[i].title}：${cards[i].desc}`;
        }
      }
      content.cards = cards;
    }
  }

  // B. 公式缺失自动修复：智能从全量文本中提取并转换
  const contentStr = JSON.stringify(content);
  if (/反应式|方程式|公式|化学式|总反应|电极反应|电势|能斯特|半反应|氧化还原|浓度商|吉布斯|自由能/.test(contentStr)) {
    const hasFormulas = Array.isArray(content.formulas) && (content.formulas as Array<unknown>).length > 0;
    const hasMainFormula = typeof (content as { mainFormula?: string }).mainFormula === 'string' && (content as { mainFormula?: string }).mainFormula!.length > 0;
    if (!hasFormulas && !hasMainFormula) {
      const formulas: Array<{ label: string; latex: string }> = [];

      if (pageType === 'concept' && Array.isArray(content.cards)) {
        for (const card of content.cards as Array<{ title: string; desc: string }>) {
          const titleHasFormulaKw = /反应式|方程式|公式|化学式|总反应|电极反应|电势|能斯特/.test(card.title);
          const descHasMath = /[=→←⇌↔][^。，]{3,60}/.test(card.desc || '') || /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻₀₁₂₃₄₅₆₇₈₉][A-Za-z]|[A-Za-z][⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻₀₁₂₃₄₅₆₇₈₉]/.test(card.desc || '');

          if (titleHasFormulaKw) {
            const extracted = extractFormulasFromText(card.desc || '');
            if (extracted.length > 0) {
              formulas.push({ label: card.title, latex: extracted[0] });
            } else {
              formulas.push({ label: card.title, latex: `\\text{${card.title}（详见教材）}` });
            }
          } else if (descHasMath) {
            const extracted = extractFormulasFromText(card.desc || '');
            for (const latex of extracted.slice(0, 1)) {
              formulas.push({ label: card.title || '相关公式', latex });
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
        for (const point of content.keyPoints as string[]) {
          const extracted = extractFormulasFromText(point);
          for (const latex of extracted.slice(0, 1)) {
            formulas.push({ label: '核心公式', latex });
          }
        }
      }

      if (pageType === 'formula') {
        if (!content.mainFormula || typeof content.mainFormula !== 'string' || (content.mainFormula as string).length === 0) {
          content.mainFormula = '\\text{公式内容详见教材}';
        }
        if (!content.derivation || typeof content.derivation !== 'string' || (content.derivation as string).length === 0) {
          content.derivation = '推导过程详见教材。';
        }
      }

      const uniqueFormulas = formulas.filter((f, i, arr) =>
        arr.findIndex((x) => x.latex === f.latex) === i
      ).slice(0, 3);

      if (uniqueFormulas.length > 0) {
        content.formulas = uniqueFormulas;
      }
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
    if (result.length < 10 || /需完整呈现|应分步展示|逻辑清晰|强调物理意义|面向学生|禁止混入|仅设计师|创作指引|设计说明/.test(result)) {
      result = fallback;
    }
    return result || fallback;
  }

  if (pageType === 'concept') {
    const cards = (content.cards as Array<{ title: string; desc: string }>) || [];
    for (const card of cards) {
      card.desc = sanitizeDirectiveText(card.desc, `${card.title}是本节的重要知识点，具体原理与机制详见教材相关章节。`);
    }
    content.cards = cards;
  }

  if (pageType === 'case') {
    const scenarios = (content.scenarios as Array<{ problem: string; solution: string }>) || [];
    for (const s of scenarios) {
      s.problem = sanitizeDirectiveText(s.problem, '请分析以下化学问题。');
      s.solution = sanitizeDirectiveText(s.solution, '解题思路详见教材。');
    }
    content.scenarios = scenarios;
  }

  if (pageType === 'summary' && Array.isArray(content.keyPoints)) {
    content.keyPoints = (content.keyPoints as string[]).map((p) =>
      sanitizeDirectiveText(p, '本节核心内容要点。')
    );
  }

  return content;
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
): Promise<SectionResult> {
  const pageTypes = section.pages.map((p) => p.type);
  const system = buildSystemPrompt(topic, difficulty, designDNA, pageTypes);
  const user = buildUserPrompt(section, topic);

  log.info(`Generating content for section ${section.sectionId} (${section.pages.length} pages) [types: ${pageTypes.join(',')}]`);

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
          const hasFormulas = Array.isArray(content.formulas) && (content.formulas as Array<unknown>).length > 0;
          const hasMainFormula = typeof (content as { mainFormula?: string }).mainFormula === 'string' && (content as { mainFormula?: string }).mainFormula!.length > 0;
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
          const scenarios = (content as { scenarios?: Array<{ problem?: string; solution?: string }> }).scenarios;
          if (scenarios?.some((s) => directivePatterns.some((p) => p.test(s.problem || '') || p.test(s.solution || '')))) return false;
        }

        return true;
      });
    } catch {
      return false;
    }
  };

  try {
    const result = await callLLM(
      { model: languageModel, system, prompt: user, maxOutputTokens: Math.min(12288, section.pages.length * 1800 + 400), temperature: 0.3 },
      `section-agent-${section.sectionId}`,
      { retries: 2, timeoutMs: 180_000, validate: validateSectionOutput },
      { mode: 'disabled', enabled: false },
    );

    const jsonText = cleanJsonText(result.text);
    const parsed = JSON.parse(jsonText);
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

    // ── 二次校验：强制兜底，确保公式不缺失 ──
    for (const page of validated.data.pages) {
      const contentStr = JSON.stringify(page.content);
      if (/反应式|方程式|公式|化学式|总反应|电极反应|电势|能斯特|半反应|氧化还原|浓度商|吉布斯|自由能/.test(contentStr)) {
        const hasFormulas = Array.isArray(page.content.formulas) && (page.content.formulas as Array<unknown>).length > 0;
        const hasMainFormula = typeof (page.content as { mainFormula?: string }).mainFormula === 'string' && (page.content as { mainFormula?: string }).mainFormula!.length > 0;
        if (!hasFormulas && !hasMainFormula) {
          log.warn(`Section ${section.sectionId} Page ${page.pageNum} still missing formulas after postProcess, injecting fallback`);
          if (page.pageType === 'formula') {
            page.content.mainFormula = '\\text{公式内容详见教材}';
            if (!page.content.derivation) page.content.derivation = '推导过程详见教材。';
          } else {
            page.content.formulas = [{ label: '相关方程式', latex: '\\text{详见教材}' }];
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
        log.warn(`Section ${section.sectionId} Page ${page.pageNum} (${page.pageType}) content failed schema, auto-fixing`);
        page.content = autoFixContent(page.pageType, page.content as Record<string, unknown>);
        fixCount++;
        // Re-validate after fix — if still failing, return error
        const reResult = schema.safeParse(page.content);
        if (!reResult.success) {
          const errMsg = `Section ${section.sectionId} Page ${page.pageNum} auto-fix failed: ${reResult.error.message.slice(0, 120)}`;
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
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Section ${section.sectionId} failed: ${msg}`);
    return { success: false, error: msg };
  }
}
