/**
 * PPTX Table Handler
 *
 * Converts table data to pptxgenjs Table with theme-aware styling.
 * Supports header rows, alternating row colors, and cell alignment.
 */

import type pptxgen from 'pptxgenjs';
import type { ThemeToken } from './types';
import { createLogger } from '@/lib/logger';
import { toPptxHex, toPptxColor } from './color-utils';

const log = createLogger('PptxTableHandler');

interface PPTTableElement {
  id: string;
  type: 'table';
  left: number;
  top: number;
  width: number;
  height: number;
  headers?: string[];
  rows?: string[][];
  rotate?: number;
}

interface TableHandlerOptions {
  theme: ThemeToken;
  ratioPx2Inch: number;
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Add a table element to a PPTX slide.
 *
 * The table is rendered using pptxgenjs native addTable() for best quality.
 * Header row gets theme accent background, data rows alternate white/light-gray.
 */
export function addTableToSlide(
  pptxSlide: pptxgen.Slide,
  element: PPTTableElement,
  options: TableHandlerOptions,
): void {
  const { theme, ratioPx2Inch } = options;

  const x = element.left / ratioPx2Inch;
  const y = element.top / ratioPx2Inch;
  const w = element.width / ratioPx2Inch;
  const h = element.height / ratioPx2Inch;

  const headers = element.headers || [];
  const rows = element.rows || [];

  if (headers.length === 0 && rows.length === 0) {
    log.warn(`Table ${element.id}: no data, skipping`);
    return;
  }

  // Build table rows for pptxgenjs
  const tableRows: pptxgen.TableRow[] = [];

  // Header row
  if (headers.length > 0) {
    tableRows.push(
      headers.map((cell) => ({
        text: cell,
        options: {
          bold: true,
          fontSize: theme.bodyFontSize - 2,
          fontFace: theme.fontFamily,
          color: toPptxHex(theme.coverTitleColor),
          fill: toPptxColor(theme.accentLight),
          align: 'center' as const,
          valign: 'middle' as const,
        },
      })),
    );
  }

  // Data rows with alternating colors
  const normalizedBg = theme.contentBg.startsWith('#')
    ? toPptxHex(theme.contentBg)
    : theme.contentBg;
  const isDarkContent = normalizedBg.length === 6 && parseInt(normalizedBg, 16) < 0x808080;
  const altRowColor = isDarkContent
    ? '#334155'
    : normalizedBg === 'ffffff'
      ? '#f8fafc'
      : theme.contentBg;
  const baseRowColor = theme.contentBg;

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const rowColor = ri % 2 === 0 ? baseRowColor : altRowColor;

    tableRows.push(
      row.map((cell) => ({
        text: cell,
        options: {
          fontSize: theme.bodyFontSize - 2,
          fontFace: theme.fontFamily,
          color: toPptxHex(theme.bodyColor),
          fill: { color: toPptxHex(rowColor) },
          align: 'center' as const,
          valign: 'middle' as const,
        },
      })),
    );
  }

  // Calculate column widths (equal distribution)
  const colCount = Math.max(headers.length, rows[0]?.length || 1);
  const colW = w / colCount;
  const colWidths = Array(colCount).fill(colW);

  try {
    pptxSlide.addTable(tableRows, {
      x,
      y,
      w,
      h,
      colW: colWidths,
      border: {
        type: 'solid',
        pt: 0.5,
        color: toPptxHex(theme.dividerColor),
      },
      fontFace: theme.fontFamily,
      fontSize: theme.bodyFontSize - 2,
      color: toPptxHex(theme.bodyColor),
      align: 'center',
      valign: 'middle',
      ...(element.rotate ? { rotate: element.rotate } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    log.error(`Table ${element.id}: failed to render: ${msg}`);
    // Fallback: render as text
    addTableFallback(pptxSlide, x, y, w, h, headers, rows, theme);
  }
}

/**
 * Build a simple text-based table fallback when native table fails.
 */
function addTableFallback(
  pptxSlide: pptxgen.Slide,
  x: number,
  y: number,
  w: number,
  h: number,
  headers: string[],
  rows: string[][],
  theme: ThemeToken,
): void {
  const allLines: string[] = [];

  if (headers.length > 0) {
    allLines.push(headers.join(' | '));
    allLines.push(headers.map(() => '---').join(' | '));
  }

  for (const row of rows) {
    allLines.push(row.join(' | '));
  }

  pptxSlide.addText(allLines.join('\n'), {
    x,
    y,
    w,
    h,
    fontSize: theme.bodyFontSize - 2,
    fontFace: theme.fontFamily,
    color: toPptxHex(theme.bodyColor),
    fill: { color: toPptxHex(theme.contentBg) },
  });
}
