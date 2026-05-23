/**
 * Sky Classroom — PPTX Exporter v2
 *
 * Theme-aware, element-complete PPTX generation.
 * Replaces the original exporter with:
 *   - Full element support (text, shape, line, latex, image, table)
 *   - Native shape mapping (roundRect, ellipse, arrow, etc.)
 *   - Theme-aware cover/end slides with decorations
 *   - Proper image/table embedding
 *   - Graceful degradation for unsupported elements
 *
 * Architecture:
 *   1. Build PPTX document with theme metadata
 *   2. Render cover slide (theme-aware)
 *   3. Render content slides (element-by-element with type dispatch)
 *   4. Render end slide (theme-aware)
 *   5. Write to buffer
 */

import pptxgen from 'pptxgenjs';
import path from 'path';
import { latexToOmml } from '@/lib/export/latex-to-omml';
import { mapShapeToPptx } from './pptx-shape-mapper';
import { addImageToSlide } from './pptx-image-handler';
import { addTableToSlide } from './pptx-table-handler';
import { addChartToSlide } from './pptx-chart-handler';
import type { ThemeToken, PptxThemeId } from './types';
import type { PPTElement, PPTTextElement, PPTChartElement, Slide } from '@/lib/types/slides';
import type { AvatarSpeech } from './types';
import { getTheme } from './pptx-themes';
import { createLogger } from '@/lib/logger';
import { toPptxHex, toPptxColor, resolveTextColor } from './color-utils';

const log = createLogger('PptxExporterV2');

/** Resolve background image path: URL → absolute filesystem path */
function resolveBgImagePath(src: string): string | null {
  // Already an absolute path
  if (src.startsWith('/')) {
    return path.join(process.cwd(), 'public', src);
  }
  // Relative path
  if (!src.includes('://')) {
    return path.join(process.cwd(), 'public', src);
  }
  // Remote URL — pptxgenjs can fetch it directly in Node
  return src;
}


/** Merge pptx color transparency with element opacity. */
function mergeTransparency(pptxColor: { color: string; transparency?: number }, opacity?: number): { color: string; transparency?: number } {
  if (opacity !== undefined && opacity < 1) {
    const t = (1 - opacity) * 100;
    return { color: pptxColor.color, transparency: pptxColor.transparency !== undefined ? Math.min(100, t + pptxColor.transparency) : t };
  }
  return pptxColor;
}

// ── Types ──────────────────────────────────────────────────────────

export interface PptxExportOptions {
  title: string;
  slides: Slide[];
  theme?: PptxThemeId;
  speakerNotes?: string[];
  avatarSpeech?: AvatarSpeech;
  includeSlides?: boolean;
  includeSpeakerNotes?: boolean;
  /** Pre-resolved images: elementId -> base64 data URI */
  resolvedImages?: Map<string, string>;
  /** Layout mode: 'ai' = AI-controlled layout (python-pptx), 'template' = WPS template fill */
  layoutMode?: 'ai' | 'template';
}

export interface PptxExportResult {
  buffer: Buffer;
  fileName: string;
  size: number;
}

interface ElementRendererContext {
  pptxSlide: pptxgen.Slide;
  theme: ThemeToken;
  ratioPx2Inch: number;
  ratioPx2Pt: number;
  resolvedImages?: Map<string, string>;
}

// ── Main Export ────────────────────────────────────────────────────

export async function exportPptx(options: PptxExportOptions): Promise<PptxExportResult> {
  const {
    title,
    slides,
    speakerNotes,
    avatarSpeech,
    includeSpeakerNotes,
    resolvedImages,
  } = options;

  const theme = getTheme(options.theme || 'sky-blue');
  const startTime = Date.now();
  const totalSlides = slides.length;

  // Extract cover title from AI-generated cover slide
  const aiCover = slides.find((s) => s.type === 'cover');
  const coverTitle = extractTitleFromSlide(aiCover) || title;
  const coverSubtitle = extractSubtitleFromSlide(aiCover) || '';

  // Build document
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'OpenMAIC Sky Classroom';
  pptx.title = coverTitle;
  pptx.subject = title;

  // ── Define Slide Masters ─────────────────────────────────────────
  pptx.defineSlideMaster({
    title: 'sky-content-master',
    background: { color: toPptxHex(theme.contentBg) },
    margin: [theme.pageMargin / 96, theme.pageMargin / 96, theme.pageMargin / 96, theme.pageMargin / 96],
    objects: [
      {
        placeholder: {
          options: { name: 'title', type: 'title', x: theme.pageMargin / 96, y: 0.5, w: theme.contentMaxWidth / 96, h: 0.6 },
          text: 'Click to add title',
        },
      },
      {
        placeholder: {
          options: { name: 'body', type: 'body', x: theme.pageMargin / 96, y: 1.2, w: theme.contentMaxWidth / 96, h: 5 },
          text: 'Click to add text',
        },
      },
    ],
  });

  // ── Cover Slide ──────────────────────────────────────────────────
  const coverSlide = pptx.addSlide();
  if (aiCover?.background?.type === 'image' && aiCover.background.image?.src) {
    const bgSrc = resolveBgImagePath(aiCover.background.image.src);
    if (bgSrc) coverSlide.background = { path: bgSrc };
  }
  renderCoverSlide(coverSlide, coverTitle, coverSubtitle, theme);

  // ── Content Slides ───────────────────────────────────────────────
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    if (slide.type === 'cover' || slide.type === 'end') continue;

    const pptxSlide = pptx.addSlide({ masterName: 'sky-content-master' });
    if (slide.background?.type === 'image' && slide.background.image?.src) {
      const bgSrc = resolveBgImagePath(slide.background.image.src);
      if (bgSrc) pptxSlide.background = { path: bgSrc };
    }
    renderContentSlide(pptxSlide, slide, theme, resolvedImages);

    // Page number
    pptxSlide.addText(`${i + 1} / ${totalSlides}`, {
      x: 11.5,
      y: 7,
      w: 1.5,
      h: 0.3,
      fontSize: 8,
      fontFace: theme.fontFamily,
      color: toPptxHex(theme.pageNumColor),
      align: 'right',
    });

    // Speaker notes
    const note = buildSpeakerNote(i, speakerNotes, avatarSpeech);
    if (note && includeSpeakerNotes) {
      pptxSlide.addNotes(note);
    }
  }

  // ── End Slide ────────────────────────────────────────────────────
  const endSlide = pptx.addSlide();
  const aiEnd = slides.find((s) => s.type === 'end');
  if (aiEnd?.background?.type === 'image' && aiEnd.background.image?.src) {
    const bgSrc = resolveBgImagePath(aiEnd.background.image.src);
    if (bgSrc) endSlide.background = { path: bgSrc };
  }
  renderEndSlide(endSlide, title, theme);

  // ── Write ────────────────────────────────────────────────────────
  const buffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  const elapsed = Date.now() - startTime;

  log.info(
    `PPTX exported: "${title}" [${theme.id}] (${slides.length} slides, ${(buffer.length / 1024).toFixed(1)}KB) in ${elapsed}ms`,
  );

  return {
    buffer,
    fileName: `${sanitizeFileName(title)}.pptx`,
    size: buffer.length,
  };
}

// ── Slide Renderers ────────────────────────────────────────────────

function renderCoverSlide(
  pptxSlide: pptxgen.Slide,
  title: string,
  subtitle: string,
  theme: ThemeToken,
): void {
  // Background
  if (theme.coverBgGradient) {
    pptxSlide.background = {
      color: toPptxHex(theme.coverBgGradient.from),
    };
    // Note: pptxgenjs doesn't support native gradients for slide backgrounds
    // We use the "from" color as solid fallback
  } else {
    pptxSlide.background = { color: toPptxHex(theme.coverBg) };
  }

  // Render cover decorations as shapes
  for (const dec of theme.coverDecorations) {
    renderDecoration(pptxSlide, dec, theme);
  }

  // Title
  pptxSlide.addText(title, {
    x: 0.8,
    y: 2.0,
    w: 11.4,
    h: 1.5,
    fontSize: theme.coverTitleSize,
    fontFace: theme.fontFamily,
    color: toPptxHex(theme.coverTitleColor),
    bold: true,
    align: 'center',
  });

  // Subtitle
  if (subtitle) {
    pptxSlide.addText(subtitle, {
      x: 1,
      y: 3.6,
      w: 11.3,
      h: 0.5,
      fontSize: theme.coverSubSize,
      fontFace: theme.fontFamily,
      color: toPptxHex(theme.coverSubColor),
      align: 'center',
    });
  }

  // Date
  pptxSlide.addText(todayDate(), {
    x: 1,
    y: 4.3,
    w: 11.3,
    h: 0.3,
    fontSize: 11,
    fontFace: theme.fontFamily,
    color: toPptxHex(theme.pageNumColor),
    align: 'center',
  });
}

function renderContentSlide(
  pptxSlide: pptxgen.Slide,
  slide: Slide,
  theme: ThemeToken,
  resolvedImages?: Map<string, string>,
): void {
  // Background is inherited from master slide (sky-content-master)
  // Individual slides can override: pptxSlide.background = { color: '...' }

  const viewportSize = slide.viewportSize || 1000;
  const ratioPx2Inch = 96 * (viewportSize / 960);
  const ratioPx2Pt = (96 / 72) * (viewportSize / 960);

  const ctx: ElementRendererContext = {
    pptxSlide,
    theme,
    ratioPx2Inch,
    ratioPx2Pt,
    resolvedImages,
  };

  // Identify title element (first text element)
  const titleIdx = slide.elements?.findIndex((el) => el.type === 'text') ?? -1;

  // Sort by vertical position for overlap detection
  const sorted = [...(slide.elements || [])].sort((a, b) => a.top - b.top);
  const placed: Array<{ left: number; right: number; bottom: number }> = [];

  for (const el of sorted) {
    try {
      const adjusted = adjustForOverlap(el, placed);
      const origIdx = slide.elements.indexOf(el);
      const isTitle = origIdx === titleIdx;
      renderElement(adjusted, ctx, isTitle);

      const elH =
        el.type === 'line'
          ? 4
          : 'height' in el && typeof (el as unknown as { height: number }).height === 'number'
            ? (el as unknown as { height: number }).height
            : 100;
      placed.push({
        left: adjusted.left,
        right: adjusted.left + adjusted.width,
        bottom: adjusted.top + elH,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      log.warn(`Skipping element ${el.id} (type=${el.type}): ${msg}`);
    }
  }
}

function renderEndSlide(
  pptxSlide: pptxgen.Slide,
  title: string,
  theme: ThemeToken,
): void {
  // Background
  if (theme.coverBgGradient) {
    pptxSlide.background = {
      color: toPptxHex(theme.coverBgGradient.from),
    };
  } else {
    pptxSlide.background = { color: toPptxHex(theme.coverBg) };
  }

  // Render cover decorations (reused for visual consistency)
  for (const dec of theme.coverDecorations) {
    renderDecoration(pptxSlide, dec, theme);
  }

  // Thanks text
  pptxSlide.addText('谢谢', {
    x: 0.5,
    y: 2.2,
    w: 11.3,
    h: 1.0,
    fontSize: theme.coverTitleSize - 4,
    fontFace: theme.fontFamily,
    color: toPptxHex(theme.coverTitleColor),
    bold: true,
    align: 'center',
  });

  // Title
  pptxSlide.addText(title, {
    x: 0.5,
    y: 3.4,
    w: 11.3,
    h: 0.6,
    fontSize: 16,
    fontFace: theme.fontFamily,
    color: toPptxHex(theme.coverSubColor),
    align: 'center',
  });
}

// ── Element Dispatcher ─────────────────────────────────────────────

function renderElement(
  el: PPTElement,
  ctx: ElementRendererContext,
  isTitle: boolean,
): void {
  switch (el.type) {
    case 'text':
      renderTextElement(el as PPTTextElement, ctx, isTitle);
      break;
    case 'shape':
      renderShapeElement(el, ctx);
      break;
    case 'line':
      renderLineElement(el, ctx);
      break;
    case 'latex':
      renderLatexElement(el, ctx);
      break;
    case 'image':
      renderImageElement(el, ctx);
      break;
    case 'table':
      renderTableElement(el, ctx);
      break;
    case 'chart':
      renderChartElement(el as PPTChartElement, ctx);
      break;
    default:
      log.warn(`Unsupported element type: ${(el as { type: string }).type}, skipping`);
  }
}

// ── Text ───────────────────────────────────────────────────────────

function renderTextElement(
  el: PPTTextElement,
  ctx: ElementRendererContext,
  isTitle: boolean,
): void {
  const { pptxSlide, theme, ratioPx2Inch, ratioPx2Pt } = ctx;
  const x = el.left / ratioPx2Inch;
  const y = el.top / ratioPx2Inch;
  const w = el.width / ratioPx2Inch;
  const h = el.height / ratioPx2Inch;

  const text = stripHtml(el.content || '');
  if (!text) return;

  const fontSize = isTitle ? theme.titleFontSize : theme.bodyFontSize;

  // Determine effective background for contrast check
  const bgColor = theme.contentBg;
  const themeColor = isTitle ? theme.coverTitleColor : theme.bodyColor;
  const resolved = resolveTextColor(el.defaultColor, themeColor, bgColor);
  const color = toPptxHex(resolved);

  pptxSlide.addText(text, {
    x,
    y,
    w,
    h,
    fontSize,
    fontFace: el.defaultFontName || theme.fontFamily,
    color,
    bold: isTitle,
    rotate: el.rotate || 0,
    ...(el.fill ? { fill: { color: toPptxHex(el.fill) } } : {}),
  });
}

// ── Shape ──────────────────────────────────────────────────────────

function renderShapeElement(el: PPTElement, ctx: ElementRendererContext): void {
  const { pptxSlide, theme, ratioPx2Inch } = ctx;
  const x = el.left / ratioPx2Inch;
  const y = el.top / ratioPx2Inch;
  const w = el.width / ratioPx2Inch;
  const h = ((el as unknown as { height?: number }).height ?? el.width) / ratioPx2Inch;

  const shapeEl = el as PPTElement & {
    path?: string;
    viewBox?: string;
    fill?: string;
    opacity?: number;
    outline?: { color?: string; width?: number; style?: string };
    rotate?: number;
  };

  const path = shapeEl.path || '';
  const viewBox = shapeEl.viewBox || `0 0 ${el.width} ${(el as unknown as { height?: number }).height ?? el.width}`;

  // Try native shape mapping first
  const mapping = mapShapeToPptx(path, viewBox);

  if (mapping && mapping.shapeType !== 'custGeom') {
    // Native shape
    const fillColor = shapeEl.fill || theme.accent;
    const fillHex = toPptxColor(fillColor).color;

    pptxSlide.addShape(mapping.shapeType as never, {
      x,
      y,
      w,
      h,
      rotate: shapeEl.rotate || 0,
      fill: { color: fillHex, transparency: (1 - (shapeEl.opacity || 1)) * 100 },
      ...(shapeEl.outline
        ? {
            line: {
              color: toPptxHex(shapeEl.outline.color || theme.shapeOutlineColor),
              width: (shapeEl.outline.width || 1) / (96 / 72),
            },
          }
        : {}),
    } as never);
  } else {
    // Fallback: simple rect with fill
    const fillColor = shapeEl.fill || theme.accent;
    pptxSlide.addShape('rect' as never, {
      x,
      y,
      w,
      h,
      rotate: shapeEl.rotate || 0,
      fill: {
        color: toPptxColor(fillColor).color,
        transparency: (1 - (shapeEl.opacity || 1)) * 100,
      },
      ...(shapeEl.outline
        ? {
            line: {
              color: toPptxHex(shapeEl.outline.color || theme.shapeOutlineColor),
              width: (shapeEl.outline.width || 1) / (96 / 72),
            },
          }
        : {}),
    } as never);
  }
}

// ── Line ───────────────────────────────────────────────────────────

function renderLineElement(el: PPTElement, ctx: ElementRendererContext): void {
  const { pptxSlide, theme, ratioPx2Inch } = ctx;
  const x = el.left / ratioPx2Inch;
  const y = el.top / ratioPx2Inch;
  const w = el.width / ratioPx2Inch;
  const lineData = el as PPTElement & {
    start?: [number, number];
    end?: [number, number];
    color?: string;
    width?: number;
    rotate?: number;
    height?: number;
  };
  const h = (lineData.height ?? Math.abs((lineData.end?.[1] ?? 0) - (lineData.start?.[1] ?? 0))) / ratioPx2Inch;

  const color = toPptxHex((lineData.color || theme.dividerColor));
  const lineWidth = 2 / (96 / 72);

  // Use native line shape
  pptxSlide.addShape('line' as never, {
    x,
    y,
    w,
    h,
    rotate: lineData.rotate || 0,
    line: { color, width: lineWidth },
  } as never);
}

// ── LaTeX ──────────────────────────────────────────────────────────

function renderLatexElement(el: PPTElement, ctx: ElementRendererContext): void {
  const { pptxSlide, theme, ratioPx2Inch } = ctx;
  const x = el.left / ratioPx2Inch;
  const y = el.top / ratioPx2Inch;
  const w = el.width / ratioPx2Inch;
  const h = Math.max(((el as unknown as { height?: number }).height ?? 50) / ratioPx2Inch, 0.5);

  const latexEl = el as PPTElement & {
    latex?: string;
    color?: string;
    align?: string;
    rotate?: number;
  };

  if (!latexEl.latex) return;

  try {
    const omml = latexToOmml(latexEl.latex, theme.bodyFontSize);
    if (omml) {
      (pptxSlide as unknown as { addFormula: (opts: Record<string, unknown>) => void }).addFormula({
        x,
        y,
        w,
        h,
        omml,
        fontSize: theme.bodyFontSize,
        color: toPptxHex(latexEl.color || theme.bodyColor),
        align: latexEl.align || 'center',
      });
    } else {
      // Fallback: plain text
      pptxSlide.addText(latexToPlainText(latexEl.latex), {
        x,
        y,
        w,
        h,
        fontSize: theme.bodyFontSize,
        fontFace: theme.fontFamily,
        color: toPptxHex(theme.bodyColor),
      });
    }
  } catch (err) {
    log.warn(`LaTeX ${el.id}: OMML conversion failed, using plain text fallback`);
    pptxSlide.addText(latexToPlainText(latexEl.latex), {
      x,
      y,
      w,
      h,
      fontSize: theme.bodyFontSize,
      fontFace: theme.fontFamily,
      color: toPptxHex(theme.bodyColor),
    });
  }
}

// ── Image ──────────────────────────────────────────────────────────

function renderImageElement(el: PPTElement, ctx: ElementRendererContext): void {
  addImageToSlide(
    ctx.pptxSlide,
    el as Parameters<typeof addImageToSlide>[1],
    {
      theme: ctx.theme,
      ratioPx2Inch: ctx.ratioPx2Inch,
      resolvedImages: ctx.resolvedImages,
    },
  );
}

// ── Table ──────────────────────────────────────────────────────────

function renderTableElement(el: PPTElement, ctx: ElementRendererContext): void {
  addTableToSlide(
    ctx.pptxSlide,
    el as Parameters<typeof addTableToSlide>[1],
    {
      theme: ctx.theme,
      ratioPx2Inch: ctx.ratioPx2Inch,
    },
  );
}

function renderChartElement(el: PPTChartElement, ctx: ElementRendererContext): void {
  addChartToSlide(
    {
      pptxSlide: ctx.pptxSlide,
      theme: ctx.theme,
      ratioPx2Inch: ctx.ratioPx2Inch,
    },
    el,
  );
}

// ── Decoration ─────────────────────────────────────────────────────

function renderDecoration(
  pptxSlide: pptxgen.Slide,
  dec: ThemeToken['coverDecorations'][number],
  theme: ThemeToken,
): void {
  const x = dec.position.x / 96;
  const y = dec.position.y / 96;
  const w = dec.position.w / 96;
  const h = dec.position.h / 96;

  if (dec.type === 'shape') {
    const style = dec.style as Record<string, unknown>;
    const fill = (style.fill as string) || theme.accent;
    const opacity = (style.opacity as number) || 0.1;
    const shape = (style.shape as string) || 'rect';

    pptxSlide.addShape((shape === 'ellipse' ? 'ellipse' : 'rect') as never, {
      x,
      y,
      w,
      h,
      fill: { color: toPptxHex(fill), transparency: (1 - opacity) * 100 },
    } as never);
  } else if (dec.type === 'line') {
    const style = dec.style as Record<string, unknown>;
    const color = (style.color as string) || theme.accent;
    const width = (style.width as number) || 2;

    pptxSlide.addShape('line' as never, {
      x,
      y,
      w,
      h,
      line: { color: toPptxHex(color), width: width / (96 / 72) },
    } as never);
  }
}

// ── Overlap Detection ──────────────────────────────────────────────

function adjustForOverlap(
  el: PPTElement,
  placed: Array<{ left: number; right: number; bottom: number }>,
): PPTElement {
  const MIN_GAP = 12;
  const adjusted = { ...el };

  const elLeft = el.left;
  const elRight = elLeft + el.width;

  let maxOverlapBottom = 0;
  for (const p of placed) {
    const hOverlap = elLeft < p.right && elRight > p.left;
    if (hOverlap && p.bottom > maxOverlapBottom) {
      maxOverlapBottom = p.bottom;
    }
  }

  if (maxOverlapBottom > 0 && adjusted.top < maxOverlapBottom + MIN_GAP) {
    adjusted.top = maxOverlapBottom + MIN_GAP;
  }

  return adjusted;
}

// ── Helpers ────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function extractTitleFromSlide(slide: Slide | undefined): string {
  if (!slide?.elements?.length) return '';
  for (const el of slide.elements) {
    if (el.type === 'text') {
      const text = stripHtml((el as PPTTextElement).content || '');
      if (text && text.length < 60) return text;
    }
  }
  return '';
}

function extractSubtitleFromSlide(slide: Slide | undefined): string {
  if (!slide?.elements?.length) return '';
  let foundTitle = false;
  for (const el of slide.elements) {
    if (el.type === 'text') {
      const text = stripHtml((el as PPTTextElement).content || '');
      if (!text) continue;
      if (!foundTitle && text.length < 60) {
        foundTitle = true;
        continue;
      }
      if (foundTitle) return text;
    }
  }
  return '';
}

function buildSpeakerNote(
  slideIndex: number,
  speakerNotes?: string[],
  avatarSpeech?: AvatarSpeech,
): string {
  const parts: string[] = [];
  if (speakerNotes?.[slideIndex]) parts.push(speakerNotes[slideIndex]);
  if (avatarSpeech?.segments) {
    const segs = avatarSpeech.segments.filter((s) => s.slideIndex === slideIndex);
    if (segs.length > 0) {
      parts.push(segs.map((s) => s.text).join('\n'));
    }
  }
  return parts.join('\n\n');
}

function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim() || '课件';
}

/** Fallback: convert simple LaTeX to readable Unicode */
function latexToPlainText(latex: string): string {
  const SUPER_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'] as const;
  const SUB_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'] as const;

  return (
    latex
      .replace(/\^{(\d+)}/g, (_, d) => SUPER_DIGITS[parseInt(d)] ?? `^${d}`)
      .replace(/_{(\d+)}/g, (_, d) => SUB_DIGITS[parseInt(d)] ?? `_${d}`)
      .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
      .replace(/\\times/g, '×')
      .replace(/\\cdot/g, '·')
      .replace(/\\pm/g, '±')
      .replace(/\\infty/g, '∞')
      .replace(/\\pi/g, 'π')
      .replace(/\\theta/g, 'θ')
      .replace(/\\alpha/g, 'α')
      .replace(/\\beta/g, 'β')
      .replace(/\\gamma/g, 'γ')
      .replace(/\\sum/g, 'Σ')
      .replace(/\\int/g, '∫')
      .replace(/[\\{}]/g, '')
      .trim()
  );
}
