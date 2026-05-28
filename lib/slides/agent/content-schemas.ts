/**
 * Content Schemas — strict Zod definitions for every page type.
 *
 * Each pageType has a content schema that defines:
 *   1. Required fields + their types
 *   2. String length limits (to prevent overflow)
 *   3. Array size limits (to match template capacity)
 *
 * Section Agent output is validated against these schemas.
 * Failed pages are auto-repaired (truncate / fill defaults).
 */
import { z } from 'zod';

// ── Utility: truncate string to max length ────────────────────────

function trunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

// ── Individual Page Schemas ───────────────────────────────────────

export const coverContentSchema = z.object({
  title: z.string().min(1).max(12),
  subtitle: z.string().min(1).max(25),
  tagline: z.string().max(30).optional(),
});

export const tocContentSchema = z.object({
  title: z.string().max(10),
  items: z.array(z.object({
    num: z.string().max(3),
    title: z.string().max(8),
    desc: z.string().max(20),
  })).min(2).max(6),
});

export const endContentSchema = z.object({
  slogan: z.string().min(1).max(15),
  subtitle: z.string().min(1).max(30),
  thanks: z.string().max(20).optional(),
});

export const chapterContentSchema = z.object({
  num: z.string().max(4),
  title: z.string().min(1).max(12),
  subtitle: z.string().max(25),
  preview: z.string().max(60).optional(),
});

export const conceptContentSchema = z.object({
  title: z.string().min(2).max(12),
  cards: z.array(z.object({
    title: z.string().min(1).max(8),
    desc: z.string().min(5).max(100),
  })).min(2).max(6),
  summary: z.string().min(5).max(120),
});

export const caseContentSchema = z.object({
  title: z.string().min(2).max(12),
  scenarios: z.array(z.object({
    problem: z.string().min(5).max(250),
    solution: z.string().min(5).max(250),
  })).min(1).max(3),
  highlight: z.string().max(40).optional(),
});

export const compareContentSchema = z.object({
  title: z.string().min(2).max(12),
  left: z.object({
    title: z.string().max(10),
    items: z.array(z.string().max(60)).min(1).max(6),
  }),
  right: z.object({
    title: z.string().max(10),
    items: z.array(z.string().max(60)).min(1).max(6),
  }),
  conclusion: z.string().min(5).max(120),
});

export const processContentSchema = z.object({
  title: z.string().min(2).max(12),
  steps: z.array(z.object({
    num: z.string().max(3),
    title: z.string().max(10),
    desc: z.string().min(5).max(120),
  })).min(2).max(8),
});

export const tableContentSchema = z.object({
  title: z.string().min(2).max(15),
  headers: z.array(z.string().max(15)).min(2).max(6),
  rows: z.array(z.array(z.string().max(40))).min(1).max(8),
  summary: z.string().min(5).max(100),
});

export const formulaContentSchema = z.object({
  title: z.string().min(2).max(15),
  mainFormula: z.string().min(1).max(200),
  derivation: z.string().min(5).max(300),
  application: z.string().max(200).optional(),
});

export const timelineContentSchema = z.object({
  title: z.string().min(2).max(12),
  events: z.array(z.object({
    date: z.string().max(20),
    content: z.string().min(3).max(80),
  })).min(2).max(8),
});

export const summaryContentSchema = z.object({
  title: z.string().max(12),
  keyPoints: z.array(z.string().min(2).max(80)).min(1).max(6),
  preview: z.string().max(60).optional(),
});

export const quizContentSchema = z.object({
  title: z.string().min(2).max(12),
  questions: z.array(z.object({
    q: z.string().min(5).max(150),
    options: z.array(z.string().max(80)).min(2).max(6),
    answer: z.string().max(2),
  })).min(1).max(5),
});

// ── Schema Registry ───────────────────────────────────────────────

export const CONTENT_SCHEMAS: Record<string, z.ZodTypeAny> = {
  cover: coverContentSchema,
  toc: tocContentSchema,
  end: endContentSchema,
  chapter: chapterContentSchema,
  concept: conceptContentSchema,
  case: caseContentSchema,
  compare: compareContentSchema,
  process: processContentSchema,
  table: tableContentSchema,
  formula: formulaContentSchema,
  timeline: timelineContentSchema,
  summary: summaryContentSchema,
  quiz: quizContentSchema,
  // content is a generic fallback that accepts any object
  content: z.object({}).passthrough(),
};

// ── Auto-Repair ────────────────────────────────────────────────────

/**
 * Try to fix content that failed schema validation.
 * Strategy: truncate strings, fill missing fields with defaults, drop excess array items.
 * Returns the repaired content (may still not pass — caller should check again).
 */
export function autoFixContent(
  pageType: string,
  content: Record<string, unknown>,
): Record<string, unknown> {
  const schema = CONTENT_SCHEMAS[pageType];
  if (!schema) return content;

  // Try parse first — if it passes, no fix needed
  const result = schema.safeParse(content);
  if (result.success) return content;

  // Simple heuristics: truncate known string fields, cap arrays
  const fixed = { ...content } as Record<string, unknown>;

  // Fix common fields — truncation limits MUST align with Zod schema max
  if (typeof fixed.title === 'string') fixed.title = trunc(fixed.title, 12);
  if (typeof fixed.summary === 'string') fixed.summary = trunc(fixed.summary, 120);
  if (typeof fixed.subtitle === 'string') fixed.subtitle = trunc(fixed.subtitle, 25);
  if (typeof fixed.slogan === 'string') fixed.slogan = trunc(fixed.slogan, 15);
  if (typeof fixed.highlight === 'string') fixed.highlight = trunc(fixed.highlight, 40);
  if (typeof fixed.preview === 'string') fixed.preview = trunc(fixed.preview, 60);
  if (typeof fixed.derivation === 'string') fixed.derivation = trunc(fixed.derivation, 300);
  if (typeof fixed.application === 'string') fixed.application = trunc(fixed.application, 200);
  if (typeof fixed.mainFormula === 'string') fixed.mainFormula = trunc(fixed.mainFormula, 200);

  // Fix arrays: cap at max
  const arrayCaps: Record<string, number> = { cards: 6, items: 6, scenarios: 3, steps: 8, rows: 8, questions: 5, events: 8, keyPoints: 6, options: 6 };
  for (const [key, cap] of Object.entries(arrayCaps)) {
    if (Array.isArray(fixed[key])) {
      fixed[key] = (fixed[key] as unknown[]).slice(0, cap).map((item: unknown) => {
        if (typeof item === 'object' && item !== null) {
          const obj = { ...item as Record<string, unknown> };
          if (typeof obj.title === 'string') obj.title = trunc(obj.title, 8);
          if (typeof obj.desc === 'string') obj.desc = trunc(obj.desc, 100);
          if (typeof obj.problem === 'string') obj.problem = trunc(obj.problem, 250);
          if (typeof obj.solution === 'string') obj.solution = trunc(obj.solution, 250);
          if (typeof obj.content === 'string') obj.content = trunc(obj.content, 80);
          if (typeof obj.date === 'string') obj.date = trunc(obj.date, 20);
          if (typeof obj.q === 'string') obj.q = trunc(obj.q, 150);
          return obj;
        }
        return typeof item === 'string' ? trunc(item, 80) : item;
      });
    }
  }

  // Fix nested objects
  if (fixed.left && typeof fixed.left === 'object') {
    const l = fixed.left as Record<string, unknown>;
    if (Array.isArray(l.items)) l.items = (l.items as string[]).map((s) => trunc(s, 60)).slice(0, 6);
    if (typeof l.title === 'string') l.title = trunc(l.title, 10);
  }
  if (fixed.right && typeof fixed.right === 'object') {
    const r = fixed.right as Record<string, unknown>;
    if (Array.isArray(r.items)) r.items = (r.items as string[]).map((s) => trunc(s, 60)).slice(0, 6);
    if (typeof r.title === 'string') r.title = trunc(r.title, 10);
  }

  // Fill missing required fields with defaults
  if (!fixed.title) fixed.title = '本节内容';
  if (pageType === 'concept' && (!fixed.summary || typeof fixed.summary !== 'string')) fixed.summary = '核心要点总结';
  if (pageType === 'case' && !fixed.highlight) fixed.highlight = '';
  if (pageType === 'compare' && (!fixed.conclusion || typeof fixed.conclusion !== 'string')) fixed.conclusion = '以上对比展示了两个概念的核心差异。';
  if (pageType === 'table' && !Array.isArray(fixed.headers)) fixed.headers = ['项目', '说明'];
  if (pageType === 'table' && !Array.isArray(fixed.rows)) fixed.rows = [['—', '—']];
  if (pageType === 'formula' && !fixed.derivation) fixed.derivation = '推导过程详见教材。';
  if (pageType === 'summary' && !Array.isArray(fixed.keyPoints)) fixed.keyPoints = ['本节核心内容'];
  if (pageType === 'end' && !fixed.slogan) fixed.slogan = '谢谢';

  return fixed;
}

// ── Inline LaTeX → Unicode Conversion ──────────────────────────────

/** Convert inline $...$ LaTeX to Unicode. Block formulas $$...$$ are left as-is for addFormula. */
export function convertInlineLatexToUnicode(text: string): string {
  // ── Inline LaTeX → Unicode ──────────────────────────────────────────
  // Applies in order: longer patterns first to avoid partial matches.
  // Each rule strips the $ delimiters and replaces with Unicode chars.
  //
  // LLMs output superscript charges in several formats:
  //   $Na^+$  $Na^\+$  $Na^{+}$  $Ca^{2+}$
  // We handle all variants with flexible patterns.

  // Unicode digit maps
  const subDigits: Record<string, string> = { '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉' };
  const superDigits: Record<string, string> = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹' };

  let result = text;

  // ── Phase 1: Named chemical patterns ──
  const namedRules: [RegExp, string][] = [
    // Superscript charges (flexible: opt braces, opt backslash before +)
    [/\$Ca\^\{2\+?\}\$/gi, 'Ca²⁺'],
    [/\$Mg\^\{2\+?\}\$/gi, 'Mg²⁺'],
    [/\$Na\^(\{\+?\}|\+?\\?\+)\$/gi, 'Na⁺'],
    [/\$K\^(\{\+?\}|\+?\\?\+)\$/gi, 'K⁺'],
    [/\$H\^(\{\+?\}|\+?\\?\+)\$/gi, 'H⁺'],
    [/\$NADP\^(\{\+?\}|\+?\\?\+)\$/gi, 'NADP⁺'],
    [/\$NAD\^(\{\+?\}|\+?\\?\+)\$/gi, 'NAD⁺'],
    [/\$Cl\^(\{-?\}|-)\$/gi, 'Cl⁻'],
    [/\$OH\^(\{-?\}|-)\$/gi, 'OH⁻'],
    [/\$e\^(\{-?\}|-)\$/gi, 'e⁻'],
    // Subscript formulas
    [/\$C_6H_\{12\}O_6\$/gi, 'C₆H₁₂O₆'],
    [/\$CO_2\$/gi, 'CO₂'],
    [/\$H_2O_2\$/gi, 'H₂O₂'],
    [/\$H_2O\$/gi, 'H₂O'],
    [/\$H_2S\$/gi, 'H₂S'],
    [/\$NO_2\$/gi, 'NO₂'],
    [/\$SO_2\$/gi, 'SO₂'],
    [/\$NH_3\$/gi, 'NH₃'],
    [/\$CH_4\$/gi, 'CH₄'],
    [/\$O_2\$/gi, 'O₂'],
    [/\$N_2\$/gi, 'N₂'],
    [/\$H_2\$/gi, 'H₂'],
    [/\$Cl_2\$/gi, 'Cl₂'],
    [/\$CO\$/gi, 'CO'],
    [/\$NO\$/gi, 'NO'],
    // Plain biochemical terms (no super/subscript)
    [/\$ADP\$/gi, 'ADP'],
    [/\$ATP\$/gi, 'ATP'],
    [/\$NADPH\$/gi, 'NADPH'],
    [/\$RuBisCO\$/gi, 'RuBisCO'],
    [/\$RuBP\$/gi, 'RuBP'],
    [/\$PEPC\$/gi, 'PEPC'],
    [/\$PEP\$/gi, 'PEP'],
    [/\$G3P\$/gi, 'G3P'],
    [/\$3-PGA\$/gi, '3-PGA'],
    // LaTeX command → text (e.g. \alpha → α)
    [/\$\\([A-Za-z0-9]+)\\$/g, '$1'],
  ];
  for (const [pattern, replacement] of namedRules) {
    result = result.replace(pattern, replacement);
  }

  // ── Phase 2: Generic single-element subscript $X_n$ → Xₙ ──
  // Only matches simple patterns (no operators inside), e.g. $C_3$, $P_i$
  result = result.replace(
    /\$([A-Z][a-z]?)_(\d+)\$/g,
    (_, el: string, num: string) => el + num.split('').map((d: string) => subDigits[d] || d).join(''),
  );

  // ── Phase 3: Generic single-element superscript $X^n$ → Xⁿ ──
  // e.g. $C^{14}$ → C¹⁴ (radioactive isotope notation)
  result = result.replace(
    /\$([A-Z][a-z]?)\^\{(\d+)\}\$/g,
    (_, el: string, num: string) => el + num.split('').map((d: string) => superDigits[d] || d).join(''),
  );

  // ── Phase 4: Remaining simple inline $...$ — convert sub/sup inside ──
  // Handles edge cases like $(CH_2O)$, $HCO_3^-$, etc.
  // Only processes $...$ blocks with NO math operators (+, =, -, >, \, etc.)
  result = result.replace(
    /\$([^$+\-=>\\/\s]{1,40})\$/g,
    (_, inner: string) => {
      // Convert _n → subscript unicode
      let s = inner.replace(/_(\d+)/g, (_m: string, num: string) =>
        num.split('').map((d: string) => subDigits[d] || d).join(''),
      );
      // Convert ^{n} → superscript unicode
      s = s.replace(/\^\{(\d+)\}/g, (_m: string, num: string) =>
        num.split('').map((d: string) => superDigits[d] || d).join(''),
      );
      // Convert ^+ / ^- → superscript unicode
      s = s.replace(/\^(-|\+)/g, (_m: string, ch: string) => ch === '+' ? '⁺' : '⁻');
      return s;
    },
  );

  return result;
}

// ── Schema Description for LLM Prompt ──────────────────────────────

/** Human-readable schema descriptions for prompt injection. */
export const SCHEMA_DESCRIPTIONS: Record<string, string> = {
  cover: `{ "title": "大标题≤12字", "subtitle": "副标题≤25字", "tagline": "英文标签≤30字母" }`,
  toc: `{ "title": "目录", "items": [{ "num":"01", "title":"章节≤8字", "desc":"描述≤20字" }], 2-6项 }`,
  end: `{ "slogan": "结束语≤15字", "subtitle": "副标语≤30字", "thanks": "感谢语≤20字" }`,
  chapter: `{ "num": "01", "title": "章节标题≤12字", "subtitle": "副标题≤25字", "preview": "预习提示≤60字" }`,
  concept: `{ "title": "标题≤12字", "cards": [{ "title":"≤8字", "desc":"≤100字" }], 2-6个卡片, "summary": "总结≤120字" }`,
  case: `{ "title": "标题≤12字", "scenarios": [{ "problem":"题目≤250字", "solution":"解答≤250字" }], 1-3个案例, "highlight": "关键句≤40字" }`,
  compare: `{ "title": "标题≤12字", "left":{ "title":"≤10字", "items":["≤60字"] }, "right":{ "title":"≤10字", "items":["≤60字"] }, "conclusion": "结论≤120字" }`,
  process: `{ "title": "标题≤12字", "steps": [{ "num":"1", "title":"≤10字", "desc":"≤120字" }], 2-8步 }`,
  table: `{ "title": "标题≤15字", "headers": ["≤15字"], 2-6列, "rows": [["≤40字"]], 1-8行, "summary": "总结≤100字" }`,
  formula: `{ "title": "标题≤15字", "mainFormula": "LaTeX≤200字", "derivation": "推导≤300字", "application": "应用≤200字" }`,
  timeline: `{ "title": "标题≤12字", "events": [{ "date":"≤20字", "content":"≤80字" }], 2-8项 }`,
  summary: `{ "title": "标题≤12字", "keyPoints": ["≤80字"], 1-6个要点, "preview": "预览≤60字" }`,
  quiz: `{ "title": "标题≤12字", "questions": [{ "q":"题目≤150字", "options":["≤80字"], 2-6选项, "answer":"答案≤2字" }], 1-5题 }`,
};
