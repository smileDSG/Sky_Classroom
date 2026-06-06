/**
 * Page Design Agent — converts page content JSON + DesignDNA
 * into a sequence of safe JSON instructions for the InstructionExecutor.
 */
import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import type { LanguageModel } from 'ai';
import type { DesignDNA } from './design-dna';
import { pageInstructionsSchema, type PageInstructions } from './instruction-executor';
import { cleanJsonText } from './content-schemas';

const log = createLogger('PageDesignAgent');

function buildSystemPrompt(designDNA: DesignDNA): string {
  const { colors, fonts, decoration, components } = designDNA;

  const densityRules =
    decoration.density === 'sparse'
      ? '页面元素极少，大量留白，简洁克制。每页最多2-3个元素。标题+简短正文+1个装饰形状即可。'
      : decoration.density === 'rich'
      ? '页面元素丰富充实，充分利用空间。每页可包含4-8个元素：标题+多段正文+多个形状装饰+表格/图表。'
      : '页面元素均衡，适度留白。每页3-5个元素：标题+正文+2-3个装饰形状。';

  return `## 角色
你是一位 pptxgenjs 渲染专家，将教学内容转换为幻灯片渲染指令。

## 画布
LAYOUT_WIDE: 13.33" × 7.5"

## 设计DNA（不可更改）
- 封面底色: ${colors.coverBg}
- 内容底色: ${colors.contentBg}
- 主强调色: ${colors.accent}
- 辅强调色: ${colors.accentSecondary}
- 标题颜色: ${colors.textPrimary}
- 正文颜色: ${colors.textBody}
- 标签颜色: ${colors.textMuted}
- 深色底文字: ${colors.textOnDark}
- 标题字体: ${fonts.heading} ${fonts.pageTitleSize}pt
- 正文字体: ${fonts.body} ${fonts.bodySize}pt
- 英文字体: ${fonts.en}
- 装饰母题: ${decoration.motif} (密度: ${decoration.density}, 重心: ${decoration.cornerWeight})
- 卡片样式: ${components.cardStyle}
- Bullet样式: ${components.bulletStyle}

## 密度规则（严格遵守）
${densityRules}

## 可用指令
1. setBackground: { "op":"setBackground", "params":{"color":"XXXXXX"} }
2. addText: { "op":"addText", "params":{"text":"...", "x":0.8,"y":0.5,"w":11.7,"h":0.7, "fontSize":34,"fontFace":"...","color":"XXXXXX","bold":true,"align":"left"} }
3. addShape: { "op":"addShape", "params":{"type":"RECTANGLE|OVAL|LINE|ROUNDED_RECTANGLE", "x":1,"y":1,"w":3,"h":2, "fillColor":"XXXXXX","fillTransparency":90} }
4. addFormula: { "op":"addFormula", "params":{"latex":"\\int_a^b f(x)dx","x":1,"y":2,"w":8,"h":0.8, "fontSize":16,"color":"1E293B"} }  ← 用于数学公式，latex 字段放 LaTeX 源码
5. addTable: { "op":"addTable", "params":{"headers":["A","B"],"rows":[["1","2"]], "x":0.8,"y":2,"w":11.7, "headerBgColor":"...","borderColor":"..."} }

## 设计规则
- 所有颜色使用DesignDNA中的，禁止自创
- 文字颜色必须与背景有强对比度
- 0.5"最小边距
- 元素之间≥0.3"间距
- 左对齐正文，居中仅用于标题
- 每页至少包含1个视觉元素（形状/表格），避免纯文字页
- 所有颜色用6位hex不带#前缀

## 公式渲染规则（硬规则，不可违反，违反会导致页面不合格）
- 数学公式、化学方程式等**必须用 addFormula 指令**，严禁用 addText 塞 LaTeX 文本
- 严禁使用 [Formula] 等占位符文本 — 遇到公式必须用 addFormula
- **如果 content 包含 formulas 数组，每个 formula 必须生成对应的 addFormula 指令，严禁忽略或省略**
- 每个 formula 的渲染方式：先用 addText 渲染 label，再用 addFormula 渲染 latex。label 和 formula 垂直排列，间距 0.2"
- 如果 content 的文本（cards.desc / keyPoints / scenarios.problem / scenarios.solution）中包含数学表达式（如 E = mc²、Zn²⁺ + Cu → Zn + Cu²⁺、ΔG = -nFE），**必须从文本中提取并生成 addFormula 指令**，不可仅用 addText 输出
- formula 类型页面必须使用 addFormula 渲染 mainFormula 字段的内容
- LaTeX 公式必须正确使用 ^ 上标和 _ 下标：电荷用 ^（如 Zn^{2+}、e^{-}），原子数用 _（如 H_2O、CO_2）。严禁省略括号写成 Zn2+ 或 H2O
- 流程步骤之间严禁使用 addText 输出孤立的 "→" 或 "->" 符号。步骤连接必须通过 addShape(LINE) 实现，或完全省略箭头，仅用编号区分步骤

## 页型布局参考（严格遵循）
- cover: 全屏背景色 + 居中标题(大字号,44pt+) + 居中副标题(小字号) + 底部装饰形状/线条
- toc: 背景色 + 顶部标题"目录" + 纵向排列的章节列表(每项带序号,左对齐)
- chapter: 全屏背景色 + 左侧章节编号(极大字号,半透明) + 章节标题 + 副标题
- concept: 顶部标题 + 2-6个卡片(等宽横向排列或纵向排列) + 底部总结文本
- case: 顶部标题 + 1-3个案例卡片(问题在上,解答在下,分区明显) + 底部高亮文本。若 content 包含 formulas 数组，每个 formula 必须先用 addText 渲染 label，再用 addFormula 渲染 latex
- compare: 顶部标题 + 左右两栏对比(每栏标题+要点列表) + 底部结论(居中或横跨)
- process: 顶部标题 + 2-8个步骤(横向流程或纵向列表,步骤间用LINE形状连接) + 底部说明
- table: 顶部标题 + 表格(居中,占页面宽度70-90%) + 底部总结
- formula: 顶部标题 + 主公式(居中,大字号,占页面核心位置) + 推导过程(下方,分步) + 应用(可选)
- timeline: 顶部标题 + 时间轴(横向或纵向主干线) + 事件节点(均匀分布)
- summary: 顶部标题 + 要点列表(纵向,每条带图标或编号) + 可选公式展示区
- quiz: 顶部标题 + 1-5道题目(每题题干+选项纵向排列,选项带A/B/C/D前缀) + 答案标注
- end: 全屏背景色 + 居中结束语(大字号) + 副标语 + 底部感谢语

## 输出格式
只输出纯JSON:
{ "pageNum": N, "instructions": [...] }`;
}

function buildUserPrompt(
  pageNum: number,
  pageType: string,
  content: Record<string, unknown>,
  totalPages: number,
  designDNA: DesignDNA,
): string {
  const formulaHint = Array.isArray(content.formulas) && (content.formulas as Array<unknown>).length > 0
    ? `\n⚠️ 重要：本页 content 包含 ${(content.formulas as Array<unknown>).length} 个公式（formulas 数组），必须在 instructions 中为每个公式生成 addText(label) + addFormula(latex) 指令，不可省略。`
    : '';
  const mainFormulaHint = typeof (content as { mainFormula?: string }).mainFormula === 'string' && (content as { mainFormula?: string }).mainFormula!.length > 0
    ? `\n⚠️ 重要：本页 content 包含主公式 mainFormula，必须用 addFormula 指令渲染，不可省略。`
    : '';

  return `页号: ${pageNum} / ${totalPages}
页面类型: ${pageType}
背景色: ${pageNum === 1 || pageNum === totalPages ? designDNA.colors.coverBg : designDNA.colors.contentBg}
页面内容: ${JSON.stringify(content)}${formulaHint}${mainFormulaHint}

请严格按"页型布局参考"中 ${pageType} 的规范输出渲染指令JSON。`;
}

// ── Fallback page layout generator ──────────────────────────────────

function buildFallbackPageInstructions(
  pageNum: number,
  pageType: string,
  content: Record<string, unknown>,
  designDNA: DesignDNA,
): PageInstructions {
  const bg = pageNum === 1 || pageType === 'end' || pageType === 'cover' || pageType === 'chapter'
    ? designDNA.colors.coverBg
    : designDNA.colors.contentBg;
  const textColor = pageType === 'cover' || pageType === 'end' || pageType === 'chapter'
    ? designDNA.colors.textOnDark
    : designDNA.colors.textPrimary;
  const title = (content.title as string) || (content.slogan as string) || `第 ${pageNum} 页`;

  const instructions: PageInstructions['instructions'] = [
    { op: 'setBackground', params: { color: bg } },
  ];

  switch (pageType) {
    case 'cover': {
      instructions.push(
        { op: 'addText', params: { text: title, x: 1, y: 2.2, w: 11.3, h: 1.2, fontSize: 40, fontFace: designDNA.fonts.heading, color: textColor, bold: true, align: 'center', valign: 'middle' } },
        { op: 'addText', params: { text: (content.subtitle as string) || '', x: 1, y: 3.6, w: 11.3, h: 0.6, fontSize: 18, fontFace: designDNA.fonts.body, color: designDNA.colors.textMuted, align: 'center', valign: 'middle' } },
        { op: 'addShape', params: { type: 'LINE', x: 4, y: 4.4, w: 5.3, h: 0, lineColor: designDNA.colors.accent, lineWidth: 2 } },
      );
      break;
    }
    case 'chapter': {
      instructions.push(
        { op: 'addText', params: { text: (content.num as string) || '', x: 1, y: 1.5, w: 11.3, h: 1.5, fontSize: 72, fontFace: designDNA.fonts.heading, color: designDNA.colors.accentSecondary, bold: true, align: 'left', valign: 'top' } },
        { op: 'addText', params: { text: title, x: 1, y: 3.2, w: 11.3, h: 1, fontSize: 32, fontFace: designDNA.fonts.heading, color: textColor, bold: true, align: 'left', valign: 'middle' } },
        { op: 'addText', params: { text: (content.subtitle as string) || '', x: 1, y: 4.4, w: 11.3, h: 0.6, fontSize: 16, fontFace: designDNA.fonts.body, color: designDNA.colors.textMuted, align: 'left', valign: 'middle' } },
      );
      break;
    }
    case 'toc': {
      const items = Array.isArray(content.items) ? content.items as Array<{num?: string; title?: string; desc?: string}> : [];
      instructions.push(
        { op: 'addText', params: { text: (content.title as string) || '目录', x: 1, y: 0.6, w: 11.3, h: 0.8, fontSize: 32, fontFace: designDNA.fonts.heading, color: designDNA.colors.textPrimary, bold: true, align: 'left', valign: 'middle' } },
      );
      items.forEach((item, i) => {
        instructions.push(
          { op: 'addText', params: { text: `${item.num || i + 1}. ${item.title || ''}`, x: 1.2, y: 1.6 + i * 0.9, w: 10.9, h: 0.5, fontSize: 16, fontFace: designDNA.fonts.body, color: designDNA.colors.textBody, align: 'left', valign: 'middle' } },
        );
      });
      break;
    }
    case 'table': {
      const headers = Array.isArray(content.headers) ? content.headers as string[] : ['项目', '说明'];
      const rows = Array.isArray(content.rows) ? content.rows as string[][] : [];
      instructions.push(
        { op: 'addText', params: { text: title, x: 1, y: 0.5, w: 11.3, h: 0.7, fontSize: 28, fontFace: designDNA.fonts.heading, color: designDNA.colors.textPrimary, bold: true, align: 'left', valign: 'middle' } },
        { op: 'addTable', params: { headers, rows, x: 1, y: 1.5, w: 11.3, headerBgColor: designDNA.colors.accent, borderColor: designDNA.colors.textMuted } },
      );
      break;
    }
    case 'formula': {
      instructions.push(
        { op: 'addText', params: { text: title, x: 1, y: 0.5, w: 11.3, h: 0.7, fontSize: 28, fontFace: designDNA.fonts.heading, color: designDNA.colors.textPrimary, bold: true, align: 'left', valign: 'middle' } },
        { op: 'addFormula', params: { latex: (content.mainFormula as string) || '\\text{公式}', x: 1, y: 2.5, w: 11.3, h: 1.2, fontSize: 20, color: designDNA.colors.textPrimary, align: 'center' } },
      );
      break;
    }
    case 'end': {
      instructions.push(
        { op: 'addText', params: { text: title, x: 1, y: 2.2, w: 11.3, h: 1.2, fontSize: 40, fontFace: designDNA.fonts.heading, color: textColor, bold: true, align: 'center', valign: 'middle' } },
        { op: 'addText', params: { text: (content.subtitle as string) || '', x: 1, y: 3.6, w: 11.3, h: 0.6, fontSize: 18, fontFace: designDNA.fonts.body, color: designDNA.colors.textMuted, align: 'center', valign: 'middle' } },
        { op: 'addShape', params: { type: 'LINE', x: 4, y: 4.4, w: 5.3, h: 0, lineColor: designDNA.colors.accent, lineWidth: 2 } },
      );
      break;
    }
    default: {
      // Generic fallback: title + body text blocks
      instructions.push(
        { op: 'addText', params: { text: title, x: 1, y: 0.5, w: 11.3, h: 0.7, fontSize: 28, fontFace: designDNA.fonts.heading, color: designDNA.colors.textPrimary, bold: true, align: 'left', valign: 'middle' } },
      );
      // Try to extract body text from various content shapes
      const bodyTexts: string[] = [];
      if (Array.isArray(content.cards)) {
        (content.cards as Array<{title?: string; desc?: string}>).forEach((c) => bodyTexts.push(`• ${c.title || ''}: ${c.desc || ''}`));
      }
      if (Array.isArray(content.keyPoints)) {
        (content.keyPoints as string[]).forEach((p) => bodyTexts.push(`• ${p}`));
      }
      if (Array.isArray(content.scenarios)) {
        (content.scenarios as Array<{problem?: string; solution?: string}>).forEach((s) => {
          if (s.problem) bodyTexts.push(`问题: ${s.problem}`);
          if (s.solution) bodyTexts.push(`解答: ${s.solution}`);
        });
      }
      if (Array.isArray(content.steps)) {
        (content.steps as Array<{title?: string; desc?: string}>).forEach((s, i) => bodyTexts.push(`${i + 1}. ${s.title || ''}: ${s.desc || ''}`));
      }
      if (bodyTexts.length === 0 && content.summary) {
        bodyTexts.push(String(content.summary));
      }
      if (bodyTexts.length === 0 && content.desc) {
        bodyTexts.push(String(content.desc));
      }

      bodyTexts.forEach((txt, i) => {
        instructions.push(
          { op: 'addText', params: { text: txt.slice(0, 200), x: 1, y: 1.4 + i * 0.6, w: 11.3, h: 0.5, fontSize: 14, fontFace: designDNA.fonts.body, color: designDNA.colors.textBody, align: 'left', valign: 'top' } },
        );
      });

      // Add a decorative accent shape if page is sparse
      if (bodyTexts.length < 3) {
        instructions.push(
          { op: 'addShape', params: { type: 'RECTANGLE', x: 11, y: 0.5, w: 1.3, h: 6.5, fillColor: designDNA.colors.accent, fillTransparency: 92 } },
        );
      }
      break;
    }
  }

  return { pageNum, instructions };
}

// ── Public API ──────────────────────────────────────────────────────

export interface PageDesignResult {
  success: boolean;
  pageInstructions?: PageInstructions;
  error?: string;
  fallback?: boolean;
}

export async function designPage(
  pageNum: number,
  pageType: string,
  content: Record<string, unknown>,
  totalPages: number,
  designDNA: DesignDNA,
  languageModel: LanguageModel,
): Promise<PageDesignResult> {
  try {
    const system = buildSystemPrompt(designDNA);
    const user = buildUserPrompt(pageNum, pageType, content, totalPages, designDNA);

    log.info(`Designing page ${pageNum} (${pageType})`);

    const pageTypeTokenMap: Record<string, number> = {
      cover: 4096, toc: 4096, end: 4096, chapter: 4096,
      concept: 6144, case: 6144, compare: 6144, process: 6144, timeline: 6144, summary: 6144, quiz: 6144,
      table: 8192, formula: 8192,
    };

    const result = await callLLM(
      { model: languageModel, system, prompt: user, maxOutputTokens: pageTypeTokenMap[pageType] || 6144, temperature: 0.3 },
      `page-design-${pageNum}`,
      { retries: 2, timeoutMs: 180000, validate: (text) => {
        try {
          const parsed = JSON.parse(cleanJsonText(text));
          return pageInstructionsSchema.safeParse(parsed).success;
        } catch {
          return false;
        }
      } },
      { mode: 'disabled', enabled: false },
    );

    const jsonText = cleanJsonText(result.text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseErr) {
      const rawPreview = result.text.slice(0, 1000);
      log.error(`Page ${pageNum} JSON parse failed. Raw preview:\n${rawPreview}\nParse error: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
      const fallback = buildFallbackPageInstructions(pageNum, pageType, content, designDNA);
      log.warn(`Page ${pageNum} using fallback layout due to JSON parse failure`);
      return { success: true, pageInstructions: fallback, fallback: true };
    }

    const validated = pageInstructionsSchema.safeParse(parsed);

    if (!validated.success) {
      // Log detailed diagnostic information
      const issues = validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      const rawPreview = result.text.slice(0, 1000);
      log.error(`Page ${pageNum} instruction validation failed. Issues: ${issues}. Raw preview:\n${rawPreview}`);

      // Attempt to auto-repair common issues
      const repaired = tryRepairInstructions(parsed as Record<string, unknown>);
      if (repaired) {
        const revalidated = pageInstructionsSchema.safeParse(repaired);
        if (revalidated.success) {
          log.info(`Page ${pageNum} auto-repaired and accepted`);
          return { success: true, pageInstructions: revalidated.data, fallback: true };
        }
      }

      // Final fallback: use generic layout
      const fallback = buildFallbackPageInstructions(pageNum, pageType, content, designDNA);
      log.warn(`Page ${pageNum} using fallback layout due to validation failure`);
      return { success: true, pageInstructions: fallback, fallback: true };
    }

    return { success: true, pageInstructions: validated.data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Page ${pageNum} design failed: ${msg}`);
    const fallback = buildFallbackPageInstructions(pageNum, pageType, content, designDNA);
    log.warn(`Page ${pageNum} using fallback layout due to exception`);
    return { success: true, pageInstructions: fallback, fallback: true };
  }
}

/**
 * Attempt to auto-repair common LLM output issues in page instructions.
 * Returns repaired object or null if unrepairable.
 */
function tryRepairInstructions(parsed: Record<string, unknown>): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== 'object') return null;

  const pageNum = typeof parsed.pageNum === 'number' ? parsed.pageNum : 1;
  const rawInstructions = Array.isArray(parsed.instructions) ? parsed.instructions : [];
  const repairedInstructions: Array<Record<string, unknown>> = [];

  for (const inst of rawInstructions) {
    if (!inst || typeof inst !== 'object') continue;
    const i = inst as Record<string, unknown>;
    const op = typeof i.op === 'string' ? i.op : undefined;
    if (!op) continue;

    // Ensure params exists
    if (!i.params || typeof i.params !== 'object') {
      i.params = {};
    }
    const params = i.params as Record<string, unknown>;

    // Strip # from color values in params
    for (const key of Object.keys(params)) {
      if (typeof params[key] === 'string' && /^(#?[0-9A-Fa-f]{6})$/.test(params[key] as string)) {
        params[key] = (params[key] as string).replace(/^#/, '');
      }
    }

    // Ensure numeric coordinates are actually numbers
    for (const numKey of ['x', 'y', 'w', 'h', 'fontSize', 'lineWidth', 'rotate', 'rectRadius', 'fillTransparency', 'transparency']) {
      if (numKey in params && typeof params[numKey] !== 'number') {
        const n = Number(params[numKey]);
        if (!Number.isNaN(n)) params[numKey] = n;
      }
    }

    // Ensure booleans are actually booleans
    for (const boolKey of ['bold', 'italic', 'rounding', 'showTitle', 'showLegend']) {
      if (boolKey in params) {
        const v = params[boolKey];
        if (typeof v === 'string') {
          params[boolKey] = v.toLowerCase() === 'true';
        }
      }
    }

    repairedInstructions.push(i);
  }

  if (repairedInstructions.length === 0) return null;
  return { pageNum, instructions: repairedInstructions };
}
