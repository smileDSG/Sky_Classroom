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
  return Array.from(s).length > max ? Array.from(s).slice(0, max).join('') : s;
}

// ── Individual Page Schemas ───────────────────────────────────────

export const coverContentSchema = z.object({
  title: z.string().min(1).max(28),
  subtitle: z.string().min(1).max(50),
  tagline: z.string().max(60).optional(),
});

export const tocContentSchema = z.object({
  title: z.string().max(15),
  items: z
    .array(
      z.object({
        num: z.string().max(4),
        title: z.string().max(15),
        desc: z.string().max(30),
      }),
    )
    .min(2)
    .max(6),
});

export const endContentSchema = z.object({
  slogan: z.string().min(1).max(28),
  subtitle: z.string().min(1).max(40),
  thanks: z.string().max(25).optional(),
});

export const chapterContentSchema = z.object({
  num: z.string().max(4),
  title: z.string().min(1).max(28),
  subtitle: z.string().max(80),
});

export const formulaItemSchema = z.object({
  label: z.string().min(1).max(20),
  latex: z.string().min(1).max(200),
});

export const conceptContentSchema = z.object({
  title: z.string().min(1).max(25),
  cards: z
    .array(
      z.object({
        title: z.string().min(1).max(28),
        desc: z.string().min(1).max(200),
      }),
    )
    .min(1)
    .max(6),
  formulas: z.array(formulaItemSchema).max(3).optional(),
  summary: z.string().min(1).max(150),
});

export const caseContentSchema = z.object({
  title: z.string().min(1).max(25),
  scenarios: z
    .array(
      z.object({
        problem: z.string().min(1).max(400),
        solution: z.string().min(1).max(400),
      }),
    )
    .min(1)
    .max(3),
  formulas: z.array(formulaItemSchema).max(3).optional(),
  highlight: z.string().max(60).optional(),
});

export const compareContentSchema = z.object({
  title: z.string().min(1).max(28),
  left: z.object({
    title: z.string().max(15),
    items: z.array(z.string().max(100)).min(1).max(6),
  }),
  right: z.object({
    title: z.string().max(15),
    items: z.array(z.string().max(100)).min(1).max(6),
  }),
  conclusion: z.string().min(1).max(150),
});

export const processContentSchema = z.object({
  title: z.string().min(1).max(25),
  steps: z
    .array(
      z.object({
        num: z.string().max(5),
        title: z.string().max(25),
        desc: z.string().min(1).max(200),
      }),
    )
    .min(1)
    .max(8),
});

export const tableContentSchema = z.object({
  title: z.string().min(1).max(25),
  headers: z.array(z.string().max(20)).min(1).max(6),
  rows: z
    .array(z.array(z.string().max(120)))
    .min(1)
    .max(8),
  summary: z.string().min(1).max(150),
});

export const formulaContentSchema = z.object({
  title: z.string().min(1).max(25),
  mainFormula: z.string().min(1).max(300),
  derivation: z.string().min(1).max(400),
  application: z.string().max(300).optional(),
});

export const timelineContentSchema = z.object({
  title: z.string().min(1).max(28),
  events: z
    .array(
      z.object({
        date: z.string().max(25),
        content: z.string().min(1).max(120),
      }),
    )
    .min(1)
    .max(8),
});

export const summaryContentSchema = z.object({
  title: z.string().max(28),
  keyPoints: z.array(z.string().min(1).max(120)).min(1).max(6),
  formulas: z.array(formulaItemSchema).max(3).optional(),
  preview: z.string().max(80).optional(),
});

export const quizContentSchema = z.object({
  title: z.string().min(1).max(25),
  questions: z
    .array(
      z.object({
        q: z.string().min(1).max(200),
        options: z.array(z.string().max(100)).min(2).max(6),
        answer: z.string().max(2),
      }),
    )
    .min(1)
    .max(5),
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
  // No generic fallback — unknown pageTypes fail validation explicitly
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

  // Try parse first — if it passes, return stripped result (removes extra fields LLM may have added)
  const result = schema.safeParse(content);
  if (result.success) return result.data as Record<string, unknown>;

  // Deep repair: type coercion + structure normalization + truncation
  let fixed = deepRepairContent(pageType, content);

  // Fill missing required fields with defaults
  if (!fixed.title || typeof fixed.title !== 'string') fixed.title = '本节内容';
  if (pageType === 'concept' && (!fixed.summary || typeof fixed.summary !== 'string'))
    fixed.summary = '核心要点总结';
  if (pageType === 'case' && !fixed.highlight) fixed.highlight = '';
  if (pageType === 'compare' && (!fixed.conclusion || typeof fixed.conclusion !== 'string'))
    fixed.conclusion = '以上对比展示了两个概念的核心差异。';
  if (pageType === 'table' && !Array.isArray(fixed.headers)) fixed.headers = ['项目', '说明'];
  if (pageType === 'table' && !Array.isArray(fixed.rows)) fixed.rows = [['—', '—']];
  if (pageType === 'formula') {
    if (!fixed.mainFormula || typeof fixed.mainFormula !== 'string') fixed.mainFormula = 'E = mc^2';
    if (!fixed.derivation || typeof fixed.derivation !== 'string')
      fixed.derivation = '推导过程详见教材。';
  }
  if (pageType === 'summary' && !Array.isArray(fixed.keyPoints)) fixed.keyPoints = ['本节核心内容'];
  if (pageType === 'end' && !fixed.slogan) fixed.slogan = '谢谢';
  // Ensure every formula item has both label and latex, and reject placeholder text
  if (Array.isArray(fixed.formulas)) {
    fixed.formulas = (fixed.formulas as Array<Record<string, unknown>>)
      .map((f) => {
        const label = typeof f.label === 'string' && f.label.trim() ? f.label.trim() : '相关方程式';
        let latex = typeof f.latex === 'string' && f.latex.trim() ? f.latex.trim() : '';
        // Reject [Formula] / [formula] / 【公式】 placeholders — treat as empty so fallback kicks in
        if (
          /\[\s*formula\s*\]/i.test(latex) ||
          /【\s*公式\s*】/.test(latex) ||
          latex.trim() === ''
        ) {
          latex = `\\text{${label}}`;
        }
        return { label, latex };
      })
      .filter((f) => f.latex && f.latex !== '\\text{}');
  }

  // Aggressive fallback: re-parse and truncate ANY too_big string field
  // based on the exact maximum reported by Zod. Loop up to 5 times to
  // handle multiple too_big issues (e.g. multiple array elements).
  let finalFixed = fixed;
  for (let attempt = 0; attempt < 5; attempt++) {
    const check = schema.safeParse(finalFixed);
    if (check.success) break;

    let changed = false;
    for (const issue of check.error.issues) {
      // Zod v4 uses `origin`, v3 uses `type` — support both
      const issueOrigin = (issue as unknown as Record<string, unknown>).origin as
        | string
        | undefined;
      const issueType = (issue as unknown as Record<string, unknown>).type as string | undefined;
      const isStringIssue = issueOrigin === 'string' || issueType === 'string';
      if (issue.code === 'too_big' && isStringIssue && typeof issue.maximum === 'number') {
        const maxLen = issue.maximum;
        const path = issue.path as (string | number)[];
        try {
          let target: Record<string, unknown> = finalFixed;
          for (let i = 0; i < path.length - 1; i++) {
            const key = path[i];
            if (typeof key === 'number' && Array.isArray(target)) {
              target = target[key] as Record<string, unknown>;
            } else {
              target = target[key as string] as Record<string, unknown>;
            }
          }
          const lastKey = path[path.length - 1];
          if (typeof lastKey === 'string' && typeof target[lastKey] === 'string') {
            const original = target[lastKey] as string;
            const trimmed = trunc(original, maxLen);
            if (trimmed !== original) {
              target[lastKey] = trimmed;
              changed = true;
            }
          }
        } catch {
          /* ignore path traversal errors */
        }
      }
    }
    if (!changed) break;
  }

  return finalFixed;
}

export function deepRepairContent(
  pageType: string,
  content: Record<string, unknown>,
): Record<string, unknown> {
  const fixed = { ...content } as Record<string, unknown>;

  // DEBUG: verify Turbopack has loaded this version (write to file so we can check via API)
  try {
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(process.cwd(), 'logs', 'pipeline-diagnostic.log');
    const line = `[${new Date().toISOString()}] [DEBUG] [deepRepairContent] v2.1 called pageType=${pageType} keys=${Object.keys(fixed).join(',')}\n`;
    fs.appendFileSync(logPath, line);
  } catch {
    /* ignore */
  }

  // Type coercion: convert numbers/booleans/null to strings
  for (const [key, value] of Object.entries(fixed)) {
    if (value === null || value === undefined) {
      fixed[key] = '';
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      fixed[key] = String(value);
    }
  }

  // Truncate string fields
  if (typeof fixed.title === 'string') fixed.title = trunc(fixed.title, 12);
  if (typeof fixed.summary === 'string') fixed.summary = trunc(fixed.summary, 120);
  if (typeof fixed.subtitle === 'string') fixed.subtitle = trunc(fixed.subtitle, 25);
  if (typeof fixed.tagline === 'string') fixed.tagline = trunc(fixed.tagline, 30);
  if (typeof fixed.slogan === 'string') fixed.slogan = trunc(fixed.slogan, 15);
  if (typeof fixed.highlight === 'string') fixed.highlight = trunc(fixed.highlight, 40);
  if (typeof fixed.preview === 'string') fixed.preview = trunc(fixed.preview, 60);
  if (typeof fixed.derivation === 'string') fixed.derivation = trunc(fixed.derivation, 300);
  if (typeof fixed.application === 'string') fixed.application = trunc(fixed.application, 200);
  if (typeof fixed.mainFormula === 'string') fixed.mainFormula = trunc(fixed.mainFormula, 200);

  // Fix arrays: cap at max + type coercion inside arrays
  const arrayCaps: Record<string, number> = {
    cards: 6,
    items: 6,
    scenarios: 3,
    steps: 8,
    rows: 8,
    questions: 5,
    events: 8,
    keyPoints: 6,
    options: 6,
    formulas: 3,
  };
  for (const [key, cap] of Object.entries(arrayCaps)) {
    if (Array.isArray(fixed[key])) {
      fixed[key] = (fixed[key] as unknown[])
        .slice(0, cap)
        .map((item: unknown) => {
          if (Array.isArray(item)) return item; // preserve nested arrays (e.g. table rows)
          if (typeof item === 'object' && item !== null) {
            const obj = { ...(item as Record<string, unknown>) };
            // Type coercion for nested object fields
            for (const [k, v] of Object.entries(obj)) {
              if (v === null || v === undefined) obj[k] = '';
              else if (typeof v === 'number' || typeof v === 'boolean') obj[k] = String(v);
            }
            const titleMax = pageType === 'toc' ? 15 : 20;
            if (typeof obj.title === 'string') obj.title = trunc(obj.title, titleMax);
            if (typeof obj.desc === 'string') obj.desc = trunc(obj.desc, 200);
            if (typeof obj.problem === 'string') obj.problem = trunc(obj.problem, 400);
            if (typeof obj.solution === 'string') obj.solution = trunc(obj.solution, 400);
            if (typeof obj.content === 'string') obj.content = trunc(obj.content, 120);
            if (typeof obj.date === 'string') obj.date = trunc(obj.date, 20);
            if (typeof obj.q === 'string') obj.q = trunc(obj.q, 200);
            if (typeof obj.answer === 'string') obj.answer = trunc(obj.answer, 2);
            if (typeof obj.num === 'string') obj.num = trunc(obj.num, 5);
            // Ensure formula items always have both label and latex
            if (key === 'formulas') {
              if (
                !obj.label ||
                typeof obj.label !== 'string' ||
                (obj.label as string).trim() === ''
              ) {
                obj.label = '相关方程式';
              }
              if (
                !obj.latex ||
                typeof obj.latex !== 'string' ||
                (obj.latex as string).trim() === ''
              ) {
                obj.latex = `\\text{${obj.label as string}}`;
              }
            }
            return obj;
          }
          return typeof item === 'string' ? trunc(item, 100) : String(item);
        })
        .filter((item) => item !== undefined && item !== null && item !== '');
    }
  }

  // Fix nested objects (compare left/right)
  if (fixed.left && typeof fixed.left === 'object') {
    const l = fixed.left as Record<string, unknown>;
    if (Array.isArray(l.items)) {
      l.items = (l.items as unknown[])
        .map((s) => (typeof s === 'string' ? trunc(s, 100) : String(s)))
        .slice(0, 6);
    }
    if (typeof l.title === 'string') l.title = trunc(l.title, 15);
  }
  if (fixed.right && typeof fixed.right === 'object') {
    const r = fixed.right as Record<string, unknown>;
    if (Array.isArray(r.items)) {
      r.items = (r.items as unknown[])
        .map((s) => (typeof s === 'string' ? trunc(s, 100) : String(s)))
        .slice(0, 6);
    }
    if (typeof r.title === 'string') r.title = trunc(r.title, 15);
  }

  // Table-specific deep repair
  if (pageType === 'table') {
    // Ensure headers is string array, capped at 25 chars
    if (Array.isArray(fixed.headers)) {
      fixed.headers = (fixed.headers as unknown[]).map((h) => trunc(String(h), 20));
    }
    // Ensure rows is string[][] — recursively extract text from nested objects.
    // If a row contains a single object cell, expand its string values into multiple cells
    // to match the header count (common LLM hallucination pattern).
    // Cap each cell at 40 chars.
    if (Array.isArray(fixed.rows)) {
      fixed.rows = (fixed.rows as unknown[]).map((row) => {
        if (Array.isArray(row)) {
          return (row as unknown[]).flatMap((cell) => {
            let text = '';
            if (cell === null || cell === undefined) text = '';
            else if (typeof cell === 'string') text = cell;
            else if (typeof cell === 'number' || typeof cell === 'boolean') text = String(cell);
            else if (typeof cell === 'object') {
              const obj = cell as Record<string, unknown>;
              if (typeof obj.text === 'string') text = obj.text;
              else if (typeof obj.value === 'string') text = obj.value;
              else if (typeof obj.content === 'string') text = obj.content;
              else if (typeof obj.name === 'string') text = obj.name;
              else {
                const strs = Object.values(obj).filter((v): v is string => typeof v === 'string');
                text = strs.length > 0 ? strs.join(', ') : JSON.stringify(obj);
              }
            } else {
              text = String(cell);
            }
            return [trunc(text, 120)];
          });
        }
        if (typeof row === 'object' && row !== null && !Array.isArray(row)) {
          const obj = row as Record<string, unknown>;
          if (typeof obj.text === 'string') return [trunc(obj.text, 120)];
          if (typeof obj.value === 'string') return [trunc(obj.value, 120)];
          if (typeof obj.content === 'string') return [trunc(obj.content, 120)];
          const strs = Object.values(obj).filter((v): v is string => typeof v === 'string');
          const text = strs.length > 0 ? strs.join(', ') : JSON.stringify(obj);
          return [trunc(text, 120)];
        }
        return [trunc(String(row), 120)];
      });
    }
  }

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
  const subDigits: Record<string, string> = {
    '0': '₀',
    '1': '₁',
    '2': '₂',
    '3': '₃',
    '4': '₄',
    '5': '₅',
    '6': '₆',
    '7': '₇',
    '8': '₈',
    '9': '₉',
  };
  const superDigits: Record<string, string> = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
  };

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
    (_, el: string, num: string) =>
      el +
      num
        .split('')
        .map((d: string) => subDigits[d] || d)
        .join(''),
  );

  // ── Phase 3: Generic single-element superscript $X^n$ → Xⁿ ──
  // e.g. $C^{14}$ → C¹⁴ (radioactive isotope notation)
  result = result.replace(
    /\$([A-Z][a-z]?)\^\{(\d+)\}\$/g,
    (_, el: string, num: string) =>
      el +
      num
        .split('')
        .map((d: string) => superDigits[d] || d)
        .join(''),
  );

  // ── Phase 4: Remaining inline $...$ — convert sub/sup inside ──
  // Handles chemical equations with operators: $6CO_2 + 6H_2O -> C_6H_{12}O_6 + 6O_2$
  // Also handles edge cases like $(CH_2O)$, $HCO_3^-$, etc.
  result = result.replace(/\$([^$]{1,80})\$/g, (_, inner: string) => {
    let s = inner;
    // Convert common LaTeX arrows first
    s = s
      .replace(/\\rightarrow/g, '→')
      .replace(/\\to/g, '→')
      .replace(/\\leftarrow/g, '←')
      .replace(/\\leftrightarrow/g, '↔');
    // Also handle plain ASCII arrows used in chemical equations
    s = s.replace(/->/g, '→').replace(/<-/g, '←');
    // Convert _n → subscript unicode
    s = s.replace(/_(\d+)/g, (_m: string, num: string) =>
      num
        .split('')
        .map((d: string) => subDigits[d] || d)
        .join(''),
    );
    s = s.replace(/_\{(\d+)\}/g, (_m: string, num: string) =>
      num
        .split('')
        .map((d: string) => subDigits[d] || d)
        .join(''),
    );
    // Convert ^{n} or ^{n+} or ^{n-} → superscript unicode
    s = s.replace(/\^\{(\d+[+-]?)\}/g, (_m: string, content: string) =>
      content
        .split('')
        .map((ch: string) => superDigits[ch] || (ch === '+' ? '⁺' : ch === '-' ? '⁻' : ch))
        .join(''),
    );
    // Convert ^+ / ^- → superscript unicode
    s = s.replace(/\^(-|\+)/g, (_m: string, ch: string) => (ch === '+' ? '⁺' : '⁻'));
    return s;
  });

  return result;
}

// ── Unicode Math → LaTeX Conversion ────────────────────────────────

/** Convert Unicode math symbols back to LaTeX commands.
 *  Used by postProcessContent to recover LaTeX from plain-text formulas.
 */
export function unicodeMathToLatex(text: string): string {
  let result = text;

  const superMap: Record<string, string> = {
    '⁰': '0',
    '¹': '1',
    '²': '2',
    '³': '3',
    '⁴': '4',
    '⁵': '5',
    '⁶': '6',
    '⁷': '7',
    '⁸': '8',
    '⁹': '9',
    '⁺': '+',
    '⁻': '-',
  };
  const subMap: Record<string, string> = {
    '₀': '0',
    '₁': '1',
    '₂': '2',
    '₃': '3',
    '₄': '4',
    '₅': '5',
    '₆': '6',
    '₇': '7',
    '₈': '8',
    '₉': '9',
  };

  result = result.replace(/([A-Za-z)])([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+)/g, (_, base: string, sup: string) => {
    const digits = sup
      .split('')
      .map((c: string) => superMap[c] || c)
      .join('');
    return `${base}^{${digits}}`;
  });

  result = result.replace(/([A-Za-z)])([₀₁₂₃₄₅₆₇₈₉]+)/g, (_, base: string, sub: string) => {
    const digits = sub
      .split('')
      .map((c: string) => subMap[c] || c)
      .join('');
    return `${base}_{${digits}}`;
  });

  result = result.replace(/→/g, ' \\rightarrow ');
  result = result.replace(/←/g, ' \\leftarrow ');
  result = result.replace(/⇌/g, ' \\rightleftharpoons ');
  result = result.replace(/↔/g, ' \\leftrightarrow ');

  const greekMap: Record<string, string> = {
    Δ: '\\Delta',
    α: '\\alpha',
    β: '\\beta',
    γ: '\\gamma',
    δ: '\\delta',
    ε: '\\epsilon',
    ζ: '\\zeta',
    η: '\\eta',
    θ: '\\theta',
    ι: '\\iota',
    κ: '\\kappa',
    λ: '\\lambda',
    μ: '\\mu',
    ν: '\\nu',
    ξ: '\\xi',
    π: '\\pi',
    ρ: '\\rho',
    σ: '\\sigma',
    τ: '\\tau',
    υ: '\\upsilon',
    φ: '\\phi',
    χ: '\\chi',
    ψ: '\\psi',
    ω: '\\omega',
    Γ: '\\Gamma',
    Θ: '\\Theta',
    Λ: '\\Lambda',
    Σ: '\\Sigma',
    Φ: '\\Phi',
    Ψ: '\\Psi',
    Ω: '\\Omega',
  };
  for (const [u, l] of Object.entries(greekMap)) {
    result = result.split(u).join(` ${l} `);
  }

  result = result.replace(/°C/g, '^\\circ \\text{C}');
  result = result.replace(/°/g, '^\\circ');
  result = result.replace(/\s+/g, ' ').trim();
  return result;
}

/** Extract mathematical/chemical formula fragments from plain text. */
export function extractFormulasFromText(text: string): string[] {
  if (!text || text.length < 3) return [];
  const formulas: string[] = [];

  const eqPattern =
    /[A-Za-z0-9Δαβγδεζηθικλμνξπρστυφχψω⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉⁺⁻]+[^。，；\n]{0,100}[=→←⇌↔][^。，；\n]{0,100}[A-Za-z0-9Δαβγδεζηθικλμνξπρστυφχψω⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉⁺⁻]+/g;
  const eqMatches = text.match(eqPattern);
  if (eqMatches) {
    for (const m of eqMatches) {
      const latex = unicodeMathToLatex(m.trim());
      if (latex.length > 3 && latex.length < 200) formulas.push(latex);
    }
  }

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

// ── Schema Description for LLM Prompt ──────────────────────────────

/** Human-readable schema descriptions for prompt injection. */
export const SCHEMA_DESCRIPTIONS: Record<string, string> = {
  cover: `{ "title": "大标题≤20字", "subtitle": "副标题≤50字", "tagline": "英文标签≤60字母" }`,
  toc: `{ "title": "目录≤15字", "items": [{ "num":"01", "title":"章节≤15字", "desc":"描述≤30字" }], 2-6项 }`,
  end: `{ "slogan": "结束语≤20字", "subtitle": "副标语≤40字", "thanks": "感谢语≤25字" }`,
  chapter: `{ "num": "01", "title": "章节标题≤20字", "subtitle": "副标题≥30字,≤80字" }`,
  concept: `{ "title": "标题≤25字", "cards": [{ "title":"≤20字", "desc":"≥40字,≤200字" }], 3-6个卡片, "formulas": [{ "label":"公式名≤20字", "latex":"LaTeX≤200字" }], 0-3条, "summary": "总结≥30字,≤200字" }`,
  case: `{ "title": "标题≤25字", "scenarios": [{ "problem":"≥30字,≤400字", "solution":"≥30字,≤400字" }], 1-3个案例, "formulas": [{ "label":"公式名≤20字", "latex":"LaTeX≤200字" }], 0-3条, "highlight": "关键句≤60字" }`,
  compare: `{ "title": "标题≤20字", "left":{ "title":"≤15字", "items":["≥15字,≤100字"] }, "right":{ "title":"≤15字", "items":["≥15字,≤100字"] }, "conclusion": "结论≥30字,≤150字" }`,
  process: `{ "title": "标题≤25字", "steps": [{ "num":"1", "title":"≤25字", "desc":"≥30字,≤200字" }], 3-8步 }`,
  table: `{ "title": "标题≤25字", "headers": ["≤20字"], 2-6列, "rows": [["≤120字"]], 1-8行, "summary": "总结≥30字,≤150字" }`,
  formula: `{ "title": "标题≤25字", "mainFormula": "LaTeX≤300字", "derivation": "推导≥50字,≤400字", "application": "应用≥30字,≤300字" }`,
  timeline: `{ "title": "标题≤20字", "events": [{ "date":"≤25字", "content":"≥20字,≤120字" }], 2-8项 }`,
  summary: `{ "title": "标题≤20字", "keyPoints": ["≥20字,≤120字"], 4-6个要点, "formulas": [{ "label":"公式名≤20字", "latex":"LaTeX≤200字" }], 0-3条, "preview": "预览≤80字" }`,
  quiz: `{ "title": "标题≤25字", "questions": [{ "q":"题目≤200字", "options":["≤100字"], 2-6选项, "answer":"答案≤2字" }], 1-5题 }`,
};

// ── JSON Text Cleaner (shared) ──────────────────────────────────────

/**
 * Remove trailing commas from JSON text without corrupting commas inside strings.
 * The naive regex `/,(\s*[}\]])/g` strips commas inside string values, e.g.
 * `{ "desc": "A, B," }` becomes `{ "desc": "A, B" }`.
 */
function removeTrailingCommas(json: string): string {
  let result = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      result += ch;
    } else {
      if (ch === '"') {
        inString = true;
        result += ch;
      } else if (ch === ',') {
        let j = i + 1;
        while (j < json.length && /[\s\r\n]/.test(json[j])) j++;
        if (j < json.length && (json[j] === '}' || json[j] === ']')) {
          continue; // skip trailing comma
        }
        result += ch;
      } else {
        result += ch;
      }
    }
  }
  return result;
}

/**
 * State-machine scanner that fixes invalid escape sequences inside JSON
 * string literals.  Walks char-by-char tracking whether we're inside a
 * string and whether the previous char was an escape.  Any backslash not
 * followed by a valid JSON escape char is doubled.
 *
 * Valid escapes: \" \\ \/ \b \f \n \r \t \uXXXX
 */
function fixInvalidEscapes(text: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (!inString) {
      if (char === '"') inString = true;
      result += char;
      continue;
    }

    // Inside a string
    if (escaped) {
      const validEscapes = '"\\/bfnrtu';
      if (!validEscapes.includes(char)) {
        // Invalid escape — double the backslash so it becomes a literal backslash
        result = result.slice(0, -1) + '\\\\' + char;
      } else if (char === 'u') {
        // \u must be followed by exactly 4 hex digits
        const hex = text.slice(i + 1, i + 5);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
          result = result.slice(0, -1) + '\\\\u';
        } else {
          result += char;
        }
      } else {
        result += char;
      }
      escaped = false;
    } else {
      if (char === '\\') {
        escaped = true;
        result += char;
      } else if (char === '"') {
        inString = false;
        result += char;
      } else {
        result += char;
      }
    }
  }

  return result;
}

/**
 * Fix missing commas between JSON values.
 * LLMs often forget commas between array elements or object properties.
 * Examples:
 *   [{"a":1}{"b":2}]  → [{"a":1},{"b":2}]
 *   {"a":1 "b":2}      → {"a":1,"b":2}
 *   ["a" "b"]          → ["a","b"]
 *
 * We walk char-by-char with a state machine (skipping inside strings)
 * and insert a comma when a value terminator (} ] ") is immediately
 * followed by another value start ({ [ ").
 */
function fixMissingCommas(text: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (c === '\\') {
        escaped = true;
      } else if (c === '"') {
        inString = false;
      }
      result += c;
      continue;
    }

    if (c === '"') {
      inString = true;
      result += c;
      continue;
    }

    result += c;

    // After a value terminator, check if next non-space char starts a new value
    if (c === '}' || c === ']' || c === '"') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      const next = text[j];
      if (next === '{' || next === '[' || next === '"') {
        result += ',';
      }
    }
  }

  return result;
}

/**
 * Escape unescaped double-quotes that appear inside JSON string literals.
 * LLMs frequently output Chinese text containing straight quotes, e.g.
 *   "desc": "这是一个"测试"字符串"
 * which breaks JSON.parse.  We walk the text with a state machine and,
 * whenever we see a quote inside a string whose following non-space char
 * is NOT a valid JSON delimiter (,:}]) and is NOT another value start
 * ({["), we escape it.
 *
 * NOTE: Value-start chars ({ [ ") are handled by fixMissingCommas which
 * runs BEFORE this function, so by the time we see them there should already
 * be a comma.  If there isn't, we treat the quote as a normal string end
 * so fixMissingCommas can insert the comma rather than us mangling the JSON.
 */
function escapeUnescapedQuotes(text: string): string {
  let result = '';
  let i = 0;
  let inString = false;
  let escaped = false;

  while (i < text.length) {
    const c = text[i];

    if (!inString) {
      if (c === '"') inString = true;
      result += c;
      i++;
      continue;
    }

    // Inside a string
    if (escaped) {
      result += c;
      escaped = false;
      i++;
      continue;
    }

    if (c === '\\') {
      result += c;
      escaped = true;
      i++;
      continue;
    }

    if (c === '"') {
      // Peek ahead (skipping whitespace) to decide whether this quote
      // ends the string or is an unescaped quote inside the value.
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      const next = text[j];
      // Valid JSON delimiters after a string value: , : } ] or EOF
      if (!next || /[,:\}\]]/.test(next)) {
        result += '"';
        inString = false;
        i++;
        continue;
      }
      // If next char starts a new value, this is a missing-comma scenario.
      // fixMissingCommas (which runs before us) should have already handled it.
      // If it somehow didn't, DON'T escape — end the string normally so the
      // JSON remains structurally valid even if there's still a missing comma.
      if (next === '{' || next === '[' || next === '"') {
        result += '"';
        inString = false;
        i++;
        continue;
      }
      // Otherwise it is an unescaped quote inside the string content
      result += '\\"';
      i++;
      continue;
    }

    result += c;
    i++;
  }

  return result;
}

/** Strip markdown fences, trailing commas, comments, and control chars from LLM JSON output. */
export function cleanJsonText(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json'))
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  else if (cleaned.startsWith('```'))
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');

  // Remove single-line comments (// ...) — not valid in JSON
  cleaned = cleaned.replace(/\/\/[^\n\r]*/g, '');
  // Remove multi-line comments (/* ... */)
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

  // Replace single-quoted strings with double-quoted (naïve but handles common LLM mistakes)
  // Matches: key: 'value' or "key": 'value'
  cleaned = cleaned.replace(/(?<=[:\[,]\s*)'((?:[^'\\]|\\.)*)'/g, '"$1"');

  cleaned = removeTrailingCommas(cleaned).replace(/[\x00-\x1f\x7f-\x9f]/g, '');

  // Fix invalid escape sequences inside JSON string literals.
  // LLMs sometimes emit backslashes that are not valid JSON escapes
  // (e.g. LaTeX \ce{}, \rightarrow, stray \x, \U, etc.).
  // We use a state-machine scan: track whether we're inside a string and
  // whether the previous char was an escape. Any \ not followed by a valid
  // JSON escape char gets doubled.
  // Valid escapes: \" \\ \/ \b \f \n \r \t \uXXXX
  cleaned = fixInvalidEscapes(cleaned);

  // Fix missing commas between values (must run BEFORE escapeUnescapedQuotes)
  cleaned = fixMissingCommas(cleaned);

  // Fix unescaped quotes inside JSON string values (common with Chinese LLM output)
  cleaned = escapeUnescapedQuotes(cleaned);

  cleaned = tryRepairJson(cleaned);
  return cleaned;
}

/**
 * Attempt to repair truncated or malformed JSON from LLM output.
 * Handles: unclosed objects/arrays, unclosed strings, truncated numbers.
 */
function tryRepairJson(text: string): string {
  let s = text.trim();

  // 1. Try to find the last complete top-level object/array
  //    by balancing braces from the start.
  const firstChar = s[0];
  if (firstChar === '{' || firstChar === '[') {
    const closer = firstChar === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escape = false;
    let lastValidEnd = -1;

    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (c === firstChar) depth++;
        else if (c === closer) {
          depth--;
          if (depth === 0) {
            lastValidEnd = i;
          }
        }
      }
    }

    if (lastValidEnd >= 0) {
      s = s.slice(0, lastValidEnd + 1);
    } else if (depth > 0) {
      // Unclosed: append missing closers
      s += closer.repeat(depth);
    }
  }

  // 2. If still inside a string, close it
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === '\\') {
      esc = true;
      continue;
    }
    if (c === '"') inStr = !inStr;
  }
  if (inStr) s += '"';

  // 3. Ensure we don't end with a property key expecting a value
  //    e.g.  "foo":   or  "foo":[
  const tail = s.trimEnd();
  if (/:\s*$/.test(tail)) s += ' null';
  if (/:\s*\[$/.test(tail)) s += ']';
  if (/:\s*\{$/.test(tail)) s += '}';

  // 4. Balance braces one more time
  let openBraces = 0;
  let openBrackets = 0;
  let inString2 = false;
  let escape2 = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape2) {
      escape2 = false;
      continue;
    }
    if (c === '\\') {
      escape2 = true;
      continue;
    }
    if (c === '"') {
      inString2 = !inString2;
      continue;
    }
    if (!inString2) {
      if (c === '{') openBraces++;
      else if (c === '}') openBraces--;
      else if (c === '[') openBrackets++;
      else if (c === ']') openBrackets--;
    }
  }
  if (openBraces > 0) s += '}'.repeat(openBraces);
  if (openBrackets > 0) s += ']'.repeat(openBrackets);

  return s;
}
