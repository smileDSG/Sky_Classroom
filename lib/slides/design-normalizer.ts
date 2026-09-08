/**
 * Design Normalizer — enforces the selected DesignDNA template onto
 * AI-generated slides before PPTX export.
 *
 * The element-level LLM tends to copy the placeholder colors in the system
 * prompt (#5b9bd5 style material palette) and invent its own fonts/sizes.
 * This module deterministically remaps every color to the template palette,
 * unifies fonts, rewrites title sizes, repairs low-contrast text against the
 * actual slide background, and drops naked panel shapes on degenerate pages
 * so the exported deck visually matches the template the user picked.
 */
import type { Slide, PPTElement, PPTTextElement } from '@/lib/types/slides';
import type { DesignDNA } from './agent/design-dna';
import { isDarkBg } from './color-utils';
import { createLogger } from '@/lib/logger';

const log = createLogger('DesignNormalizer');

const CANVAS_W = 1000;
const CANVAS_H = 562.5;

interface PaletteSet {
  colors: string[]; // '#RRGGBB'
  textPrimary: string;
  textBody: string;
  textMuted: string;
  textOnDark: string;
  accent: string;
  contentBg: string;
}

function buildPaletteSet(dna: DesignDNA): PaletteSet {
  const h = (c: string) => `#${c.toUpperCase()}`;
  return {
    colors: [
      h(dna.colors.coverBg),
      h(dna.colors.contentBg),
      h(dna.colors.accent),
      h(dna.colors.accentSecondary),
      h(dna.colors.accentLight),
      h(dna.colors.textPrimary),
      h(dna.colors.textBody),
      h(dna.colors.textMuted),
      h(dna.colors.textOnDark),
    ],
    textPrimary: h(dna.colors.textPrimary),
    textBody: h(dna.colors.textBody),
    textMuted: h(dna.colors.textMuted),
    textOnDark: h(dna.colors.textOnDark),
    accent: h(dna.colors.accent),
    contentBg: h(dna.colors.contentBg),
  };
}

function parseHex(color: string): [number, number, number] | null {
  const m = color.trim().match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return null;
  const v = m[1];
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

/** Nearest palette color in RGB space. Falls back to the input for unparsable colors. */
function nearestPalette(color: string, palette: PaletteSet): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  let best = palette.colors[0];
  let bestDist = Infinity;
  for (const candidate of palette.colors) {
    const c = parseHex(candidate)!;
    const dist = (rgb[0] - c[0]) ** 2 + (rgb[1] - c[1]) ** 2 + (rgb[2] - c[2]) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best;
}

/** Effective slide background color (falls back to theme contentBg). */
export function slideBackgroundColor(slide: Slide, fallback: string): string {
  const bg = slide.background;
  if (bg?.type === 'solid' && bg.color) return bg.color;
  if (bg?.type === 'gradient' && bg.gradient?.colors?.length) {
    return bg.gradient.colors[0].color;
  }
  return fallback;
}

/** Repair contrast: dark text on dark bg → textOnDark; light text on light bg → textPrimary. */
function repairContrast(color: string, bgColor: string, palette: PaletteSet): string {
  try {
    const bgDark = isDarkBg(bgColor);
    const fgDark = isDarkBg(color);
    if (bgDark && fgDark) return palette.textOnDark;
    if (!bgDark && !fgDark) return palette.textPrimary;
  } catch {
    /* unparsable colors — leave as-is */
  }
  return color;
}

/** Rewrite inline styles inside element HTML content. */
function remapInlineStyles(content: string, palette: PaletteSet, bg: string): string {
  let out = content;
  // Hex colors (#rgb/#rrggbb/#rrggbbaa), but not `background-color` etc.
  out = out.replace(/(?<![a-zA-Z-])color\s*:\s*(#)([0-9a-fA-F]{3,8})/g, (_m, p1, hex) => {
    const mapped = repairContrast(nearestPalette(hex, palette), bg, palette);
    return `color:${p1}${mapped.replace('#', '')}`;
  });
  // rgb()/rgba() colors
  out = out.replace(
    /(?<![a-zA-Z-])color\s*:\s*rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g,
    (_m, r, g, b) => {
      const hex = ((1 << 24) + (r << 16) + (g << 8) + +b).toString(16).slice(1);
      const mapped = repairContrast(nearestPalette(hex, palette), bg, palette);
      return `color:${mapped.toLowerCase()}`;
    },
  );
  // Unify fonts: strip inline font-family so defaultFontName governs
  out = out.replace(/font-family\s*:[^;"'})]+;?/gi, '');
  return out;
}

function visibleLength(html: string): number {
  const text = html.replace(/<[^>]*>/g, '').trim();
  let len = 0;
  for (const ch of text) {
    len += /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/.test(ch) ? 1 : 0.55;
  }
  return len;
}

/** Width-aware title font size in px (canvas px units). */
function titleFontSizePx(el: PPTTextElement, dna: DesignDNA): number {
  const target = Math.round(dna.fonts.pageTitleSize * 1.389); // pt → canvas px
  const effLen = Math.max(1, visibleLength(el.content || ''));
  const maxFit = Math.floor(el.width / effLen);
  return Math.max(26, Math.min(56, target, maxFit));
}

function normalizeTextElement(
  el: PPTTextElement,
  isTitle: boolean,
  bg: string,
  dna: DesignDNA,
  palette: PaletteSet,
): PPTTextElement {
  const base = isTitle ? palette.textPrimary : palette.textBody;
  const defaultColor = repairContrast(
    nearestPalette(el.defaultColor || base, palette),
    bg,
    palette,
  );
  let content = remapInlineStyles(el.content || '', palette, bg);
  if (isTitle) {
    const px = titleFontSizePx(el, dna);
    if (/font-size\s*:/i.test(content)) {
      content = content.replace(/font-size\s*:\s*[\d.]+(px|pt)/gi, `font-size:${px}px`);
    }
  }
  return {
    ...el,
    defaultColor,
    content,
    defaultFontName: isTitle ? dna.fonts.heading : dna.fonts.body,
    fill: el.fill ? nearestPalette(el.fill, palette) : el.fill,
  };
}

function normalizeShapeLike(el: PPTElement, palette: PaletteSet): PPTElement {
  const s = el as PPTElement & {
    fill?: string;
    outline?: { color?: string; width?: number; style?: string };
  };
  const next = { ...s } as PPTElement & {
    fill?: string;
    outline?: { color?: string; width?: number; style?: string };
  };
  if (s.fill) next.fill = nearestPalette(s.fill, palette);
  if (s.outline?.color) {
    next.outline = { ...s.outline, color: nearestPalette(s.outline.color, palette) };
  }
  return next;
}

function normalizeLine(el: PPTElement, palette: PaletteSet): PPTElement {
  const line = el as PPTElement & { color?: string };
  if (!line.color) return el;
  return { ...line, color: nearestPalette(line.color, palette) } as PPTElement;
}

/**
 * Enforce the DesignDNA design system onto generated slides.
 * Cover slides are skipped (the exporter renders the template cover instead).
 */
export function normalizeSlideDesign(slides: Slide[], dna: DesignDNA): Slide[] {
  const palette = buildPaletteSet(dna);

  return slides.map((slide) => {
    if (slide.type === 'cover') return slide;

    const bg = slideBackgroundColor(slide, palette.contentBg);
    let elements = [...slide.elements];
    const titleIdx = elements.findIndex((el) => el.type === 'text');

    elements = elements.map((el, idx) => {
      switch (el.type) {
        case 'text':
          return normalizeTextElement(el as PPTTextElement, idx === titleIdx, bg, dna, palette);
        case 'shape':
          return normalizeShapeLike(el, palette);
        case 'line':
          return normalizeLine(el, palette);
        default:
          return el;
      }
    });

    // Degenerate page guard: a content slide that is mostly an empty panel
    // (LLM emitted a bare rectangle instead of real content) looks broken.
    // Drop the naked panel so at least no giant empty box is rendered.
    const isContent = slide.type !== 'end';
    const totalText = elements
      .filter((el): el is PPTTextElement => el.type === 'text')
      .reduce((sum, el) => sum + visibleLength(el.content || ''), 0);
    if (isContent && totalText < 30) {
      const before = elements.length;
      elements = elements.filter((el) => {
        if (el.type !== 'shape') return true;
        const h = (el as unknown as { height?: number }).height ?? el.width;
        return el.width * h <= 0.3 * CANVAS_W * CANVAS_H;
      });
      if (elements.length !== before) {
        log.warn(
          `[normalizeSlideDesign] dropped ${before - elements.length} empty panel(s) on near-empty content slide`,
        );
      }
    }

    return { ...slide, elements };
  });
}
