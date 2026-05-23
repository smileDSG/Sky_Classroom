/**
 * Template Decorator Generators
 *
 * Generates decorative elements (shapes, lines, overlays) based on theme tokens.
 * Used by slide templates to create visually rich cover and content slides.
 */

import { nanoid } from 'nanoid';
import type { ThemeToken } from './types';
import type { PPTElement, PPTTextElement } from '@/lib/types/slides';

// ── Helpers ────────────────────────────────────────────────────────

function elId(prefix: string): string {
  return `${prefix}_${nanoid(6)}`;
}

// ── Cover Decorations ──────────────────────────────────────────────

/**
 * Generate decorative elements for a cover slide based on theme.
 * These are overlay shapes/lines that add visual interest to the cover.
 */
export function generateCoverDecorations(theme: ThemeToken): PPTElement[] {
  const elements: PPTElement[] = [];

  for (const dec of theme.coverDecorations) {
    const base = {
      id: elId('dec'),
      left: dec.position.x,
      top: dec.position.y,
      width: dec.position.w,
      height: dec.position.h,
      rotate: 0,
    };

    if (dec.type === 'shape') {
      const shapeStyle = dec.style as Record<string, unknown>;
      const opacity = (shapeStyle.opacity as number) ?? 0.1;
      const fillColor = shapeStyle.fill as string;
      const shape = (shapeStyle.shape as string) || 'rect';

      // For simple rect decorations
      elements.push({
        ...base,
        id: elId('dec_shape'),
        type: 'shape',
        path:
          shape === 'ellipse'
            ? 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z'
            : 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
        viewBox: shape === 'ellipse' ? '0 0 100 100' : '0 0 1 1',
        fill: fillColor,
        fixedRatio: false,
        rotate: 0,
        // Store opacity in a way the renderer can use
        ...(opacity < 1 ? { opacity } : {}),
      } as PPTElement);
    } else if (dec.type === 'line') {
      const lineStyle = dec.style as Record<string, unknown>;
      elements.push({
        ...base,
        id: elId('dec_line'),
        type: 'line',
        start: [0, 0],
        end: [dec.position.w, 0],
        color: (lineStyle.color as string) || theme.accent,
        width: (lineStyle.width as number) || 2,
        rotate: 0,
      } as unknown as PPTElement);
    }
    // gradient-overlay is handled at slide background level, not as element
  }

  return elements;
}

// ── Bullet Generators ──────────────────────────────────────────────

/** Generate a bullet list with theme-aware styling */
export function generateBulletElements(
  items: string[],
  theme: ThemeToken,
  startY: number,
  options: {
    maxWidth?: number;
    leftMargin?: number;
    lineHeight?: number;
    maxItems?: number;
  } = {},
): PPTElement[] {
  const { maxWidth = 880, leftMargin = 60, lineHeight = 65, maxItems = 6 } = options;
  const count = Math.min(items.length, maxItems);
  const elements: PPTElement[] = [];

  for (let i = 0; i < count; i++) {
    const y = startY + i * lineHeight;

    // Bullet marker
    const bulletEl = createBulletMarker(
      theme,
      leftMargin,
      y + 10,
      i + 1,
    );
    elements.push(bulletEl);

    // Text
    const textEl: PPTTextElement = {
      id: elId('bullet_txt'),
      type: 'text',
      left: leftMargin + 32,
      top: y,
      width: maxWidth - leftMargin - 32,
      height: 50,
      content: `<p style="font-size:${theme.bulletSize}px;line-height:1.5;color:${theme.bodyColor};">${escapeHtml(items[i] ?? '')}</p>`,
      defaultFontName: theme.fontFamily,
      defaultColor: theme.bodyColor,
      rotate: 0,
    };
    elements.push(textEl as PPTElement);
  }

  return elements;
}

function createBulletMarker(
  theme: ThemeToken,
  x: number,
  y: number,
  index: number,
): PPTElement {
  const size = theme.bulletSize >= 16 ? 10 : 8;

  switch (theme.bulletStyle) {
    case 'square': {
      return {
        id: elId('bullet'),
        type: 'shape',
        left: x,
        top: y + 4,
        width: size,
        height: size,
        path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
        viewBox: '0 0 1 1',
        fill: theme.accent,
        fixedRatio: false,
        rotate: 0,
      } as PPTElement;
    }
    case 'check': {
      // Use a small colored circle for check style (simplified)
      return {
        id: elId('bullet'),
        type: 'shape',
        left: x,
        top: y + 4,
        width: size,
        height: size,
        path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
        viewBox: '0 0 100 100',
        fill: theme.accent,
        fixedRatio: false,
        rotate: 0,
      } as PPTElement;
    }
    case 'arrow': {
      return {
        id: elId('bullet'),
        type: 'shape',
        left: x,
        top: y + 4,
        width: size,
        height: size,
        path: 'M 0 50 L 60 0 L 60 30 L 100 30 L 100 70 L 60 70 L 60 100 Z',
        viewBox: '0 0 100 100',
        fill: theme.accent,
        fixedRatio: false,
        rotate: 0,
      } as PPTElement;
    }
    case 'dot':
    default: {
      return {
        id: elId('bullet'),
        type: 'shape',
        left: x,
        top: y + 4,
        width: size,
        height: size,
        path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
        viewBox: '0 0 100 100',
        fill: theme.accent,
        fixedRatio: false,
        rotate: 0,
      } as PPTElement;
    }
  }
}

// ── Numbered Step Generators ───────────────────────────────────────

/** Generate numbered circle badges for step layouts */
export function generateStepBadges(
  count: number,
  theme: ThemeToken,
  positions: { x: number; y: number }[],
): PPTElement[] {
  const elements: PPTElement[] = [];
  const badgeSize = 48;

  for (let i = 0; i < Math.min(count, positions.length); i++) {
    const pos = positions[i];

    // Circle background
    elements.push({
      id: elId('step_bg'),
      type: 'shape',
      left: pos.x,
      top: pos.y,
      width: badgeSize,
      height: badgeSize,
      path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
      viewBox: '0 0 100 100',
      fill: theme.accent,
      fixedRatio: false,
      rotate: 0,
    } as PPTElement);

    // Number text
    elements.push({
      id: elId('step_num'),
      type: 'text',
      left: pos.x,
      top: pos.y + 4,
      width: badgeSize,
      height: badgeSize,
      content: `<p style="font-size:20px;text-align:center;color:#ffffff;line-height:${badgeSize - 8}px;"><strong>${i + 1}</strong></p>`,
      defaultFontName: theme.fontFamily,
      defaultColor: '#ffffff',
      rotate: 0,
    } as PPTElement);
  }

  return elements;
}

// ── Card Generators ────────────────────────────────────────────────

/** Generate card background shapes for grid layouts */
export function generateCardBackgrounds(
  count: number,
  theme: ThemeToken,
  positions: { x: number; y: number; w: number; h: number }[],
): PPTElement[] {
  const elements: PPTElement[] = [];

  for (let i = 0; i < Math.min(count, positions.length); i++) {
    const pos = positions[i];
    elements.push({
      id: elId('card_bg'),
      type: 'shape',
      left: pos.x,
      top: pos.y,
      width: pos.w,
      height: pos.h,
      path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
      viewBox: '0 0 1 1',
      fill: theme.accentLight,
      fixedRatio: false,
      rotate: 0,
      outline: {
        color: theme.shapeOutlineColor,
        width: 1,
        style: 'solid',
      },
    } as PPTElement);
  }

  return elements;
}

// ── Divider Generators ─────────────────────────────────────────────

/** Generate a horizontal divider line */
export function generateDivider(
  theme: ThemeToken,
  y: number,
  options: { left?: number; width?: number; height?: number } = {},
): PPTElement {
  const left = options.left ?? 60;
  const width = options.width ?? 880;
  const height = options.height ?? 2;

  return {
    id: elId('divider'),
    type: 'line',
    left,
    top: y,
    width,
    height,
    start: [0, 0],
    end: [width, 0],
    color: theme.dividerColor,
    rotate: 0,
  } as unknown as PPTElement;
}

// ── Quote Decorations ──────────────────────────────────────────────

/** Generate large quotation mark decoration for quote slides */
export function generateQuoteDecoration(
  theme: ThemeToken,
  x: number,
  y: number,
): PPTElement {
  return {
    id: elId('quote_dec'),
    type: 'text',
    left: x,
    top: y,
    width: 80,
    height: 80,
    content: `<p style="font-size:64px;color:${theme.accent};opacity:0.2;font-family:${theme.headingFont};">"</p>`,
    defaultFontName: theme.headingFont,
    defaultColor: theme.accent,
    rotate: 0,
  } as PPTElement;
}

// ── Table Generators ───────────────────────────────────────────────

/** Generate table cell elements with theme styling */
export function generateTableCells(
  headers: string[],
  rows: string[][],
  theme: ThemeToken,
  startY: number,
): PPTElement[] {
  const elements: PPTElement[] = [];
  const allRows = [headers, ...rows];
  const colCount = headers.length || 1;
  const rowHeight = 40;
  const tableWidth = 880;
  const colWidth = tableWidth / colCount;
  const leftMargin = 60;

  for (let ri = 0; ri < allRows.length; ri++) {
    const row = allRows[ri];
    const y = startY + ri * rowHeight;
    const isHeader = ri === 0;

    for (let ci = 0; ci < row.length; ci++) {
      const cellLeft = leftMargin + ci * colWidth;

      // Cell background (header only)
      if (isHeader) {
        elements.push({
          id: elId('tbl_bg'),
          type: 'shape',
          left: cellLeft,
          top: y,
          width: colWidth,
          height: rowHeight,
          path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
          viewBox: '0 0 1 1',
          fill: theme.accentLight,
          fixedRatio: false,
          rotate: 0,
        } as PPTElement);
      }

      // Cell text
      elements.push({
        id: elId('tbl_txt'),
        type: 'text',
        left: cellLeft + 12,
        top: y + 8,
        width: colWidth - 24,
        height: rowHeight - 16,
        content: `<p style="font-size:14px;line-height:${rowHeight - 16}px;${isHeader ? 'font-weight:bold;' : ''}color:${isHeader ? theme.coverTitleColor : theme.bodyColor};">${escapeHtml(row[ci] ?? '')}</p>`,
        defaultFontName: theme.fontFamily,
        defaultColor: isHeader ? theme.coverTitleColor : theme.bodyColor,
        rotate: 0,
      } as PPTElement);
    }
  }

  return elements;
}

// ── Utilities ──────────────────────────────────────────────────────

function escapeHtml(text: string | null | undefined): string {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Build a gradient background definition for Slide.background */
export function buildGradientBackground(
  gradient: NonNullable<ThemeToken['coverBgGradient']>,
): { type: 'gradient'; gradient: { type: 'linear'; rotate: number; colors: Array<{ pos: number; color: string }> } } {
  return {
    type: 'gradient',
    gradient: {
      type: 'linear',
      rotate: gradient.angle,
      colors: [
        { pos: 0, color: gradient.from },
        { pos: 1, color: gradient.to },
      ],
    },
  };
}
