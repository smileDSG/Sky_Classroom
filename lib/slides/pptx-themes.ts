/**
 * Sky Classroom — PPTX Theme Definitions (O-008)
 *
 * Backward-compatible theme system that bridges legacy PptxTheme
 * with the new ThemeToken architecture.
 */

import type { ThemeToken, PptxThemeId } from './types';
import { getThemeById } from './themes';
import type { DesignDNA } from './agent/design-dna';

export type { PptxThemeId } from './types';

/** @deprecated Use ThemeToken from lib/slides/types instead */
export interface PptxTheme {
  id: PptxThemeId;
  name: string;
  description: string;
  coverBg: string;
  contentBg: string;
  accent: string;
  coverTitleColor: string;
  coverSubColor: string;
  bodyColor: string;
  pageNumColor: string;
  fontFamily: string;
  titleFontSize: number;
  bodyFontSize: number;
  coverTitleSize: number;
  useWideContent: boolean;
}

/** Convert new ThemeToken to legacy PptxTheme for backward compatibility */
function toLegacyTheme(token: ThemeToken): PptxTheme {
  return {
    id: token.id,
    name: token.name,
    description: token.description,
    coverBg: token.coverBgGradient ? token.coverBgGradient.from : token.coverBg,
    contentBg: token.contentBg,
    accent: token.accent,
    coverTitleColor: token.coverTitleColor,
    coverSubColor: token.coverSubColor,
    bodyColor: token.bodyColor,
    pageNumColor: token.pageNumColor,
    fontFamily: token.fontFamily,
    titleFontSize: token.titleFontSize,
    bodyFontSize: token.bodyFontSize,
    coverTitleSize: token.coverTitleSize,
    useWideContent: token.useWideContent,
  };
}

/** Legacy registry for backward compatibility */
export const PPTX_THEMES: Record<PptxThemeId, PptxTheme> = {
  'academic-navy': toLegacyTheme(getThemeById('academic-navy')),
  'sky-blue': toLegacyTheme(getThemeById('sky-blue')), // 历史别名
  minimal: toLegacyTheme(getThemeById('minimal')),
  academic: toLegacyTheme(getThemeById('academic')),
  'tech-dark': toLegacyTheme(getThemeById('tech-dark')),
  'nature-fresh': toLegacyTheme(getThemeById('nature-fresh')),
  'macaron-pink': toLegacyTheme(getThemeById('macaron-pink')),
  handdrawn: toLegacyTheme(getThemeById('handdrawn')),
};

/** Get legacy theme by ID (backward compatible) */
export function getPptxTheme(id: PptxThemeId): PptxTheme {
  return PPTX_THEMES[id] || PPTX_THEMES['academic-navy'];
}

/** Get full ThemeToken (recommended for new code) */
export function getTheme(id: PptxThemeId): ThemeToken {
  return getThemeById(id);
}

/**
 * Build a ThemeToken from a user-selected DesignDNA template.
 *
 * The base theme (chosen by motif/style heuristics) provides layout
 * metrics and decorations; all colors, fonts, and font sizes come from
 * the DesignDNA so the exported deck matches the previewed template.
 */
export function buildThemeFromDesignDNA(dna: DesignDNA, baseId: PptxThemeId): ThemeToken {
  const base = getTheme(baseId);
  const c = dna.colors;
  const f = dna.fonts;
  const hex = (v: string) => `#${v.toUpperCase()}`;

  // 统一中文字体为思源黑体 Noto Sans SC，并固定学术级字号层级。
  // 避免个别 legacy 风格把微软雅黑/小字号带到导出课件，导致字体与字号忽乱。
  const cnFont = 'Noto Sans SC';
  const bodyFontSize = Math.min(30, Math.max(14, f.bodySize + 2));
  const captionFontSize = Math.min(20, Math.max(11, f.captionSize + 2));

  return {
    ...base,
    name: `${dna.styleName}（基于${base.name}）`,
    description: `设计基因主题：${dna.styleName} / ${dna.mood}`,
    coverBg: hex(c.coverBg),
    coverBgGradient: base.coverBgGradient
      ? { ...base.coverBgGradient, from: hex(c.coverBg), to: hex(c.accentLight) }
      : undefined,
    contentBg: hex(c.contentBg),
    contentBgGradient: base.contentBgGradient
      ? { ...base.contentBgGradient, from: hex(c.contentBg) }
      : undefined,
    accent: hex(c.accent),
    accentSecondary: hex(c.accentSecondary),
    accentLight: hex(c.accentLight),
    coverTitleColor: hex(c.textOnDark),
    coverSubColor: hex(c.textMuted),
    bodyColor: hex(c.textPrimary),
    bodyMutedColor: hex(c.textMuted),
    pageNumColor: hex(c.textMuted),
    dividerColor: hex(c.accentLight),
    fontFamily: cnFont,
    headingFont: cnFont,
    coverTitleSize: Math.min(56, Math.max(36, base.coverTitleSize)),
    coverSubSize: Math.min(24, Math.max(14, base.coverSubSize)),
    titleFontSize: Math.min(36, Math.max(24, base.titleFontSize)),
    bodyFontSize,
    captionFontSize,
    shapeOutlineColor: hex(c.accentLight),
  };
}

export { getThemeById, getAllThemes, getAllThemeIds } from './themes';
