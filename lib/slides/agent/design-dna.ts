/**
 * DesignDNA — centralized design token schema, validation, and defaults.
 *
 * All color palettes and font pairings are sourced from the pptx skill
 * (Anthropic's professional presentation design guidelines).
 */
import { z } from 'zod';

// ── Color Palettes (from pptx skill) ───────────────────────────────────

export interface ColorPalette {
  coverBg: string;
  contentBg: string;
  accent: string;
  accentSecondary: string;
  accentLight: string;
  textPrimary: string;
  textBody: string;
  textMuted: string;
  textOnDark: string;
}

export const COLOR_PALETTES: Record<string, ColorPalette> = {
  'midnight-executive': {
    coverBg: '1E2761',
    contentBg: 'FFFFFF',
    accent: 'CADCFC',
    accentSecondary: '1E2761',
    accentLight: 'F0F3FA',
    textPrimary: '1E293B',
    textBody: '475569',
    textMuted: '94A3B8',
    textOnDark: 'FFFFFF',
  },
  'forest-moss': {
    coverBg: '2C5F2D',
    contentBg: 'F5F5F5',
    accent: '97BC62',
    accentSecondary: '2C5F2D',
    accentLight: 'E8F0E0',
    textPrimary: '1B3A1D',
    textBody: '475569',
    textMuted: '94A3B8',
    textOnDark: 'F5F5F5',
  },
  'coral-energy': {
    coverBg: 'F96167',
    contentBg: 'FFFFFF',
    accent: 'F9E795',
    accentSecondary: '2F3C7E',
    accentLight: 'FFF5E6',
    textPrimary: '2F3C7E',
    textBody: '475569',
    textMuted: '94A3B8',
    textOnDark: 'FFFFFF',
  },
  'warm-terracotta': {
    coverBg: 'B85042',
    contentBg: 'E7E8D1',
    accent: 'A7BEAE',
    accentSecondary: 'B85042',
    accentLight: 'F0EDE0',
    textPrimary: '3D1F1A',
    textBody: '475569',
    textMuted: '8B7E74',
    textOnDark: 'E7E8D1',
  },
  'ocean-gradient': {
    coverBg: '065A82',
    contentBg: 'FFFFFF',
    accent: '1C7293',
    accentSecondary: '21295C',
    accentLight: 'E4F0F5',
    textPrimary: '21295C',
    textBody: '475569',
    textMuted: '94A3B8',
    textOnDark: 'FFFFFF',
  },
  'charcoal-minimal': {
    coverBg: '36454F',
    contentBg: 'F2F2F2',
    accent: '212121',
    accentSecondary: '36454F',
    accentLight: 'E8E8E8',
    textPrimary: '212121',
    textBody: '475569',
    textMuted: '94A3B8',
    textOnDark: 'F2F2F2',
  },
  'teal-trust': {
    coverBg: '028090',
    contentBg: 'FFFFFF',
    accent: '00A896',
    accentSecondary: '02C39A',
    accentLight: 'E6F5F3',
    textPrimary: '1E293B',
    textBody: '475569',
    textMuted: '94A3B8',
    textOnDark: 'FFFFFF',
  },
  'berry-cream': {
    coverBg: '6D2E46',
    contentBg: 'ECE2D0',
    accent: 'A26769',
    accentSecondary: '6D2E46',
    accentLight: 'F5EFE8',
    textPrimary: '3D1A28',
    textBody: '475569',
    textMuted: '9B8E84',
    textOnDark: 'ECE2D0',
  },
  'sage-calm': {
    coverBg: '84B59F',
    contentBg: 'FFFFFF',
    accent: '69A297',
    accentSecondary: '50808E',
    accentLight: 'EDF5F2',
    textPrimary: '1E293B',
    textBody: '475569',
    textMuted: '94A3B8',
    textOnDark: 'FFFFFF',
  },
  'cherry-bold': {
    coverBg: '990011',
    contentBg: 'FCF6F5',
    accent: '2F3C7E',
    accentSecondary: '990011',
    accentLight: 'FFF0EF',
    textPrimary: '2F3C7E',
    textBody: '475569',
    textMuted: 'B89494',
    textOnDark: 'FCF6F5',
  },
  // Chinese-optimized palettes
  'classical-chinese': {
    coverBg: 'E8D5B7',
    contentBg: 'FFFEF9',
    accent: 'C41E3A',
    accentSecondary: '2C1810',
    accentLight: 'F5EDE0',
    textPrimary: '2C1810',
    textBody: '4A3728',
    textMuted: 'A09080',
    textOnDark: 'FFFEF9',
  },
  'tech-dark-cn': {
    coverBg: '0F1D3D',
    contentBg: 'F8FAFE',
    accent: '00D4FF',
    accentSecondary: '3B82F6',
    accentLight: 'E8F4FF',
    textPrimary: '1E293B',
    textBody: '475569',
    textMuted: '94A3B8',
    textOnDark: 'FFFFFF',
  },
};

export const PALETTE_STYLE_INFO: Record<
  string,
  { styleName: string; mood: string; bestFor: string[] }
> = {
  'midnight-executive': {
    styleName: '商务天空蓝',
    mood: '专业稳重',
    bestFor: ['商务汇报', '学术演讲', '企业培训'],
  },
  'forest-moss': {
    styleName: '森林生机绿',
    mood: '自然清新',
    bestFor: ['生物科学', '环保主题', '生态教育'],
  },
  'coral-energy': {
    styleName: '珊瑚活力橙',
    mood: '热情活力',
    bestFor: ['创意营销', '活动宣讲', '青年教育'],
  },
  'warm-terracotta': {
    styleName: '陶土暖红',
    mood: '温暖人文',
    bestFor: ['历史人文', '艺术鉴赏', '传统文化'],
  },
  'ocean-gradient': {
    styleName: '深海科技蓝',
    mood: '科技冷静',
    bestFor: ['信息技术', '工程科学', '数据分析'],
  },
  'charcoal-minimal': {
    styleName: '极简炭灰',
    mood: '克制现代',
    bestFor: ['建筑设ư计', '产品发布', '极简主义'],
  },
  'teal-trust': {
    styleName: '青绿健康',
    mood: '可信稳重',
    bestFor: ['医疗健康', '公共管理', '金融理财'],
  },
  'berry-cream': {
    styleName: '浆果优雅紫',
    mood: '优雅柔和',
    bestFor: ['艺术设计', '时尚美妆', '文学创作'],
  },
  'sage-calm': {
    styleName: '鼠尾草治愈',
    mood: '平静治愈',
    bestFor: ['心理健康', '生活美学', '冥想放松'],
  },
  'cherry-bold': {
    styleName: '樱桃热烈红',
    mood: '醒目大胆',
    bestFor: ['节庆活动', '公益宣传', '紧急通知'],
  },
  'classical-chinese': {
    styleName: '中式古典',
    mood: '传统雅致',
    bestFor: ['国学经典', '诗词鉴赏', '书法绘画'],
  },
  'tech-dark-cn': {
    styleName: '暗夜科技',
    mood: '深邃未来',
    bestFor: ['人工智能', '前沿科技', '黑客松'],
  },
};

export const DEFAULT_COLOR_PALETTE = COLOR_PALETTES['midnight-executive'];

// ── Font Pairings (from pptx skill) ────────────────────────────────────

export interface FontPairing {
  heading: string; // 中文字体主名（PPTX 用）
  body: string;
  en: string; // 英文字体
  headingSize: number;
  pageTitleSize: number;
  bodySize: number;
  captionSize: number;
  headingStack?: string; // CSS 字体栈（SVG / 前端预览用）
  bodyStack?: string;
}

export const FONT_PAIRS: Record<string, FontPairing> = {
  'georgia-calibri': {
    heading: 'Microsoft YaHei',
    body: 'Microsoft YaHei',
    en: 'Georgia',
    headingSize: 52,
    pageTitleSize: 34,
    bodySize: 13,
    captionSize: 10,
    headingStack: '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif',
    bodyStack: '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif',
  },
  'arial-black-arial': {
    heading: 'Microsoft YaHei',
    body: 'Microsoft YaHei',
    en: 'Arial Black',
    headingSize: 48,
    pageTitleSize: 32,
    bodySize: 14,
    captionSize: 11,
    headingStack: '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif',
    bodyStack: '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif',
  },
  'calibri-light': {
    heading: 'PingFang SC',
    body: 'PingFang SC',
    en: 'Calibri',
    headingSize: 50,
    pageTitleSize: 34,
    bodySize: 14,
    captionSize: 10,
    headingStack: '"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif',
    bodyStack: '"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif',
  },
  'cambria-calibri': {
    heading: 'FangSong',
    body: 'FangSong',
    en: 'Cambria',
    headingSize: 52,
    pageTitleSize: 34,
    bodySize: 13,
    captionSize: 10,
    headingStack: 'FangSong, STFangsong, "Fangsong SC", serif',
    bodyStack: 'FangSong, STFangsong, "Fangsong SC", serif',
  },
  'impact-arial': {
    heading: 'SimHei',
    body: 'SimHei',
    en: 'Impact',
    headingSize: 56,
    pageTitleSize: 36,
    bodySize: 14,
    captionSize: 10,
    headingStack: 'SimHei, STHeiti, "Heiti SC", sans-serif',
    bodyStack: 'SimHei, STHeiti, "Heiti SC", sans-serif',
  },
};

export const DEFAULT_FONT_PAIR = FONT_PAIRS['arial-black-arial'];

// ── Allowed Values ─────────────────────────────────────────────────────

export const ALLOWED_MOTIFS = [
  'geometric-lines',
  'ink-wash',
  'neon-grid',
  'organic-circles',
  'chinese-seal',
] as const;

export const ALLOWED_DENSITIES = ['sparse', 'moderate', 'rich'] as const;

export const ALLOWED_CORNER_WEIGHTS = [
  'top-right',
  'scattered',
  'centered',
  'top-left',
  'bottom-right',
] as const;

type DecorationMotif = (typeof ALLOWED_MOTIFS)[number];
type DecorationDensity = (typeof ALLOWED_DENSITIES)[number];
type DecorationCornerWeight = (typeof ALLOWED_CORNER_WEIGHTS)[number];

export const ALLOWED_CARD_STYLES = [
  'accent-left-bar',
  'top-accent-border',
  'shadow-only',
  'filled-accent',
] as const;

export const ALLOWED_BULLET_STYLES = ['dot', 'check', 'arrow', 'chinese-brush'] as const;

export const ALLOWED_PAGE_NUMBER_STYLES = [
  'simple-number',
  'number-slash-total',
  'circle-number',
] as const;

// ── Layout Types ─────────────────────────────────────────────────────

export const ALLOWED_LAYOUT_TYPES = [
  'hero-centered', // 标题居中巨大，装饰散落周围
  'hero-left', // 左对齐文本 + 右侧装饰
  'split-panel', // 左半深色面板放标题，右半浅色放图形
  'big-number', // 超大公式/数字占视觉重心，标题压在上面
  'vertical-poem', // 竖排文字，中式传统书封感
  'corner-drama', // 装饰集中角落，标题在另一端形成张力
  'frame-border', // 细边框包裹，内容居中
  'minimal-type', // 纯排版无装饰，靠字间距和对齐
  'bold-accent', // 顶部或底部粗色带，标题压在上面
  'gradient-wash', // 柔和渐变底，标题悬浮
  'double-stripe', // 上下平行线夹标题
  'image-zone', // 右侧图区占位
] as const;

export type LayoutType = (typeof ALLOWED_LAYOUT_TYPES)[number];

/** motif → candidate layout pool. Each motif's pool is ordered to match the motif's visual language. */
export const MOTIF_LAYOUT_POOL: Record<string, LayoutType[]> = {
  'chinese-seal': [
    'vertical-poem',
    'frame-border',
    'hero-centered',
    'minimal-type',
    'gradient-wash',
  ],
  'ink-wash': ['hero-centered', 'gradient-wash', 'minimal-type', 'frame-border', 'vertical-poem'],
  'geometric-lines': [
    'hero-left',
    'split-panel',
    'corner-drama',
    'bold-accent',
    'big-number',
    'double-stripe',
    'image-zone',
  ],
  'neon-grid': [
    'split-panel',
    'corner-drama',
    'double-stripe',
    'big-number',
    'hero-left',
    'image-zone',
  ],
  'organic-circles': [
    'hero-centered',
    'gradient-wash',
    'minimal-type',
    'image-zone',
    'hero-left',
    'frame-border',
  ],
};

// ── Zod Schema ─────────────────────────────────────────────────────────

export const colorsSchema = z.object({
  coverBg: z.string().regex(/^[0-9A-Fa-f]{6}$/),
  contentBg: z.string().regex(/^[0-9A-Fa-f]{6}$/),
  accent: z.string().regex(/^[0-9A-Fa-f]{6}$/),
  accentSecondary: z.string().regex(/^[0-9A-Fa-f]{6}$/),
  accentLight: z.string().regex(/^[0-9A-Fa-f]{6}$/),
  textPrimary: z.string().regex(/^[0-9A-Fa-f]{6}$/),
  textBody: z.string().regex(/^[0-9A-Fa-f]{6}$/),
  textMuted: z.string().regex(/^[0-9A-Fa-f]{6}$/),
  textOnDark: z.string().regex(/^[0-9A-Fa-f]{6}$/),
});

export const fontsSchema = z.object({
  heading: z.string().min(1),
  body: z.string().min(1),
  en: z.string().min(1),
  headingSize: z.number().min(36).max(72),
  pageTitleSize: z.number().min(24).max(44),
  bodySize: z.number().min(10).max(18),
  captionSize: z.number().min(8).max(14),
  headingStack: z.string().optional(),
  bodyStack: z.string().optional(),
});

export const decorationSchema = z.object({
  motif: z.enum(ALLOWED_MOTIFS),
  density: z.enum(ALLOWED_DENSITIES),
  cornerWeight: z.string(),
});

export const componentsSchema = z.object({
  cardStyle: z.enum(ALLOWED_CARD_STYLES),
  bulletStyle: z.enum(ALLOWED_BULLET_STYLES),
  pageNumberStyle: z.enum(ALLOWED_PAGE_NUMBER_STYLES),
});

export const designDNASchema = z.object({
  styleName: z.string().min(1).max(20),
  recommended: z.boolean(),
  colors: colorsSchema,
  fonts: fontsSchema,
  decoration: decorationSchema,
  components: componentsSchema,
  layoutType: z.enum(ALLOWED_LAYOUT_TYPES).optional(),
  mood: z.string().min(1).max(30),
  bestFor: z.array(z.string()).min(1).max(5),
});

export type DesignDNA = z.infer<typeof designDNASchema>;

// ── Validation & Sanitization ──────────────────────────────────────────

function isColorInAnyPalette(color: string): boolean {
  for (const p of Object.values(COLOR_PALETTES)) {
    if (Object.values(p).some((c) => c.toUpperCase() === color.toUpperCase())) return true;
  }
  return false;
}

function sanitizeColors(colors: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  const defaultColors = DEFAULT_COLOR_PALETTE as unknown as Record<string, string>;
  for (const key of Object.keys(defaultColors)) {
    const val = colors[key];
    result[key] =
      val && /^[0-9A-Fa-f]{6}$/.test(val) && isColorInAnyPalette(val)
        ? val.toUpperCase()
        : defaultColors[key];
  }
  return result;
}

function sanitizeFonts(fonts: Record<string, unknown>): typeof DEFAULT_FONT_PAIR {
  const validPairs = Object.values(FONT_PAIRS);
  // Require exact match on font pair key (heading + body + en + size)
  const found = validPairs.find(
    (p) =>
      p.en === fonts.en &&
      p.heading === fonts.heading &&
      p.body === fonts.body &&
      p.headingSize === fonts.headingSize,
  );
  if (found) return found;
  return DEFAULT_FONT_PAIR;
}

function sanitizeDecoration(dec: Record<string, unknown>): {
  motif: DecorationMotif;
  density: DecorationDensity;
  cornerWeight: DecorationCornerWeight;
  replacementCount: number;
} {
  let replacementCount = 0;
  const motif = ALLOWED_MOTIFS.includes(dec.motif as DecorationMotif)
    ? (dec.motif as DecorationMotif)
    : (replacementCount++, 'geometric-lines');
  const density = ALLOWED_DENSITIES.includes(dec.density as DecorationDensity)
    ? (dec.density as DecorationDensity)
    : (replacementCount++, 'moderate');
  const cornerWeight = ALLOWED_CORNER_WEIGHTS.includes(dec.cornerWeight as DecorationCornerWeight)
    ? (dec.cornerWeight as DecorationCornerWeight)
    : (replacementCount++, 'top-right');
  return { motif, density, cornerWeight, replacementCount };
}

function sanitizeComponents(comp: Record<string, unknown>) {
  return {
    cardStyle: ALLOWED_CARD_STYLES.includes(comp.cardStyle as (typeof ALLOWED_CARD_STYLES)[number])
      ? comp.cardStyle
      : 'accent-left-bar',
    bulletStyle: ALLOWED_BULLET_STYLES.includes(
      comp.bulletStyle as (typeof ALLOWED_BULLET_STYLES)[number],
    )
      ? comp.bulletStyle
      : 'dot',
    pageNumberStyle: ALLOWED_PAGE_NUMBER_STYLES.includes(
      comp.pageNumberStyle as (typeof ALLOWED_PAGE_NUMBER_STYLES)[number],
    )
      ? comp.pageNumberStyle
      : 'number-slash-total',
  };
}

export interface ValidationResult {
  valid: boolean;
  designDNA: DesignDNA;
  replacementCount: number;
  warnings: string[];
}

export function validateDesignDNA(raw: unknown): ValidationResult {
  const warnings: string[] = [];
  let replacementCount = 0;

  // Parse
  const parsed = designDNASchema.safeParse(raw);
  if (!parsed.success) {
    return {
      valid: false,
      designDNA: getDefaultDesignDNA(),
      replacementCount: 999,
      warnings: [`JSON schema validation failed: ${parsed.error.message.slice(0, 200)}`],
    };
  }

  const d = parsed.data;

  // Sanitize colors
  const origColors = { ...d.colors };
  const cleanColors = sanitizeColors(d.colors as unknown as Record<string, string>);
  for (const key of Object.keys(cleanColors)) {
    if (cleanColors[key] !== (origColors as Record<string, string>)[key]) {
      replacementCount++;
      warnings.push(
        `colors.${key} replaced: ${(origColors as Record<string, string>)[key]} → ${cleanColors[key]}`,
      );
    }
  }

  // Sanitize fonts
  const cleanFonts = sanitizeFonts(d.fonts as unknown as Record<string, unknown>);
  if (cleanFonts.en !== d.fonts.en) {
    replacementCount++;
    warnings.push(`fonts replaced: en=${d.fonts.en} → ${cleanFonts.en}`);
  }

  // Sanitize decoration
  const decResult = sanitizeDecoration(d.decoration as unknown as Record<string, unknown>);
  replacementCount += decResult.replacementCount;
  if (decResult.motif !== d.decoration.motif) {
    warnings.push(`decoration.motif replaced: ${d.decoration.motif} → ${decResult.motif}`);
  }

  // Sanitize components
  const cleanComponents = sanitizeComponents(d.components as unknown as Record<string, unknown>);

  const clean: DesignDNA = {
    ...d,
    colors: cleanColors as DesignDNA['colors'],
    fonts: cleanFonts,
    decoration: {
      motif: decResult.motif,
      density: decResult.density,
      cornerWeight: decResult.cornerWeight,
    },
    components: cleanComponents as DesignDNA['components'],
  };

  if (replacementCount > 3) {
    warnings.push(`High replacement count (${replacementCount}) — this style was downgraded`);
  }

  return { valid: replacementCount <= 3, designDNA: clean, replacementCount, warnings };
}

export function getDefaultDesignDNA(): DesignDNA {
  return {
    styleName: '经典天空蓝',
    recommended: false,
    colors: { ...DEFAULT_COLOR_PALETTE },
    fonts: { ...DEFAULT_FONT_PAIR },
    decoration: { motif: 'geometric-lines', density: 'moderate', cornerWeight: 'top-right' },
    components: {
      cardStyle: 'accent-left-bar',
      bulletStyle: 'dot',
      pageNumberStyle: 'number-slash-total',
    },
    layoutType: 'hero-left' as LayoutType,
    mood: '专业学术',
    bestFor: ['通用'],
  };
}
