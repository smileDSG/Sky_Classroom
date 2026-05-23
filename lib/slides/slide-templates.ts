/**
 * Slide Layout Templates (B-008)
 *
 * Pre-built slide templates with fixed positions, sizes, and styles.
 * AI fills only text content — templates control layout.
 */
import { nanoid } from 'nanoid';
import type { Slide } from '@/lib/types/slides';

// ── Types ──────────────────────────────────────────────────────────────────

export type CoverTemplateId = 'cover-classic' | 'cover-modern' | 'cover-bold';
export type ContentTemplateId =
  | 'content-title-body'
  | 'content-two-col'
  | 'content-bullets'
  | 'content-formula'
  | 'content-steps'
  | 'content-quote'
  | 'content-grid2x2'
  | 'content-image'
  | 'content-table';
export type EndTemplateId = 'end-summary' | 'end-thanks' | 'end-qa';
export type TemplateId = CoverTemplateId | ContentTemplateId | EndTemplateId;

export interface TemplateParams {
  title?: string;
  subtitle?: string;
  bodyText?: string;
  leftText?: string;
  rightText?: string;
  bullets?: string[];
  formula?: string;
  formulaNote?: string;
  steps?: { title: string; text: string }[];
  quote?: string;
  quoteAuthor?: string;
  gridItems?: { title: string; text: string }[];
  tableHeaders?: string[];
  tableRows?: string[][];
  keyPoints?: string[];
}

export interface TemplateDescriptor {
  id: TemplateId;
  name: string;
  description: string;
  category: 'cover' | 'content' | 'end';
  requiredParams: (keyof TemplateParams)[];
}

export interface TemplateSlot {
  template: TemplateId;
  params: TemplateParams;
}

// ── Constants ──────────────────────────────────────────────────────────────

const CANVAS_W = 1000;
const CANVAS_H = 562.5;
const DEFAULT_THEME = {
  backgroundColor: '#ffffff',
  themeColors: ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4'],
  fontColor: '#333333',
  fontName: 'Microsoft YaHei',
};

function elId(prefix: string) { return `${prefix}_${nanoid(6)}`; }

// ── Cover Templates ────────────────────────────────────────────────────────

export function coverClassic(params: TemplateParams): Slide {
  return {
    id: nanoid(), viewportSize: CANVAS_W, viewportRatio: CANVAS_H / CANVAS_W,
    type: 'cover', theme: DEFAULT_THEME,
    background: { type: 'solid', color: '#ffffff' },
    elements: [
      { id: elId('title'), type: 'text', left: 100, top: 170, width: 800, height: 80,
        content: `<p style="font-size:40px;text-align:center;"><strong>${params.title || ''}</strong></p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#1a1a1a', rotate: 0 },
      { id: elId('subtitle'), type: 'text', left: 150, top: 275, width: 700, height: 50,
        content: `<p style="font-size:20px;text-align:center;color:#555;">${params.subtitle || ''}</p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#555555', rotate: 0 },
    ],
  };
}

export function coverModern(params: TemplateParams): Slide {
  return {
    id: nanoid(), viewportSize: CANVAS_W, viewportRatio: CANVAS_H / CANVAS_W,
    type: 'cover', theme: DEFAULT_THEME,
    background: { type: 'solid', color: '#f8fafc' },
    elements: [
      { id: elId('accent'), type: 'shape', left: 0, top: 0, width: 1000, height: 8,
        path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z', viewBox: '0 0 1 1', fill: '#5b9bd5', fixedRatio: false, rotate: 0 },
      { id: elId('title'), type: 'text', left: 60, top: 100, width: 600, height: 120,
        content: `<p style="font-size:44px;line-height:1.3;"><strong>${params.title || ''}</strong></p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#1a1a1a', rotate: 0 },
      { id: elId('subtitle'), type: 'text', left: 60, top: 240, width: 500, height: 50,
        content: `<p style="font-size:20px;color:#5b9bd5;">${params.subtitle || ''}</p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#5b9bd5', rotate: 0 },
    ],
  };
}

export function coverBold(params: TemplateParams): Slide {
  return {
    id: nanoid(), viewportSize: CANVAS_W, viewportRatio: CANVAS_H / CANVAS_W,
    type: 'cover', theme: DEFAULT_THEME,
    background: { type: 'solid', color: '#1e3a5f' },
    elements: [
      { id: elId('title'), type: 'text', left: 80, top: 160, width: 840, height: 140,
        content: `<p style="font-size:44px;text-align:center;color:#ffffff;line-height:1.4;"><strong>${params.title || ''}</strong></p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#ffffff', rotate: 0 },
      { id: elId('subtitle'), type: 'text', left: 150, top: 330, width: 700, height: 50,
        content: `<p style="font-size:18px;text-align:center;color:#aac4e0;">${params.subtitle || ''}</p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#aac4e0', rotate: 0 },
    ],
  };
}

// ── Content Templates ──────────────────────────────────────────────────────

export function contentTitleBody(params: TemplateParams): Slide {
  return {
    id: nanoid(), viewportSize: CANVAS_W, viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content', theme: DEFAULT_THEME, background: { type: 'solid', color: '#ffffff' },
    elements: [
      { id: elId('title'), type: 'text', left: 60, top: 50, width: 880, height: 55,
        content: `<p style="font-size:32px;"><strong>${params.title || ''}</strong></p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#1a1a1a', rotate: 0 },
      { id: elId('body'), type: 'text', left: 60, top: 140, width: 880, height: 360,
        content: `<p style="font-size:18px;line-height:1.8;">${params.bodyText || ''}</p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#333333', rotate: 0 },
    ],
  };
}

export function contentTwoCol(params: TemplateParams): Slide {
  return {
    id: nanoid(), viewportSize: CANVAS_W, viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content', theme: DEFAULT_THEME, background: { type: 'solid', color: '#ffffff' },
    elements: [
      { id: elId('title'), type: 'text', left: 60, top: 50, width: 880, height: 55,
        content: `<p style="font-size:32px;"><strong>${params.title || ''}</strong></p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#1a1a1a', rotate: 0 },
      { id: elId('left'), type: 'text', left: 60, top: 135, width: 410, height: 360,
        content: `<p style="font-size:18px;line-height:1.8;">${params.leftText || ''}</p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#333333', rotate: 0 },
      { id: elId('right'), type: 'text', left: 530, top: 135, width: 410, height: 360,
        content: `<p style="font-size:18px;line-height:1.8;">${params.rightText || ''}</p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#333333', rotate: 0 },
    ],
  };
}

export function contentBullets(params: TemplateParams): Slide {
  const items = params.bullets || [];
  const bulletElements = items.flatMap((item, i) => {
    const y = 130 + i * 65;
    return [
      { id: elId('dot'), type: 'shape' as const, left: 70, top: y + 8, width: 10, height: 10,
        path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z', viewBox: '0 0 1 1',
        fill: '#5b9bd5', fixedRatio: false, rotate: 0 },
      { id: elId('item'), type: 'text' as const, left: 100, top: y, width: 820, height: 50,
        content: `<p style="font-size:20px;">${item}</p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#333333', rotate: 0 },
    ];
  });

  return {
    id: nanoid(), viewportSize: CANVAS_W, viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content', theme: DEFAULT_THEME, background: { type: 'solid', color: '#ffffff' },
    elements: [
      { id: elId('title'), type: 'text', left: 60, top: 50, width: 880, height: 55,
        content: `<p style="font-size:32px;"><strong>${params.title || ''}</strong></p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#1a1a1a', rotate: 0 },
      ...bulletElements,
    ],
  };
}

export function contentFormula(params: TemplateParams): Slide {
  return {
    id: nanoid(), viewportSize: CANVAS_W, viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content', theme: DEFAULT_THEME, background: { type: 'solid', color: '#ffffff' },
    elements: [
      { id: elId('title'), type: 'text', left: 60, top: 50, width: 880, height: 55,
        content: `<p style="font-size:32px;"><strong>${params.title || ''}</strong></p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#1a1a1a', rotate: 0 },
      { id: elId('formula'), type: 'latex', left: 100, top: 155, width: 800, height: 100,
        latex: params.formula || '', color: '#1a1a1a', align: 'center', fixedRatio: true, rotate: 0 },
      { id: elId('note'), type: 'text', left: 100, top: 280, width: 800, height: 80,
        content: `<p style="font-size:16px;text-align:center;color:#666;">${params.formulaNote || ''}</p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#666666', rotate: 0 },
    ],
  } as Slide;
}

export function contentSteps(params: TemplateParams): Slide {
  const steps = params.steps || [];
  // Adapt step width to fit: max 5 steps, wider for fewer
  const n = Math.min(steps.length, 5);
  if (n === 0) return contentTitleBody(params); // fallback

  const totalGap = (n - 1) * 24;
  const STEP_W = Math.min(220, (CANVAS_W - 120 - totalGap) / n);
  const START_X = (CANVAS_W - (STEP_W * n + totalGap)) / 2;

  const stepElements = steps.slice(0, n).flatMap((step, i) => {
    const x = START_X + i * (STEP_W + 24);
    return [
      { id: elId('num'), type: 'shape' as const, left: x + 105, top: 140, width: 60, height: 60,
        path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z', viewBox: '0 0 1 1',
        fill: '#5b9bd5', fixedRatio: false, rotate: 0 },
      { id: elId('numTxt'), type: 'text' as const, left: x + 105, top: 145, width: 60, height: 50,
        content: `<p style="font-size:28px;text-align:center;color:#ffffff;line-height:60px;"><strong>${i + 1}</strong></p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#ffffff', rotate: 0 },
      { id: elId('stepT'), type: 'text' as const, left: x, top: 220, width: STEP_W, height: 40,
        content: `<p style="font-size:18px;text-align:center;"><strong>${step.title}</strong></p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#1a1a1a', rotate: 0 },
      { id: elId('stepD'), type: 'text' as const, left: x, top: 270, width: STEP_W, height: 120,
        content: `<p style="font-size:14px;text-align:center;color:#555;">${step.text}</p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#555555', rotate: 0 },
    ];
  });

  return {
    id: nanoid(), viewportSize: CANVAS_W, viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content', theme: DEFAULT_THEME, background: { type: 'solid', color: '#ffffff' },
    elements: [
      { id: elId('title'), type: 'text', left: 60, top: 50, width: 880, height: 55,
        content: `<p style="font-size:32px;text-align:center;"><strong>${params.title || ''}</strong></p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#1a1a1a', rotate: 0 },
      ...stepElements,
    ],
  };
}

export function contentQuote(params: TemplateParams): Slide {
  return {
    id: nanoid(), viewportSize: CANVAS_W, viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content', theme: DEFAULT_THEME, background: { type: 'solid', color: '#f8fafc' },
    elements: [
      { id: elId('quote'), type: 'text', left: 100, top: 120, width: 800, height: 200,
        content: `<p style="font-size:28px;line-height:1.6;text-align:center;color:#1e3a5f;font-style:italic;">"${params.quote || ''}"</p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#1e3a5f', rotate: 0 },
      { id: elId('author'), type: 'text', left: 100, top: 350, width: 800, height: 40,
        content: `<p style="font-size:18px;text-align:center;color:#888;">—— ${params.quoteAuthor || ''}</p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#888888', rotate: 0 },
    ],
  };
}

export function contentGrid2x2(params: TemplateParams): Slide {
  const items = params.gridItems || [];
  const CARD_W = 400, CARD_H = 140, GAP = 20;
  const START_X = (CANVAS_W - (CARD_W * 2 + GAP)) / 2;

  const cardElements = items.flatMap((item, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = START_X + col * (CARD_W + GAP), y = 130 + row * (CARD_H + GAP);
    return [
      { id: elId('card'), type: 'shape' as const, left: x, top: y, width: CARD_W, height: CARD_H,
        path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z', viewBox: '0 0 1 1',
        fill: '#f0f4f8', fixedRatio: false, rotate: 0 },
      { id: elId('ct'), type: 'text' as const, left: x + 20, top: y + 15, width: CARD_W - 40, height: 40,
        content: `<p style="font-size:18px;"><strong>${item.title}</strong></p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#1a1a1a', rotate: 0 },
      { id: elId('cd'), type: 'text' as const, left: x + 20, top: y + 60, width: CARD_W - 40, height: 60,
        content: `<p style="font-size:14px;color:#555;">${item.text}</p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#555555', rotate: 0 },
    ];
  });

  return {
    id: nanoid(), viewportSize: CANVAS_W, viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content', theme: DEFAULT_THEME, background: { type: 'solid', color: '#ffffff' },
    elements: [
      { id: elId('title'), type: 'text', left: 60, top: 50, width: 880, height: 55,
        content: `<p style="font-size:32px;text-align:center;"><strong>${params.title || ''}</strong></p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#1a1a1a', rotate: 0 },
      ...cardElements,
    ],
  };
}

export function contentImage(params: TemplateParams): Slide {
  return {
    id: nanoid(), viewportSize: CANVAS_W, viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content', theme: DEFAULT_THEME, background: { type: 'solid', color: '#ffffff' },
    elements: [
      { id: elId('title'), type: 'text', left: 60, top: 50, width: 880, height: 55,
        content: `<p style="font-size:32px;"><strong>${params.title || ''}</strong></p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#1a1a1a', rotate: 0 },
      { id: elId('img'), type: 'text', left: 60, top: 130, width: 460, height: 300,
        content: `<p style="font-size:14px;text-align:center;color:#aaa;line-height:300px;">[图片]</p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#aaaaaa', rotate: 0 },
      { id: elId('desc'), type: 'text', left: 550, top: 130, width: 390, height: 300,
        content: `<p style="font-size:18px;line-height:1.8;">${params.bodyText || ''}</p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#333333', rotate: 0 },
    ],
  };
}

export function contentTable(params: TemplateParams): Slide {
  const headers = params.tableHeaders || [];
  const rows = params.tableRows || [];
  const lines = [headers, ...rows];

  const ROW_H = 36, COL_W = 860 / Math.max(headers.length || 1, 1);
  const tableElements = lines.flatMap((row, ri) =>
    row.map((cell, ci) => ({
      id: elId('cell'), type: 'text' as const,
      left: 70 + ci * COL_W, top: 130 + ri * ROW_H, width: COL_W, height: ROW_H,
      content: `<p style="font-size:14px;text-align:center;line-height:${ROW_H}px;${ri === 0 ? 'font-weight:bold;' : ''}">${cell}</p>`,
      defaultFontName: 'Microsoft YaHei', defaultColor: ri === 0 ? '#1a1a1a' : '#333333', rotate: 0,
    })),
  );

  return {
    id: nanoid(), viewportSize: CANVAS_W, viewportRatio: CANVAS_H / CANVAS_W,
    type: 'content', theme: DEFAULT_THEME, background: { type: 'solid', color: '#ffffff' },
    elements: [
      { id: elId('title'), type: 'text', left: 60, top: 50, width: 880, height: 55,
        content: `<p style="font-size:32px;"><strong>${params.title || ''}</strong></p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#1a1a1a', rotate: 0 },
      ...tableElements,
    ],
  };
}

// ── End Templates ──────────────────────────────────────────────────────────

export function endSummary(params: TemplateParams): Slide {
  const points = params.keyPoints || [];
  const pointElements = points.flatMap((p, i) => {
    const y = 140 + i * 50;
    return [
      { id: elId('dot'), type: 'shape' as const, left: 100, top: y + 8, width: 30, height: 30,
        path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z', viewBox: '0 0 1 1',
        fill: '#5b9bd5', fixedRatio: false, rotate: 0 },
      { id: elId('num'), type: 'text' as const, left: 100, top: y + 8, width: 30, height: 30,
        content: `<p style="font-size:16px;text-align:center;color:#ffffff;line-height:30px;"><strong>${i + 1}</strong></p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#ffffff', rotate: 0 },
      { id: elId('text'), type: 'text' as const, left: 150, top: y + 5, width: 750, height: 36,
        content: `<p style="font-size:20px;">${p}</p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#333333', rotate: 0 },
    ];
  });

  return {
    id: nanoid(), viewportSize: CANVAS_W, viewportRatio: CANVAS_H / CANVAS_W,
    type: 'end', theme: DEFAULT_THEME, background: { type: 'solid', color: '#f8fafc' },
    elements: [
      { id: elId('title'), type: 'text', left: 100, top: 60, width: 800, height: 60,
        content: `<p style="font-size:36px;text-align:center;"><strong>${params.title || '要点总结'}</strong></p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#1a1a1a', rotate: 0 },
      ...pointElements,
    ],
  };
}

export function endThanks(params: TemplateParams): Slide {
  return {
    id: nanoid(), viewportSize: CANVAS_W, viewportRatio: CANVAS_H / CANVAS_W,
    type: 'end', theme: DEFAULT_THEME, background: { type: 'solid', color: '#1e3a5f' },
    elements: [
      { id: elId('thanks'), type: 'text', left: 100, top: 180, width: 800, height: 100,
        content: `<p style="font-size:48px;text-align:center;color:#ffffff;"><strong>谢谢</strong></p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#ffffff', rotate: 0 },
      { id: elId('sub'), type: 'text', left: 100, top: 300, width: 800, height: 60,
        content: `<p style="font-size:20px;text-align:center;color:#aac4e0;">${params.subtitle || ''}</p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#aac4e0', rotate: 0 },
    ],
  };
}

export function endQA(params: TemplateParams): Slide {
  return {
    id: nanoid(), viewportSize: CANVAS_W, viewportRatio: CANVAS_H / CANVAS_W,
    type: 'end', theme: DEFAULT_THEME, background: { type: 'solid', color: '#ffffff' },
    elements: [
      { id: elId('qa'), type: 'text', left: 100, top: 160, width: 800, height: 120,
        content: `<p style="font-size:48px;text-align:center;"><strong>Q & A</strong></p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#1a1a1a', rotate: 0 },
      { id: elId('sub'), type: 'text', left: 100, top: 290, width: 800, height: 50,
        content: `<p style="font-size:18px;text-align:center;color:#888;">${params.subtitle || '欢迎提问与讨论'}</p>`,
        defaultFontName: 'Microsoft YaHei', defaultColor: '#888888', rotate: 0 },
    ],
  };
}

// ── Registry ───────────────────────────────────────────────────────────────

export const TEMPLATE_REGISTRY: Record<TemplateId, { fn: (params: TemplateParams) => Slide; descriptor: TemplateDescriptor }> = {
  'cover-classic': { fn: coverClassic, descriptor: { id: 'cover-classic', name: '经典学术', description: '居中标题+副标题', category: 'cover', requiredParams: ['title', 'subtitle'] } },
  'cover-modern': { fn: coverModern, descriptor: { id: 'cover-modern', name: '现代简约', description: '左对齐大字+顶部色条', category: 'cover', requiredParams: ['title', 'subtitle'] } },
  'cover-bold': { fn: coverBold, descriptor: { id: 'cover-bold', name: '醒目大字', description: '深色背景+超大标题', category: 'cover', requiredParams: ['title', 'subtitle'] } },
  'content-title-body': { fn: contentTitleBody, descriptor: { id: 'content-title-body', name: '标题+正文', description: '单栏标题+正文段落', category: 'content', requiredParams: ['title', 'bodyText'] } },
  'content-two-col': { fn: contentTwoCol, descriptor: { id: 'content-two-col', name: '双栏对比', description: '标题+左右双栏内容', category: 'content', requiredParams: ['title', 'leftText', 'rightText'] } },
  'content-bullets': { fn: contentBullets, descriptor: { id: 'content-bullets', name: '要点列表', description: '标题+带图标的要点列表', category: 'content', requiredParams: ['title', 'bullets'] } },
  'content-formula': { fn: contentFormula, descriptor: { id: 'content-formula', name: '公式推导', description: '标题+LaTeX公式+注释', category: 'content', requiredParams: ['title', 'formula'] } },
  'content-steps': { fn: contentSteps, descriptor: { id: 'content-steps', name: '步骤流程', description: '标题+横向步骤卡片', category: 'content', requiredParams: ['title', 'steps'] } },
  'content-quote': { fn: contentQuote, descriptor: { id: 'content-quote', name: '引用金句', description: '大字引用+出处', category: 'content', requiredParams: ['quote'] } },
  'content-grid2x2': { fn: contentGrid2x2, descriptor: { id: 'content-grid2x2', name: '四格卡片', description: '标题+2×2网格卡片', category: 'content', requiredParams: ['title', 'gridItems'] } },
  'content-image': { fn: contentImage, descriptor: { id: 'content-image', name: '图文混排', description: '标题+左图右文布局', category: 'content', requiredParams: ['title', 'bodyText'] } },
  'content-table': { fn: contentTable, descriptor: { id: 'content-table', name: '数据表格', description: '标题+对比表格', category: 'content', requiredParams: ['title', 'tableHeaders', 'tableRows'] } },
  'end-summary': { fn: endSummary, descriptor: { id: 'end-summary', name: '要点总结', description: '带编号的关键要点', category: 'end', requiredParams: ['keyPoints'] } },
  'end-thanks': { fn: endThanks, descriptor: { id: 'end-thanks', name: '致谢', description: '大字致谢+副标题', category: 'end', requiredParams: [] } },
  'end-qa': { fn: endQA, descriptor: { id: 'end-qa', name: '问答环节', description: 'Q&A大字+提示文字', category: 'end', requiredParams: [] } },
};

export function getTemplate(id: TemplateId): ((params: TemplateParams) => Slide) | undefined {
  return TEMPLATE_REGISTRY[id]?.fn;
}

export function getTemplateDescriptor(id: TemplateId): TemplateDescriptor | undefined {
  return TEMPLATE_REGISTRY[id]?.descriptor;
}

export function getTemplatesByCategory(category: 'cover' | 'content' | 'end'): TemplateDescriptor[] {
  return Object.values(TEMPLATE_REGISTRY)
    .filter((t) => t.descriptor.category === category)
    .map((t) => t.descriptor);
}

export function getAllTemplateDescriptors(): TemplateDescriptor[] {
  return Object.values(TEMPLATE_REGISTRY).map((t) => t.descriptor);
}

// ── Assembler ──────────────────────────────────────────────────────────────

export function assembleSlides(slots: TemplateSlot[]): Slide[] {
  return slots
    .map((slot) => {
      const tpl = TEMPLATE_REGISTRY[slot.template];
      if (!tpl) return null;
      return tpl.fn(slot.params);
    })
    .filter(Boolean) as Slide[];
}
