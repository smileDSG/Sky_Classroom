import { loadTemplate } from '@/lib/templates/template-parser';
import { selectTemplatePage } from '@/lib/templates/content-mapper';
import {
  replacePlaceholders,
  extractPlaceholderValues,
} from '@/lib/templates/placeholder-replacer';
import type { StructuredContent } from './classroom-content-agent';
import type { SceneOutline } from '@/lib/types/generation';
import type { TemplateSlideData } from '@/lib/templates/pptd-types';
import { createLogger } from '@/lib/logger';

const log = createLogger('TemplateLayout');

const TEMPLATE_DIR =
  process.env.TEMPLATE_DIR ?? 'C:\\\\Users\\\\11486\\\\Desktop\\\\Kimi_Agent_星穹课堂课件模板';

interface TemplateMatcher {
  name: string;
  keywords: string[];
}

const TEMPLATE_MATCHERS: TemplateMatcher[] = [
  {
    name: 'nature_green',
    keywords: ['生物', '自然', '植物', '生态', '环境', '绿色', '细胞', '基因', '进化', '光合'],
  },
  {
    name: 'medical_health',
    keywords: ['医', '健康', '生理', '护理', '药', '解剖', '病理', '临床', '诊断', '治疗'],
  },
  {
    name: 'warm_humanities',
    keywords: [
      '历史',
      '文化',
      '人文',
      '艺术',
      '社会',
      '哲学',
      '心理',
      '考古',
      '博物馆',
      '朝代',
      '战争',
      '革命',
      '政治',
      '经济',
      '地理',
      '旅游',
      '电影',
      '文学',
      '音乐',
      '绘画',
      '戏剧',
      '舞蹈',
      '雕塑',
      '建筑',
      '宗教',
      '民俗',
      '语言',
      '传媒',
      '新闻',
    ],
  },
  {
    name: 'chinese_classic',
    keywords: [
      '古诗',
      '诗词',
      '古文',
      '文言文',
      '书法',
      '国学',
      '儒家',
      '道家',
      '论语',
      '孔子',
      '四书五经',
      '道德经',
      '老子',
      '庄子',
      '唐诗',
      '宋词',
      '元曲',
      '茶道',
      '古琴',
      '京剧',
      '国画',
    ],
  },
  {
    name: 'business_blue_gray',
    keywords: [
      '商业',
      '经济',
      '管理',
      '金融',
      '市场',
      '营销',
      '企业',
      '创业',
      '投资',
      '贸易',
      '供应链',
      '人力资源',
      '财务',
      '会计',
    ],
  },
  {
    name: 'tech_dark_blue',
    keywords: [
      '科技',
      '技术',
      '编程',
      '计算机',
      '软件',
      '硬件',
      '人工智能',
      'AI',
      '数据',
      '网络',
      '电子',
      '工程',
      '物理',
      '化学',
      '数学',
      '天文',
      '科学',
      '量子',
      '芯片',
      '算法',
      '信息',
      '机器',
      '代码',
      '开发',
      '互联网',
      '通信',
      '能源',
      '机械',
      '土木',
      '材料',
      '制造',
    ],
  },
];

export function getAvailableTemplates(): string[] {
  return TEMPLATE_MATCHERS.map((m) => m.name);
}

function scoreTemplateAgainstText(
  matcher: TemplateMatcher,
  text: string,
): { score: number; matched: string[] } {
  let score = 0;
  const matched: string[] = [];
  for (const kw of matcher.keywords) {
    if (text.includes(kw.toLowerCase())) {
      score++;
      matched.push(kw);
    }
  }
  return { score, matched };
}

/**
 * Select a single unified template for an entire course.
 * Aggregates keyword scores across all outlines so every slide
 * shares the same template and visual style.
 */
export function selectTemplateForCourse(outlines: SceneOutline[]): string {
  let bestMatch = 'tech_dark_blue';
  let bestScore = 0;
  const totalScores: Record<string, { score: number; matched: string[] }> = {};

  for (const matcher of TEMPLATE_MATCHERS) {
    let score = 0;
    const matched: string[] = [];
    for (const outline of outlines) {
      const text = `${outline.title} ${outline.description || ''}`.toLowerCase();
      const result = scoreTemplateAgainstText(matcher, text);
      score += result.score;
      matched.push(...result.matched);
    }
    totalScores[matcher.name] = { score, matched: [...new Set(matched)] };
    if (score > bestScore) {
      bestScore = score;
      bestMatch = matcher.name;
    }
  }

  const scoreSummary = Object.entries(totalScores)
    .sort((a, b) => b[1].score - a[1].score)
    .map(
      ([name, { score, matched }]) =>
        `${name}=${score}[${matched.slice(0, 5).join(',')}${matched.length > 5 ? '...' : ''}]`,
    )
    .join(' | ');

  log.info(
    `[TemplateSelect] Course template → ${bestMatch} (score=${bestScore}). All scores: ${scoreSummary}`,
  );

  return bestMatch;
}

/**
 * Select a template name based on the outline title.
 * Fallback for single-slide / incremental generation without a course context.
 */
export function selectTemplateForOutline(outlineTitle: string, _themePaletteName?: string): string {
  const text = outlineTitle.toLowerCase();

  let bestMatch = 'tech_dark_blue';
  let bestScore = 0;
  const scores: Record<string, { score: number; matched: string[] }> = {};

  for (const matcher of TEMPLATE_MATCHERS) {
    const result = scoreTemplateAgainstText(matcher, text);
    scores[matcher.name] = result;
    if (result.score > bestScore) {
      bestScore = result.score;
      bestMatch = matcher.name;
    }
  }

  const scoreSummary = Object.entries(scores)
    .sort((a, b) => b[1].score - a[1].score)
    .map(([name, { score, matched }]) => `${name}=${score}[${matched.join(',')}]`)
    .join(' | ');

  log.info(
    `[TemplateSelect] title="${outlineTitle}" → ${bestMatch} (score=${bestScore}). Details: ${scoreSummary}`,
  );

  return bestMatch;
}

/**
 * Convert StructuredContent into a template-driven slide layout.
 * Loads the YAML template, selects the best page, and replaces placeholders.
 */
export async function layoutContentWithTemplate(
  content: StructuredContent,
  templateName: string = 'tech_dark_blue',
): Promise<TemplateSlideData> {
  const templateDir = `${TEMPLATE_DIR}\\${templateName}`;
  log.info(
    `[TemplateLayout] Loading template dir: ${templateDir} for content.type=${content.type}`,
  );

  const { manifest, pages } = loadTemplate(templateDir);
  log.info(
    `[TemplateLayout] Loaded manifest="${manifest.title}" with ${Object.keys(pages).length} pages`,
  );

  const { pageName, page } = selectTemplatePage(content, pages);
  log.info(`[TemplateLayout] Selected page: ${pageName} for content.type=${content.type}`);

  const values = extractPlaceholderValues(content as Record<string, unknown>, pageName);
  const valueKeys = Object.keys(values);
  log.info(`[TemplateLayout] Extracted placeholders: [${valueKeys.join(', ')}]`);

  const resolvedPage = replacePlaceholders(page, values);
  log.info(
    `[TemplateLayout] Resolved ${resolvedPage.elements.length} elements for ${templateName}/${pageName}`,
  );

  return {
    templateName,
    pageName,
    page: resolvedPage,
    theme: manifest.theme,
    manifest,
  };
}
