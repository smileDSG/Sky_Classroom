/**
 * Color conversion utilities for PPTX export.
 *
 * pptxgenjs only accepts 6-digit hex colors (without #).
 * This module converts CSS colors (hex, rgb, rgba) to the format pptxgenjs expects.
 */

export interface PptxColor {
  color: string; // 6-digit hex without #
  transparency?: number; // 0-100
}

/**
 * Convert a CSS color string to pptxgenjs-compatible color + transparency.
 *
 * Supports:
 *   - #RRGGBB / #RGB
 *   - rgb(R, G, B)
 *   - rgba(R, G, B, A)
 *
 * Falls back to the input string (without #) for unrecognized formats.
 */
export function toPptxColor(color: string): PptxColor {
  const trimmed = color.trim();

  // rgba(R, G, B, A)
  const rgbaMatch = trimmed.match(/^rgba?\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})(?:,\s*([\d.]+))?\)$/i);
  if (rgbaMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbaMatch[1], 10)));
    const g = Math.min(255, Math.max(0, parseInt(rgbaMatch[2], 10)));
    const b = Math.min(255, Math.max(0, parseInt(rgbaMatch[3], 10)));
    const a = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
    const hex = ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    const transparency = Math.round((1 - Math.min(1, Math.max(0, a))) * 100);
    return transparency > 0 ? { color: hex, transparency } : { color: hex };
  }

  // #RRGGBBAA
  const hex8Match = trimmed.match(/^#([0-9a-fA-F]{8})$/);
  if (hex8Match) {
    const hex = hex8Match[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = parseInt(hex.slice(6, 8), 16) / 255;
    const color = ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    const transparency = Math.round((1 - Math.min(1, Math.max(0, a))) * 100);
    return transparency > 0 ? { color, transparency } : { color };
  }

  // #RRGGBB or #RGB
  const hexMatch = trimmed.match(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return { color: hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] };
    }
    return { color: hex };
  }

  // Unknown format: strip # and hope for the best
  return { color: trimmed.replace(/^#/, '') };
}

/**
 * Convenience: extract just the hex color string for places that don't need transparency.
 */
export function toPptxHex(color: string): string {
  return toPptxColor(color).color;
}

// ── Luminance & contrast ───────────────────────────────────────────

const LUM_CACHE = new Map<string, number>();

/** Compute relative luminance of a CSS color string (hex/rgb/rgba) */
export function getLuminance(color: string): number {
  const cached = LUM_CACHE.get(color);
  if (cached !== undefined) return cached;
  let r = 0, g = 0, b = 0;
  const hex = color.replace('#', '');
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else if (color.startsWith('rgb')) {
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) {
      r = parseInt(m[1], 10);
      g = parseInt(m[2], 10);
      b = parseInt(m[3], 10);
    }
  }
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const lum = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  LUM_CACHE.set(color, lum);
  return lum;
}

/** Determine whether a color is dark (luminance < 0.35) */
export function isDarkBg(color: string): boolean {
  return getLuminance(color) < 0.35;
}

/**
 * Resolve text color for a given background and theme.
 * If the element's own color conflicts with the background (both dark or both light),
 * fall back to the theme's intended color.
 */
export function resolveTextColor(
  elementColor: string | undefined,
  themeColor: string,
  backgroundColor: string,
): string {
  if (!elementColor) return themeColor;
  const bgDark = isDarkBg(backgroundColor);
  const elDark = isDarkBg(elementColor);
  // Conflict: element color and background are both dark or both light
  if (bgDark === elDark) return themeColor;
  return elementColor;
}
