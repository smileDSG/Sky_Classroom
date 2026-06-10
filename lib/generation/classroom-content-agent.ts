/**
 * Classroom Content Agent — generates structured content JSON for classroom slides.
 *
 * Separates content generation (what to teach) from layout generation (how to display).
 * The LLM outputs pure content (titles, cards, bullets, steps), and the Layout Agent
 * converts it into precise Canvas coordinates.
 */

import { z } from 'zod';
import type { SceneOutline } from '@/lib/types/generation';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';
import type { AICallFn, GenerationResult } from './pipeline-types';
import type { ColorPalette, FontPairing } from './classroom-design-dna';
import { createLogger } from '@/lib/logger';

const log = createLogger('ContentAgent');

// ═══════════════════════════════════════════════════════════════
// Task 1: Content Type & Zod Schemas
// ═══════════════════════════════════════════════════════════════

export type ContentType =
  | 'concept'
  | 'case'
  | 'compare'
  | 'process'
  | 'summary'
  | 'table'
  | 'formula'
  | 'quote'
  | 'sidebar'
  | 'image_large'
  | 'image_half';

const formulaItemSchema = z.object({
  label: z.string().min(1).max(40),
  latex: z.string().min(1).max(300),
});

const conceptContentSchema = z.object({
  type: z.literal('concept'),
  title: z.string().min(1).max(60),
  cards: z.array(
    z.object({
      title: z.string().min(1).max(40),
      desc: z.string().min(30).max(300),
    }),
  ).min(2).max(6),
  summary: z.string().min(10).max(200).optional(),
  formulas: z.array(formulaItemSchema).max(3).optional(),
});

const caseContentSchema = z.object({
  type: z.literal('case'),
  title: z.string().min(1).max(60),
  scenarios: z.array(
    z.object({
      problem: z.string().min(20).max(400),
      solution: z.string().min(20).max(400),
    }),
  ).min(1).max(3),
  highlight: z.string().min(1).max(100).optional(),
  formulas: z.array(formulaItemSchema).max(3).optional(),
});

const compareContentSchema = z.object({
  type: z.literal('compare'),
  title: z.string().min(1).max(60),
  left: z.object({
    title: z.string().min(1).max(40),
    items: z.array(z.string().min(10).max(150)).min(2).max(6),
  }),
  right: z.object({
    title: z.string().min(1).max(40),
    items: z.array(z.string().min(10).max(150)).min(2).max(6),
  }),
  conclusion: z.string().min(10).max(200),
});

const processContentSchema = z.object({
  type: z.literal('process'),
  title: z.string().min(1).max(60),
  steps: z.array(
    z.object({
      num: z.string().min(1).max(5),
      title: z.string().min(1).max(40),
      desc: z.string().min(20).max(300),
    }),
  ).min(2).max(6),
  formulas: z.array(formulaItemSchema).max(3).optional(),
});

const summaryContentSchema = z.object({
  type: z.literal('summary'),
  title: z.string().min(1).max(60),
  keyPoints: z.array(z.string().min(10).max(200)).min(3).max(6),
  preview: z.string().min(1).max(150).optional(),
  formulas: z.array(formulaItemSchema).max(3).optional(),
});

const tableContentSchema = z.object({
  type: z.literal('table'),
  title: z.string().min(1).max(60),
  headers: z.array(z.string().min(1).max(40)).min(2).max(6),
  rows: z.array(z.array(z.string().min(1).max(200))).min(1).max(8),
  summary: z.string().min(10).max(200),
});

const formulaContentSchema = z.object({
  type: z.literal('formula'),
  title: z.string().min(1).max(60),
  mainFormula: z.string().min(1).max(300),
  derivation: z.string().min(20).max(500),
  application: z.string().min(10).max(300).optional(),
});

const quoteContentSchema = z.object({
  type: z.literal('quote'),
  title: z.string().min(1).max(60).optional(),
  body: z.string().min(1).max(300).describe('金句/引言内容，1-2句话'),
  caption: z.string().min(1).max(100).optional().describe('引言来源，如作者、书名'),
});

const sidebarContentSchema = z.object({
  type: z.literal('sidebar'),
  title: z.string().min(1).max(60).optional(),
  body: z.string().min(1).max(300).describe('侧边栏引言/核心观点'),
  main_body: z.string().min(20).max(600).describe('正文内容'),
});

const imageLargeContentSchema = z.object({
  type: z.literal('image_large'),
  title: z.string().min(1).max(60),
  image_url: z.string(),
  image_caption: z.string().min(1).max(200).optional(),
});

const imageHalfContentSchema = z.object({
  type: z.literal('image_half'),
  title: z.string().min(1).max(60),
  image_url: z.string(),
  image_caption: z.string().min(1).max(200).optional(),
  body: z.string().min(10).max(500).describe('与图片并排的描述文字'),
});

export const structuredContentSchema = z.discriminatedUnion('type', [
  conceptContentSchema,
  caseContentSchema,
  compareContentSchema,
  processContentSchema,
  summaryContentSchema,
  tableContentSchema,
  formulaContentSchema,
  quoteContentSchema,
  sidebarContentSchema,
  imageLargeContentSchema,
  imageHalfContentSchema,
]);

export type StructuredContent = z.infer<typeof structuredContentSchema>;

// ═══════════════════════════════════════════════════════════════
// Task 2: Content Type Inference
// ═══════════════════════════════════════════════════════════════

interface ContentTypeRule {
  type: ContentType;
  keywords: string[];
}

const CONTENT_TYPE_RULES: ContentTypeRule[] = [
  {
    type: 'table',
    keywords: ['表格', 'table', '对照表', '数据表', '汇总表'],
  },
  {
    type: 'formula',
    keywords: ['公式', 'equation', 'formula', '反应式', '方程式', '化学式', '计算', '推导', '定理', '定律'],
  },
  {
    type: 'compare',
    keywords: ['对比', '比较', '区别', '差异', '异同', 'vs', 'versus', 'compare', 'comparison'],
  },
  {
    type: 'case',
    keywords: ['案例', 'case', '实例', '例子', 'scenario', '应用', '实际问题', '例题'],
  },
  {
    type: 'process',
    keywords: ['过程', '步骤', '流程', 'stage', 'step', 'process', 'procedure', '机制', '如何', '怎样', '顺序'],
  },
  {
    type: 'summary',
    keywords: ['总结', 'summary', '归纳', '回顾', '小结', '核心要点', '梳理', '要点'],
  },
  {
    type: 'quote',
    keywords: ['金句', '引言', '名言', '格言', 'quote', '名句'],
  },
  {
    type: 'sidebar',
    keywords: ['侧边', '旁注', '要点提示', 'sidebar'],
  },
  {
    type: 'image_large',
    keywords: ['大图', '全图', '图片展示', '大图展示'],
  },
  {
    type: 'image_half',
    keywords: ['图文', '配图', '半图', '图文并排'],
  },
];

/**
 * Analyze a SceneOutline to determine the best content type.
 * Uses keyword matching on title, description, and keyPoints.
 */
export function inferContentTypeFromOutline(outline: SceneOutline): ContentType {
  const text = `${outline.title} ${outline.description || ''} ${(outline.keyPoints || []).join(' ')}`.toLowerCase();

  for (const rule of CONTENT_TYPE_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw.toLowerCase())) {
        log.info(`[ContentAgent] Inferred type=${rule.type} for "${outline.title}" (matched keyword: "${kw}")`);
        return rule.type;
      }
    }
  }

  log.info(`[ContentAgent] Inferred type=concept for "${outline.title}" (no keyword match)`);
  return 'concept';
}

// ═══════════════════════════════════════════════════════════════
// Task 3: Content Generation
// ═══════════════════════════════════════════════════════════════

export interface GenerateStructuredContentOptions {
  outline: SceneOutline;
  aiCallFn: AICallFn;
  contentType?: ContentType;
  subject?: string;
  grade?: string;
  languageDirective?: string;
  assignedImages?: string;
  mediaElementEnabled?: boolean;
  teacherContext?: string;
  completenessHint?: string;
  themePaletteName?: string;
  mood?: string;
  palette?: ColorPalette;
  fonts?: FontPairing;
}

/**
 * Build a user prompt for the content generation LLM call.
 */
function buildContentUserPrompt(
  outline: SceneOutline,
  contentType: ContentType,
  subject?: string,
  grade?: string,
): string {
  const subjectLine = subject ? `学科：${subject}\n` : '';
  const gradeLine = grade ? `学段：${grade}\n` : '';

  return `${subjectLine}${gradeLine}页面标题：${outline.title}
页面描述：${outline.description || ''}
核心要点：${(outline.keyPoints || []).join('、')}
内容类型：${contentType}

请根据以上信息生成 ${contentType} 类型的结构化教学内容。`;
}

/**
 * Strip markdown fences and clean LLM JSON output.
 */
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

/**
 * Generate structured content for a scene outline.
 * Builds a prompt, calls the LLM, parses and validates the response.
 */
export async function generateStructuredContent(
  options: GenerateStructuredContentOptions,
): Promise<GenerationResult<StructuredContent>> {
  const {
    outline,
    aiCallFn,
    contentType: explicitType,
    subject,
    grade,
    languageDirective,
    assignedImages,
    mediaElementEnabled,
    teacherContext,
    completenessHint,
    themePaletteName,
    mood,
    palette,
    fonts,
  } = options;

  const inferredType = explicitType ?? inferContentTypeFromOutline(outline);
  log.info(`[ContentAgent] Generating structured content for "${outline.title}" (type=${inferredType}, theme=${themePaletteName ?? 'default'})`);

  let systemPrompt: string;
  let userPrompt: string;

  try {
    const prompts = buildPrompt(PROMPT_IDS.SLIDE_CONTENT_V2, {
      contentType: inferredType,
      subject: subject ?? '通用',
      grade: grade ?? '中学',
      theme_palette_name: themePaletteName ?? 'midnight-executive',
      mood: mood ?? '专业稳重',
      theme_cover_bg: palette?.coverBg ?? '1E2761',
      theme_content_bg: palette?.contentBg ?? 'FFFFFF',
      theme_primary: palette?.accent ?? 'CADCFC',
      theme_secondary: palette?.accentSecondary ?? '1E2761',
      theme_accent_light: palette?.accentLight ?? 'F0F3FA',
      theme_text_primary: palette?.textPrimary ?? '1E293B',
      theme_text_body: palette?.textBody ?? '475569',
      theme_text_muted: palette?.textMuted ?? '94A3B8',
      theme_text_on_dark: palette?.textOnDark ?? 'FFFFFF',
      theme_font_heading: fonts?.heading ?? 'Microsoft YaHei',
      theme_font_body: fonts?.body ?? 'Microsoft YaHei',
      theme_font_en: fonts?.en ?? 'Georgia',
      theme_title_size: fonts?.pageTitleSize ?? 34,
      theme_body_size: fonts?.bodySize ?? 16,
      theme_caption_size: fonts?.captionSize ?? 14,
      title: outline.title,
      description: outline.description ?? '',
      keyPoints: (outline.keyPoints || []).join('\n'),
      completeness_hint: completenessHint ?? '',
      teacherContext: teacherContext ?? '',
      mediaElementEnabled: !!mediaElementEnabled,
      assignedImages: assignedImages ?? 'No images available.',
      languageDirective: languageDirective ?? 'Use the language inferred from the course context.',
    });
    if (!prompts) {
      throw new Error('Failed to build prompt');
    }
    systemPrompt = prompts.system;
  } catch {
    // Fallback if prompt file doesn't exist yet (another agent is rewriting it)
    systemPrompt = `你是一位专业的教育内容生成助手。请根据提供的大纲生成结构化教学内容。
严格遵循 JSON 格式输出，不要包含任何额外说明文字。
内容类型：${inferredType}`;
  }

  userPrompt = buildContentUserPrompt(outline, inferredType, subject, grade);

  try {
    const rawResponse = await aiCallFn(systemPrompt, userPrompt);
    const cleanedJson = cleanJsonResponse(rawResponse);

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanedJson);
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      return { success: false, error: `JSON parse failed: ${msg}` };
    }

    const validation = structuredContentSchema.safeParse(parsed);
    if (!validation.success) {
      const issues = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      log.error(`[ContentAgent] Schema validation failed for "${outline.title}": ${issues.slice(0, 300)}`);
      return { success: false, error: `Schema validation failed: ${issues.slice(0, 300)}` };
    }

    log.info(`[ContentAgent] Successfully generated ${validation.data.type} for "${outline.title}"`);
    return { success: true, data: validation.data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`[ContentAgent] LLM call failed for "${outline.title}": ${msg}`);
    return { success: false, error: `LLM call failed: ${msg}` };
  }
}
