/**
 * Classroom Design DNA — curated color palettes, fonts, and theme selection
 * for educational slide generation.
 *
 * Adapted from the PPT module's design-dna.ts (lib/slides/agent/design-dna.ts)
 * with education-optimized palette curation and keyword-based selection.
 */

import {
  COLOR_PALETTES,
  FONT_PAIRS,
  type ColorPalette,
  type FontPairing,
} from '@/lib/slides/agent/design-dna';
import type { SceneOutline } from '@/lib/types/generation';
import { createLogger } from '@/lib/logger';

export type { ColorPalette, FontPairing };

const log = createLogger('DesignDNA');

export interface ClassroomThemeSelection {
  paletteName: string;
  palette: ColorPalette;
  fonts: FontPairing;
  styleName: string;
  mood: string;
}

/** Curated palette names for classroom use */
const CLASSROOM_PALETTES = [
  'midnight-executive',
  'tech-dark-cn',
  'forest-moss',
  'warm-terracotta',
  'ocean-gradient',
  'classical-chinese',
] as const;

type ClassroomPaletteName = (typeof CLASSROOM_PALETTES)[number];

const PALETTE_META: Record<ClassroomPaletteName, { styleName: string; mood: string }> = {
  'midnight-executive': { styleName: '商务天空蓝', mood: '专业稳重' },
  'tech-dark-cn': { styleName: '暗夜科技', mood: '深邃未来' },
  'forest-moss': { styleName: '森林生机绿', mood: '自然清新' },
  'warm-terracotta': { styleName: '陶土暖红', mood: '温暖人文' },
  'ocean-gradient': { styleName: '深海科技蓝', mood: '科技冷静' },
  'classical-chinese': { styleName: '中式古典', mood: '传统雅致' },
};

const THEME_KEYWORDS: Record<ClassroomPaletteName, string[]> = {
  'midnight-executive': ['商务', '管理', '通用', '基础', '入门', '概述', '简介', '导论'],
  'tech-dark-cn': [
    '量子', '算法', '编程', '代码', '人工智能', 'AI', '机器学习', '深度学习', '神经网络',
    '计算机', '网络', '数据', '科技', '工程', '物理', '化学', '数学', '微积分', '几何',
    '代数', '机器人', '自动化', '芯片', '电路', '电子', '信息', '软件', '硬件', '互联网',
    '区块链', '云计算', '大数据', '物联网', '虚拟现实', '密码', '加密', '安全', '前端',
    '后端', '开发', '程序', '编译', '操作系统', '数据库', '数据结构', '黑客', '黑客松',
  ],
  'forest-moss': [
    '生物', '植物', '动物', '生态', '环境', '环保', '自然', '森林', '海洋', '细胞', '基因',
    '进化', '光合作用', '呼吸', '食物链', '气候', '绿色', '有机', '农业', '园艺', '医药',
    '中药', '草本', '健康', '运动', '健身', '营养', '解剖', '生理', '微观', '细菌', '病毒',
    '免疫', '医学', '护理', '心理', '大脑', '神经', '记忆',
  ],
  'warm-terracotta': [
    '历史', '人文', '艺术', '绘画', '雕塑', '音乐', '舞蹈', '戏剧', '电影', '摄影', '建筑',
    '设计', '时尚', '文学', '小说', '诗歌', '散文', '哲学', '思想', '文化', '传统', '民俗',
    '考古', '文物', '博物馆', '朝代', '战争', '革命', '政治', '经济', '社会', '地理', '旅游',
    '世界', '国家', '民族', '语言', '文字', '书法', '美术', '素描', '油画', '水彩', '版画',
    '陶瓷', '工艺',
  ],
  'ocean-gradient': [
    '信息技术', '机械', '土木', '能源', '电力', '水利', '材料', '制造', '工业', '生产', '质量',
    '测量', '统计', '概率', '数据分析', '系统', '架构', '运维', '测试', '产品', '项目', '流程',
    '优化', '效率', '成本', '预算', '财务', '会计', '审计', '投资', '金融', '银行', '证券',
    '保险', '市场', '营销', '销售', '品牌', '广告', '公关', '人力资源', '招聘', '培训', '绩效',
    '组织', '战略', '竞争', '创新', '创业', '商业', '贸易', '物流', '供应链', '客服', '用户体验',
  ],
  'classical-chinese': [
    '国学', '诗词', '唐诗', '宋词', '元曲', '古文', '文言文', '四书五经', '论语', '孟子',
    '大学', '中庸', '道德经', '庄子', '老子', '孔子', '儒家', '道家', '佛家', '禅', '书法',
    '国画', '京剧', '古琴', '茶道', '武术', '太极', '中医', '针灸', '经络', '五行', '八卦',
    '节气', '农历', '春节', '中秋', '端午', '清明', '故宫', '长城', '兵马俑', '丝绸之路',
    '瓷器', '丝绸', '茶叶', '古韵', '风雅', '华夏', '中华',
  ],
};

const FONT_FOR_PALETTE: Record<ClassroomPaletteName, string> = {
  'midnight-executive': 'georgia-calibri',
  'tech-dark-cn': 'calibri-light',
  'forest-moss': 'georgia-calibri',
  'warm-terracotta': 'cambria-calibri',
  'ocean-gradient': 'calibri-light',
  'classical-chinese': 'cambria-calibri',
};

/** Fixed classroom-appropriate font sizes (px) for 1000×562.5 canvas */
export const CLASSROOM_FONT_SIZES = {
  title: 34,
  subtitle: 26,
  keypoint: 20,
  body: 16,
  caption: 14,
} as const;

/**
 * Select the most appropriate theme for a given scene outline.
 * Uses keyword matching on title + description (case-insensitive for English,
 * exact character match for Chinese).
 */
export function selectThemeForOutline(outline: SceneOutline): ClassroomThemeSelection {
  const text = `${outline.title} ${outline.description}`.toLowerCase();

  let bestMatch: ClassroomPaletteName | null = null;
  let bestScore = 0;
  const scoreDetails: Record<string, { score: number; hits: string[] }> = {};

  for (const paletteName of CLASSROOM_PALETTES) {
    const keywords = THEME_KEYWORDS[paletteName];
    let score = 0;
    const hits: string[] = [];
    for (const kw of keywords) {
      const lowerKw = kw.toLowerCase();
      let idx = text.indexOf(lowerKw);
      while (idx !== -1) {
        score++;
        hits.push(kw);
        idx = text.indexOf(lowerKw, idx + 1);
      }
    }
    scoreDetails[paletteName] = { score, hits };
    if (score > bestScore) {
      bestScore = score;
      bestMatch = paletteName;
    }
  }

  const selected = bestMatch ?? 'midnight-executive';
  const palette = COLOR_PALETTES[selected];
  const fontKey = FONT_FOR_PALETTE[selected];
  const fonts = FONT_PAIRS[fontKey] ?? FONT_PAIRS['georgia-calibri'];
  const meta = PALETTE_META[selected];

  const sortedScores = Object.entries(scoreDetails)
    .sort((a, b) => b[1].score - a[1].score)
    .map(([name, { score, hits }]) => `${name}=${score}[${hits.slice(0, 3).join(',')}${hits.length > 3 ? '...' : ''}]`)
    .join(' | ');

  log.info(`[DesignDNA] outline="${outline.title}" → palette=${selected} (score=${bestScore}, style=${meta.styleName}). All scores: ${sortedScores}`);

  return {
    paletteName: selected,
    palette,
    fonts,
    styleName: meta.styleName,
    mood: meta.mood,
  };
}

/**
 * Select a unified theme for an entire course based on all outlines.
 * Aggregates keyword scores across all outlines so every slide shares
 * the same palette and fonts.
 */
export function selectThemeForCourse(outlines: SceneOutline[]): ClassroomThemeSelection {
  let bestMatch: ClassroomPaletteName | null = null;
  let bestScore = 0;
  const scoreDetails: Record<string, number> = {};

  for (const paletteName of CLASSROOM_PALETTES) {
    const keywords = THEME_KEYWORDS[paletteName];
    let score = 0;
    for (const outline of outlines) {
      const text = `${outline.title} ${outline.description}`.toLowerCase();
      for (const kw of keywords) {
        const lowerKw = kw.toLowerCase();
        let idx = text.indexOf(lowerKw);
        while (idx !== -1) {
          score++;
          idx = text.indexOf(lowerKw, idx + 1);
        }
      }
    }
    scoreDetails[paletteName] = score;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = paletteName;
    }
  }

  const selected = bestMatch ?? 'midnight-executive';
  const palette = COLOR_PALETTES[selected];
  const fontKey = FONT_FOR_PALETTE[selected];
  const fonts = FONT_PAIRS[fontKey] ?? FONT_PAIRS['georgia-calibri'];
  const meta = PALETTE_META[selected];

  const sortedScores = Object.entries(scoreDetails)
    .sort((a, b) => b[1] - a[1])
    .map(([name, score]) => `${name}=${score}`)
    .join(' | ');

  log.info(`[DesignDNA] Course theme=${selected} (score=${bestScore}, style=${meta.styleName}). All scores: ${sortedScores}`);

  return {
    paletteName: selected,
    palette,
    fonts,
    styleName: meta.styleName,
    mood: meta.mood,
  };
}

// ── Template-Driven Theme Selection ────────────────────────────────

const TEMPLATE_TO_PALETTE: Record<string, ClassroomPaletteName> = {
  tech_dark_blue: 'tech-dark-cn',
  warm_humanities: 'warm-terracotta',
  nature_green: 'forest-moss',
  medical_health: 'ocean-gradient',
  chinese_classic: 'classical-chinese',
  business_blue_gray: 'midnight-executive',
};

export function selectThemeForTemplate(templateName: string): ClassroomThemeSelection {
  const paletteName = TEMPLATE_TO_PALETTE[templateName] || 'midnight-executive';
  const palette = COLOR_PALETTES[paletteName];
  const fontKey = FONT_FOR_PALETTE[paletteName];
  const fonts = FONT_PAIRS[fontKey] ?? FONT_PAIRS['georgia-calibri'];
  const meta = PALETTE_META[paletteName];

  log.info(`[DesignDNA] template="${templateName}" → palette=${paletteName} (style=${meta.styleName})`);

  return {
    paletteName,
    palette,
    fonts,
    styleName: meta.styleName,
    mood: meta.mood,
  };
}

/**
 * Content page layout types used by fallback layout system.
 * These match the layout templates defined in fallback-layouts.ts.
 */
export type ContentPageLayoutType =
  | 'two-column'
  | 'icon-list'
  | 'grid-2x2'
  | 'half-bleed-image';

/**
 * Select a deterministic layout type for a content page based on outline hash.
 * This ensures the same outline always gets the same layout, providing variety
 * across a course while maintaining consistency for identical inputs.
 */
export function selectLayoutTypeForOutline(
  outline: SceneOutline,
): ContentPageLayoutType {
  const hash = outline.title.split('').reduce((h, c) => {
    return ((h << 5) - h + c.charCodeAt(0)) | 0;
  }, 0);
  const layouts: ContentPageLayoutType[] = [
    'two-column',
    'icon-list',
    'grid-2x2',
    'half-bleed-image',
  ];
  const index = Math.abs(hash) % layouts.length;
  return layouts[index];
}
