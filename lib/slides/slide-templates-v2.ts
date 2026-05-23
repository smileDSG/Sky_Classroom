/**
 * Slide Layout Templates v2 (B-008-v2)
 *
 * Theme-aware pre-built slide templates with visual decorations.
 * AI fills text content — templates control layout and apply theme tokens.
 */

import { nanoid } from 'nanoid';
import type { Slide, PPTElement } from '@/lib/types/slides';
import type {
  ThemeToken,
  TemplateParamsV2,
  TemplateDescriptorV2,
  TemplateSlotV2,
  TemplateIdV2,
} from './types';
import {
  generateCoverDecorations,
  generateBulletElements,
  generateStepBadges,
  generateCardBackgrounds,
  generateDivider,
  generateQuoteDecoration,
  generateTableCells,
  buildGradientBackground,
} from './template-decorators';

// ── Constants ──────────────────────────────────────────────────────

const CANVAS_W = 1000;
const CANVAS_H = 562.5;

function elId(prefix: string): string {
  return `${prefix}_${nanoid(6)}`;
}

function textEl(
  id: string,
  left: number,
  top: number,
  width: number,
  height: number,
  content: string,
  theme: ThemeToken,
  options: { fontSize?: number; color?: string; bold?: boolean; align?: string } = {},
): Slide['elements'][number] {
  const fontSize = options.fontSize ?? theme.bodyFontSize;
  const color = options.color ?? theme.bodyColor;
  const bold = options.bold ?? false;
  const align = options.align ?? 'left';

  return {
    id: elId(id),
    type: 'text',
    left,
    top,
    width,
    height,
    content: `<p style="font-size:${fontSize}px;color:${color};text-align:${align};${bold ? 'font-weight:bold;' : ''}line-height:1.5;">${String(content ?? '')}</p>`,
    defaultFontName: theme.fontFamily,
    defaultColor: color,
    rotate: 0,
  };
}

// ── Cover Templates ────────────────────────────────────────────────

export function coverClassic(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const decorations = generateCoverDecorations(theme);
  const bg = theme.coverBgGradient
    ? buildGradientBackground(theme.coverBgGradient)
    : { type: 'solid' as const, color: theme.coverBg };

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'cover',
    theme: {
      backgroundColor: theme.coverBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.coverTitleColor,
      fontName: theme.fontFamily,
    },
    background: bg,
    elements: [
      ...decorations,
      textEl('title', 100, 170, 800, 90, params.title || '', theme, {
        fontSize: theme.coverTitleSize,
        color: theme.coverTitleColor,
        bold: true,
        align: 'center',
      }),
      textEl('subtitle', 150, 280, 700, 60, params.subtitle || '', theme, {
        fontSize: theme.coverSubSize,
        color: theme.coverSubColor,
        align: 'center',
      }),
    ],
  };
}

export function coverModern(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const decorations = generateCoverDecorations(theme);
  const bg = theme.coverBgGradient
    ? buildGradientBackground(theme.coverBgGradient)
    : { type: 'solid' as const, color: theme.coverBg };

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'cover',
    theme: {
      backgroundColor: theme.coverBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.coverTitleColor,
      fontName: theme.fontFamily,
    },
    background: bg,
    elements: [
      ...decorations,
      // Accent bar at top
      {
        id: elId('accent_bar'),
        type: 'shape',
        left: 0,
        top: 0,
        width: CANVAS_W,
        height: 8,
        path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
        viewBox: '0 0 1 1',
        fill: theme.accent,
        fixedRatio: false,
        rotate: 0,
      },
      textEl('title', 60, 120, 600, 130, params.title || '', theme, {
        fontSize: theme.coverTitleSize,
        color: theme.coverTitleColor,
        bold: true,
        align: 'left',
      }),
      textEl('subtitle', 60, 260, 500, 50, params.subtitle || '', theme, {
        fontSize: theme.coverSubSize,
        color: theme.accent,
        align: 'left',
      }),
    ],
  };
}

export function coverBold(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const decorations = generateCoverDecorations(theme);
  const bg = theme.coverBgGradient
    ? buildGradientBackground(theme.coverBgGradient)
    : { type: 'solid' as const, color: theme.coverBg };

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'cover',
    theme: {
      backgroundColor: theme.coverBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.coverTitleColor,
      fontName: theme.fontFamily,
    },
    background: bg,
    elements: [
      ...decorations,
      textEl('title', 80, 140, 840, 150, params.title || '', theme, {
        fontSize: theme.coverTitleSize,
        color: theme.coverTitleColor,
        bold: true,
        align: 'center',
      }),
      textEl('subtitle', 150, 320, 700, 50, params.subtitle || '', theme, {
        fontSize: theme.coverSubSize,
        color: theme.coverSubColor,
        align: 'center',
      }),
    ],
  };
}

export function coverFullImage(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const bg = theme.coverBgGradient
    ? buildGradientBackground(theme.coverBgGradient)
    : { type: 'solid' as const, color: theme.coverBg };

  const elements: Slide['elements'] = [
    // Full-width image placeholder or actual image
    {
      id: elId('cover_img'),
      type: 'image',
      left: 0,
      top: 0,
      width: CANVAS_W,
      height: CANVAS_H,
      src: params.imageUrl || '',
      fixedRatio: false,
      rotate: 0,
    },
    // Dark overlay for text readability
    {
      id: elId('overlay'),
      type: 'shape',
      left: 0,
      top: 0,
      width: CANVAS_W,
      height: CANVAS_H,
      path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
      viewBox: '0 0 1 1',
      fill: '#000000',
      opacity: 0.4,
      fixedRatio: false,
      rotate: 0,
    },
    textEl('title', 60, 200, 880, 90, params.title || '', theme, {
      fontSize: theme.coverTitleSize,
      color: '#ffffff',
      bold: true,
      align: 'center',
    }),
    textEl('subtitle', 150, 310, 700, 50, params.subtitle || '', theme, {
      fontSize: theme.coverSubSize,
      color: 'rgba(255,255,255,0.85)',
      align: 'center',
    }),
  ];

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'cover',
    theme: {
      backgroundColor: theme.coverBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.coverTitleColor,
      fontName: theme.fontFamily,
    },
    background: bg,
    elements,
  };
}

export function coverGradient(params: TemplateParamsV2, theme: ThemeToken): Slide {
  // For macaron-pink theme, use template background images
  const isMacaron = theme.id === 'macaron-pink';
  const bg: Slide['background'] = isMacaron
    ? { type: 'image', image: { src: '/templates/backgrounds/macaron_cover_1.jpg', size: 'cover' } }
    : theme.coverBgGradient
      ? buildGradientBackground(theme.coverBgGradient)
      : { type: 'solid', color: theme.coverBg };

  const elements: Slide['elements'] = [
    // Decorative circle
    {
      id: elId('dec_circle'),
      type: 'shape',
      left: 700,
      top: 50,
      width: 250,
      height: 250,
      path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
      viewBox: '0 0 100 100',
      fill: theme.accent,
      opacity: 0.1,
      fixedRatio: false,
      rotate: 0,
    },
    textEl('title', 80, 160, 600, 130, params.title || '', theme, {
      fontSize: theme.coverTitleSize,
      color: theme.coverTitleColor,
      bold: true,
      align: 'left',
    }),
    textEl('subtitle', 80, 310, 500, 50, params.subtitle || '', theme, {
      fontSize: theme.coverSubSize,
      color: theme.coverSubColor,
      align: 'left',
    }),
    // Accent underline
    {
      id: elId('accent_line'),
      type: 'line',
      left: 80,
      top: 300,
      width: 120,
      height: 4,
      start: [0, 0],
      end: [120, 0],
      color: theme.accent,
      rotate: 0,
    } as unknown as PPTElement,
  ];

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'cover',
    theme: {
      backgroundColor: theme.coverBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.coverTitleColor,
      fontName: theme.fontFamily,
    },
    background: bg,
    elements,
  };
}

// ── Content Templates ──────────────────────────────────────────────

export function contentTitleBody(params: TemplateParamsV2, theme: ThemeToken): Slide {
  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements: [
      textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
        fontSize: theme.titleFontSize,
        color: theme.bodyColor,
        bold: true,
      }),
      generateDivider(theme, 115, { left: theme.pageMargin, width: 80 }),
      textEl('body', theme.pageMargin, 140, theme.contentMaxWidth, 380, params.bodyText || '', theme, {
        fontSize: theme.bodyFontSize,
        color: theme.bodyColor,
      }),
    ],
  };
}

export function contentTwoCol(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const gap = 40;
  const colW = (theme.contentMaxWidth - gap) / 2;

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements: [
      textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
        fontSize: theme.titleFontSize,
        color: theme.bodyColor,
        bold: true,
      }),
      generateDivider(theme, 115, { left: theme.pageMargin, width: 80 }),
      textEl('left', theme.pageMargin, 140, colW, 380, params.leftText || '', theme, {
        fontSize: theme.bodyFontSize,
        color: theme.bodyColor,
      }),
      // Center divider
      {
        id: elId('col_div'),
        type: 'line',
        left: theme.pageMargin + colW + gap / 2 - 1,
        top: 140,
        width: 2,
        height: 350,
        start: [0, 0],
        end: [0, 350],
        color: theme.dividerColor,
        rotate: 0,
      } as unknown as PPTElement,
      textEl('right', theme.pageMargin + colW + gap, 140, colW, 380, params.rightText || '', theme, {
        fontSize: theme.bodyFontSize,
        color: theme.bodyColor,
      }),
    ],
  };
}

export function contentBullets(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const bullets = params.bullets || [];

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements: [
      textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
        fontSize: theme.titleFontSize,
        color: theme.bodyColor,
        bold: true,
      }),
      generateDivider(theme, 115, { left: theme.pageMargin, width: 80 }),
      ...generateBulletElements(bullets, theme, 140, {
        maxWidth: theme.contentMaxWidth,
        leftMargin: theme.pageMargin,
        lineHeight: 70,
      }),
    ],
  };
}

export function contentFormula(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const elements: Slide['elements'] = [
    textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
      fontSize: theme.titleFontSize,
      color: theme.bodyColor,
      bold: true,
    }),
    generateDivider(theme, 115, { left: theme.pageMargin, width: 80 }),
  ];

  if (params.formula) {
    elements.push({
      id: elId('formula'),
      type: 'latex',
      left: 100,
      top: 160,
      width: 800,
      height: 100,
      latex: params.formula,
      color: theme.bodyColor,
      align: 'center',
      fixedRatio: true,
      rotate: 0,
    });
  }

  if (params.formulaNote) {
    elements.push(
      textEl('note', 100, 290, 800, 80, params.formulaNote, theme, {
        fontSize: theme.captionFontSize,
        color: theme.bodyMutedColor,
        align: 'center',
      }),
    );
  }

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements,
  };
}

export function contentSteps(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const steps = params.steps || [];
  const n = Math.min(steps.length, 4);

  if (n === 0) return contentTitleBody(params, theme);

  const totalGap = (n - 1) * 30;
  const cardW = Math.min(200, (theme.contentMaxWidth - totalGap) / n);
  const startX = theme.pageMargin + (theme.contentMaxWidth - (cardW * n + totalGap)) / 2;

  const elements: Slide['elements'] = [
    textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
      fontSize: theme.titleFontSize,
      color: theme.bodyColor,
      bold: true,
      align: 'center',
    }),
    generateDivider(theme, 115, {
      left: theme.pageMargin + theme.contentMaxWidth / 2 - 40,
      width: 80,
    }),
  ];

  // Step badges
  const badgePositions = Array.from({ length: n }, (_, i) => ({
    x: startX + i * (cardW + 30) + cardW / 2 - 24,
    y: 150,
  }));
  elements.push(...generateStepBadges(n, theme, badgePositions));

  // Step text
  for (let i = 0; i < n; i++) {
    const x = startX + i * (cardW + 30);
    elements.push(
      textEl(`stepT_${i}`, x, 220, cardW, 40, steps[i].title || '', theme, {
        fontSize: 18,
        color: theme.bodyColor,
        bold: true,
        align: 'center',
      }),
    );
    elements.push(
      textEl(`stepD_${i}`, x, 270, cardW, 120, steps[i].text || '', theme, {
        fontSize: 14,
        color: theme.bodyMutedColor,
        align: 'center',
      }),
    );
  }

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements,
  };
}

export function contentQuote(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const elements: Slide['elements'] = [
    generateQuoteDecoration(theme, 80, 60),
    textEl('quote', 100, 120, 800, 200, `&ldquo;${params.quote || ''}&rdquo;`, theme, {
      fontSize: 28,
      color: theme.coverTitleColor,
      align: 'center',
    }),
  ];

  if (params.quoteAuthor) {
    elements.push(
      textEl('author', 100, 350, 800, 40, `&mdash; ${params.quoteAuthor || ''}`, theme, {
        fontSize: 18,
        color: theme.bodyMutedColor,
        align: 'center',
      }),
    );
  }

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.accentLight },
    elements,
  };
}

export function contentGrid2x2(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const items = params.gridItems || [];
  const CARD_W = 400;
  const CARD_H = 160;
  const GAP = 24;
  const startX = (CANVAS_W - (CARD_W * 2 + GAP)) / 2;

  const positions = items.slice(0, 4).map((_, i) => ({
    x: startX + (i % 2) * (CARD_W + GAP),
    y: 130 + Math.floor(i / 2) * (CARD_H + GAP),
    w: CARD_W,
    h: CARD_H,
  }));

  const elements: Slide['elements'] = [
    textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
      fontSize: theme.titleFontSize,
      color: theme.bodyColor,
      bold: true,
    }),
    generateDivider(theme, 115, { left: theme.pageMargin, width: 80 }),
    ...generateCardBackgrounds(items.length, theme, positions),
  ];

  items.slice(0, 4).forEach((item, i) => {
    const pos = positions[i];
    elements.push(
      textEl(`ct_${i}`, pos.x + 20, pos.y + 20, CARD_W - 40, 40, item.title || '', theme, {
        fontSize: 18,
        color: theme.bodyColor,
        bold: true,
      }),
    );
    elements.push(
      textEl(`cd_${i}`, pos.x + 20, pos.y + 65, CARD_W - 40, 80, item.text || '', theme, {
        fontSize: 14,
        color: theme.bodyMutedColor,
      }),
    );
  });

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements,
  };
}

export function contentImage(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const imgPos = params.imagePosition || 'left';
  const imgW = 420;
  const imgH = 340;
  const textW = theme.contentMaxWidth - imgW - 40;

  const imgLeft = imgPos === 'left' ? theme.pageMargin : theme.pageMargin + textW + 40;
  const textLeft = imgPos === 'left' ? theme.pageMargin + imgW + 40 : theme.pageMargin;

  const elements: Slide['elements'] = [
    textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
      fontSize: theme.titleFontSize,
      color: theme.bodyColor,
      bold: true,
    }),
    generateDivider(theme, 115, { left: theme.pageMargin, width: 80 }),
  ];

  if (params.imageUrl) {
    elements.push({
      id: elId('img'),
      type: 'image',
      left: imgLeft,
      top: 140,
      width: imgW,
      height: imgH,
      src: params.imageUrl,
      fixedRatio: false,
      rotate: 0,
    });
  } else {
    // Placeholder
    elements.push({
      id: elId('img_placeholder'),
      type: 'shape',
      left: imgLeft,
      top: 140,
      width: imgW,
      height: imgH,
      path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
      viewBox: '0 0 1 1',
      fill: theme.accentLight,
      fixedRatio: false,
      rotate: 0,
    });
    elements.push(
      textEl('img_label', imgLeft, 140 + imgH / 2 - 15, imgW, 30, '[图片]', theme, {
        fontSize: 14,
        color: theme.bodyMutedColor,
        align: 'center',
      }),
    );
  }

  if (params.imageCaption) {
    elements.push(
      textEl('caption', imgLeft, 140 + imgH + 10, imgW, 30, params.imageCaption || '', theme, {
        fontSize: theme.captionFontSize,
        color: theme.bodyMutedColor,
        align: 'center',
      }),
    );
  }

  elements.push(
    textEl('body', textLeft, 140, textW, imgH, params.bodyText || '', theme, {
      fontSize: theme.bodyFontSize,
      color: theme.bodyColor,
    }),
  );

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements,
  };
}

export function contentTable(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const headers = params.tableHeaders || [];
  const rows = params.tableRows || [];

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements: [
      textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
        fontSize: theme.titleFontSize,
        color: theme.bodyColor,
        bold: true,
      }),
      generateDivider(theme, 115, { left: theme.pageMargin, width: 80 }),
      ...generateTableCells(headers, rows, theme, 140),
    ],
  };
}

// ── New Content Templates ──────────────────────────────────────────

export function contentFullImage(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const elements: Slide['elements'] = [
    // Full background image
    {
      id: elId('bg_img'),
      type: 'image',
      left: 0,
      top: 0,
      width: CANVAS_W,
      height: CANVAS_H,
      src: params.imageUrl || '',
      fixedRatio: false,
      rotate: 0,
    },
    // Gradient overlay for text readability
    {
      id: elId('overlay'),
      type: 'shape',
      left: 0,
      top: 300,
      width: CANVAS_W,
      height: 262.5,
      path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
      viewBox: '0 0 1 1',
      fill: theme.coverBg,
      opacity: 0.85,
      fixedRatio: false,
      rotate: 0,
    },
    textEl('title', theme.pageMargin, 320, theme.contentMaxWidth, 70, params.title || '', theme, {
      fontSize: theme.titleFontSize,
      color: theme.coverTitleColor,
      bold: true,
    }),
    textEl('body', theme.pageMargin, 400, theme.contentMaxWidth, 120, params.bodyText || '', theme, {
      fontSize: theme.bodyFontSize,
      color: theme.bodyColor,
    }),
  ];

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements,
  };
}

export function contentTimeline(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const items = params.timelineItems || [];
  const n = Math.min(items.length, 5);
  const startY = 140;
  const itemHeight = 75;

  const elements: Slide['elements'] = [
    textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
      fontSize: theme.titleFontSize,
      color: theme.bodyColor,
      bold: true,
    }),
    generateDivider(theme, 115, { left: theme.pageMargin, width: 80 }),
    // Vertical line
    {
      id: elId('timeline_line'),
      type: 'line',
      left: theme.pageMargin + 50,
      top: startY,
      width: 2,
      height: n * itemHeight,
      start: [0, 0],
      end: [0, n * itemHeight],
      color: theme.accent,
      rotate: 0,
    } as unknown as PPTElement,
  ];

  items.slice(0, n).forEach((item, i) => {
    const y = startY + i * itemHeight;
    // Dot
    elements.push({
      id: elId('tl_dot'),
      type: 'shape',
      left: theme.pageMargin + 42,
      top: y + 8,
      width: 18,
      height: 18,
      path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
      viewBox: '0 0 100 100',
      fill: theme.accent,
      fixedRatio: false,
      rotate: 0,
    });
    // Date
    elements.push(
      textEl(`tl_date_${i}`, theme.pageMargin, y, 80, 30, item.date || '', theme, {
        fontSize: 14,
        color: theme.accent,
        bold: true,
      }),
    );
    // Event
    elements.push(
      textEl(`tl_event_${i}`, theme.pageMargin + 100, y, theme.contentMaxWidth - 100, 50, item.event || '', theme, {
        fontSize: theme.bodyFontSize,
        color: theme.bodyColor,
      }),
    );
  });

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements,
  };
}

export function contentProsCons(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const pros = params.pros || [];
  const cons = params.cons || [];
  const colW = (theme.contentMaxWidth - 40) / 2;

  const elements: Slide['elements'] = [
    textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
      fontSize: theme.titleFontSize,
      color: theme.bodyColor,
      bold: true,
    }),
    generateDivider(theme, 115, { left: theme.pageMargin, width: 80 }),
    // Pros header
    textEl('pros_header', theme.pageMargin, 140, colW, 40, '优点', theme, {
      fontSize: 20,
      color: '#16a34a',
      bold: true,
    }),
    // Cons header
    textEl('cons_header', theme.pageMargin + colW + 40, 140, colW, 40, '缺点', theme, {
      fontSize: 20,
      color: '#dc2626',
      bold: true,
    }),
    // Divider between columns
    {
      id: elId('pc_div'),
      type: 'line',
      left: theme.pageMargin + colW + 20,
      top: 140,
      width: 2,
      height: 380,
      start: [0, 0],
      end: [0, 380],
      color: theme.dividerColor,
      rotate: 0,
    } as unknown as PPTElement,
  ];

  // Pros bullets (green)
  pros.slice(0, 5).forEach((pro, i) => {
    const y = 190 + i * 60;
    elements.push({
      id: elId('pro_dot'),
      type: 'shape',
      left: theme.pageMargin,
      top: y + 6,
      width: 10,
      height: 10,
      path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
      viewBox: '0 0 100 100',
      fill: '#16a34a',
      fixedRatio: false,
      rotate: 0,
    });
    elements.push(
      textEl(`pro_${i}`, theme.pageMargin + 24, y, colW - 24, 50, pro || '', theme, {
        fontSize: theme.bodyFontSize,
        color: theme.bodyColor,
      }),
    );
  });

  // Cons bullets (red)
  cons.slice(0, 5).forEach((con, i) => {
    const y = 190 + i * 60;
    elements.push({
      id: elId('con_dot'),
      type: 'shape',
      left: theme.pageMargin + colW + 40,
      top: y + 6,
      width: 10,
      height: 10,
      path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
      viewBox: '0 0 100 100',
      fill: '#dc2626',
      fixedRatio: false,
      rotate: 0,
    });
    elements.push(
      textEl(`con_${i}`, theme.pageMargin + colW + 64, y, colW - 24, 50, con || '', theme, {
        fontSize: theme.bodyFontSize,
        color: theme.bodyColor,
      }),
    );
  });

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements,
  };
}

export function contentCode(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const codeBg = theme.id === 'tech-dark' ? '#0f172a' : theme.accentLight;
  const codeColor = theme.id === 'tech-dark' ? '#e2e8f0' : theme.bodyColor;

  const elements: Slide['elements'] = [
    textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
      fontSize: theme.titleFontSize,
      color: theme.bodyColor,
      bold: true,
    }),
    generateDivider(theme, 115, { left: theme.pageMargin, width: 80 }),
    // Code block background
    {
      id: elId('code_bg'),
      type: 'shape',
      left: theme.pageMargin,
      top: 140,
      width: theme.contentMaxWidth,
      height: 350,
      path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
      viewBox: '0 0 1 1',
      fill: codeBg,
      fixedRatio: false,
      rotate: 0,
      outline: {
        color: theme.dividerColor,
        width: 1,
        style: 'solid',
      },
    },
    // Language label
    textEl('lang_label', theme.pageMargin + 16, 146, 200, 24, params.codeLanguage || 'code', theme, {
      fontSize: 12,
      color: theme.bodyMutedColor,
    }),
    // Code text
    textEl('code', theme.pageMargin + 20, 175, theme.contentMaxWidth - 40, 300, params.code || '', theme, {
      fontSize: 14,
      color: codeColor,
    }),
  ];

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements,
  };
}

// ── Teaching-specific Content Templates ────────────────────────────

/** Table of Contents: chapter list with numbered circles */
export function contentToc(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const sections = params.sections || [{ title: '第一章' }, { title: '第二章' }];
  const n = Math.min(sections.length, 6);

  const elements: Slide['elements'] = [
    textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '本节课内容', theme, {
      fontSize: theme.titleFontSize,
      color: theme.bodyColor,
      bold: true,
    }),
    generateDivider(theme, 115, { left: theme.pageMargin, width: 80 }),
  ];

  for (let i = 0; i < n; i++) {
    const y = 150 + i * 65;
    // Number circle
    elements.push({
      id: elId('toc_circle'),
      type: 'shape',
      left: theme.pageMargin,
      top: y,
      width: 40,
      height: 40,
      path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
      viewBox: '0 0 100 100',
      fill: theme.accent,
      fixedRatio: false,
      rotate: 0,
    } as PPTElement);
    // Number
    elements.push(
      textEl(`toc_num_${i}`, theme.pageMargin, y + 4, 40, 32, String(i + 1), theme, {
        fontSize: 18,
        color: '#ffffff',
        bold: true,
        align: 'center',
      }),
    );
    // Section title
    elements.push(
      textEl(`toc_t_${i}`, theme.pageMargin + 56, y + 4, 400, 32, sections[i].title || '', theme, {
        fontSize: 20,
        color: theme.bodyColor,
        bold: true,
      }),
    );
    // Description (if present)
    if (sections[i].description) {
      elements.push(
        textEl(`toc_d_${i}`, theme.pageMargin + 56, y + 32, 400, 24, sections[i].description!, theme, {
          fontSize: 14,
          color: theme.bodyMutedColor,
        }),
      );
    }
  }

  // Right side decorative accent block
  elements.push({
    id: elId('toc_deco'),
    type: 'shape',
    left: CANVAS_W - 200,
    top: 120,
    width: 160,
    height: 380,
    path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
    viewBox: '0 0 1 1',
    fill: theme.accent,
    opacity: 0.06,
    fixedRatio: false,
    rotate: 0,
  } as PPTElement);

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements,
  };
}

/** Learning Objectives: checklist-style goals */
export function contentObjectives(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const objectives = params.objectives || [{ text: '理解核心概念' }, { text: '掌握基本方法' }];
  const n = Math.min(objectives.length, 5);

  const elements: Slide['elements'] = [
    textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '学习目标', theme, {
      fontSize: theme.titleFontSize,
      color: theme.bodyColor,
      bold: true,
    }),
    generateDivider(theme, 115, { left: theme.pageMargin, width: 80 }),
  ];

  for (let i = 0; i < n; i++) {
    const y = 150 + i * 70;
    // Check circle
    elements.push({
      id: elId('obj_circle'),
      type: 'shape',
      left: theme.pageMargin,
      top: y,
      width: 36,
      height: 36,
      path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
      viewBox: '0 0 100 100',
      fill: theme.accent,
      fixedRatio: false,
      rotate: 0,
    } as PPTElement);
    // Checkmark
    elements.push(
      textEl(`obj_check_${i}`, theme.pageMargin, y + 2, 36, 32, '✓', theme, {
        fontSize: 20,
        color: '#ffffff',
        bold: true,
        align: 'center',
      }),
    );
    // Objective text
    elements.push(
      textEl(`obj_txt_${i}`, theme.pageMargin + 50, y + 4, theme.contentMaxWidth - 80, 40, objectives[i].text || '', theme, {
        fontSize: theme.bodyFontSize + 2,
        color: theme.bodyColor,
      }),
    );
  }

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements,
  };
}

/** Section divider: large chapter number + title + intro */
export function contentSection(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const sectionNumber = params.sectionNumber || '01';
  const sectionTitle = params.sectionTitle || '新章节';
  const intro = params.intro || '';

  const elements: Slide['elements'] = [
    // Large background number (decorative, faint)
    textEl('sec_bg_num', theme.pageMargin, 60, theme.contentMaxWidth, 200, sectionNumber, theme, {
      fontSize: 140,
      color: theme.accent,
      bold: true,
      align: 'left',
    }),
    // Accent bar
    {
      id: elId('sec_bar'),
      type: 'shape',
      left: theme.pageMargin,
      top: 260,
      width: 80,
      height: 6,
      path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
      viewBox: '0 0 1 1',
      fill: theme.accent,
      fixedRatio: false,
      rotate: 0,
    } as PPTElement,
    // Section title
    textEl('sec_title', theme.pageMargin, 290, theme.contentMaxWidth, 70, sectionTitle, theme, {
      fontSize: 36,
      color: theme.bodyColor,
      bold: true,
    }),
  ];

  if (intro) {
    elements.push(
      textEl('sec_intro', theme.pageMargin, 370, theme.contentMaxWidth - 100, 80, intro, theme, {
        fontSize: theme.bodyFontSize + 2,
        color: theme.bodyMutedColor,
      }),
    );
  }

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.accentLight },
    elements,
  };
}

/** Quiz / Classroom exercise: question + options + answer */
export function contentQuiz(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const question = params.question || '请选择正确答案';
  const options = params.options || ['选项 A', '选项 B', '选项 C', '选项 D'];
  const answer = params.answer || '';
  const explanation = params.explanation || '';

  const elements: Slide['elements'] = [
    textEl('title', theme.pageMargin, 40, theme.contentMaxWidth, 50, params.title || '课堂练习', theme, {
      fontSize: theme.titleFontSize,
      color: theme.bodyColor,
      bold: true,
    }),
    generateDivider(theme, 100, { left: theme.pageMargin, width: 80 }),
    // Question
    textEl('quiz_q', theme.pageMargin, 120, theme.contentMaxWidth, 60, question, theme, {
      fontSize: theme.bodyFontSize + 2,
      color: theme.bodyColor,
      bold: true,
    }),
  ];

  // Options (2 columns)
  const cols = 2;
  const colW = (theme.contentMaxWidth - 24) / cols;
  const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
  options.slice(0, 6).forEach((opt, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = theme.pageMargin + col * (colW + 24);
    const y = 200 + row * 70;

    // Option badge
    elements.push({
      id: elId('quiz_badge'),
      type: 'shape',
      left: x,
      top: y,
      width: 32,
      height: 32,
      path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
      viewBox: '0 0 100 100',
      fill: theme.accent,
      fixedRatio: false,
      rotate: 0,
    } as PPTElement);

    elements.push(
      textEl(`quiz_lbl_${i}`, x, y + 2, 32, 28, optionLabels[i], theme, {
        fontSize: 16,
        color: '#ffffff',
        bold: true,
        align: 'center',
      }),
    );

    elements.push(
      textEl(`quiz_opt_${i}`, x + 42, y + 2, colW - 50, 60, opt || '', theme, {
        fontSize: theme.bodyFontSize,
        color: theme.bodyColor,
      }),
    );
  });

  // Answer & explanation (if provided)
  const answerY = 200 + Math.ceil(options.length / 2) * 70 + 20;
  if (answer) {
    elements.push(
      textEl('quiz_ans', theme.pageMargin, answerY, theme.contentMaxWidth, 30, `答案：${answer}`, theme, {
        fontSize: theme.bodyFontSize,
        color: theme.accent,
        bold: true,
      }),
    );
  }
  if (explanation) {
    elements.push(
      textEl('quiz_exp', theme.pageMargin, answerY + 36, theme.contentMaxWidth, 60, `解析：${explanation}`, theme, {
        fontSize: theme.captionFontSize,
        color: theme.bodyMutedColor,
      }),
    );
  }

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements,
  };
}

export function contentBigIdea(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const elements: Slide['elements'] = [
    // Large decorative number/icon background
    {
      id: elId('big_bg'),
      type: 'shape',
      left: theme.pageMargin,
      top: 100,
      width: 120,
      height: 120,
      path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
      viewBox: '0 0 100 100',
      fill: theme.accent,
      opacity: 0.1,
      fixedRatio: false,
      rotate: 0,
    },
    // Lightbulb/icon text
    textEl('big_icon', theme.pageMargin + 30, 120, 60, 80, '💡', theme, {
      fontSize: 48,
      color: theme.accent,
      align: 'center',
    }),
    textEl('title', theme.pageMargin + 160, 110, theme.contentMaxWidth - 160, 70, params.title || '', theme, {
      fontSize: theme.titleFontSize,
      color: theme.bodyColor,
      bold: true,
    }),
    textEl('body', theme.pageMargin, 240, theme.contentMaxWidth, 260, params.bodyText || '', theme, {
      fontSize: theme.bodyFontSize + 2,
      color: theme.bodyColor,
    }),
  ];

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements,
  };
}

// ── End Templates ──────────────────────────────────────────────────

export function endSummary(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const points = params.keyPoints || [];
  const bg = theme.coverBgGradient
    ? buildGradientBackground(theme.coverBgGradient)
    : { type: 'solid' as const, color: theme.contentBg };

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'end',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: bg,
    elements: [
      textEl('title', theme.pageMargin, 60, theme.contentMaxWidth, 70, params.title || '要点总结', theme, {
        fontSize: 36,
        color: theme.coverTitleColor,
        bold: true,
        align: 'center',
      }),
      ...generateBulletElements(points, theme, 150, {
        maxWidth: theme.contentMaxWidth - 100,
        leftMargin: theme.pageMargin + 50,
        lineHeight: 60,
        maxItems: 6,
      }),
    ],
  };
}

export function endThanks(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const bg = theme.coverBgGradient
    ? buildGradientBackground(theme.coverBgGradient)
    : { type: 'solid' as const, color: theme.coverBg };

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'end',
    theme: {
      backgroundColor: theme.coverBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.coverTitleColor,
      fontName: theme.fontFamily,
    },
    background: bg,
    elements: [
      ...generateCoverDecorations(theme),
      textEl('thanks', 100, 180, 800, 100, '谢谢', theme, {
        fontSize: 48,
        color: theme.coverTitleColor,
        bold: true,
        align: 'center',
      }),
      textEl('sub', 100, 300, 800, 60, params.subtitle || '', theme, {
        fontSize: 20,
        color: theme.coverSubColor,
        align: 'center',
      }),
    ],
  };
}

export function endQA(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const bg = theme.coverBgGradient
    ? buildGradientBackground(theme.coverBgGradient)
    : { type: 'solid' as const, color: theme.contentBg };

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'end',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: bg,
    elements: [
      textEl('qa', 100, 160, 800, 120, 'Q & A', theme, {
        fontSize: 52,
        color: theme.accent,
        bold: true,
        align: 'center',
      }),
      textEl('sub', 100, 300, 800, 50, params.subtitle || '欢迎提问与讨论', theme, {
        fontSize: 18,
        color: theme.bodyMutedColor,
        align: 'center',
      }),
      // Decorative line
      {
        id: elId('qa_line'),
        type: 'line',
        left: 350,
        top: 290,
        width: 300,
        height: 2,
        start: [0, 0],
        end: [300, 0],
        color: theme.accent,
        rotate: 0,
      } as unknown as PPTElement,
    ],
  };
}

// ── Premium Content Templates ──────────────────────────────────────

/** Data stats cards: large numbers with descriptions */
export function contentStats(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const items = params.gridItems || [{ title: '100+', text: '示例数据' }];
  const n = Math.min(items.length, 4);
  const gap = 24;
  const cardW = (theme.contentMaxWidth - (n - 1) * gap) / n;
  const startX = theme.pageMargin;

  const elements: Slide['elements'] = [
    textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
      fontSize: theme.titleFontSize,
      color: theme.bodyColor,
      bold: true,
    }),
    generateDivider(theme, 115, { left: theme.pageMargin, width: 60 }),
  ];

  for (let i = 0; i < n; i++) {
    const x = startX + i * (cardW + gap);
    const y = 160;

    // Card background with subtle theme tint
    elements.push({
      id: elId('stat_card'),
      type: 'shape',
      left: x,
      top: y,
      width: cardW,
      height: 220,
      path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
      viewBox: '0 0 1 1',
      fill: theme.accentLight,
      fixedRatio: false,
      rotate: 0,
      outline: { color: theme.dividerColor, width: 1, style: 'solid' },
    } as PPTElement);

    // Top accent bar
    elements.push({
      id: elId('stat_bar'),
      type: 'shape',
      left: x,
      top: y,
      width: cardW,
      height: 4,
      path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
      viewBox: '0 0 1 1',
      fill: theme.accent,
      fixedRatio: false,
      rotate: 0,
    } as PPTElement);

    // Big number
    elements.push(
      textEl(`statN_${i}`, x, y + 30, cardW, 60, items[i].title || '0', theme, {
        fontSize: 36,
        color: theme.accent,
        bold: true,
        align: 'center',
      }),
    );

    // Description
    elements.push(
      textEl(`statD_${i}`, x + 12, y + 100, cardW - 24, 100, items[i].text || '', theme, {
        fontSize: 14,
        color: theme.bodyMutedColor,
        align: 'center',
      }),
    );
  }

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements,
  };
}

/** Highlight concept: large colored block + title + body */
export function contentHighlight(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const blockW = 280;
  const blockX = theme.pageMargin;
  const textX = blockX + blockW + 40;
  const textW = theme.contentMaxWidth - blockW - 40;

  const elements: Slide['elements'] = [
    // Left accent block
    {
      id: elId('hl_block'),
      type: 'shape',
      left: blockX,
      top: 80,
      width: blockW,
      height: 420,
      path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
      viewBox: '0 0 1 1',
      fill: theme.accent,
      fixedRatio: false,
      rotate: 0,
    } as PPTElement,
    // Inner lighter block
    {
      id: elId('hl_inner'),
      type: 'shape',
      left: blockX + 20,
      top: 100,
      width: blockW - 40,
      height: 380,
      path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
      viewBox: '0 0 1 1',
      fill: theme.accentLight,
      fixedRatio: false,
      rotate: 0,
    } as PPTElement,
    // Large concept word on block
    textEl('hl_concept', blockX, 200, blockW, 120, params.subtitle || '核心概念', theme, {
      fontSize: 28,
      color: theme.coverTitleColor,
      bold: true,
      align: 'center',
    }),
    // Right title
    textEl('hl_title', textX, 80, textW, 60, params.title || '', theme, {
      fontSize: theme.titleFontSize,
      color: theme.bodyColor,
      bold: true,
    }),
    // Right body
    textEl('hl_body', textX, 160, textW, 300, params.bodyText || '', theme, {
      fontSize: theme.bodyFontSize,
      color: theme.bodyMutedColor,
    }),
  ];

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements,
  };
}

/** Diagram layout: center concept with surrounding key points */
export function contentDiagram(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const keys = params.keyPoints || ['要点一', '要点二', '要点三'];
  const n = Math.min(keys.length, 5);
  const centerX = CANVAS_W / 2;
  const centerY = 260;

  const elements: Slide['elements'] = [
    textEl('title', theme.pageMargin, 40, theme.contentMaxWidth, 60, params.title || '', theme, {
      fontSize: theme.titleFontSize,
      color: theme.bodyColor,
      bold: true,
      align: 'center',
    }),
    // Center circle
    {
      id: elId('dia_center'),
      type: 'shape',
      left: centerX - 70,
      top: centerY - 70,
      width: 140,
      height: 140,
      path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
      viewBox: '0 0 100 100',
      fill: theme.accent,
      fixedRatio: false,
      rotate: 0,
    } as PPTElement,
    // Center text
    textEl('dia_ctext', centerX - 70, centerY - 25, 140, 50, params.subtitle || '核心', theme, {
      fontSize: 18,
      color: '#ffffff',
      bold: true,
      align: 'center',
    }),
  ];

  // Surrounding points
  const angles = [-90, -30, 30, 90, 150].slice(0, n);
  const radius = 180;
  for (let i = 0; i < n; i++) {
    const rad = (angles[i] * Math.PI) / 180;
    const px = centerX + radius * Math.cos(rad) - 80;
    const py = centerY + radius * Math.sin(rad) - 20;

    // Connector line
    const lineStartX = centerX + 70 * Math.cos(rad);
    const lineStartY = centerY + 70 * Math.sin(rad);
    const lineEndX = px + 80;
    const lineEndY = py + 20;
    elements.push({
      id: elId('dia_line'),
      type: 'line',
      left: Math.min(lineStartX, lineEndX),
      top: Math.min(lineStartY, lineEndY),
      width: Math.abs(lineEndX - lineStartX),
      height: Math.abs(lineEndY - lineStartY),
      start: [0, lineStartY <= lineEndY ? 0 : Math.abs(lineEndY - lineStartY)],
      end: [Math.abs(lineEndX - lineStartX), lineStartY <= lineEndY ? Math.abs(lineEndY - lineStartY) : 0],
      color: theme.dividerColor,
      rotate: 0,
    } as unknown as PPTElement);

    // Point card bg
    elements.push({
      id: elId('dia_card'),
      type: 'shape',
      left: px,
      top: py,
      width: 160,
      height: 40,
      path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
      viewBox: '0 0 1 1',
      fill: theme.accentLight,
      fixedRatio: false,
      rotate: 0,
      outline: { color: theme.dividerColor, width: 1, style: 'solid' },
    } as PPTElement);

    elements.push(
      textEl(`dia_p${i}`, px, py, 160, 40, keys[i] || '', theme, {
        fontSize: 13,
        color: theme.bodyColor,
        align: 'center',
      }),
    );
  }

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements,
  };
}

/** Infographic: three horizontal icon cards */
export function contentInfographic3(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const items = params.gridItems || [{ title: 'A', text: '描述' }, { title: 'B', text: '描述' }, { title: 'C', text: '描述' }];
  const n = Math.min(items.length, 3);
  const gap = 30;
  const cardW = (theme.contentMaxWidth - (n - 1) * gap) / n;
  const startX = theme.pageMargin;

  const elements: Slide['elements'] = [
    textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
      fontSize: theme.titleFontSize,
      color: theme.bodyColor,
      bold: true,
      align: 'center',
    }),
    generateDivider(theme, 115, { left: theme.pageMargin + theme.contentMaxWidth / 2 - 40, width: 80 }),
  ];

  for (let i = 0; i < n; i++) {
    const x = startX + i * (cardW + gap);
    const y = 160;

    // Circle icon background
    elements.push({
      id: elId('info_icon'),
      type: 'shape',
      left: x + cardW / 2 - 30,
      top: y,
      width: 60,
      height: 60,
      path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
      viewBox: '0 0 100 100',
      fill: theme.accent,
      fixedRatio: false,
      rotate: 0,
    } as PPTElement);

    // Icon number
    elements.push(
      textEl(`info_num_${i}`, x + cardW / 2 - 30, y + 8, 60, 44, String(i + 1), theme, {
        fontSize: 28,
        color: '#ffffff',
        bold: true,
        align: 'center',
      }),
    );

    // Title
    elements.push(
      textEl(`info_t_${i}`, x, y + 80, cardW, 40, items[i].title || '', theme, {
        fontSize: 18,
        color: theme.bodyColor,
        bold: true,
        align: 'center',
      }),
    );

    // Description
    elements.push(
      textEl(`info_d_${i}`, x + 8, y + 125, cardW - 16, 100, items[i].text || '', theme, {
        fontSize: 14,
        color: theme.bodyMutedColor,
        align: 'center',
      }),
    );
  }

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements,
  };
}

/** Horizontal process flow: 4 steps connected by arrows */
export function contentProcessH(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const steps = params.steps || [{ title: 'Step 1', text: '描述' }];
  const n = Math.min(steps.length, 4);
  const gap = 20;
  const cardW = Math.min(200, (theme.contentMaxWidth - (n - 1) * gap) / n);
  const startX = theme.pageMargin + (theme.contentMaxWidth - (cardW * n + (n - 1) * gap)) / 2;

  const elements: Slide['elements'] = [
    textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
      fontSize: theme.titleFontSize,
      color: theme.bodyColor,
      bold: true,
      align: 'center',
    }),
    generateDivider(theme, 115, { left: theme.pageMargin + theme.contentMaxWidth / 2 - 40, width: 80 }),
  ];

  for (let i = 0; i < n; i++) {
    const x = startX + i * (cardW + gap);
    const y = 160;

    // Card background
    elements.push({
      id: elId('proc_card'),
      type: 'shape',
      left: x,
      top: y,
      width: cardW,
      height: 200,
      path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
      viewBox: '0 0 1 1',
      fill: theme.accentLight,
      fixedRatio: false,
      rotate: 0,
      outline: { color: theme.dividerColor, width: 1, style: 'solid' },
    } as PPTElement);

    // Step number badge
    elements.push({
      id: elId('proc_badge'),
      type: 'shape',
      left: x + cardW / 2 - 18,
      top: y + 16,
      width: 36,
      height: 36,
      path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
      viewBox: '0 0 100 100',
      fill: theme.accent,
      fixedRatio: false,
      rotate: 0,
    } as PPTElement);

    elements.push(
      textEl(`proc_num_${i}`, x + cardW / 2 - 18, y + 20, 36, 28, String(i + 1), theme, {
        fontSize: 18,
        color: '#ffffff',
        bold: true,
        align: 'center',
      }),
    );

    // Step title
    elements.push(
      textEl(`proc_t_${i}`, x, y + 65, cardW, 40, steps[i].title || '', theme, {
        fontSize: 16,
        color: theme.bodyColor,
        bold: true,
        align: 'center',
      }),
    );

    // Step description
    elements.push(
      textEl(`proc_d_${i}`, x + 8, y + 110, cardW - 16, 80, steps[i].text || '', theme, {
        fontSize: 13,
        color: theme.bodyMutedColor,
        align: 'center',
      }),
    );

    // Arrow between cards (except last)
    if (i < n - 1) {
      const arrowX = x + cardW + gap / 2 - 10;
      elements.push(
        textEl(`proc_arrow_${i}`, arrowX, y + 90, 20, 20, '→', theme, {
          fontSize: 20,
          color: theme.accent,
          bold: true,
          align: 'center',
        }),
      );
    }
  }

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements,
  };
}

/** Pyramid: 3-layer hierarchy */
export function contentPyramid(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const levels = params.keyPoints || ['顶层', '中层', '底层'];
  const n = Math.min(levels.length, 3);
  const maxW = theme.contentMaxWidth - 100;
  const centerX = theme.pageMargin + theme.contentMaxWidth / 2;

  const elements: Slide['elements'] = [
    textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
      fontSize: theme.titleFontSize,
      color: theme.bodyColor,
      bold: true,
      align: 'center',
    }),
    generateDivider(theme, 115, { left: theme.pageMargin + theme.contentMaxWidth / 2 - 40, width: 80 }),
  ];

  for (let i = 0; i < n; i++) {
    const levelW = maxW * (1 - i * 0.25);
    const levelH = 80;
    const y = 160 + i * 100;
    const x = centerX - levelW / 2;

    // Trapezoid shape (simulated with rect + border trick via outline)
    elements.push({
      id: elId('pyr_shape'),
      type: 'shape',
      left: x,
      top: y,
      width: levelW,
      height: levelH,
      path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
      viewBox: '0 0 1 1',
      fill: i === 0 ? theme.accent : i === 1 ? theme.accentSecondary : theme.accentLight,
      fixedRatio: false,
      rotate: 0,
      opacity: 0.85,
    } as PPTElement);

    // Level text
    elements.push(
      textEl(`pyr_txt_${i}`, x, y + 20, levelW, 40, levels[i] || '', theme, {
        fontSize: 16,
        color: i === 0 ? '#ffffff' : theme.bodyColor,
        bold: true,
        align: 'center',
      }),
    );
  }

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements,
  };
}

/** Venn diagram: two overlapping circles with labels */
export function contentVenn(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const leftLabel = params.leftText || 'A';
  const rightLabel = params.rightText || 'B';

  const elements: Slide['elements'] = [
    textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
      fontSize: theme.titleFontSize,
      color: theme.bodyColor,
      bold: true,
      align: 'center',
    }),
    generateDivider(theme, 115, { left: theme.pageMargin + theme.contentMaxWidth / 2 - 40, width: 80 }),
    // Left circle
    {
      id: elId('venn_left'),
      type: 'shape',
      left: 260,
      top: 180,
      width: 200,
      height: 200,
      path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
      viewBox: '0 0 100 100',
      fill: theme.accent,
      fixedRatio: false,
      rotate: 0,
      opacity: 0.3,
    } as PPTElement,
    // Right circle
    {
      id: elId('venn_right'),
      type: 'shape',
      left: 380,
      top: 180,
      width: 200,
      height: 200,
      path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
      viewBox: '0 0 100 100',
      fill: theme.accentSecondary,
      fixedRatio: false,
      rotate: 0,
      opacity: 0.3,
    } as PPTElement,
    // Left label
    textEl('venn_lbl', 260, 160, 200, 30, leftLabel, theme, {
      fontSize: 18,
      color: theme.bodyColor,
      bold: true,
      align: 'center',
    }),
    // Right label
    textEl('venn_lbr', 380, 160, 200, 30, rightLabel, theme, {
      fontSize: 18,
      color: theme.bodyColor,
      bold: true,
      align: 'center',
    }),
    // Intersection label
    textEl('venn_int', 370, 260, 100, 40, params.subtitle || '交集', theme, {
      fontSize: 14,
      color: theme.accent,
      bold: true,
      align: 'center',
    }),
  ];

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements,
  };
}

/** Split highlight: large left block + right title/body */
export function contentSplitHighlight(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const blockW = 360;
  const blockX = theme.pageMargin;
  const textX = blockX + blockW + 40;
  const textW = theme.contentMaxWidth - blockW - 40;

  const elements: Slide['elements'] = [
    // Large left accent block with gradient feel
    {
      id: elId('sh_block'),
      type: 'shape',
      left: blockX,
      top: 60,
      width: blockW,
      height: 460,
      path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
      viewBox: '0 0 1 1',
      fill: theme.accent,
      fixedRatio: false,
      rotate: 0,
    } as PPTElement,
    // Inner light block for text
    {
      id: elId('sh_inner'),
      type: 'shape',
      left: blockX + 30,
      top: 100,
      width: blockW - 60,
      height: 380,
      path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
      viewBox: '0 0 1 1',
      fill: theme.accentLight,
      fixedRatio: false,
      rotate: 0,
      opacity: 0.5,
    } as PPTElement,
    // Big concept word
    textEl('sh_concept', blockX, 220, blockW, 120, params.subtitle || '核心', theme, {
      fontSize: 32,
      color: theme.coverTitleColor,
      bold: true,
      align: 'center',
    }),
    // Right title
    textEl('sh_title', textX, 80, textW, 60, params.title || '', theme, {
      fontSize: theme.titleFontSize,
      color: theme.bodyColor,
      bold: true,
    }),
    // Right body
    textEl('sh_body', textX, 160, textW, 300, params.bodyText || '', theme, {
      fontSize: theme.bodyFontSize,
      color: theme.bodyMutedColor,
    }),
  ];

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements,
  };
}

/** Bar chart: title + native bar chart */
export function contentBarChart(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const labels = params.tableHeaders || ['A', 'B', 'C'];
  const values = (params.tableRows || [[10, 20, 30]])[0] || [10, 20, 30];

  const chartEl = {
    id: elId('chart'),
    type: 'chart' as const,
    left: theme.pageMargin,
    top: 130,
    width: theme.contentMaxWidth,
    height: 360,
    rotate: 0,
    chartType: 'bar' as const,
    data: {
      labels,
      legends: [params.subtitle || '数据'],
      series: [values],
    },
    themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.coverSubColor, theme.bodyMutedColor],
    textColor: theme.bodyColor,
    lineColor: theme.dividerColor,
  };

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements: [
      textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
        fontSize: theme.titleFontSize,
        color: theme.bodyColor,
        bold: true,
      }),
      generateDivider(theme, 115, { left: theme.pageMargin, width: 60 }),
      chartEl as unknown as PPTElement,
    ],
  };
}

/** Pie chart: title + native pie chart */
export function contentPieChart(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const labels = params.tableHeaders || ['A', 'B', 'C'];
  const values = (params.tableRows || [[30, 40, 30]])[0] || [30, 40, 30];

  const chartEl = {
    id: elId('chart'),
    type: 'chart' as const,
    left: theme.pageMargin,
    top: 130,
    width: theme.contentMaxWidth,
    height: 360,
    rotate: 0,
    chartType: 'pie' as const,
    data: {
      labels,
      legends: [params.subtitle || '占比'],
      series: [values],
    },
    themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.coverSubColor, theme.bodyMutedColor],
    textColor: theme.bodyColor,
  };

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements: [
      textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
        fontSize: theme.titleFontSize,
        color: theme.bodyColor,
        bold: true,
      }),
      generateDivider(theme, 115, { left: theme.pageMargin, width: 60 }),
      chartEl as unknown as PPTElement,
    ],
  };
}

/** Line chart: title + native line chart */
export function contentLineChart(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const labels = params.tableHeaders || ['1月', '2月', '3月', '4月', '5月'];
  const values = (params.tableRows || [[10, 25, 18, 35, 28]])[0] || [10, 25, 18, 35, 28];

  const chartEl = {
    id: elId('chart'),
    type: 'chart' as const,
    left: theme.pageMargin,
    top: 130,
    width: theme.contentMaxWidth,
    height: 360,
    rotate: 0,
    chartType: 'line' as const,
    data: {
      labels,
      legends: [params.subtitle || '趋势'],
      series: [values],
    },
    options: { lineSmooth: true },
    themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.coverSubColor, theme.bodyMutedColor],
    textColor: theme.bodyColor,
    lineColor: theme.dividerColor,
  };

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements: [
      textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
        fontSize: theme.titleFontSize,
        color: theme.bodyColor,
        bold: true,
      }),
      generateDivider(theme, 115, { left: theme.pageMargin, width: 60 }),
      chartEl as unknown as PPTElement,
    ],
  };
}

/** Gradient cards: title + cards with gradient accent tops */
export function contentGradientCards(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const items = params.gridItems || [];
  const cardW = (theme.contentMaxWidth - 40) / 2;
  const cardH = 170;
  const cols = 2;
  const startY = 160;

  const cards: PPTElement[] = [];
  items.slice(0, 4).forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = theme.pageMargin + col * (cardW + 20);
    const y = startY + row * (cardH + 20);

    // Gradient top bar
    cards.push({
      id: elId('gc_bar'),
      type: 'shape',
      left: x,
      top: y,
      width: cardW,
      height: 6,
      path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
      viewBox: '0 0 1 1',
      fill: i % 2 === 0 ? theme.accent : theme.accentSecondary,
      fixedRatio: false,
      rotate: 0,
    } as PPTElement);

    // Card background
    cards.push({
      id: elId('gc_bg'),
      type: 'shape',
      left: x,
      top: y + 6,
      width: cardW,
      height: cardH - 6,
      path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
      viewBox: '0 0 1 1',
      fill: theme.accentLight,
      fixedRatio: false,
      rotate: 0,
      opacity: 0.4,
    } as PPTElement);

    // Card title
    cards.push(textEl(`gc_t_${i}`, x + 20, y + 24, cardW - 40, 40, item.title || '', theme, {
      fontSize: theme.bodyFontSize + 2,
      color: theme.bodyColor,
      bold: true,
    }));

    // Card description
    cards.push(textEl(`gc_d_${i}`, x + 20, y + 70, cardW - 40, 80, item.text || '', theme, {
      fontSize: theme.bodyFontSize,
      color: theme.bodyMutedColor,
    }));
  });

  const isMacaron = theme.id === 'macaron-pink';

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: isMacaron
      ? { type: 'image', image: { src: '/templates/backgrounds/macaron_content_1.jpg', size: 'cover' } }
      : { type: 'solid', color: theme.contentBg },
    elements: [
      textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
        fontSize: theme.titleFontSize,
        color: theme.bodyColor,
        bold: true,
      }),
      generateDivider(theme, 115, { left: theme.pageMargin, width: 60 }),
      ...cards,
    ],
  };
}

/** Macaron bullets: title + bullets with gradient circle markers */
export function contentMacaronBullets(params: TemplateParamsV2, theme: ThemeToken): Slide {
  const bullets = params.bullets || [];
  const bulletEls = generateBulletElements(bullets, theme, 160, {
    maxWidth: theme.contentMaxWidth - 40,
    leftMargin: theme.pageMargin + 40,
    lineHeight: 70,
  });

  // Add gradient circle decorations behind bullets
  const decorations: PPTElement[] = [
    {
      id: elId('mb_deco1'),
      type: 'shape',
      left: theme.pageMargin + theme.contentMaxWidth - 120,
      top: 80,
      width: 100,
      height: 100,
      path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
      viewBox: '0 0 100 100',
      fill: theme.accentSecondary,
      fixedRatio: false,
      rotate: 0,
      opacity: 0.15,
    } as PPTElement,
    {
      id: elId('mb_deco2'),
      type: 'shape',
      left: theme.pageMargin + theme.contentMaxWidth - 60,
      top: 400,
      width: 80,
      height: 80,
      path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
      viewBox: '0 0 100 100',
      fill: theme.accent,
      fixedRatio: false,
      rotate: 0,
      opacity: 0.1,
    } as PPTElement,
  ];

  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'image', image: { src: '/templates/backgrounds/macaron_content_2.jpg', size: 'cover' } },
    elements: [
      textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, params.title || '', theme, {
        fontSize: theme.titleFontSize,
        color: theme.bodyColor,
        bold: true,
      }),
      generateDivider(theme, 115, { left: theme.pageMargin, width: 60 }),
      ...bulletEls,
      ...decorations,
    ],
  };
}

// ── Registry ───────────────────────────────────────────────────────

export const TEMPLATE_REGISTRY_V2: Record<
  TemplateIdV2,
  {
    fn: (params: TemplateParamsV2, theme: ThemeToken) => Slide;
    descriptor: TemplateDescriptorV2;
  }
> = {
  'cover-classic': {
    fn: coverClassic,
    descriptor: {
      id: 'cover-classic',
      name: '经典学术',
      description: '居中标题+副标题，带主题装饰',
      category: 'cover',
      requiredParams: ['title', 'subtitle'],
      visualHint:
        '经典封面：标题居中，副标题在下方，背景带主题色渐变和装饰几何形状。适合正式学术课件。',
    },
  },
  'cover-modern': {
    fn: coverModern,
    descriptor: {
      id: 'cover-modern',
      name: '现代简约',
      description: '左对齐大字+顶部色条+装饰圆',
      category: 'cover',
      requiredParams: ['title', 'subtitle'],
      visualHint:
        '现代封面：标题左对齐大号字体，顶部有强调色细条，右上角有半透明装饰圆。适合现代教学风格。',
    },
  },
  'cover-bold': {
    fn: coverBold,
    descriptor: {
      id: 'cover-bold',
      name: '醒目大字',
      description: '深色背景+超大居中标题',
      category: 'cover',
      requiredParams: ['title', 'subtitle'],
      visualHint:
        '醒目封面：深色背景上白色大号居中标题，底部有装饰条。适合需要冲击力的开场。',
    },
  },
  'cover-full-image': {
    fn: coverFullImage,
    descriptor: {
      id: 'cover-full-image',
      name: '全图封面',
      description: '全屏背景图+文字遮罩',
      category: 'cover',
      requiredParams: ['title', 'subtitle'],
      visualHint:
        '全图封面：背景铺满图片，上方叠加半透明暗色遮罩，白色文字居中。需要配图时使用。',
    },
  },
  'cover-gradient': {
    fn: coverGradient,
    descriptor: {
      id: 'cover-gradient',
      name: '渐变封面',
      description: '渐变背景+左对齐标题+装饰线',
      category: 'cover',
      requiredParams: ['title', 'subtitle'],
      visualHint:
        '渐变封面：主题色渐变背景，标题左对齐，标题下方有短强调线装饰，右侧有装饰圆。',
    },
  },
  'content-title-body': {
    fn: contentTitleBody,
    descriptor: {
      id: 'content-title-body',
      name: '标题+正文',
      description: '单栏标题+正文段落，带分隔线',
      category: 'content',
      requiredParams: ['title', 'bodyText'],
      visualHint:
        '标准内容页：顶部标题，标题下方有短强调色分隔线，下方是正文段落。留白充足。',
    },
  },
  'content-two-col': {
    fn: contentTwoCol,
    descriptor: {
      id: 'content-two-col',
      name: '双栏对比',
      description: '标题+左右双栏内容+中间分隔线',
      category: 'content',
      requiredParams: ['title', 'leftText', 'rightText'],
      visualHint:
        '双栏对比：顶部标题，中间用细竖线分为左右两栏，适合对比、并列展示两种观点。',
    },
  },
  'content-bullets': {
    fn: contentBullets,
    descriptor: {
      id: 'content-bullets',
      name: '要点列表',
      description: '标题+带主题色图标的要点列表',
      category: 'content',
      requiredParams: ['title', 'bullets'],
      visualHint:
        '要点列表：顶部标题，下方是带主题色 bullet 圆点的列表项，每项有充足行高。',
    },
  },
  'content-formula': {
    fn: contentFormula,
    descriptor: {
      id: 'content-formula',
      name: '公式推导',
      description: '标题+LaTeX公式+注释',
      category: 'content',
      requiredParams: ['title', 'formula'],
      visualHint:
        '公式页：顶部标题，中间居中大号 LaTeX 公式，下方灰色小字注释。适合数学物理课件。',
    },
  },
  'content-steps': {
    fn: contentSteps,
    descriptor: {
      id: 'content-steps',
      name: '步骤流程',
      description: '标题+横向步骤卡片+编号徽章',
      category: 'content',
      requiredParams: ['title', 'steps'],
      visualHint:
        '步骤流程：顶部居中标题，下方横向排列 3-4 个步骤卡片，每个卡片上方有圆形编号徽章。',
    },
  },
  'content-quote': {
    fn: contentQuote,
    descriptor: {
      id: 'content-quote',
      name: '引用金句',
      description: '大字引用+出处，浅色背景',
      category: 'content',
      requiredParams: ['quote'],
      visualHint:
        '引用页：浅色背景，大号斜体引用文字居中，左上方有大号半透明引号装饰，下方是出处。',
    },
  },
  'content-grid2x2': {
    fn: contentGrid2x2,
    descriptor: {
      id: 'content-grid2x2',
      name: '四格卡片',
      description: '标题+2×2网格卡片+背景色',
      category: 'content',
      requiredParams: ['title', 'gridItems'],
      visualHint:
        '四格卡片：顶部标题，下方 2×2 网格排列卡片，每张卡片有浅色背景和细边框，内含标题和描述。',
    },
  },
  'content-image': {
    fn: contentImage,
    descriptor: {
      id: 'content-image',
      name: '图文混排',
      description: '标题+左图右文或右图左文',
      category: 'content',
      requiredParams: ['title', 'bodyText'],
      visualHint:
        '图文混排：顶部标题，左侧图片右侧文字（或反之），图片有圆角和阴影。适合配图讲解。',
    },
  },
  'content-table': {
    fn: contentTable,
    descriptor: {
      id: 'content-table',
      name: '数据表格',
      description: '标题+对比表格+表头高亮',
      category: 'content',
      requiredParams: ['title', 'tableHeaders', 'tableRows'],
      visualHint:
        '表格页：顶部标题，下方是带表头高亮的对比表格，表头使用主题色浅色背景，数据行交替白色。',
    },
  },
  'content-full-image': {
    fn: contentFullImage,
    descriptor: {
      id: 'content-full-image',
      name: '大图叙事',
      description: '全屏背景图+底部文字遮罩',
      category: 'content',
      requiredParams: ['title', 'bodyText'],
      visualHint:
        '大图叙事：全屏背景图片，底部叠加渐变遮罩，遮罩上方是标题和正文。适合视觉冲击力强的内容。',
    },
  },
  'content-timeline': {
    fn: contentTimeline,
    descriptor: {
      id: 'content-timeline',
      name: '时间轴',
      description: '标题+竖向时间轴+节点圆点',
      category: 'content',
      requiredParams: ['title', 'timelineItems'],
      visualHint:
        '时间轴：顶部标题，左侧竖线时间轴，每个节点有主题色圆点和日期标签，右侧是事件描述。',
    },
  },
  'content-pros-cons': {
    fn: contentProsCons,
    descriptor: {
      id: 'content-pros-cons',
      name: '优缺点对比',
      description: '标题+左右分栏（绿色优点/红色缺点）',
      category: 'content',
      requiredParams: ['title', 'pros', 'cons'],
      visualHint:
        '优缺点：顶部标题，中间竖线分为左右两栏，左侧绿色标题+绿色 bullet 列优点，右侧红色标题+红色 bullet 列缺点。',
    },
  },
  'content-code': {
    fn: contentCode,
    descriptor: {
      id: 'content-code',
      name: '代码展示',
      description: '标题+代码块+语法高亮背景',
      category: 'content',
      requiredParams: ['title', 'code'],
      visualHint:
        '代码页：顶部标题，下方是带浅色背景的代码块，左上角有语言标签。适合编程教学。',
    },
  },
  'content-big-idea': {
    fn: contentBigIdea,
    descriptor: {
      id: 'content-big-idea',
      name: '大概念',
      description: '大号图标+标题+重点正文',
      category: 'content',
      requiredParams: ['title', 'bodyText'],
      visualHint:
        '大概念：左侧大号灯泡/想法图标，右侧是大标题和重点正文，强调核心概念。适合总结关键思想。',
    },
  },
  'content-stats': {
    fn: contentStats,
    descriptor: {
      id: 'content-stats',
      name: '数据卡片',
      description: '大数字+描述的数据展示卡片',
      category: 'content',
      requiredParams: ['title', 'gridItems'],
      visualHint:
        '数据卡片：顶部标题，下方横向排列 3-4 个大数字卡片，每个卡片顶部有主题色 accent 条，包含大号数字和描述文字。适合数据展示和统计。',
    },
  },
  'content-bar-chart': {
    fn: contentBarChart,
    descriptor: {
      id: 'content-bar-chart',
      name: '柱状图',
      description: '标题+原生柱状图（可编辑Excel图表）',
      category: 'content',
      requiredParams: ['title', 'tableHeaders', 'tableRows'],
      visualHint:
        '柱状图：顶部标题，下方是原生柱状图，使用主题色系。PowerPoint中双击可编辑数据。适合数据对比、排名展示。tableHeaders是X轴标签，tableRows第一行是各柱数值。',
    },
  },
  'content-pie-chart': {
    fn: contentPieChart,
    descriptor: {
      id: 'content-pie-chart',
      name: '饼图',
      description: '标题+原生饼图（可编辑Excel图表）',
      category: 'content',
      requiredParams: ['title', 'tableHeaders', 'tableRows'],
      visualHint:
        '饼图：顶部标题，下方是原生饼图，使用主题色系。PowerPoint中双击可编辑数据。适合占比分布、构成分析。tableHeaders是各扇区标签，tableRows第一行是各扇区数值。',
    },
  },
  'content-line-chart': {
    fn: contentLineChart,
    descriptor: {
      id: 'content-line-chart',
      name: '折线图',
      description: '标题+原生折线图（可编辑Excel图表）',
      category: 'content',
      requiredParams: ['title', 'tableHeaders', 'tableRows'],
      visualHint:
        '折线图：顶部标题，下方是原生平滑折线图，使用主题色系。PowerPoint中双击可编辑数据。适合趋势变化、时间序列。tableHeaders是X轴标签，tableRows第一行是各点数值。',
    },
  },
  'content-gradient-cards': {
    fn: contentGradientCards,
    descriptor: {
      id: 'content-gradient-cards',
      name: '渐变卡片',
      description: '标题+2x2卡片网格，每张卡片顶部有主题色渐变条',
      category: 'content',
      requiredParams: ['title', 'gridItems'],
      visualHint:
        '渐变卡片：顶部标题，下方是2x2卡片网格布局。每张卡片顶部有主题色/次主题色交替的渐变色条，下方是浅色调卡片背景，包含标题和描述。适合展示多个并列要点、特性介绍。',
    },
  },
  'content-macaron-bullets': {
    fn: contentMacaronBullets,
    descriptor: {
      id: 'content-macaron-bullets',
      name: '马卡龙要点',
      description: '标题+带渐变圆形装饰的要点列表（适合macaron-pink主题）',
      category: 'content',
      requiredParams: ['title', 'bullets'],
      visualHint:
        '马卡龙要点：顶部标题，下方是带主题色圆点标记的要点列表，右侧有半透明的渐变圆形装饰元素（大圆+小圆）。视觉效果柔和甜美，特别适合马卡龙粉紫主题。',
    },
  },
  'content-highlight': {
    fn: contentHighlight,
    descriptor: {
      id: 'content-highlight',
      name: '高亮概念',
      description: '左侧色块+右侧标题正文',
      category: 'content',
      requiredParams: ['title', 'bodyText'],
      visualHint:
        '高亮概念：左侧大面积主题色块，中间写核心概念词，右侧是标题和详细正文。适合强调一个关键知识点。',
    },
  },
  'content-diagram': {
    fn: contentDiagram,
    descriptor: {
      id: 'content-diagram',
      name: '关系图',
      description: '中心概念+周围要点连线',
      category: 'content',
      requiredParams: ['title', 'keyPoints'],
      visualHint:
        '关系图：页面中央有大圆形核心概念，周围环绕 3-5 个要点卡片，用线条连接到中心。适合展示概念之间的关系。',
    },
  },
  'content-infographic-3': {
    fn: contentInfographic3,
    descriptor: {
      id: 'content-infographic-3',
      name: '三要素图',
      description: '标题+3个圆形图标卡片横向排列',
      category: 'content',
      requiredParams: ['title', 'gridItems'],
      visualHint:
        '三要素图：顶部标题，下方横向排列3个圆形图标卡片，每个卡片有主题色圆形背景+数字+标题+描述。适合展示三要素、三步骤、三特点。',
    },
  },
  'content-process-h': {
    fn: contentProcessH,
    descriptor: {
      id: 'content-process-h',
      name: '横向流程',
      description: '标题+横向步骤卡片+箭头连接',
      category: 'content',
      requiredParams: ['title', 'steps'],
      visualHint:
        '横向流程：顶部标题，下方横向排列3-4个步骤卡片，卡片间用箭头连接，每个卡片有圆形编号徽章+标题+描述。适合展示流程、步骤、演化过程。',
    },
  },
  'content-pyramid': {
    fn: contentPyramid,
    descriptor: {
      id: 'content-pyramid',
      name: '金字塔',
      description: '标题+3层金字塔层级',
      category: 'content',
      requiredParams: ['title', 'keyPoints'],
      visualHint:
        '金字塔：顶部标题，下方3层递减宽度的色块层级，顶层最窄用主题色，中层用次要色，底层最宽用浅色。适合展示层级结构、优先级、重要性递减。',
    },
  },
  'content-venn': {
    fn: contentVenn,
    descriptor: {
      id: 'content-venn',
      name: '维恩图',
      description: '两个重叠圆形+交集标签',
      category: 'content',
      requiredParams: ['title', 'leftText', 'rightText'],
      visualHint:
        '维恩图：顶部标题，中央两个半透明重叠圆形，左侧圆形标注A，右侧标注B，交集区域标注共同点。适合展示对比、交集、共同特征。',
    },
  },
  'content-split-highlight': {
    fn: contentSplitHighlight,
    descriptor: {
      id: 'content-split-highlight',
      name: '分栏高亮',
      description: '左大色块+右标题正文',
      category: 'content',
      requiredParams: ['title', 'bodyText'],
      visualHint:
        '分栏高亮：左侧大面积主题色块写核心词，右侧标题+详细正文。适合强调一个关键知识点。',
    },
  },
  // ── Teaching-specific templates ──
  'content-toc': {
    fn: contentToc,
    descriptor: {
      id: 'content-toc',
      name: '目录页',
      description: '章节列表+序号圆圈+右侧装饰',
      category: 'content',
      requiredParams: ['title', 'sections'],
      visualHint:
        '目录页：顶部标题，左侧是带主题色圆形序号的章节列表（最多6项），右侧有半透明装饰块。适合课件开场展示知识地图。',
    },
  },
  'content-objectives': {
    fn: contentObjectives,
    descriptor: {
      id: 'content-objectives',
      name: '学习目标',
      description: '带勾选图标的学习目标列表',
      category: 'content',
      requiredParams: ['title', 'objectives'],
      visualHint:
        '学习目标页：顶部标题，下方是带主题色圆形勾选图标的3-5个学习目标列表。让学生明确本节课要达到的目标。',
    },
  },
  'content-section': {
    fn: contentSection,
    descriptor: {
      id: 'content-section',
      name: '章节过渡',
      description: '超大章节号+标题+引言，浅色背景',
      category: 'content',
      requiredParams: ['sectionNumber', 'sectionTitle'],
      visualHint:
        '章节过渡页：超大半透明章节编号作为背景装饰，下方有主题色横条、章节标题和简短引言。背景使用主题浅色，视觉上有明显区分。适合引入新概念时给学生认知缓冲。',
    },
  },
  'content-quiz': {
    fn: contentQuiz,
    descriptor: {
      id: 'content-quiz',
      name: '课堂练习',
      description: '题目+选项(A/B/C/D)+答案解析',
      category: 'content',
      requiredParams: ['title', 'question', 'options'],
      visualHint:
        '课堂练习页：顶部标题，下方是题目文字，再下方是2列排列的选项（每个选项左侧有主题色圆形字母标签），底部有答案和解析文字。适合课堂小测检验理解。',
    },
  },
  'end-summary': {
    fn: endSummary,
    descriptor: {
      id: 'end-summary',
      name: '要点总结',
      description: '带编号的关键要点列表',
      category: 'end',
      requiredParams: ['keyPoints'],
      visualHint:
        '总结页：居中标题，下方是带主题色编号的关键要点列表，背景使用主题浅色。',
    },
  },
  'end-thanks': {
    fn: endThanks,
    descriptor: {
      id: 'end-thanks',
      name: '致谢',
      description: '大字致谢+副标题+装饰',
      category: 'end',
      requiredParams: [],
      visualHint: '致谢页：大号"谢谢"居中，下方副标题，背景带主题色渐变和装饰形状。',
    },
  },
  'end-qa': {
    fn: endQA,
    descriptor: {
      id: 'end-qa',
      name: '问答环节',
      description: 'Q&A大字+提示文字+装饰线',
      category: 'end',
      requiredParams: [],
      visualHint:
        '问答页：大号"Q & A"居中，主题色，下方灰色提示文字，中间有主题色横线装饰。',
    },
  },
};

// ── Helpers ────────────────────────────────────────────────────────

export function getTemplateV2(id: TemplateIdV2) {
  return TEMPLATE_REGISTRY_V2[id]?.fn;
}

export function getTemplateDescriptorV2(id: TemplateIdV2): TemplateDescriptorV2 | undefined {
  return TEMPLATE_REGISTRY_V2[id]?.descriptor;
}

export function getTemplatesByCategoryV2(category: 'cover' | 'content' | 'end'): TemplateDescriptorV2[] {
  return Object.values(TEMPLATE_REGISTRY_V2)
    .filter((t) => t.descriptor.category === category)
    .map((t) => t.descriptor);
}

export function getAllTemplateDescriptorsV2(): TemplateDescriptorV2[] {
  return Object.values(TEMPLATE_REGISTRY_V2).map((t) => t.descriptor);
}

// ── Assembler ──────────────────────────────────────────────────────

function isParamEmpty(v: unknown): boolean {
  return v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

function hasRequiredParams(params: TemplateParamsV2, required: (keyof TemplateParamsV2)[]): boolean {
  return required.every((key) => !isParamEmpty(params[key]));
}

/** Fallback content slide when AI returns empty params */
function fallbackContentSlide(theme: ThemeToken): Slide {
  return {
    id: nanoid(),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content',
    theme: {
      backgroundColor: theme.contentBg,
      themeColors: [theme.accent, theme.accentSecondary, theme.dividerColor, theme.bodyMutedColor, theme.coverSubColor],
      fontColor: theme.bodyColor,
      fontName: theme.fontFamily,
    },
    background: { type: 'solid', color: theme.contentBg },
    elements: [
      textEl('title', theme.pageMargin, 50, theme.contentMaxWidth, 60, '内容待补充', theme, {
        fontSize: theme.titleFontSize,
        color: theme.bodyColor,
        bold: true,
      }),
      generateDivider(theme, 115, { left: theme.pageMargin, width: 80 }),
      textEl('body', theme.pageMargin, 140, theme.contentMaxWidth, 320, '本页内容由 AI 自动生成，当前暂无具体内容。', theme, {
        fontSize: theme.bodyFontSize,
        color: theme.bodyMutedColor,
      }),
    ],
  };
}

export function assembleSlidesV2(slots: TemplateSlotV2[], theme: ThemeToken): Slide[] {
  const isMacaron = theme.id === 'macaron-pink';
  const macaronBgMap: Record<string, Slide['background']> = {
    cover: { type: 'image', image: { src: '/templates/backgrounds/macaron_cover_1.jpg', size: 'cover' } },
    content: { type: 'image', image: { src: '/templates/backgrounds/macaron_content_1.jpg', size: 'cover' } },
    end: { type: 'image', image: { src: '/templates/backgrounds/macaron_cover_2.jpg', size: 'cover' } },
  };

  return slots
    .map((slot, index) => {
      const tpl = TEMPLATE_REGISTRY_V2[slot.template];
      if (!tpl) {
        console.warn(`[assembleSlidesV2] Unknown template "${slot.template}" at slot ${index}, using fallback`);
        return fallbackContentSlide(theme);
      }
      const required = tpl.descriptor.requiredParams;
      if (required.length > 0 && !hasRequiredParams(slot.params, required)) {
        const missing = required.filter((k) => isParamEmpty(slot.params[k]));
        console.warn(`[assembleSlidesV2] Slot ${index} template "${slot.template}" missing params: ${missing.join(', ')}, using fallback`);
        return fallbackContentSlide(theme);
      }
      const slide = tpl.fn(slot.params, theme);
      // Apply macaron background images to all slides when using macaron-pink theme
      if (isMacaron && slide.type && macaronBgMap[slide.type]) {
        slide.background = macaronBgMap[slide.type];
      }
      return slide;
    })
    .filter(Boolean) as Slide[];
}
