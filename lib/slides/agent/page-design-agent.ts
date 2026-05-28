/**
 * Page Design Agent — converts page content JSON + DesignDNA
 * into a sequence of safe JSON instructions for the InstructionExecutor.
 */
import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import type { LanguageModel } from 'ai';
import type { DesignDNA } from './design-dna';
import { pageInstructionsSchema, type PageInstructions } from './instruction-executor';

const log = createLogger('PageDesignAgent');

function buildSystemPrompt(designDNA: DesignDNA): string {
  const { colors, fonts, decoration, components } = designDNA;

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
- 数学公式、化学方程式等必须用 addFormula 指令，严禁用 addText 塞 LaTeX 文本
- 所有颜色用6位hex不带#前缀

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
  return `页号: ${pageNum} / ${totalPages}
页面类型: ${pageType}
背景色: ${pageNum === 1 || pageNum === totalPages ? designDNA.colors.coverBg : designDNA.colors.contentBg}
页面内容: ${JSON.stringify(content, null, 2)}

请输出此页的渲染指令JSON。`;
}

function cleanJsonText(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1').replace(/[\x00-\x1f\x7f-\x9f]/g, '');
  return cleaned;
}

// ── Public API ──────────────────────────────────────────────────────

export interface PageDesignResult {
  success: boolean;
  pageInstructions?: PageInstructions;
  error?: string;
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

    const result = await callLLM(
      { model: languageModel, system, prompt: user, maxOutputTokens: 24576, temperature: 0.5 },
      `page-design-${pageNum}`,
      { retries: 2, validate: (text) => {
        const t = text.trim();
        return t.length > 300 && t.includes('instructions') && (t.endsWith('}') || t.endsWith('}]'));
      } },
    );

    const jsonText = cleanJsonText(result.text);
    const parsed = JSON.parse(jsonText);
    const validated = pageInstructionsSchema.safeParse(parsed);

    if (!validated.success) {
      log.error(`Page ${pageNum} instruction validation failed`);
      return { success: false, error: validated.error.message };
    }

    return { success: true, pageInstructions: validated.data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Page ${pageNum} design failed: ${msg}`);
    return { success: false, error: msg };
  }
}
