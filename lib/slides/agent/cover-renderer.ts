/**
 * Cover Renderer — renders a DesignDNA into a single-slide cover PPTX.
 * Supports 12 distinct layout types for true visual variety.
 */
import pptxgen from 'pptxgenjs';
import path from 'path';
import fs from 'fs/promises';
import { createLogger } from '@/lib/logger';
import type { DesignDNA, LayoutType } from './design-dna';

const log = createLogger('CoverRenderer');
const W = 13.33;
const H = 7.5;

function hex(c: string): string {
  return c;
}
function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface CoverRenderResult {
  success: boolean;
  pptxPath?: string;
  error?: string;
}

export async function renderCoverPptx(
  designDNA: DesignDNA,
  title: string,
  subtitle: string,
  outputDir: string,
  index: number,
): Promise<CoverRenderResult> {
  try {
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_WIDE';
    pres.author = '天空课堂';
    pres.title = title;
    const slide = pres.addSlide();

    const layout = (designDNA.layoutType as LayoutType) || 'hero-left';
    const renderer = LAYOUT_RENDERERS[layout] || LAYOUT_RENDERERS['hero-left'];
    renderer(slide, pres, designDNA, title, subtitle);

    const safeName = `cover-${String(index).padStart(2, '0')}-${Date.now()}.pptx`;
    const pptxPath = path.join(outputDir, safeName);
    await fs.mkdir(outputDir, { recursive: true });
    await pres.writeFile({ fileName: pptxPath });
    return { success: true, pptxPath };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Cover render failed for index ${index}: ${msg}`);
    return { success: false, error: msg };
  }
}

// ── Tagline helper ──────────────────────────────────────────────────

function tagline(subtitle: string): string {
  const cleaned = subtitle
    .toUpperCase()
    .replace(/[^A-Za-z\s]/g, '')
    .slice(0, 30);
  return cleaned || 'TEACHING COURSEWARE';
}

// ── Layout Registry ──────────────────────────────────────────────────

type LayoutFn = (
  slide: pptxgen.Slide,
  pres: pptxgen,
  dna: DesignDNA,
  title: string,
  subtitle: string,
) => void;

const LAYOUT_RENDERERS: Record<string, LayoutFn> = {
  /* ── 1. hero-centered: 居中巨大标题 + 装饰围绕散落 ── */
  'hero-centered'(slide, _pres, dna, title, subtitle) {
    const { colors, fonts } = dna;
    slide.background = { color: hex(colors.coverBg) };
    // Decorative circles scattered around center
    const cx = W / 2,
      cy = 3.2;
    for (const [dx, dy, sz, op] of [
      [-4.5, -1.8, 2.5, 94],
      [4.8, -2.2, 3.0, 95],
      [-3.5, 2.5, 1.5, 92],
      [4.2, 2.0, 2.0, 93],
      [0.5, -2.8, 1.0, 90],
      [-1.0, 3.0, 0.8, 90],
    ] as const) {
      slide.addShape(
        'ellipse' as never,
        {
          x: cx + dx,
          y: cy + dy,
          w: sz,
          h: sz,
          fill: { color: hex(colors.accent), transparency: op },
        } as never,
      );
    }
    // Subtle center ring
    slide.addShape(
      'ellipse' as never,
      {
        x: cx - 2.3,
        y: cy - 1.5,
        w: 4.6,
        h: 3.0,
        fill: { color: hex(colors.accent), transparency: 96 },
        line: { color: hex(colors.accent), width: 0.5 },
      } as never,
    );
    // Tag
    slide.addText(tagline(subtitle), {
      x: 1.5,
      y: 1.2,
      w: 10.3,
      h: 0.4,
      fontSize: 11,
      fontFace: fonts.en,
      color: hex(colors.accent),
      charSpacing: 8,
      align: 'center',
      margin: 0,
    });
    // Title
    slide.addText(title, {
      x: 1.5,
      y: cy - 0.8,
      w: 10.3,
      h: 1.6,
      fontSize: fonts.headingSize,
      fontFace: fonts.heading,
      color: hex(colors.textOnDark),
      bold: true,
      align: 'center',
      margin: 0,
    });
    // Subtitle
    slide.addText(subtitle, {
      x: 2.5,
      y: cy + 1.2,
      w: 8.3,
      h: 0.5,
      fontSize: 14,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'center',
      margin: 0,
    });
    // Date
    slide.addText(todayDate(), {
      x: 4,
      y: 6.5,
      w: 5.3,
      h: 0.3,
      fontSize: 10,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'center',
      margin: 0,
    });
  },

  /* ── 2. hero-left: 左对齐文本 + 右侧装饰 ── */
  'hero-left'(slide, _pres, dna, title, subtitle) {
    const { colors, fonts } = dna;
    slide.background = { color: hex(colors.coverBg) };
    // Right accent area
    slide.addShape(
      'rect' as never,
      {
        x: 7.5,
        y: 0,
        w: 5.83,
        h: 7.5,
        fill: { color: hex(colors.accent), transparency: 95 },
      } as never,
    );
    // Diagonal line
    slide.addShape(
      'line' as never,
      {
        x: 7.5,
        y: 7.5,
        w: 5.83,
        h: -7.5,
        line: { color: hex(colors.accent), width: 1.5 },
      } as never,
    );
    // Decorative circle
    slide.addShape(
      'ellipse' as never,
      {
        x: 9.0,
        y: 5.5,
        w: 1.6,
        h: 1.6,
        fill: { color: hex(colors.accent), transparency: 90 },
      } as never,
    );
    // Tag
    slide.addText(tagline(subtitle), {
      x: 1.0,
      y: 1.2,
      w: 6.0,
      h: 0.5,
      fontSize: 12,
      fontFace: fonts.en,
      color: hex(colors.accent),
      charSpacing: 6,
      align: 'left',
      margin: 0,
    });
    // Accent line
    slide.addShape(
      'line' as never,
      { x: 1.0, y: 1.85, w: 1.2, h: 0, line: { color: hex(colors.accent), width: 2.5 } } as never,
    );
    // Title
    slide.addText(title, {
      x: 1.0,
      y: 2.2,
      w: 6.0,
      h: 1.6,
      fontSize: fonts.headingSize,
      fontFace: fonts.heading,
      color: hex(colors.textOnDark),
      bold: true,
      align: 'left',
      margin: 0,
    });
    // Subtitle
    slide.addText(subtitle, {
      x: 1.0,
      y: 4.0,
      w: 5.5,
      h: 0.6,
      fontSize: 16,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'left',
      margin: 0,
    });
    // Date
    slide.addText(todayDate(), {
      x: 1.0,
      y: 6.5,
      w: 4.0,
      h: 0.4,
      fontSize: 11,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'left',
      margin: 0,
    });
  },

  /* ── 3. split-panel: 左半深色面板 + 右半浅色 ── */
  'split-panel'(slide, _pres, dna, title, subtitle) {
    const { colors, fonts } = dna;
    slide.background = { color: hex(colors.contentBg) };
    // Dark left panel
    slide.addShape(
      'rect' as never,
      { x: 0, y: 0, w: 6.0, h: 7.5, fill: { color: hex(colors.coverBg) } } as never,
    );
    // Accent stripe at split
    slide.addShape(
      'rect' as never,
      { x: 6.0, y: 0, w: 0.08, h: 7.5, fill: { color: hex(colors.accent) } } as never,
    );
    // Right side accent shapes
    slide.addShape(
      'ellipse' as never,
      {
        x: 8.5,
        y: 1.5,
        w: 3,
        h: 3,
        fill: { color: hex(colors.accent), transparency: 92 },
      } as never,
    );
    slide.addShape(
      'ellipse' as never,
      {
        x: 9.5,
        y: 4.0,
        w: 2,
        h: 2,
        fill: { color: hex(colors.accentSecondary), transparency: 90 },
      } as never,
    );
    // Tag on left
    slide.addText(tagline(subtitle), {
      x: 0.8,
      y: 1.0,
      w: 4.8,
      h: 0.4,
      fontSize: 11,
      fontFace: fonts.en,
      color: hex(colors.accent),
      charSpacing: 5,
      align: 'left',
      margin: 0,
    });
    // Title on left panel
    slide.addText(title, {
      x: 0.8,
      y: 2.0,
      w: 4.8,
      h: 1.6,
      fontSize: fonts.headingSize - 4,
      fontFace: fonts.heading,
      color: hex(colors.textOnDark),
      bold: true,
      align: 'left',
      margin: 0,
    });
    // Subtitle
    slide.addText(subtitle, {
      x: 0.8,
      y: 3.8,
      w: 4.8,
      h: 0.6,
      fontSize: 14,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'left',
      margin: 0,
    });
    // Date on right panel
    slide.addText(todayDate(), {
      x: 7.0,
      y: 6.5,
      w: 5,
      h: 0.3,
      fontSize: 10,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'left',
      margin: 0,
    });
  },

  /* ── 4. big-number: 超大公式/数字占视觉重心 ── */
  'big-number'(slide, _pres, dna, title, subtitle) {
    const { colors, fonts } = dna;
    slide.background = { color: hex(colors.coverBg) };
    // Huge background number (title first 3 chars as watermark)
    const big = title.length <= 6 ? title : title.slice(0, 4);
    slide.addText(big, {
      x: 2,
      y: 0.5,
      w: 9.3,
      h: 5.0,
      fontSize: 120,
      fontFace: fonts.en,
      color: hex(colors.accent),
      bold: true,
      align: 'center',
      valign: 'middle',
      margin: 0,
    });
    // Making it translucent via shape overlay
    // Small tag above title
    slide.addText(tagline(subtitle), {
      x: 1.5,
      y: 0.6,
      w: 10.3,
      h: 0.4,
      fontSize: 10,
      fontFace: fonts.en,
      color: hex(colors.accent),
      charSpacing: 4,
      align: 'center',
      margin: 0,
    });
    // Title over the big number area (smaller, at bottom of that zone)
    // Bottom info bar
    slide.addShape(
      'rect' as never,
      {
        x: 0,
        y: 5.5,
        w: 13.33,
        h: 2.0,
        fill: { color: hex(colors.textPrimary), transparency: 85 },
      } as never,
    );
    slide.addText(title, {
      x: 1.5,
      y: 5.7,
      w: 10.3,
      h: 0.9,
      fontSize: 36,
      fontFace: fonts.heading,
      color: hex(colors.textOnDark),
      bold: true,
      align: 'center',
      margin: 0,
    });
    slide.addText(subtitle, {
      x: 2.5,
      y: 6.6,
      w: 8.3,
      h: 0.4,
      fontSize: 14,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'center',
      margin: 0,
    });
  },

  /* ── 5. vertical-poem: 竖排中文，中式书封感 ── */
  'vertical-poem'(slide, _pres, dna, title, subtitle) {
    const { colors, fonts } = dna;
    slide.background = { color: hex(colors.coverBg) };
    // Top / bottom decorative bars
    slide.addShape(
      'rect' as never,
      {
        x: 0,
        y: 0,
        w: 13.33,
        h: 0.04,
        fill: { color: hex(colors.accent), transparency: 60 },
      } as never,
    );
    slide.addShape(
      'rect' as never,
      {
        x: 0,
        y: 7.46,
        w: 13.33,
        h: 0.04,
        fill: { color: hex(colors.accent), transparency: 60 },
      } as never,
    );
    // Right side seal-like square
    slide.addShape(
      'rect' as never,
      {
        x: 10.8,
        y: 1.2,
        w: 1.8,
        h: 1.8,
        fill: { color: hex(colors.accent), transparency: 88 },
      } as never,
    );
    // Center: title rendered as stacked characters
    const chars = title.replace(/\s/g, '').split('');
    const charH = 0.55;
    const totalH = chars.length * charH;
    const startY = (H - totalH) / 2;
    for (let i = 0; i < chars.length; i++) {
      slide.addText(chars[i], {
        x: 9.5,
        y: startY + i * charH,
        w: 2.0,
        h: charH,
        fontSize: 28,
        fontFace: fonts.heading,
        color: hex(colors.textOnDark),
        bold: true,
        align: 'center',
        margin: 0,
      });
    }
    // Small tag top-left
    slide.addText(tagline(subtitle), {
      x: 1.0,
      y: 1.2,
      w: 5.0,
      h: 0.3,
      fontSize: 10,
      fontFace: fonts.en,
      color: hex(colors.accent),
      charSpacing: 4,
      align: 'left',
      margin: 0,
    });
    // Subtitle bottom
    slide.addText(subtitle, {
      x: 2.5,
      y: 6.0,
      w: 6.0,
      h: 0.4,
      fontSize: 13,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'center',
      margin: 0,
    });
  },

  /* ── 6. corner-drama: 装饰集中一角，标题另一端 ── */
  'corner-drama'(slide, _pres, dna, title, subtitle) {
    const { colors, fonts } = dna;
    slide.background = { color: hex(colors.coverBg) };
    // Top-right corner drama
    slide.addShape(
      'rect' as never,
      { x: 8.5, y: 0, w: 5, h: 5, fill: { color: hex(colors.accent), transparency: 92 } } as never,
    );
    slide.addShape(
      'ellipse' as never,
      {
        x: 10.5,
        y: 0.5,
        w: 2.5,
        h: 2.5,
        fill: { color: hex(colors.accentSecondary), transparency: 88 },
      } as never,
    );
    slide.addShape(
      'line' as never,
      { x: 8.5, y: 5, w: 0, h: 2.5, line: { color: hex(colors.accent), width: 1.5 } } as never,
    );
    slide.addShape(
      'line' as never,
      { x: 8.5, y: 5, w: 4.83, h: 0, line: { color: hex(colors.accent), width: 1.5 } } as never,
    );
    // Small corner indicator bottom-left
    slide.addShape(
      'rect' as never,
      {
        x: 0,
        y: 6.5,
        w: 0.8,
        h: 1.0,
        fill: { color: hex(colors.accent), transparency: 85 },
      } as never,
    );
    // Tag
    slide.addText(tagline(subtitle), {
      x: 1.0,
      y: 1.2,
      w: 6.0,
      h: 0.4,
      fontSize: 11,
      fontFace: fonts.en,
      color: hex(colors.accent),
      charSpacing: 5,
      align: 'left',
      margin: 0,
    });
    // Title (left, away from corner drama)
    slide.addText(title, {
      x: 1.0,
      y: 2.5,
      w: 7.0,
      h: 1.6,
      fontSize: fonts.headingSize,
      fontFace: fonts.heading,
      color: hex(colors.textOnDark),
      bold: true,
      align: 'left',
      margin: 0,
    });
    // Subtitle
    slide.addText(subtitle, {
      x: 1.0,
      y: 4.3,
      w: 6.0,
      h: 0.5,
      fontSize: 15,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'left',
      margin: 0,
    });
    // Date bottom-left
    slide.addText(todayDate(), {
      x: 1.0,
      y: 6.5,
      w: 4.0,
      h: 0.3,
      fontSize: 10,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'left',
      margin: 0,
    });
  },

  /* ── 7. frame-border: 细边框包裹，内容居中 ── */
  'frame-border'(slide, _pres, dna, title, subtitle) {
    const { colors, fonts } = dna;
    slide.background = { color: hex(colors.coverBg) };
    // Double-frame border
    const m = 0.6;
    slide.addShape(
      'rect' as never,
      {
        x: m,
        y: m,
        w: W - 2 * m,
        h: H - 2 * m,
        fill: { color: hex(colors.accent), transparency: 97 },
        line: { color: hex(colors.accent), width: 0.8 },
      } as never,
    );
    slide.addShape(
      'rect' as never,
      {
        x: m + 0.15,
        y: m + 0.15,
        w: W - 2 * (m + 0.15),
        h: H - 2 * (m + 0.15),
        line: { color: hex(colors.accent), width: 0.5 },
      } as never,
    );
    // Small corner dots
    for (const [xx, yy] of [
      [m, m],
      [W - m, m],
      [m, H - m],
      [W - m, H - m],
    ]) {
      slide.addShape(
        'ellipse' as never,
        {
          x: xx - 0.12,
          y: yy - 0.12,
          w: 0.24,
          h: 0.24,
          fill: { color: hex(colors.accent) },
        } as never,
      );
    }
    // Tag
    slide.addText(tagline(subtitle), {
      x: 2.0,
      y: 1.6,
      w: 9.3,
      h: 0.4,
      fontSize: 11,
      fontFace: fonts.en,
      color: hex(colors.accent),
      charSpacing: 6,
      align: 'center',
      margin: 0,
    });
    // Title
    slide.addText(title, {
      x: 2.0,
      y: 2.3,
      w: 9.3,
      h: 1.6,
      fontSize: fonts.headingSize,
      fontFace: fonts.heading,
      color: hex(colors.textOnDark),
      bold: true,
      align: 'center',
      margin: 0,
    });
    // Subtitle
    slide.addText(subtitle, {
      x: 2.5,
      y: 4.2,
      w: 8.3,
      h: 0.5,
      fontSize: 15,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'center',
      margin: 0,
    });
    // Date
    slide.addText(todayDate(), {
      x: 4,
      y: 5.5,
      w: 5.3,
      h: 0.3,
      fontSize: 10,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'center',
      margin: 0,
    });
  },

  /* ── 8. minimal-type: 纯排版无形状装饰 ── */
  'minimal-type'(slide, _pres, dna, title, subtitle) {
    const { colors, fonts } = dna;
    slide.background = { color: hex(colors.coverBg) };
    // Only text, no decorative shapes. Rely on typography + spacing.
    // Large centered title
    slide.addText(title, {
      x: 1.5,
      y: 2.0,
      w: 10.3,
      h: 2.0,
      fontSize: fonts.headingSize + 8,
      fontFace: fonts.heading,
      color: hex(colors.textOnDark),
      bold: true,
      align: 'center',
      valign: 'middle',
      margin: 0,
    });
    // Thin separator line
    slide.addShape(
      'line' as never,
      { x: 5.5, y: 4.3, w: 2.3, h: 0, line: { color: hex(colors.accent), width: 1.0 } } as never,
    );
    // Subtitle
    slide.addText(subtitle, {
      x: 2.5,
      y: 4.6,
      w: 8.3,
      h: 0.5,
      fontSize: 15,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'center',
      margin: 0,
    });
    // Tag
    slide.addText(tagline(subtitle), {
      x: 4,
      y: 5.4,
      w: 5.3,
      h: 0.3,
      fontSize: 10,
      fontFace: fonts.en,
      color: hex(colors.textMuted),
      charSpacing: 6,
      align: 'center',
      margin: 0,
    });
  },

  /* ── 9. bold-accent: 顶部粗色带 + 标题在其上 ── */
  'bold-accent'(slide, _pres, dna, title, subtitle) {
    const { colors, fonts } = dna;
    slide.background = { color: hex(colors.coverBg) };
    // Thick top accent bar
    slide.addShape(
      'rect' as never,
      {
        x: 0,
        y: 0,
        w: 13.33,
        h: 1.2,
        fill: { color: hex(colors.accent), transparency: 40 },
      } as never,
    );
    // Second thinner bar
    slide.addShape(
      'rect' as never,
      { x: 0, y: 1.2, w: 13.33, h: 0.06, fill: { color: hex(colors.accent) } } as never,
    );
    // Tag in top bar
    slide.addText(tagline(subtitle), {
      x: 1.0,
      y: 0.3,
      w: 11,
      h: 0.4,
      fontSize: 11,
      fontFace: fonts.en,
      color: hex(colors.textOnDark),
      charSpacing: 5,
      align: 'left',
      margin: 0,
    });
    // Title below bars
    slide.addText(title, {
      x: 1.0,
      y: 2.2,
      w: 11.3,
      h: 1.6,
      fontSize: fonts.headingSize,
      fontFace: fonts.heading,
      color: hex(colors.textOnDark),
      bold: true,
      align: 'left',
      margin: 0,
    });
    // Left accent bar next to title
    slide.addShape(
      'rect' as never,
      { x: 0.3, y: 2.2, w: 0.08, h: 1.6, fill: { color: hex(colors.accent) } } as never,
    );
    // Subtitle
    slide.addText(subtitle, {
      x: 1.0,
      y: 4.0,
      w: 8.0,
      h: 0.5,
      fontSize: 15,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'left',
      margin: 0,
    });
    // Bottom accent bar
    slide.addShape(
      'rect' as never,
      {
        x: 0,
        y: 6.2,
        w: 13.33,
        h: 0.04,
        fill: { color: hex(colors.accent), transparency: 60 },
      } as never,
    );
    slide.addText(todayDate(), {
      x: 1.0,
      y: 6.5,
      w: 4.0,
      h: 0.3,
      fontSize: 10,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'left',
      margin: 0,
    });
  },

  /* ── 10. gradient-wash: 柔和渐变底，标题悬浮 ── */
  'gradient-wash'(slide, _pres, dna, title, subtitle) {
    const { colors, fonts } = dna;
    slide.background = { color: hex(colors.coverBg) };
    // Soft overlays to hint gradient
    slide.addShape(
      'rect' as never,
      {
        x: 0,
        y: 0,
        w: 13.33,
        h: 4.5,
        fill: { color: hex(colors.accentSecondary), transparency: 92 },
      } as never,
    );
    slide.addShape(
      'rect' as never,
      {
        x: 0,
        y: 3.0,
        w: 13.33,
        h: 4.5,
        fill: { color: hex(colors.accent), transparency: 94 },
      } as never,
    );
    // Light scattered circles
    for (const [cx, cy, sz] of [
      [3, 2.5, 1.8],
      [10.5, 5.5, 2.2],
      [6.5, 4.0, 1.2],
    ] as const) {
      slide.addShape(
        'ellipse' as never,
        {
          x: cx,
          y: cy,
          w: sz,
          h: sz,
          fill: { color: hex(colors.accentLight), transparency: 85 },
        } as never,
      );
    }
    // Tag
    slide.addText(tagline(subtitle), {
      x: 1.5,
      y: 1.0,
      w: 10.3,
      h: 0.4,
      fontSize: 11,
      fontFace: fonts.en,
      color: hex(colors.accent),
      charSpacing: 6,
      align: 'center',
      margin: 0,
    });
    // Title
    slide.addText(title, {
      x: 1.0,
      y: 2.2,
      w: 11.3,
      h: 1.6,
      fontSize: fonts.headingSize,
      fontFace: fonts.heading,
      color: hex(colors.textOnDark),
      bold: true,
      align: 'center',
      margin: 0,
    });
    // Subtitle
    slide.addText(subtitle, {
      x: 2.0,
      y: 4.2,
      w: 9.3,
      h: 0.5,
      fontSize: 15,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'center',
      margin: 0,
    });
    // Date
    slide.addText(todayDate(), {
      x: 4,
      y: 6.5,
      w: 5.3,
      h: 0.3,
      fontSize: 10,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'center',
      margin: 0,
    });
  },

  /* ── 11. double-stripe: 上下平行线夹标题 ── */
  'double-stripe'(slide, _pres, dna, title, subtitle) {
    const { colors, fonts } = dna;
    slide.background = { color: hex(colors.coverBg) };
    // Top thick stripe
    slide.addShape(
      'rect' as never,
      { x: 0, y: 1.3, w: 13.33, h: 0.06, fill: { color: hex(colors.accent) } } as never,
    );
    // Bottom thick stripe
    slide.addShape(
      'rect' as never,
      { x: 0, y: 4.8, w: 13.33, h: 0.06, fill: { color: hex(colors.accent) } } as never,
    );
    // Thin accent stripe above title
    slide.addShape(
      'rect' as never,
      { x: 1.0, y: 1.6, w: 3.0, h: 0.03, fill: { color: hex(colors.accentSecondary) } } as never,
    );
    // Tag
    slide.addText(tagline(subtitle), {
      x: 1.0,
      y: 0.6,
      w: 8.0,
      h: 0.4,
      fontSize: 10,
      fontFace: fonts.en,
      color: hex(colors.accent),
      charSpacing: 5,
      align: 'left',
      margin: 0,
    });
    // Title between stripes
    slide.addText(title, {
      x: 1.0,
      y: 2.0,
      w: 10.0,
      h: 2.0,
      fontSize: fonts.headingSize,
      fontFace: fonts.heading,
      color: hex(colors.textOnDark),
      bold: true,
      align: 'left',
      valign: 'middle',
      margin: 0,
    });
    // Subtitle below bottom stripe
    slide.addText(subtitle, {
      x: 1.0,
      y: 5.2,
      w: 9.0,
      h: 0.5,
      fontSize: 15,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'left',
      margin: 0,
    });
    // Date
    slide.addText(todayDate(), {
      x: 1.0,
      y: 6.5,
      w: 4.0,
      h: 0.3,
      fontSize: 10,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'left',
      margin: 0,
    });
  },

  /* ── 12. image-zone: 右侧图区占位 ── */
  'image-zone'(slide, _pres, dna, title, subtitle) {
    const { colors, fonts } = dna;
    slide.background = { color: hex(colors.coverBg) };
    // Right image zone with border
    slide.addShape(
      'rect' as never,
      {
        x: 7.5,
        y: 1.0,
        w: 5.0,
        h: 5.5,
        fill: { color: hex(colors.accent), transparency: 90 },
        line: { color: hex(colors.accent), width: 0.5 },
      } as never,
    );
    // Cross lines in image zone (placeholder)
    slide.addShape(
      'line' as never,
      { x: 7.8, y: 1.3, w: 4.4, h: 4.9, line: { color: hex(colors.accent), width: 0.3 } } as never,
    );
    slide.addShape(
      'line' as never,
      {
        x: 12.2,
        y: 1.3,
        w: -4.4,
        h: 4.9,
        line: { color: hex(colors.accent), width: 0.3 },
      } as never,
    );
    // Small label in image zone
    slide.addText('[ 插 图 ]', {
      x: 8.5,
      y: 3.0,
      w: 3.0,
      h: 1.0,
      fontSize: 14,
      fontFace: fonts.heading,
      color: hex(colors.accent),
      align: 'center',
      margin: 0,
    });
    // Tag
    slide.addText(tagline(subtitle), {
      x: 0.8,
      y: 1.0,
      w: 6.0,
      h: 0.4,
      fontSize: 11,
      fontFace: fonts.en,
      color: hex(colors.accent),
      charSpacing: 5,
      align: 'left',
      margin: 0,
    });
    // Accent line
    slide.addShape(
      'line' as never,
      { x: 0.8, y: 1.6, w: 1.0, h: 0, line: { color: hex(colors.accent), width: 2.0 } } as never,
    );
    // Title left
    slide.addText(title, {
      x: 0.8,
      y: 2.0,
      w: 6.0,
      h: 1.8,
      fontSize: fonts.headingSize - 4,
      fontFace: fonts.heading,
      color: hex(colors.textOnDark),
      bold: true,
      align: 'left',
      margin: 0,
    });
    // Subtitle
    slide.addText(subtitle, {
      x: 0.8,
      y: 4.0,
      w: 6.0,
      h: 0.6,
      fontSize: 14,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'left',
      margin: 0,
    });
    // Date
    slide.addText(todayDate(), {
      x: 0.8,
      y: 6.5,
      w: 4.0,
      h: 0.3,
      fontSize: 10,
      fontFace: fonts.body,
      color: hex(colors.textMuted),
      align: 'left',
      margin: 0,
    });
  },
};
