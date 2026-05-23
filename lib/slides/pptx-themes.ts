/**
 * Sky Classroom — PPTX Theme Definitions (O-008)
 *
 * Backward-compatible theme system that bridges legacy PptxTheme
 * with the new ThemeToken architecture.
 */

import type { ThemeToken, PptxThemeId } from './types';
import { getThemeById } from './themes';

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
    coverBg: token.coverBgGradient
      ? token.coverBgGradient.from
      : token.coverBg,
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
  'sky-blue': toLegacyTheme(getThemeById('sky-blue')),
  minimal: toLegacyTheme(getThemeById('minimal')),
  academic: toLegacyTheme(getThemeById('academic')),
  'tech-dark': toLegacyTheme(getThemeById('tech-dark')),
  'nature-fresh': toLegacyTheme(getThemeById('nature-fresh')),
  'macaron-pink': toLegacyTheme(getThemeById('macaron-pink')),
};

/** Get legacy theme by ID (backward compatible) */
export function getPptxTheme(id: PptxThemeId): PptxTheme {
  return PPTX_THEMES[id] || PPTX_THEMES['sky-blue'];
}

/** Get full ThemeToken (recommended for new code) */
export function getTheme(id: PptxThemeId): ThemeToken {
  return getThemeById(id);
}

export { getThemeById, getAllThemes, getAllThemeIds } from './themes';
