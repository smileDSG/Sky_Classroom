/**
 * Sky Classroom — Course PPTX Exporter (B-003)
 *
 * Pure client-side module. Generates a complete PPTX course package:
 *   Cover → TOC → Content Slides → Knowledge Points → End
 *
 * Reuses formatting utilities exported from use-export-pptx.ts.
 */
import pptxgen from 'pptxgenjs';
import { toPoints } from '@/lib/export/svg-path-parser';
import { svg2Base64 } from '@/lib/export/svg2base64';
import { latexToOmml } from '@/lib/export/latex-to-omml';
import { getLineElementPath } from '@/lib/utils/element';
import {
  formatHTML,
  formatColor,
  formatPoints,
  getShadowOption,
  getOutlineOption,
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
} from '@/lib/export/use-export-pptx';
import type { Slide, PPTElement } from '@/lib/types/slides';
import type { CourseExportConfig, CourseExportResult } from '@/lib/slides/types';
import type { TemplateElement, TemplateSlideData, PPTDManifest } from '@/lib/templates/pptd-types';
import { createLogger } from '@/lib/logger';

const log = createLogger('CourseExporter');

// ── Progress ─────────────────────────────────────────────────────────

export interface CourseExportProgress {
  stage: 'cover' | 'toc' | 'slides' | 'knowledge' | 'end' | 'packaging';
  current: number;
  total: number;
}

// ── Constants ────────────────────────────────────────────────────────

// ── Theme Helpers ────────────────────────────────────────────────────

function isLightColor(hex: string): boolean {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

interface ExportTheme {
  coverBg: string;
  endBg: string;
  tocBg: string;
  knowledgeBg: string;
  accent: string;
  fontFamily: string;
  coverTitleColor: string;
  coverSubColor: string;
  bodyColor: string;
  mutedColor: string;
  dividerColor: string;
  textOnDark: string;
}

function resolveExportTheme(slides: Slide[]): ExportTheme {
  const ref = slides.find((s) => s.type === 'cover') ?? slides[0];
  const theme = ref?.theme;
  const coverBg =
    slides.find((s) => s.type === 'cover')?.background?.color ??
    theme?.themeColors?.[1] ??
    '#1e3a5f';
  const accent = theme?.themeColors?.[0] ?? '#5b9bd5';
  const fontFamily = theme?.fontName ?? DEFAULT_FONT_FAMILY;
  const bodyColor = theme?.fontColor ?? '#1e293b';
  const mutedColor = theme?.themeColors?.[4] ?? '#64748b';
  const accentLight = theme?.themeColors?.[2] ?? '#f0f3fa';
  const coverTitleColor = isLightColor(coverBg) ? bodyColor : '#FFFFFF';
  const coverSubColor = isLightColor(coverBg) ? mutedColor : '#94a3b8';

  return {
    coverBg,
    endBg: coverBg,
    tocBg: accentLight,
    knowledgeBg: accentLight,
    accent,
    fontFamily,
    coverTitleColor,
    coverSubColor,
    bodyColor,
    mutedColor,
    dividerColor: '#e2e8f0',
    textOnDark: isLightColor(coverBg) ? bodyColor : '#FFFFFF',
  };
}

// ── Main Export ──────────────────────────────────────────────────────

export async function exportCourseToPPTX(
  config: CourseExportConfig,
  slides: Slide[],
  knowledgePoints?: { name: string; description: string; difficulty: string }[],
  similarQuestions?: { problem: string; difficulty: number; knowledgePoint: string }[],
  onProgress?: (progress: CourseExportProgress) => void,
): Promise<CourseExportResult> {
  const hasSlides = config.includeSlides && slides.length > 0;
  const hasKnowledge =
    config.includeKnowledgePoints && knowledgePoints && knowledgePoints.length > 0;
  const hasSimilar =
    config.includeSimilarQuestions && similarQuestions && similarQuestions.length > 0;

  const totalSteps = 1 + (hasSlides ? 1 + slides.length : 0) + (hasKnowledge ? 1 : 0) + 1;
  let step = 0;

  const pptx = new pptxgen();

  // Use 16:9 layout (matches slide viewport ratio)
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Sky Classroom';
  pptx.title = config.title;

  const et = hasSlides ? resolveExportTheme(slides) : null;

  // ── 1. Cover ──
  step++;
  onProgress?.({ stage: 'cover', current: step, total: totalSteps });
  addCoverSlide(pptx, config, et);

  // ── 2. TOC ──
  if (hasSlides) {
    step++;
    onProgress?.({ stage: 'toc', current: step, total: totalSteps });
    addTOCSlide(pptx, slides, et!);
  }

  // ── 3. Content Slides ──
  if (hasSlides) {
    for (const slide of slides) {
      step++;
      onProgress?.({ stage: 'slides', current: step, total: totalSteps });
      addContentSlide(pptx, slide, et);
    }
  }

  // ── 4. Knowledge Points ──
  if (hasKnowledge) {
    step++;
    onProgress?.({ stage: 'knowledge', current: step, total: totalSteps });
    addKnowledgeSlide(pptx, knowledgePoints!, similarQuestions, hasSimilar, et);
  }

  // ── 5. End ──
  step++;
  onProgress?.({ stage: 'end', current: step, total: totalSteps });
  addEndSlide(pptx, config, et);

  // ── 6. Package ──
  onProgress?.({ stage: 'packaging', current: totalSteps, total: totalSteps });
  const blob = (await pptx.write({ outputType: 'blob' })) as Blob;
  const fileUrl = URL.createObjectURL(blob);
  const fileName = `${config.title}.pptx`;

  log.info(`Course export complete: "${fileName}" (${blob.size} bytes)`);

  return { fileUrl, fileName };
}

// ── Section Helpers ──────────────────────────────────────────────────

function addCoverSlide(pptx: pptxgen, config: CourseExportConfig, et: ExportTheme | null) {
  const slide = pptx.addSlide();
  slide.background = { fill: et?.coverBg ?? '#1e3a5f' };

  // Title
  slide.addText(config.title, {
    x: 0.5,
    y: 1.5,
    w: 9,
    h: 1.5,
    fontSize: 36,
    fontFace: et?.fontFamily ?? DEFAULT_FONT_FAMILY,
    color: et?.coverTitleColor ?? '#FFFFFF',
    bold: true,
    align: 'center',
  });

  // Subtitle
  slide.addText('Sky Classroom · AI 生成课件', {
    x: 0.5,
    y: 3.2,
    w: 9,
    h: 0.6,
    fontSize: 16,
    fontFace: et?.fontFamily ?? DEFAULT_FONT_FAMILY,
    color: et?.coverSubColor ?? '#94a3b8',
    align: 'center',
  });

  // Avatar watermark
  if (config.avatarName) {
    slide.addText(`讲解人: ${config.avatarName}`, {
      x: 6.5,
      y: 5.2,
      w: 3,
      h: 0.4,
      fontSize: 11,
      fontFace: et?.fontFamily ?? DEFAULT_FONT_FAMILY,
      color: et?.mutedColor ?? '#64748b',
      align: 'right',
    });
  }
}

function addTOCSlide(pptx: pptxgen, slides: Slide[], et: ExportTheme) {
  const slide = pptx.addSlide();
  slide.background = { fill: et.tocBg };

  slide.addText('目录', {
    x: 0.8,
    y: 0.5,
    w: 8,
    h: 0.8,
    fontSize: 28,
    fontFace: et.fontFamily,
    color: et.bodyColor,
    bold: true,
  });

  const contentSlides = slides.filter((s) => s.type !== 'cover' && s.type !== 'end');
  const items = contentSlides.map((s, i) => {
    const title = extractSlideTitle(s);
    return { text: `${i + 1}. ${title}`, options: {} };
  });

  if (items.length > 0) {
    slide.addText(items, {
      x: 1.2,
      y: 1.8,
      w: 7.6,
      h: 0.4,
      fontSize: 16,
      fontFace: et.fontFamily,
      color: et.bodyColor,
      lineSpacingMultiple: 2.2,
    });
  } else {
    slide.addText('（无内容页）', {
      x: 1.2,
      y: 1.8,
      w: 7.6,
      h: 0.4,
      fontSize: 14,
      fontFace: et.fontFamily,
      color: et.mutedColor,
    });
  }
}

function addContentSlide(pptx: pptxgen, s: Slide, et: ExportTheme | null) {
  const pptxSlide = pptx.addSlide();

  // Background
  if (s.background) {
    if (s.background.type === 'solid' && s.background.color) {
      pptxSlide.background = { fill: s.background.color };
    } else if (s.background.type === 'gradient' && s.background.gradient) {
      const colors = s.background.gradient.colors;
      pptxSlide.background = { fill: colors[0]?.color ?? '#ffffff' };
    }
  }

  // Template-driven rendering
  if (s.templateData) {
    applyTemplateBackground(pptxSlide, s.templateData);
    for (const el of s.templateData.page.elements) {
      try {
        convertTemplateElement(pptxSlide, el, s.templateData.theme, et);
      } catch (err) {
        log.warn(`Skipping template element ${el.elementId} (type=${el.elementType}):`, err);
      }
    }
    return;
  }

  // Legacy element rendering
  const viewportSize = s.viewportSize || 1000;
  const ratioPx2Inch = 96 * (viewportSize / 960);
  const ratioPx2Pt = (96 / 72) * (viewportSize / 960);

  for (const el of s.elements) {
    try {
      convertElement(pptxSlide, el, ratioPx2Inch, ratioPx2Pt, et);
    } catch (err) {
      log.warn(`Skipping element ${el.id} (type=${el.type}):`, err);
    }
  }
}

function addKnowledgeSlide(
  pptx: pptxgen,
  knowledgePoints: { name: string; description: string; difficulty: string }[],
  similarQuestions?: { problem: string; difficulty: number; knowledgePoint: string }[],
  includeSimilar?: boolean,
  et?: ExportTheme | null,
) {
  const slide = pptx.addSlide();
  slide.background = { fill: et?.knowledgeBg ?? '#f8fafc' };

  slide.addText('知识点总结', {
    x: 0.8,
    y: 0.5,
    w: 8,
    h: 0.8,
    fontSize: 28,
    fontFace: et?.fontFamily ?? DEFAULT_FONT_FAMILY,
    color: et?.bodyColor ?? '#1e293b',
    bold: true,
  });

  // Table rows: [Name, Description, Difficulty]
  const rows: pptxgen.TableRow[] = [
    [
      {
        text: '知识点',
        options: { bold: true, fontSize: 13, fill: { color: et?.dividerColor ?? '#e2e8f0' } },
      },
      {
        text: '说明',
        options: { bold: true, fontSize: 13, fill: { color: et?.dividerColor ?? '#e2e8f0' } },
      },
      {
        text: '难度',
        options: { bold: true, fontSize: 13, fill: { color: et?.dividerColor ?? '#e2e8f0' } },
      },
    ],
  ];

  for (const kp of knowledgePoints) {
    const diffColor =
      kp.difficulty === 'easy' ? '#10b981' : kp.difficulty === 'hard' ? '#ef4444' : '#f59e0b';
    rows.push([
      { text: kp.name, options: { fontSize: 12 } },
      { text: kp.description, options: { fontSize: 11 } },
      { text: kp.difficulty, options: { fontSize: 11, color: diffColor, bold: true } },
    ]);
  }

  slide.addTable(rows, {
    x: 0.5,
    y: 1.6,
    w: 9,
    colW: [2.5, 5.0, 1.5],
    border: { type: 'solid', pt: 0.5, color: et?.mutedColor ?? '#cbd5e1' },
    rowH: 0.4,
  });

  // Similar questions section
  if (includeSimilar && similarQuestions && similarQuestions.length > 0) {
    const qSlide = pptx.addSlide();
    qSlide.background = { fill: et?.knowledgeBg ?? '#f8fafc' };
    qSlide.addText('相似题目推荐', {
      x: 0.8,
      y: 0.5,
      w: 8,
      h: 0.8,
      fontSize: 28,
      fontFace: et?.fontFamily ?? DEFAULT_FONT_FAMILY,
      color: et?.bodyColor ?? '#1e293b',
      bold: true,
    });

    const items = similarQuestions.slice(0, 8).map((q, i) => ({
      text: `${i + 1}. ${q.problem}  [${q.knowledgePoint}]`,
      options: { fontSize: 14, fontFace: et?.fontFamily ?? DEFAULT_FONT_FAMILY },
    }));

    qSlide.addText(items, {
      x: 0.8,
      y: 1.6,
      w: 8.4,
      h: 0.4,
      lineSpacingMultiple: 1.8,
      color: et?.bodyColor ?? '#334155',
    });
  }
}

function addEndSlide(pptx: pptxgen, config: CourseExportConfig, et: ExportTheme | null) {
  const slide = pptx.addSlide();
  slide.background = { fill: et?.endBg ?? '#1e3a5f' };

  slide.addText('感谢观看', {
    x: 0.5,
    y: 2.0,
    w: 9,
    h: 1.2,
    fontSize: 40,
    fontFace: et?.fontFamily ?? DEFAULT_FONT_FAMILY,
    color: et?.textOnDark ?? '#FFFFFF',
    bold: true,
    align: 'center',
  });

  slide.addText(config.title, {
    x: 0.5,
    y: 3.3,
    w: 9,
    h: 0.5,
    fontSize: 18,
    fontFace: et?.fontFamily ?? DEFAULT_FONT_FAMILY,
    color: et?.mutedColor ?? '#94a3b8',
    align: 'center',
  });

  if (config.avatarName) {
    slide.addText(`讲解人: ${config.avatarName}`, {
      x: 0.5,
      y: 4.5,
      w: 9,
      h: 0.4,
      fontSize: 12,
      fontFace: et?.fontFamily ?? DEFAULT_FONT_FAMILY,
      color: et?.mutedColor ?? '#64748b',
      align: 'center',
    });
  }
}

// ── Element Conversion ───────────────────────────────────────────────

function convertElement(
  pptxSlide: pptxgen.Slide,
  el: PPTElement,
  ratioPx2Inch: number,
  ratioPx2Pt: number,
  et?: ExportTheme | null,
) {
  const {
    left,
    top,
    width,
    height,
    rotate = 0,
  } = el as PPTElement & { height: number; rotate: number };
  const x = left / ratioPx2Inch;
  const y = top / ratioPx2Inch;
  const w = width / ratioPx2Inch;
  const h = height / ratioPx2Inch;

  switch (el.type) {
    case 'text': {
      const textProps = formatHTML(el.content, ratioPx2Pt);
      pptxSlide.addText(textProps, {
        x,
        y,
        w,
        h,
        rotate,
        fontFace: el.defaultFontName || et?.fontFamily || DEFAULT_FONT_FAMILY,
        fontSize: DEFAULT_FONT_SIZE,
        color: el.defaultColor || et?.bodyColor || '#333333',
        ...(el.fill ? { fill: { color: el.fill } } : {}),
        ...(el.shadow ? { shadow: getShadowOption(el.shadow, ratioPx2Pt) } : {}),
        ...(el.outline ? { line: getOutlineOption(el.outline, ratioPx2Pt) } : {}),
      });
      break;
    }
    case 'shape': {
      const shapeEl = el as PPTElement & {
        viewBox: string;
        path: string;
        fill?: string;
        gradient?: { type: string; colors: Array<{ pos: number; color: string }> };
        outline?: { color?: string; width?: number; style?: string };
      };
      const path = shapeEl.path;
      if (!path) break;
      const viewBox = shapeEl.viewBox || `0 0 ${el.width} ${el.height}`;
      const viewBoxParts = viewBox.split(/\s+/).map(Number);
      const vbW = viewBoxParts[2] || el.width;
      const vbH = viewBoxParts[3] || el.height;
      const scaleX = el.width / vbW;
      const scaleY = el.height / vbH;
      try {
        const svgPoints = toPoints(path);
        const points = formatPoints(svgPoints, ratioPx2Inch, { x: scaleX, y: scaleY });
        const fillColor =
          shapeEl.fill || shapeEl.gradient?.colors[0]?.color || et?.accent || '#5b9bd5';
        pptxSlide.addShape(
          'custGeom' as pptxgen.ShapeType,
          {
            x,
            y,
            w,
            h,
            rotate: rotate || 0,
            fill: { color: fillColor },
            line: shapeEl.outline
              ? getOutlineOption(
                  shapeEl.outline as Parameters<typeof getOutlineOption>[0],
                  ratioPx2Pt,
                )
              : undefined,
            custGeom: { points },
          } as pptxgen.ShapeProps,
        );
      } catch {
        log.warn(`Shape ${el.id}: SVG path conversion failed, skipping`);
      }
      break;
    }
    case 'line': {
      const linePath = getLineElementPath(el as Parameters<typeof getLineElementPath>[0]);
      if (!linePath) break;
      try {
        const svgPoints = toPoints(linePath);
        const points = formatPoints(svgPoints, ratioPx2Inch);
        pptxSlide.addShape(
          'custGeom' as pptxgen.ShapeType,
          {
            x,
            y,
            w,
            h,
            rotate: rotate || 0,
            line: {
              color: (el as { color?: string }).color || et?.bodyColor || '#333333',
              width: 1,
            },
            custGeom: { points },
          } as pptxgen.ShapeProps,
        );
      } catch {
        log.warn(`Line ${el.id}: SVG path conversion failed, skipping`);
      }
      break;
    }
    case 'latex': {
      const latexEl = el as PPTElement & { latex: string; color?: string };
      if (!latexEl.latex) break;
      try {
        const omml = latexToOmml(latexEl.latex, 16);
        if (omml) {
          pptxSlide.addFormula({
            x,
            y,
            w,
            h,
            data: omml,
          } as unknown as pptxgen.FormulaProps);
        }
      } catch {
        // Fallback: skip latex elements that can't be converted
        log.warn(`Latex ${el.id}: OMML conversion failed, skipping`);
      }
      break;
    }
    default:
      // Skip image, chart, table, video, audio, code for now
      break;
  }
}

// ── Template-to-PPTX Conversion ───────────────────────────────────────

const TEMPLATE_SCALE = 128; // 1280px = 10inch → 1px = 1/128 inch

function applyTemplateBackground(pptxSlide: pptxgen.Slide, templateData: TemplateSlideData) {
  const bg = templateData.page.background;
  if (!bg) return;

  if (bg.type === 'solid' && bg.color) {
    const c = resolveTemplateColor(bg.color, templateData.theme, '#FFFFFF');
    pptxSlide.background = { color: c.color, transparency: (1 - c.alpha) * 100 };
  } else if (bg.type === 'gradient' && bg.stops && bg.stops.length > 0) {
    // pptxgenjs slide bg doesn't support gradients; use first stop as fallback
    const c = resolveTemplateColor(bg.stops[0].color, templateData.theme, '#FFFFFF');
    pptxSlide.background = { color: c.color, transparency: (1 - c.alpha) * 100 };
  }
}

function resolveTemplateColor(
  color: string | undefined,
  theme: PPTDManifest['theme'] | undefined,
  fallback: string,
): { alpha: number; color: string } {
  let resolved = fallback;
  if (color) {
    if (color.startsWith('$')) {
      const key = color.slice(1);
      resolved = theme?.colors?.[key] || fallback;
    } else {
      resolved = color;
    }
  }
  return formatColor(resolved);
}

function stripHtml(html: string): string {
  return html
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim();
}

function convertTemplateElement(
  pptxSlide: pptxgen.Slide,
  el: TemplateElement,
  theme: PPTDManifest['theme'],
  et: ExportTheme | null,
) {
  const [x, y, w, h] = el.bounds;
  const inchX = x / TEMPLATE_SCALE;
  const inchY = y / TEMPLATE_SCALE;
  const inchW = w / TEMPLATE_SCALE;
  const inchH = h / TEMPLATE_SCALE;

  switch (el.elementType) {
    case 'text': {
      const rawText = el.content?.text || '';
      const text = stripHtml(rawText);
      if (!text) return;

      const colorC = resolveTemplateColor(el.content?.color, theme, et?.bodyColor || '#333333');
      const align = (el.content?.align?.[0] as 'left' | 'center' | 'right') || 'left';
      const valign = (el.content?.align?.[1] as 'top' | 'middle' | 'bottom') || 'top';

      // Try to parse fontSize from style reference
      let fontSize = 14;
      const styleRef = el.content?.style;
      if (styleRef && styleRef.startsWith('$') && theme?.textStyles) {
        const styleName = styleRef.slice(1);
        const style = theme.textStyles[styleName];
        if (style) {
          fontSize = style.fontSize ? Math.round(style.fontSize * 0.6) : 14;
        }
      }

      pptxSlide.addText(text, {
        x: inchX,
        y: inchY,
        w: inchW,
        h: inchH,
        fontSize,
        fontFace: et?.fontFamily || DEFAULT_FONT_FAMILY,
        color: colorC.color,
        align,
        valign,
        wrap: el.content?.wrap !== false,
      });
      break;
    }

    case 'shape': {
      const shapeType =
        el.shapeName === 'ellipse'
          ? 'ellipse'
          : el.shapeName === 'roundRect'
            ? 'roundRect'
            : 'rect';
      const fillC = resolveTemplateColor(el.fill?.color, theme, et?.accent || '#5b9bd5');
      const lineC = el.border
        ? resolveTemplateColor(el.border.color, theme, et?.dividerColor || '#cccccc')
        : undefined;
      const shadowC = el.shadow
        ? resolveTemplateColor(el.shadow.color, theme, '#000000')
        : undefined;

      const shapeOpts: pptxgen.ShapeProps = {
        x: inchX,
        y: inchY,
        w: inchW,
        h: inchH,
        fill: { color: fillC.color, transparency: (1 - fillC.alpha) * 100 },
      };
      if (el.border && lineC) {
        shapeOpts.line = {
          color: lineC.color,
          transparency: (1 - lineC.alpha) * 100,
          width: el.border.width / TEMPLATE_SCALE,
        };
      }
      if (el.shadow && shadowC) {
        shapeOpts.shadow = {
          type: 'outer',
          blur: el.shadow.blur / TEMPLATE_SCALE,
          color: shadowC.color,
          opacity: shadowC.alpha,
          offset: el.shadow.offset[0] / TEMPLATE_SCALE,
          angle: 45,
        };
      }

      pptxSlide.addShape(shapeType as never, shapeOpts as never);
      break;
    }

    case 'line': {
      const lineC = el.border
        ? resolveTemplateColor(el.border.color, theme, et?.bodyColor || '#333333')
        : formatColor(et?.bodyColor || '#333333');
      pptxSlide.addShape(
        'line' as never,
        {
          x: inchX,
          y: inchY,
          w: inchW,
          h: inchH,
          line: {
            color: lineC.color,
            transparency: (1 - lineC.alpha) * 100,
            width: el.border ? el.border.width / TEMPLATE_SCALE : 1,
          },
        } as never,
      );
      break;
    }

    case 'image': {
      if (el.src && !el.src.startsWith('placeholder:')) {
        pptxSlide.addImage({
          path: el.src,
          x: inchX,
          y: inchY,
          w: inchW,
          h: inchH,
        });
      }
      break;
    }

    case 'icon': {
      // FontAwesome icons cannot be embedded in PPTX directly.
      // Render a small placeholder text with the icon name.
      if (el.iconName) {
        const iconC = resolveTemplateColor(el.fill?.color, theme, et?.mutedColor || '#94a3b8');
        pptxSlide.addText(`[${el.iconName}]`, {
          x: inchX,
          y: inchY,
          w: inchW,
          h: inchH,
          fontSize: 10,
          fontFace: et?.fontFamily || DEFAULT_FONT_FAMILY,
          color: iconC.color,
          align: 'center',
          valign: 'middle',
        });
      }
      break;
    }

    default:
      log.warn(`Unsupported template element type: ${(el as { elementType: string }).elementType}`);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

const HTML_TAG_RE = /<[^>]*>/g;

function extractSlideTitle(slide: Slide): string {
  if (slide.templateData) {
    for (const el of slide.templateData.page.elements) {
      if (el.elementType === 'text' && el.content?.placeholder === 'title') {
        const plain = stripHtml(el.content.text || '').trim();
        if (plain && plain.length < 60) return plain;
      }
    }
  }
  for (const el of slide.elements) {
    if (el.type === 'text') {
      const textEl = el as PPTElement & { content: string };
      const plain = textEl.content?.replace(HTML_TAG_RE, '').trim();
      if (plain && plain.length < 60) return plain;
    }
  }
  return slide.type === 'cover' ? '封面' : slide.type === 'end' ? '封底' : '幻灯片';
}
