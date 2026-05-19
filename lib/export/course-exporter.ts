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
import { createLogger } from '@/lib/logger';

const log = createLogger('CourseExporter');

// ── Progress ─────────────────────────────────────────────────────────

export interface CourseExportProgress {
  stage: 'cover' | 'toc' | 'slides' | 'knowledge' | 'end' | 'packaging';
  current: number;
  total: number;
}

// ── Constants ────────────────────────────────────────────────────────

const COVER_BG = '#1e3a5f';
const END_BG = '#1e3a5f';

// ── Main Export ──────────────────────────────────────────────────────

export async function exportCourseToPPTX(
  config: CourseExportConfig,
  slides: Slide[],
  knowledgePoints?: { name: string; description: string; difficulty: string }[],
  similarQuestions?: { problem: string; difficulty: number; knowledgePoint: string }[],
  onProgress?: (progress: CourseExportProgress) => void,
): Promise<CourseExportResult> {
  const hasSlides = config.includeSlides && slides.length > 0;
  const hasKnowledge = config.includeKnowledgePoints && knowledgePoints && knowledgePoints.length > 0;
  const hasSimilar = config.includeSimilarQuestions && similarQuestions && similarQuestions.length > 0;

  const totalSteps = 1 + (hasSlides ? 1 + slides.length : 0) + (hasKnowledge ? 1 : 0) + 1;
  let step = 0;

  const pptx = new pptxgen();

  // Use 16:9 layout (matches slide viewport ratio)
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Sky Classroom';
  pptx.title = config.title;

  // ── 1. Cover ──
  step++;
  onProgress?.({ stage: 'cover', current: step, total: totalSteps });
  addCoverSlide(pptx, config);

  // ── 2. TOC ──
  if (hasSlides) {
    step++;
    onProgress?.({ stage: 'toc', current: step, total: totalSteps });
    addTOCSlide(pptx, slides);
  }

  // ── 3. Content Slides ──
  if (hasSlides) {
    for (const slide of slides) {
      step++;
      onProgress?.({ stage: 'slides', current: step, total: totalSteps });
      addContentSlide(pptx, slide);
    }
  }

  // ── 4. Knowledge Points ──
  if (hasKnowledge) {
    step++;
    onProgress?.({ stage: 'knowledge', current: step, total: totalSteps });
    addKnowledgeSlide(pptx, knowledgePoints!, similarQuestions, hasSimilar);
  }

  // ── 5. End ──
  step++;
  onProgress?.({ stage: 'end', current: step, total: totalSteps });
  addEndSlide(pptx, config);

  // ── 6. Package ──
  onProgress?.({ stage: 'packaging', current: totalSteps, total: totalSteps });
  const blob = (await pptx.write({ outputType: 'blob' })) as Blob;
  const fileUrl = URL.createObjectURL(blob);
  const fileName = `${config.title}.pptx`;

  log.info(`Course export complete: "${fileName}" (${blob.size} bytes)`);

  return { fileUrl, fileName };
}

// ── Section Helpers ──────────────────────────────────────────────────

function addCoverSlide(pptx: pptxgen, config: CourseExportConfig) {
  const slide = pptx.addSlide();
  slide.background = { fill: COVER_BG };

  // Title
  slide.addText(config.title, {
    x: 0.5, y: 1.5, w: 9, h: 1.5,
    fontSize: 36, fontFace: DEFAULT_FONT_FAMILY,
    color: '#FFFFFF', bold: true, align: 'center',
  });

  // Subtitle
  slide.addText('Sky Classroom · AI 生成课件', {
    x: 0.5, y: 3.2, w: 9, h: 0.6,
    fontSize: 16, fontFace: DEFAULT_FONT_FAMILY,
    color: '#94a3b8', align: 'center',
  });

  // Avatar watermark
  if (config.avatarName) {
    slide.addText(`讲解人: ${config.avatarName}`, {
      x: 6.5, y: 5.2, w: 3, h: 0.4,
      fontSize: 11, fontFace: DEFAULT_FONT_FAMILY,
      color: '#64748b', align: 'right',
    });
  }
}

function addTOCSlide(pptx: pptxgen, slides: Slide[]) {
  const slide = pptx.addSlide();
  slide.background = { fill: '#f8fafc' };

  slide.addText('目录', {
    x: 0.8, y: 0.5, w: 8, h: 0.8,
    fontSize: 28, fontFace: DEFAULT_FONT_FAMILY,
    color: '#1e293b', bold: true,
  });

  const contentSlides = slides.filter((s) => s.type !== 'cover' && s.type !== 'end');
  const items = contentSlides.map((s, i) => {
    const title = extractSlideTitle(s);
    return { text: `${i + 1}. ${title}`, options: {} };
  });

  if (items.length > 0) {
    slide.addText(items, {
      x: 1.2, y: 1.8, w: 7.6, h: 0.4,
      fontSize: 16, fontFace: DEFAULT_FONT_FAMILY,
      color: '#334155', lineSpacingMultiple: 2.2,
    });
  } else {
    slide.addText('（无内容页）', {
      x: 1.2, y: 1.8, w: 7.6, h: 0.4,
      fontSize: 14, fontFace: DEFAULT_FONT_FAMILY,
      color: '#94a3b8',
    });
  }
}

function addContentSlide(pptx: pptxgen, s: Slide) {
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

  const viewportSize = s.viewportSize || 1000;
  const ratioPx2Inch = 96 * (viewportSize / 960);
  const ratioPx2Pt = (96 / 72) * (viewportSize / 960);

  for (const el of s.elements) {
    try {
      convertElement(pptxSlide, el, ratioPx2Inch, ratioPx2Pt);
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
) {
  const slide = pptx.addSlide();
  slide.background = { fill: '#f8fafc' };

  slide.addText('知识点总结', {
    x: 0.8, y: 0.5, w: 8, h: 0.8,
    fontSize: 28, fontFace: DEFAULT_FONT_FAMILY,
    color: '#1e293b', bold: true,
  });

  // Table rows: [Name, Description, Difficulty]
  const rows: pptxgen.TableRow[] = [
    [
      { text: '知识点', options: { bold: true, fontSize: 13, fill: { color: '#e2e8f0' } } },
      { text: '说明', options: { bold: true, fontSize: 13, fill: { color: '#e2e8f0' } } },
      { text: '难度', options: { bold: true, fontSize: 13, fill: { color: '#e2e8f0' } } },
    ],
  ];

  for (const kp of knowledgePoints) {
    const diffColor = kp.difficulty === 'easy' ? '#10b981' : kp.difficulty === 'hard' ? '#ef4444' : '#f59e0b';
    rows.push([
      { text: kp.name, options: { fontSize: 12 } },
      { text: kp.description, options: { fontSize: 11 } },
      { text: kp.difficulty, options: { fontSize: 11, color: diffColor, bold: true } },
    ]);
  }

  slide.addTable(rows, {
    x: 0.5, y: 1.6, w: 9,
    colW: [2.5, 5.0, 1.5],
    border: { type: 'solid', pt: 0.5, color: '#cbd5e1' },
    rowH: 0.4,
  });

  // Similar questions section
  if (includeSimilar && similarQuestions && similarQuestions.length > 0) {
    const qSlide = pptx.addSlide();
    qSlide.background = { fill: '#f8fafc' };
    qSlide.addText('相似题目推荐', {
      x: 0.8, y: 0.5, w: 8, h: 0.8,
      fontSize: 28, fontFace: DEFAULT_FONT_FAMILY,
      color: '#1e293b', bold: true,
    });

    const items = similarQuestions.slice(0, 8).map((q, i) => ({
      text: `${i + 1}. ${q.problem}  [${q.knowledgePoint}]`,
      options: { fontSize: 14, fontFace: DEFAULT_FONT_FAMILY },
    }));

    qSlide.addText(items, {
      x: 0.8, y: 1.6, w: 8.4, h: 0.4,
      lineSpacingMultiple: 1.8, color: '#334155',
    });
  }
}

function addEndSlide(pptx: pptxgen, config: CourseExportConfig) {
  const slide = pptx.addSlide();
  slide.background = { fill: END_BG };

  slide.addText('感谢观看', {
    x: 0.5, y: 2.0, w: 9, h: 1.2,
    fontSize: 40, fontFace: DEFAULT_FONT_FAMILY,
    color: '#FFFFFF', bold: true, align: 'center',
  });

  slide.addText(config.title, {
    x: 0.5, y: 3.3, w: 9, h: 0.5,
    fontSize: 18, fontFace: DEFAULT_FONT_FAMILY,
    color: '#94a3b8', align: 'center',
  });

  if (config.avatarName) {
    slide.addText(`讲解人: ${config.avatarName}`, {
      x: 0.5, y: 4.5, w: 9, h: 0.4,
      fontSize: 12, fontFace: DEFAULT_FONT_FAMILY,
      color: '#64748b', align: 'center',
    });
  }
}

// ── Element Conversion ───────────────────────────────────────────────

function convertElement(
  pptxSlide: pptxgen.Slide,
  el: PPTElement,
  ratioPx2Inch: number,
  ratioPx2Pt: number,
) {
  const { left, top, width, height, rotate = 0 } = el as PPTElement & { height: number; rotate: number };
  const x = left / ratioPx2Inch;
  const y = top / ratioPx2Inch;
  const w = width / ratioPx2Inch;
  const h = height / ratioPx2Inch;

  switch (el.type) {
    case 'text': {
      const textProps = formatHTML(el.content, ratioPx2Pt);
      pptxSlide.addText(textProps, {
        x, y, w, h, rotate,
        fontFace: el.defaultFontName || DEFAULT_FONT_FAMILY,
        fontSize: DEFAULT_FONT_SIZE,
        color: el.defaultColor || '#333333',
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
        const fillColor = shapeEl.fill || (shapeEl.gradient?.colors[0]?.color) || '#5b9bd5';
        pptxSlide.addShape('custGeom' as pptxgen.ShapeType, {
          x, y, w, h, rotate: rotate || 0,
          fill: { color: fillColor },
          line: shapeEl.outline ? getOutlineOption(shapeEl.outline as Parameters<typeof getOutlineOption>[0], ratioPx2Pt) : undefined,
          custGeom: { points },
        } as pptxgen.ShapeProps);
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
        pptxSlide.addShape('custGeom' as pptxgen.ShapeType, {
          x, y, w, h, rotate: rotate || 0,
          line: { color: (el as { color?: string }).color || '#333333', width: 1 },
          custGeom: { points },
        } as pptxgen.ShapeProps);
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
            x, y, w, h,
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

// ── Helpers ──────────────────────────────────────────────────────────

const HTML_TAG_RE = /<[^>]*>/g;

function extractSlideTitle(slide: Slide): string {
  for (const el of slide.elements) {
    if (el.type === 'text') {
      const textEl = el as PPTElement & { content: string };
      const plain = textEl.content?.replace(HTML_TAG_RE, '').trim();
      if (plain && plain.length < 60) return plain;
    }
  }
  return slide.type === 'cover' ? '封面' : slide.type === 'end' ? '封底' : '幻灯片';
}
