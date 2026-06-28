/**
 * Teaching → Classroom Converter
 *
 * Converts a completed TeachingJob into a Stage + Scene[] suitable for
 * Classroom playback. Maps LessonSections and ContentChunks to slides/quiz scenes.
 */

import { nanoid } from 'nanoid';
import type {
  Slide,
  SlideTheme,
  PPTElement,
  PPTTextElement,
  PPTLatexElement,
  PPTShapeElement,
  PPTImageElement,
  PPTLineElement,
  SlideBackground,
} from '@/lib/types/slides';
import type {
  Scene,
  Stage,
  SlideContent,
  QuizContent,
  QuizQuestion,
  QuizOption,
} from '@/lib/types/stage';
import type { TeachingJob, GeneratedSectionData } from '@/lib/server/teaching-job-store';
import type { Action } from '@/lib/types/action';
import type { StructuredContent } from '@/lib/generation/classroom-content-agent';
import type { SceneOutline } from '@/lib/types/generation';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import { generateSlideContent } from '@/lib/generation/scene-content/slide-generator';
import { polishSlide } from '@/lib/generation/scene-content/slide-polish';
import { callLLM } from '@/lib/ai/llm';
import { resolveModel } from '@/lib/server/resolve-model';
import { createLogger } from '@/lib/logger';

const log = createLogger('TeachingToClassroom');

const CANVAS_W = 1000;
const CANVAS_H = 562.5;

const DEFAULT_THEME: SlideTheme = {
  backgroundColor: '#ffffff',
  themeColors: ['#3B82F6', '#60A5FA', '#93C5FD', '#1E40AF', '#0EA5E9'],
  fontColor: '#333333',
  fontName: 'Microsoft YaHei',
};

const DEFAULT_BACKGROUND: SlideBackground = {
  type: 'solid',
  color: '#f0f9ff',
};

/** Approximate chars that fit in a content slide body area */
const MAX_CHARS_PER_SLIDE = 280;
let teachingSlideAiCallPromise: Promise<AICallFn | null> | null = null;

function createId(prefix: string): string {
  return `${prefix}_${nanoid(8)}`;
}

function createTitleElement(title: string): PPTTextElement {
  return {
    id: createId('el'),
    type: 'text',
    left: 60,
    top: 50,
    width: 880,
    height: 55,
    rotate: 0,
    content: `<p><strong><span style="font-size:24px;color:#1e3a5f;">${escapeHtml(title)}</span></strong></p>`,
    defaultFontName: 'Microsoft YaHei',
    defaultColor: '#1e3a5f',
    lineHeight: 1.4,
    paragraphSpace: 0,
    textType: 'title',
  };
}

function createBodyElement(html: string, top = 120, height = 400): PPTTextElement {
  return {
    id: createId('el'),
    type: 'text',
    left: 60,
    top,
    width: 880,
    height,
    rotate: 0,
    content: html,
    defaultFontName: 'Microsoft YaHei',
    defaultColor: '#333333',
    lineHeight: 1.6,
    paragraphSpace: 6,
    textType: 'content',
  };
}

function createLatexElement(latex: string, top: number, left = 60): PPTLatexElement {
  return {
    id: createId('el'),
    type: 'latex',
    left,
    top,
    width: 880,
    height: 60,
    rotate: 0,
    latex,
    color: '#333333',
    align: 'left',
  };
}

function createExampleBoxElement(html: string, top: number, height: number): PPTTextElement {
  return {
    id: createId('el'),
    type: 'text',
    left: 60,
    top,
    width: 880,
    height,
    rotate: 0,
    content: html,
    defaultFontName: 'Microsoft YaHei',
    defaultColor: '#334155',
    lineHeight: 1.5,
    paragraphSpace: 4,
    fill: '#f0f9ff',
    textType: 'content',
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convert a chunk's content (Markdown + LaTeX) into HTML for PPTTextElement */
function chunkContentToHtml(content: string): string {
  // Simple Markdown → HTML conversion for common patterns
  let html = escapeHtml(content);

  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text*
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // Inline code: `text`
  html = html.replace(
    /`(.+?)`/g,
    '<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;font-family:monospace;">$1</code>',
  );

  // Wrap in paragraph
  const lines = html.split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return '<p></p>';
  return lines.map((l) => `<p>${l}</p>`).join('');
}

/** Extract LaTeX formulas from text content */
function extractLatexSegments(text: string): Array<{ type: 'text' | 'latex'; value: string }> {
  const segments: Array<{ type: 'text' | 'latex'; value: string }> = [];
  // Match both \( ... \) and $...$ patterns
  const regex = /(?:\\\((.+?)\\\)|\$(.+?)\$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'latex', value: match[1] || match[2] || '' });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', value: text });
  }

  return segments;
}

/** Split long text into pages that fit on a slide */
function paginateText(text: string, maxChars = MAX_CHARS_PER_SLIDE): string[] {
  if (text.length <= maxChars) return [text];

  const pages: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      pages.push(remaining);
      break;
    }
    // Find a good break point (end of sentence or paragraph)
    let breakAt = maxChars;
    const searchWindow = remaining.slice(Math.max(0, maxChars - 40), maxChars + 1);
    const sentenceEnd = searchWindow.lastIndexOf('。');
    const paragraphEnd = searchWindow.lastIndexOf('\n');
    const commaEnd = searchWindow.lastIndexOf('，');

    if (sentenceEnd > 10) breakAt = Math.max(0, maxChars - 40) + sentenceEnd + 1;
    else if (paragraphEnd > 5) breakAt = Math.max(0, maxChars - 40) + paragraphEnd + 1;
    else if (commaEnd > 10) breakAt = Math.max(0, maxChars - 40) + commaEnd + 1;

    pages.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).trimStart();
  }

  return pages;
}

/** Convert a list of content chunks into Slide elements, handling pagination */
function chunksToSlides(
  sectionData: GeneratedSectionData,
  stageId: string,
  baseOrder: number,
): Scene[] {
  const { section, chunks } = sectionData;
  const scenes: Scene[] = [];

  // Group chunks by page — start with title slide
  let currentPageElements: PPTElement[] = [createTitleElement(section.title)];
  let currentBodyChars = 0;
  let currentTop = 120;
  let pageCount = 0;

  const flushPage = () => {
    if (currentPageElements.length <= 1) return; // Only title, skip empty page
    const slide: Slide = polishSlide(
      {
        id: createId('slide'),
        viewportSize: CANVAS_W,
        viewportRatio: CANVAS_H / CANVAS_W,
        theme: DEFAULT_THEME,
        elements: currentPageElements,
        background: DEFAULT_BACKGROUND,
        type: 'content',
      },
      { title: section.title, keyPoints: section.knowledgePoints },
    );

    const slideContent: SlideContent = {
      type: 'slide',
      canvas: slide,
    };

    // Build immersive actions for this slide page
    const actions: Action[] = [];
    const titleElementId = currentPageElements[0]?.id;

    const kpText = section.knowledgePoints?.length
      ? `本节重点：${section.knowledgePoints.join('、')}。`
      : '';
    const speechText =
      pageCount === 0
        ? `接下来我们进入「${section.title}」。${kpText}${section.estimatedDuration ? `预计用时 ${section.estimatedDuration} 分钟。` : ''}`
        : `我们继续「${section.title}」的讲解。`;

    actions.push({
      id: createId('action'),
      type: 'speech',
      title: 'Scene Introduction',
      text: speechText,
    });

    if (titleElementId) {
      actions.push({
        id: createId('action'),
        type: 'spotlight',
        title: 'Highlight Title',
        elementId: titleElementId,
      });
    }

    scenes.push({
      id: createId('scene'),
      stageId,
      type: 'slide',
      title: pageCount === 0 ? section.title : `${section.title} (${pageCount + 1})`,
      order: baseOrder + pageCount,
      content: slideContent,
      actions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    pageCount++;
    currentPageElements = [createTitleElement(section.title)];
    currentBodyChars = 0;
    currentTop = 120;
  };

  for (const chunk of chunks) {
    if (chunk.failed) continue;

    switch (chunk.type) {
      case 'text': {
        const pages = paginateText(chunk.content);
        for (const pageText of pages) {
          if (currentBodyChars + pageText.length > MAX_CHARS_PER_SLIDE && currentBodyChars > 0) {
            flushPage();
          }
          const html = chunkContentToHtml(pageText);
          const height = Math.min(400, 40 + pageText.length * 1.8);
          currentPageElements.push(createBodyElement(html, currentTop, height));
          currentBodyChars += pageText.length;
          currentTop += height + 10;
        }
        break;
      }
      case 'formula': {
        const segments = extractLatexSegments(chunk.content);
        for (const seg of segments) {
          if (seg.type === 'latex') {
            currentPageElements.push(createLatexElement(seg.value, currentTop));
            currentTop += 70;
          } else {
            const html = chunkContentToHtml(seg.value);
            const height = Math.min(120, 40 + seg.value.length * 1.8);
            currentPageElements.push(createBodyElement(html, currentTop, height));
            currentTop += height + 10;
          }
        }
        break;
      }
      case 'example': {
        if (currentBodyChars > MAX_CHARS_PER_SLIDE * 0.7) {
          flushPage();
        }
        const html = chunkContentToHtml(`例题：${chunk.content}`);
        const height = Math.min(200, 60 + chunk.content.length * 1.5);
        currentPageElements.push(createExampleBoxElement(html, currentTop, height));
        currentBodyChars += chunk.content.length;
        currentTop += height + 10;
        break;
      }
      case 'diagram': {
        // Diagram chunks often contain markdown descriptions; render as text
        const html = chunkContentToHtml(chunk.content);
        const height = Math.min(300, 60 + chunk.content.length * 1.5);
        currentPageElements.push(createBodyElement(html, currentTop, height));
        currentTop += height + 10;
        break;
      }
      case 'quiz': {
        // Quizzes are handled separately in convertSectionToQuizScene
        break;
      }
    }
  }

  flushPage();
  return scenes;
}

/** Convert a section with quiz chunks into a quiz scene */
function convertSectionToQuizScene(
  sectionData: GeneratedSectionData,
  stageId: string,
  order: number,
): Scene | null {
  const { section, chunks } = sectionData;
  const quizChunks = chunks.filter((c) => c.type === 'quiz' && !c.failed);
  if (quizChunks.length === 0) return null;

  const questions: QuizQuestion[] = quizChunks.map((chunk) => {
    const opts: QuizOption[] = (chunk.options ?? []).map((o, i) => ({
      label: o,
      value: String.fromCharCode(65 + i), // A, B, C, D
    }));

    return {
      id: createId('q'),
      type: 'single',
      question: chunk.question ?? chunk.content ?? '题目',
      options: opts,
      answer:
        typeof chunk.correctAnswer === 'number' && opts[chunk.correctAnswer]
          ? [opts[chunk.correctAnswer].value]
          : opts.length > 0
            ? [opts[0].value]
            : [],
      analysis: '请认真思考后作答',
      hasAnswer: opts.length > 0,
      points: 1,
    };
  });

  const quizContent: QuizContent = {
    type: 'quiz',
    questions,
    knowledgePoints: section.knowledgePoints,
  };

  const actions: Action[] = [
    {
      id: createId('action'),
      type: 'speech',
      title: 'Quiz Introduction',
      text: `学习完以上内容，我们来做几道练习题巩固一下吧。请认真思考后作答。`,
    },
  ];

  return {
    id: createId('scene'),
    stageId,
    type: 'quiz',
    title: section.title,
    order,
    content: quizContent,
    actions,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// OpenMAIC-style slide layout helpers

function createTextElement(
  content: string,
  left: number,
  top: number,
  width: number,
  height: number,
  options: {
    color?: string;
    fontSize?: number;
    fill?: string;
    lineHeight?: number;
    textType?: 'title' | 'content';
    italic?: boolean;
  } = {},
): PPTTextElement {
  const fontSize = options.fontSize ?? 20;
  const color = options.color ?? '#243044';
  const fontStyle = options.italic ? 'font-style:italic;' : '';
  return {
    id: createId('el'),
    type: 'text',
    left,
    top,
    width,
    height,
    rotate: 0,
    content: `<p style="font-size:${fontSize}px;color:${color};line-height:${options.lineHeight ?? 1.45};${fontStyle}">${content}</p>`,
    defaultFontName: 'Microsoft YaHei',
    defaultColor: color,
    lineHeight: options.lineHeight ?? 1.45,
    paragraphSpace: 4,
    fill: options.fill,
    textType: options.textType ?? 'content',
  };
}

function createShapeElement(
  left: number,
  top: number,
  width: number,
  height: number,
  fill: string,
  opacity = 1,
): PPTShapeElement {
  return {
    id: createId('shape'),
    type: 'shape',
    left,
    top,
    width,
    height,
    rotate: 0,
    viewBox: `0 0 ${width} ${height}`,
    path: `M0 0 L${width} 0 L${width} ${height} L0 ${height} Z`,
    fixedRatio: false,
    fill,
    opacity,
  };
}

function createRuleElement(
  left: number,
  top: number,
  width: number,
  color = '#2f80d1',
): PPTLineElement {
  return {
    id: createId('line'),
    type: 'line',
    left,
    top,
    width: 3,
    start: [0, 0],
    end: [width, 0],
    style: 'solid',
    color,
    points: ['', ''],
  };
}

function createImageElement(
  src: string,
  left: number,
  top: number,
  width: number,
  height: number,
): PPTImageElement {
  return {
    id: createId('img'),
    type: 'image',
    left,
    top,
    width,
    height,
    rotate: 0,
    fixedRatio: true,
    src,
    radius: 0,
  };
}

function bulletsHtml(items: Array<{ title?: string; desc: string }>, max = 4): string {
  return items
    .slice(0, max)
    .map((item) => {
      const title = item.title ? `<strong>${escapeHtml(item.title)}:</strong> ` : '';
      return `&bull; ${title}${escapeHtml(item.desc)}`;
    })
    .join('<br/>');
}

function splitSentences(text: string, max = 4): Array<{ desc: string }> {
  return text
    .split(/[\n。！？.!?；;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((desc) => ({ desc }));
}

function stableIndexFromText(text: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % modulo;
}

function structuredLayoutSeed(structured: StructuredContent, sectionTitle: string): string {
  const title = 'title' in structured && structured.title ? structured.title : sectionTitle;
  const content =
    structured.type === 'concept'
      ? structured.cards.map((card) => `${card.title}:${card.desc}`).join('|')
      : '';
  return `${structured.type}:${sectionTitle}:${title}:${content}`;
}

function stableRange(seed: string, salt: string, min: number, max: number): number {
  return min + stableIndexFromText(`${seed}:${salt}`, max - min + 1);
}

function stablePick<T>(items: T[], seed: string, salt: string): T {
  return items[stableIndexFromText(`${seed}:${salt}`, items.length)];
}
function containsAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function addMiniDiagram(elements: PPTElement[], left: number, top: number, title: string): void {
  elements.push(createShapeElement(left, top, 410, 245, '#f8fbff', 1));
  elements.push(createShapeElement(left + 22, top + 26, 366, 34, '#eaf4ff', 1));
  elements.push(
    createTextElement(`<strong>${escapeHtml(title)}</strong>`, left + 38, top + 33, 320, 22, {
      fontSize: 14,
      color: '#1f456e',
    }),
  );

  const cards = [
    { x: left + 28, y: top + 82, fill: '#fff7ed', label: 'Input' },
    { x: left + 158, y: top + 82, fill: '#eef7ff', label: 'Process' },
    { x: left + 288, y: top + 82, fill: '#f0fdf4', label: 'Output' },
  ];

  cards.forEach((card, index) => {
    elements.push(createShapeElement(card.x, card.y, 94, 82, card.fill, 1));
    elements.push(
      createTextElement(`<strong>${card.label}</strong>`, card.x + 13, card.y + 18, 68, 22, {
        fontSize: 14,
        color: '#243044',
      }),
    );
    elements.push(
      createTextElement(`Step ${index + 1}`, card.x + 18, card.y + 46, 58, 20, {
        fontSize: 12,
        color: '#64748b',
      }),
    );
  });

  elements.push(createRuleElement(left + 122, top + 122, 36, '#9bb7d5'));
  elements.push(createRuleElement(left + 252, top + 122, 36, '#9bb7d5'));
  elements.push(createShapeElement(left + 42, top + 188, 326, 12, '#dbeafe', 1));
  elements.push(createShapeElement(left + 42, top + 210, 246, 8, '#bfdbfe', 1));
}

function addConceptFocusVisual(
  elements: PPTElement[],
  structured: Extract<StructuredContent, { type: 'concept' }>,
  sectionTitle: string,
  seed: string,
): 'left' | 'right' | 'none' {
  const source = `${sectionTitle} ${structured.title} ${structured.cards
    .map((card) => `${card.title} ${card.desc}`)
    .join(' ')}`;
  const hasGraph = containsAny(source, [
    /\u56fe\u50cf|\u56fe\u8c61|\u629b\u7269\u7ebf|\u5750\u6807|\u5f00\u53e3/,
    /graph|parabola|coordinate/i,
  ]);
  const hasApplication = containsAny(source, [
    /\u5e94\u7528|\u5b9e\u9645|\u751f\u6d3b|\u60c5\u5883|\u5efa\u6a21/,
    /application|scenario|model/i,
  ]);
  const hasDefinition = containsAny(source, [
    /\u5b9a\u4e49|\u6982\u5ff5|\u672c\u8d28|\u5f62\u5982/,
    /definition|concept/i,
  ]);

  if (structured.formulas?.[0]) {
    const formulaLeft = stablePick([118, 372, 526], seed, 'formula-left');
    const formulaTop = stablePick([168, 438], seed, 'formula-top');
    elements.push(createLatexElement(structured.formulas[0].latex, formulaTop, formulaLeft));
  }

  if (hasGraph) {
    const left = stablePick([116, 560], seed, 'graph-left');
    const top = stableRange(seed, 'graph-top', 188, 224);
    addMiniDiagram(elements, left, top, '\u56fe\u50cf\u89c2\u5bdf');
    return left < 400 ? 'left' : 'right';
  }

  if (hasApplication) {
    const left = stablePick([120, 552], seed, 'app-left');
    const top = stableRange(seed, 'app-top', 190, 218);
    elements.push(createShapeElement(left, top, 324, 214, '#fff7ed', 1));
    elements.push(
      createTextElement(
        `<strong>${escapeHtml(structured.cards[0]?.title ?? sectionTitle)}</strong>`,
        left + 28,
        top + 26,
        252,
        32,
        {
          fontSize: 21,
          color: '#7a4217',
        },
      ),
    );
    elements.push(
      createTextElement(
        escapeHtml(structured.cards[0]?.desc ?? sectionTitle),
        left + 28,
        top + 82,
        260,
        82,
        {
          fontSize: 17,
          color: '#4a3218',
        },
      ),
    );
    elements.push(
      createShapeElement(
        left + 36,
        top + 176,
        stableRange(seed, 'app-bar', 130, 230),
        10,
        '#fdba74',
        1,
      ),
    );
    return left < 400 ? 'left' : 'right';
  }

  if (hasDefinition) {
    const left = stablePick([122, 506], seed, 'def-left');
    const top = stableRange(seed, 'def-top', 186, 220);
    elements.push(createShapeElement(left, top, 370, 218, '#f8fbff', 1));
    elements.push(createShapeElement(left + 26, top + 28, 7, 150, '#2f80d1', 1));
    elements.push(
      createTextElement(
        `<strong>${escapeHtml(structured.cards[0]?.title ?? sectionTitle)}</strong><br/>${escapeHtml(structured.cards[0]?.desc ?? sectionTitle)}`,
        left + 54,
        top + 34,
        278,
        120,
        {
          fontSize: 19,
          color: '#17335c',
        },
      ),
    );
    return left < 400 ? 'left' : 'right';
  }

  const left = stablePick([112, 492], seed, 'mini-left');
  addMiniDiagram(elements, left, stableRange(seed, 'mini-top', 184, 212), 'Concept Map');
  return left < 400 ? 'left' : 'right';
}

function addAdaptiveConceptCards(
  elements: PPTElement[],
  structured: Extract<StructuredContent, { type: 'concept' }>,
  seed: string,
  reservedSide: 'left' | 'right' | 'none',
): void {
  const cards = structured.cards.slice(0, 5);
  const palette = stablePick(
    [
      ['#e7f3ff', '#e8faef', '#fff3c4', '#f3e8ff', '#ffe4e6'],
      ['#f8fbff', '#fff7ed', '#ecfeff', '#f0fdf4', '#fef3c7'],
      ['#eef2ff', '#fef9c3', '#f0fdfa', '#fff1f2', '#eff6ff'],
    ],
    seed,
    'palette',
  );
  const colors = ['#17406d', '#166534', '#92400e', '#6b21a8', '#9f1239'];
  const fullLayouts = [
    [
      [544, 190, 160, 118],
      [724, 190, 160, 118],
      [544, 330, 160, 118],
      [724, 330, 160, 118],
    ],
    [
      [118, 194, 208, 112],
      [382, 190, 236, 128],
      [674, 194, 208, 112],
      [246, 348, 208, 112],
      [546, 348, 208, 112],
    ],
    [
      [118, 204, 254, 118],
      [408, 204, 254, 118],
      [698, 204, 176, 118],
      [188, 358, 294, 104],
      [518, 358, 294, 104],
    ],
    [
      [122, 330, 172, 122],
      [318, 292, 172, 122],
      [514, 330, 172, 122],
      [710, 292, 172, 122],
    ],
  ];
  const leftReservedLayouts = [
    [
      [590, 188, 290, 82],
      [590, 284, 290, 82],
      [590, 380, 290, 82],
    ],
    [
      [568, 190, 146, 118],
      [734, 190, 146, 118],
      [568, 332, 146, 118],
      [734, 332, 146, 118],
    ],
  ];
  const rightReservedLayouts = [
    [
      [120, 188, 290, 82],
      [120, 284, 290, 82],
      [120, 380, 290, 82],
    ],
    [
      [120, 190, 146, 118],
      [286, 190, 146, 118],
      [120, 332, 146, 118],
      [286, 332, 146, 118],
    ],
  ];
  const layoutPack =
    reservedSide === 'left'
      ? leftReservedLayouts
      : reservedSide === 'right'
        ? rightReservedLayouts
        : fullLayouts;
  const layouts = layoutPack[stableIndexFromText(`${seed}:card-pattern`, layoutPack.length)];

  cards.forEach((card, index) => {
    const slot = layouts[index % layouts.length];
    const offsetX = stableRange(seed, `card-${index}-x`, -8, 8);
    const offsetY = stableRange(seed, `card-${index}-y`, -6, 6);
    const [left, top, width, height] = slot;
    elements.push(
      createShapeElement(
        left + offsetX,
        top + offsetY,
        width,
        height,
        palette[index % palette.length],
        1,
      ),
    );
    elements.push(
      createTextElement(
        `<strong>${escapeHtml(card.title)}</strong>`,
        left + offsetX + 20,
        top + offsetY + 18,
        width - 40,
        28,
        {
          fontSize: width < 190 ? 17 : 19,
          color: colors[index % colors.length],
        },
      ),
    );
    elements.push(
      createTextElement(
        escapeHtml(card.desc),
        left + offsetX + 20,
        top + offsetY + 58,
        width - 40,
        Math.max(42, height - 72),
        {
          fontSize: width < 190 ? 14 : 16,
          color: '#243044',
        },
      ),
    );
  });
}

function addConceptSummary(
  elements: PPTElement[],
  structured: Extract<StructuredContent, { type: 'concept' }>,
  sectionTitle: string,
  seed: string,
): void {
  const summary = structured.summary || structured.cards[0]?.desc || sectionTitle;
  const placements = [
    [150, 454, 700, 36],
    [560, 410, 310, 58],
    [124, 416, 338, 58],
    [236, 466, 528, 34],
  ];
  const [left, top, width, height] =
    placements[stableIndexFromText(`${seed}:summary`, placements.length)];
  elements.push(createShapeElement(left - 18, top - 8, width + 36, height + 16, '#f1f5ff', 0.9));
  elements.push(
    createTextElement(
      `<strong>Key idea:</strong> ${escapeHtml(summary)}`,
      left,
      top,
      width,
      height,
      {
        fontSize: width < 360 ? 15 : 16,
        color: '#21446d',
      },
    ),
  );
}

function addConceptAdaptiveLayout(
  elements: PPTElement[],
  structured: Extract<StructuredContent, { type: 'concept' }>,
  sectionTitle: string,
): void {
  const seed = structuredLayoutSeed(structured, sectionTitle);
  const reservedSide = addConceptFocusVisual(elements, structured, sectionTitle, seed);
  addAdaptiveConceptCards(elements, structured, seed, reservedSide);
  addConceptSummary(elements, structured, sectionTitle, seed);
}

function createOpenMaicStyleSlide(structured: StructuredContent, sectionTitle: string): Slide {
  const title = 'title' in structured && structured.title ? structured.title : sectionTitle;
  const elements: PPTElement[] = [
    createTextElement(`<strong>${escapeHtml(title)}</strong>`, 105, 76, 790, 70, {
      fontSize: 34,
      color: '#17233c',
      textType: 'title',
    }),
    createRuleElement(105, 154, 790),
  ];

  const addFooter = () => {
    elements.push(createShapeElement(105, 492, 790, 28, '#e8f2ff', 0.9));
    elements.push(
      createTextElement(escapeHtml(sectionTitle), 128, 496, 500, 22, {
        fontSize: 14,
        color: '#53657d',
      }),
    );
  };

  switch (structured.type) {
    case 'concept': {
      addConceptAdaptiveLayout(elements, structured, sectionTitle);
      break;
    }
    case 'compare': {
      elements.push(createShapeElement(112, 190, 350, 220, '#f8fbff', 1));
      elements.push(createShapeElement(538, 190, 350, 220, '#fffaf2', 1));
      elements.push(
        createTextElement(
          `<strong>${escapeHtml(structured.left.title)}</strong>`,
          138,
          210,
          300,
          34,
          {
            fontSize: 20,
            color: '#17335c',
          },
        ),
      );
      elements.push(
        createTextElement(
          `<strong>${escapeHtml(structured.right.title)}</strong>`,
          564,
          210,
          300,
          34,
          {
            fontSize: 20,
            color: '#7a4217',
          },
        ),
      );
      elements.push(
        createTextElement(
          bulletsHtml(
            structured.left.items.map((desc) => ({ desc })),
            5,
          ),
          138,
          260,
          300,
          112,
          { fontSize: 16 },
        ),
      );
      elements.push(
        createTextElement(
          bulletsHtml(
            structured.right.items.map((desc) => ({ desc })),
            5,
          ),
          564,
          260,
          300,
          112,
          { fontSize: 16 },
        ),
      );
      elements.push(createShapeElement(112, 424, 776, 44, '#eaf4ff', 0.95));
      elements.push(
        createTextElement(
          `<strong>Key takeaway:</strong> ${escapeHtml(structured.conclusion)}`,
          138,
          432,
          720,
          30,
          {
            fontSize: 16,
            color: '#1f456e',
          },
        ),
      );
      break;
    }
    case 'process': {
      const steps = structured.steps.slice(0, 5);
      const gap = 680 / Math.max(steps.length - 1, 1);
      elements.push(createRuleElement(160, 278, 680, '#a8bed6'));
      steps.forEach((step, index) => {
        const x = 135 + index * gap;
        elements.push(createShapeElement(x, 248, 58, 58, '#eaf1ff', 1));
        elements.push(
          createTextElement(`<strong>${escapeHtml(step.num)}</strong>`, x + 18, 262, 28, 24, {
            fontSize: 18,
            color: '#2f54c9',
          }),
        );
        elements.push(
          createTextElement(
            `<strong>${escapeHtml(step.title)}</strong><br/>${escapeHtml(step.desc)}`,
            x - 36,
            330,
            130,
            92,
            { fontSize: 14, color: '#283344' },
          ),
        );
      });
      if (structured.formulas?.[0]) {
        elements.push(createLatexElement(structured.formulas[0].latex, 420, 160));
      }
      break;
    }
    case 'formula': {
      elements.push(createShapeElement(112, 188, 776, 105, '#f8fbff', 1));
      elements.push(createLatexElement(structured.mainFormula, 208, 160));
      elements.push(
        createTextElement(
          bulletsHtml(splitSentences(structured.derivation), 4),
          124,
          325,
          420,
          120,
          {
            fontSize: 17,
          },
        ),
      );
      if (structured.application) {
        elements.push(createShapeElement(590, 326, 298, 112, '#fff7ec', 1));
        elements.push(
          createTextElement(
            `<strong>Application</strong><br/>${escapeHtml(structured.application)}`,
            618,
            344,
            244,
            72,
            { fontSize: 16, color: '#674313' },
          ),
        );
      }
      break;
    }
    case 'case': {
      const scenario = structured.scenarios[0];
      elements.push(createShapeElement(112, 184, 370, 230, '#fff7ec', 1));
      elements.push(createShapeElement(520, 184, 370, 230, '#eef7ff', 1));
      elements.push(
        createTextElement(
          `<strong>Problem</strong><br/>${escapeHtml(scenario.problem)}`,
          142,
          214,
          310,
          150,
          {
            fontSize: 17,
            color: '#4a3218',
          },
        ),
      );
      elements.push(
        createTextElement(
          `<strong>Solution</strong><br/>${escapeHtml(scenario.solution)}`,
          550,
          214,
          310,
          150,
          {
            fontSize: 17,
            color: '#173b63',
          },
        ),
      );
      if (structured.highlight) {
        elements.push(
          createTextElement(`"${escapeHtml(structured.highlight)}"`, 156, 428, 680, 40, {
            fontSize: 17,
            color: '#2c5f9c',
            italic: true,
          }),
        );
      }
      break;
    }
    case 'summary': {
      elements.push(
        createTextElement(
          bulletsHtml(
            structured.keyPoints.map((desc) => ({ desc })),
            6,
          ),
          130,
          190,
          520,
          240,
          {
            fontSize: 19,
            color: '#20242d',
          },
        ),
      );
      if (structured.preview) {
        elements.push(createShapeElement(690, 214, 190, 165, '#f5f0ff', 1));
        elements.push(
          createTextElement(
            `<strong>Next</strong><br/>${escapeHtml(structured.preview)}`,
            716,
            242,
            138,
            96,
            {
              fontSize: 17,
              color: '#4b2f84',
            },
          ),
        );
      }
      break;
    }
    case 'quote': {
      elements.push(
        createTextElement(`"${escapeHtml(structured.body)}"`, 170, 212, 660, 130, {
          fontSize: 27,
          color: '#1d2b44',
          italic: true,
        }),
      );
      elements.push(createRuleElement(280, 368, 440, '#cbd8e8'));
      if (structured.caption) {
        elements.push(
          createTextElement(escapeHtml(structured.caption), 360, 390, 280, 35, {
            fontSize: 17,
            color: '#68758a',
          }),
        );
      }
      break;
    }
    case 'sidebar': {
      elements.push(createShapeElement(112, 188, 270, 240, '#eef7ff', 1));
      elements.push(
        createTextElement(`"${escapeHtml(structured.body)}"`, 142, 225, 210, 130, {
          fontSize: 19,
          color: '#17456e',
          italic: true,
        }),
      );
      elements.push(
        createTextElement(escapeHtml(structured.main_body), 430, 205, 430, 190, {
          fontSize: 20,
          color: '#20242d',
        }),
      );
      break;
    }
    case 'image_half':
    case 'image_large': {
      const imageSrc = structured.image_url;
      const hasImage = /^(https?:|data:|\/)/.test(imageSrc);
      if (hasImage) {
        const imageWidth = structured.type === 'image_large' ? 640 : 410;
        elements.push(createImageElement(imageSrc, 112, 184, imageWidth, 245));
      }
      const textLeft = structured.type === 'image_large' ? 170 : 560;
      const textTop = structured.type === 'image_large' ? 444 : 210;
      const caption = structured.image_caption || '';
      const body = structured.type === 'image_half' ? structured.body : caption;
      elements.push(
        createTextElement(
          escapeHtml(body || caption || sectionTitle),
          textLeft,
          textTop,
          330,
          130,
          {
            fontSize: 18,
            color: '#2b3443',
            italic: structured.type === 'image_large',
          },
        ),
      );
      break;
    }
    case 'table': {
      const colCount = Math.min(structured.headers.length, 4);
      const rowCount = Math.min(structured.rows.length, 5);
      const tableLeft = 120;
      const tableTop = 190;
      const cellW = 760 / colCount;
      const cellH = 42;
      structured.headers.slice(0, colCount).forEach((header, i) => {
        elements.push(
          createShapeElement(tableLeft + i * cellW, tableTop, cellW, cellH, '#eaf4ff', 1),
        );
        elements.push(
          createTextElement(
            `<strong>${escapeHtml(header)}</strong>`,
            tableLeft + i * cellW + 10,
            tableTop + 10,
            cellW - 20,
            20,
            {
              fontSize: 14,
              color: '#1f456e',
            },
          ),
        );
      });
      structured.rows.slice(0, rowCount).forEach((row, r) => {
        row.slice(0, colCount).forEach((cell, c) => {
          elements.push(
            createShapeElement(
              tableLeft + c * cellW,
              tableTop + (r + 1) * cellH,
              cellW,
              cellH,
              r % 2 ? '#ffffff' : '#f8fbff',
              1,
            ),
          );
          elements.push(
            createTextElement(
              escapeHtml(cell),
              tableLeft + c * cellW + 10,
              tableTop + (r + 1) * cellH + 9,
              cellW - 20,
              22,
              {
                fontSize: 13,
                color: '#2b3443',
              },
            ),
          );
        });
      });
      elements.push(
        createTextElement(escapeHtml(structured.summary), 140, 455, 720, 30, {
          fontSize: 15,
          color: '#53657d',
        }),
      );
      break;
    }
    default: {
      elements.push(
        createTextElement(escapeHtml(sectionTitle), 140, 205, 700, 190, {
          fontSize: 22,
          color: '#20242d',
        }),
      );
      break;
    }
  }

  addFooter();

  return {
    id: createId('slide'),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    theme: DEFAULT_THEME,
    elements,
    background: { type: 'solid', color: '#ffffff' },
    type: 'content',
  };
}

/** Convert StructuredContent into a local element slide when the OpenMAIC agent is unavailable. */
export function createStructuredFallbackSlide(
  structured: StructuredContent,
  sectionTitle: string,
): Slide | null {
  try {
    return polishSlide(createOpenMaicStyleSlide(structured, sectionTitle), { title: sectionTitle });
  } catch (err) {
    log.warn(`[ToClassroom] OpenMAIC-style layout failed for "${sectionTitle}":`, err);
    return null;
  }
}

async function getTeachingSlideAiCall(): Promise<AICallFn | null> {
  teachingSlideAiCallPromise ??= (async () => {
    try {
      const { model, modelInfo } = await resolveModel({});
      return async (systemPrompt, userPrompt) => {
        const result = await callLLM(
          {
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            maxOutputTokens: modelInfo?.outputWindow,
          },
          'teaching-to-classroom-slide',
        );
        return result.text;
      };
    } catch (err) {
      log.warn('[ToClassroom] Unable to initialize element-level slide generator:', err);
      return null;
    }
  })();

  return teachingSlideAiCallPromise;
}

function compactText(value: string, max = 120): string {
  return value
    .replace(/[#*_`>\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function structuredKeyPoints(structured?: StructuredContent): string[] {
  if (!structured) return [];

  switch (structured.type) {
    case 'concept':
      return structured.cards.map((card) => `${card.title}: ${card.desc}`);
    case 'compare':
      return [structured.left.title, structured.right.title, structured.conclusion];
    case 'process':
      return structured.steps.map((step) => `${step.num}. ${step.title}: ${step.desc}`);
    case 'formula':
      return [structured.mainFormula, structured.derivation, structured.application ?? ''];
    case 'case':
      return structured.scenarios.flatMap((scenario) => [scenario.problem, scenario.solution]);
    case 'summary':
      return structured.keyPoints;
    case 'quote':
      return [structured.body, structured.caption ?? ''];
    case 'sidebar':
      return [structured.body, structured.main_body];
    case 'image_half':
      return [structured.body, structured.image_caption ?? ''];
    case 'image_large':
      return [structured.image_caption ?? ''];
    case 'table':
      return [structured.summary, ...structured.headers];
    default:
      return [];
  }
}

function buildSectionOutline(sectionData: GeneratedSectionData, order: number): SceneOutline {
  const { section, chunks, structured } = sectionData;
  const chunkPoints = chunks
    .filter((chunk) => chunk.type !== 'quiz' && !chunk.failed)
    .map((chunk) => compactText(chunk.content))
    .filter(Boolean);

  const keyPoints = [
    ...section.knowledgePoints,
    ...structuredKeyPoints(structured).map((point) => compactText(point)),
    ...chunkPoints,
  ]
    .filter(Boolean)
    .slice(0, 6);

  return {
    id: section.id,
    type: 'slide',
    title: section.title,
    description: `${section.contentType} section for ${section.depth} learners. Focus on ${
      section.knowledgePoints.join(', ') || section.title
    }.`,
    keyPoints: keyPoints.length > 0 ? keyPoints : [section.title],
    teachingObjective: section.knowledgePoints.join(', '),
    estimatedDuration: section.estimatedDuration * 60,
    order: order + 1,
  };
}

async function generateElementSlideForSection(
  sectionData: GeneratedSectionData,
  order: number,
): Promise<Slide | null> {
  const aiCall = await getTeachingSlideAiCall();
  if (!aiCall) return null;

  try {
    const content = await generateSlideContent(
      buildSectionOutline(sectionData, order),
      aiCall,
      undefined,
      undefined,
      false,
      undefined,
      undefined,
      'Use the same language as the section title and key points.',
    );

    if (!content || content.elements.length === 0) return null;

    return polishSlide(
      {
        id: createId('slide'),
        viewportSize: CANVAS_W,
        viewportRatio: CANVAS_H / CANVAS_W,
        theme: DEFAULT_THEME,
        elements: content.elements,
        background: content.background ?? DEFAULT_BACKGROUND,
        type: 'content',
      },
      {
        title: sectionData.section.title,
        keyPoints: sectionData.section.knowledgePoints,
        decorate: false,
      },
    );
  } catch (err) {
    log.warn(
      `[ToClassroom] Element-level slide generation failed for "${sectionData.section.title}":`,
      err,
    );
    return null;
  }
}

/**
 * Convert a single GeneratedSectionData into one or more Scenes.
 * Returns an array because long text sections may be paginated into multiple slide scenes.
 */
export async function convertSectionToScenes(
  sectionData: GeneratedSectionData,
  stageId: string,
  order: number,
): Promise<Scene[]> {
  const { section, chunks, structured } = sectionData;
  const scenes: Scene[] = [];

  const nonQuizChunks = chunks.filter((c) => c.type !== 'quiz');
  const hasQuizChunks = chunks.some((c) => c.type === 'quiz');
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST;

  // Path 1: OpenMAIC element-level slide generator, with local structured fallback.
  if (!isTestEnv) {
    const slide =
      (await generateElementSlideForSection(sectionData, order)) ??
      (structured ? createStructuredFallbackSlide(structured, section.title) : null);
    if (slide) {
      const richActions: Action[] = [];
      const richKpText = section.knowledgePoints?.length
        ? `本节重点：${section.knowledgePoints.join('、')}。`
        : '';
      richActions.push({
        id: createId('action'),
        type: 'speech',
        title: 'Scene Introduction',
        text: `接下来我们进入「${section.title}」。${richKpText}${section.estimatedDuration ? `预计用时 ${section.estimatedDuration} 分钟。` : ''}`,
      });

      scenes.push({
        id: createId('scene'),
        stageId,
        type: 'slide',
        title: section.title,
        order,
        content: { type: 'slide', canvas: slide },
        actions: richActions,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      log.info(`[ToClassroom] OpenMAIC-style slide produced for: ${section.title}`);
    }
  }

  // ── Path 2: Fallback to text-based slides ──
  if (scenes.length === 0 && nonQuizChunks.length > 0) {
    const slideScenes = chunksToSlides({ section, chunks: nonQuizChunks }, stageId, order);
    scenes.push(...slideScenes);
  }

  // ── Path 3: Quiz-only section — create a summary slide ──
  if (scenes.length === 0 && nonQuizChunks.length === 0) {
    const summaryElements: PPTElement[] = [createTitleElement(section.title)];
    const kpStr = section.knowledgePoints.join('、');
    summaryElements.push(createBodyElement(`<p>本节重点：${escapeHtml(kpStr)}</p>`, 120, 100));
    if (section.hasQuiz) {
      summaryElements.push(
        createBodyElement(
          `<p style="color:#64748b;">请完成下方随堂测验，检验学习成果。</p>`,
          240,
          50,
        ),
      );
    }
    const summarySlide: Slide = polishSlide(
      {
        id: createId('slide'),
        viewportSize: CANVAS_W,
        viewportRatio: CANVAS_H / CANVAS_W,
        theme: DEFAULT_THEME,
        elements: summaryElements,
        background: DEFAULT_BACKGROUND,
        type: 'content',
      },
      { title: section.title, keyPoints: section.knowledgePoints },
    );
    const summaryActions: Action[] = [];
    const sumKpText = section.knowledgePoints?.length
      ? `本节重点：${section.knowledgePoints.join('、')}。`
      : '';
    summaryActions.push({
      id: createId('action'),
      type: 'speech',
      title: 'Scene Introduction',
      text: `接下来我们进入「${section.title}」。${sumKpText}${section.estimatedDuration ? `预计用时 ${section.estimatedDuration} 分钟。` : ''}`,
    });

    scenes.push({
      id: createId('scene'),
      stageId,
      type: 'slide',
      title: section.title,
      order,
      content: { type: 'slide', canvas: summarySlide },
      actions: summaryActions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  if (hasQuizChunks) {
    const quizScene = convertSectionToQuizScene(sectionData, stageId, order + scenes.length);
    if (quizScene) scenes.push(quizScene);
  }

  return scenes;
}

/**
 * Convert a completed TeachingJob into a Stage + Scene[] for Classroom playback.
 */
export async function convertTeachingJobToStage(
  job: TeachingJob,
): Promise<{ stage: Stage; scenes: Scene[] }> {
  const stageId = createId('stage');
  const now = Date.now();

  const stage: Stage = {
    id: stageId,
    name: job.plan?.title ?? job.topic ?? '教案课堂',
    description: `由 AI 智能授课教案转换而来：${job.topic}`,
    createdAt: now,
    updatedAt: now,
    agentIds: ['default-1', 'default-2', 'default-3'],
    style: 'interactive',
    languageDirective: 'zh-CN',
  };

  const scenes: Scene[] = [];
  let order = 0;

  // Add a cover slide
  const coverTitleText = job.plan?.title ?? job.topic ?? '教案课堂';
  const coverElements: PPTElement[] = [
    {
      id: createId('el'),
      type: 'text',
      left: 60,
      top: 80,
      width: 880,
      height: 70,
      rotate: 0,
      content: `<p style="text-align:center;"><strong><span style="font-size:32px;color:#1E40AF;font-family:Microsoft YaHei;">${escapeHtml(coverTitleText)}</span></strong></p>`,
      defaultFontName: 'Microsoft YaHei',
      defaultColor: '#1E40AF',
      lineHeight: 1.3,
      paragraphSpace: 0,
      textType: 'title',
    },
    {
      id: createId('el'),
      type: 'text',
      left: 60,
      top: 170,
      width: 880,
      height: 40,
      rotate: 0,
      content: `<p style="text-align:center;color:#64748b;font-size:16px;font-family:Microsoft YaHei;">${escapeHtml(job.topic)}</p>`,
      defaultFontName: 'Microsoft YaHei',
      defaultColor: '#64748b',
      lineHeight: 1.4,
      paragraphSpace: 0,
      textType: 'content',
    },
    {
      id: createId('el'),
      type: 'text',
      left: 60,
      top: 230,
      width: 880,
      height: 30,
      rotate: 0,
      content: `<p style="text-align:center;color:#94a3b8;font-size:14px;font-family:Microsoft YaHei;">预计 ${job.plan?.estimatedDuration ?? '-'} 分钟 · ${job.plan?.sections.length ?? (job.sections ?? []).length} 个章节</p>`,
      defaultFontName: 'Microsoft YaHei',
      defaultColor: '#94a3b8',
      lineHeight: 1.4,
      paragraphSpace: 0,
      textType: 'content',
    },
  ];

  if (job.plan?.focusPoints?.length) {
    const badges = job.plan.focusPoints
      .map(
        (fp) =>
          `<span style="display:inline-block;background:#DBEAFE;color:#1E40AF;padding:4px 12px;border-radius:9999px;font-size:13px;margin:4px;font-family:Microsoft YaHei;">${escapeHtml(fp)}</span>`,
      )
      .join('');
    coverElements.push({
      id: createId('el'),
      type: 'text',
      left: 60,
      top: 280,
      width: 880,
      height: 60,
      rotate: 0,
      content: `<p style="text-align:center;">${badges}</p>`,
      defaultFontName: 'Microsoft YaHei',
      defaultColor: '#1E40AF',
      lineHeight: 1.4,
      paragraphSpace: 0,
      textType: 'content',
    });
  }

  const coverSlide: Slide = polishSlide(
    {
      id: createId('slide'),
      viewportSize: CANVAS_W,
      viewportRatio: CANVAS_H / CANVAS_W,
      theme: DEFAULT_THEME,
      elements: coverElements,
      background: { type: 'solid', color: '#f0f9ff' },
      type: 'cover',
    },
    { title: coverTitleText, keyPoints: job.plan?.focusPoints },
  );

  const coverActions: Action[] = [];
  const introText = `同学们好，今天我们要学习的是《${job.plan?.title ?? job.topic ?? '教案课堂'}》。本节课共 ${job.plan?.sections.length ?? (job.sections ?? []).length} 个章节，${job.plan?.estimatedDuration ? `预计用时 ${job.plan.estimatedDuration} 分钟。` : ''}${job.plan?.focusPoints?.length ? `重点内容：${job.plan.focusPoints.join('、')}。` : ''}让我们一起开始吧！`;
  coverActions.push({
    id: createId('action'),
    type: 'speech',
    title: 'Course Introduction',
    text: introText,
  });
  const coverTitleId = coverSlide.elements[0]?.id;
  if (coverTitleId) {
    coverActions.push({
      id: createId('action'),
      type: 'spotlight',
      title: 'Highlight Title',
      elementId: coverTitleId,
    });
  }

  scenes.push({
    id: createId('scene'),
    stageId,
    type: 'slide',
    title: '封面',
    order: order++,
    content: { type: 'slide', canvas: coverSlide },
    actions: coverActions,
    createdAt: now,
    updatedAt: now,
  });

  // Convert each section
  const sectionDatas = job.sections ?? [];
  for (const sectionData of sectionDatas) {
    const sectionScenes = await convertSectionToScenes(sectionData, stageId, order);
    scenes.push(...sectionScenes);
    order += sectionScenes.length;
  }

  // Add an end slide
  const endElements: PPTElement[] = [
    {
      id: createId('el'),
      type: 'text',
      left: 60,
      top: 120,
      width: 880,
      height: 60,
      rotate: 0,
      content: `<p style="text-align:center;"><strong><span style="font-size:28px;color:#1E40AF;font-family:Microsoft YaHei;">课程结束</span></strong></p>`,
      defaultFontName: 'Microsoft YaHei',
      defaultColor: '#1E40AF',
      lineHeight: 1.3,
      paragraphSpace: 0,
      textType: 'title',
    },
    {
      id: createId('el'),
      type: 'text',
      left: 60,
      top: 200,
      width: 880,
      height: 40,
      rotate: 0,
      content: `<p style="text-align:center;color:#64748b;font-size:16px;font-family:Microsoft YaHei;">感谢学习！希望大家课后及时复习今天学到的内容。</p>`,
      defaultFontName: 'Microsoft YaHei',
      defaultColor: '#64748b',
      lineHeight: 1.4,
      paragraphSpace: 0,
      textType: 'content',
    },
    {
      id: createId('el'),
      type: 'text',
      left: 60,
      top: 260,
      width: 880,
      height: 30,
      rotate: 0,
      content: `<p style="text-align:center;color:#94a3b8;font-size:14px;font-family:Microsoft YaHei;">共完成 ${(job.sections ?? []).length} 个章节${job.plan?.estimatedDuration ? ` · 预计用时 ${job.plan.estimatedDuration} 分钟` : ''}</p>`,
      defaultFontName: 'Microsoft YaHei',
      defaultColor: '#94a3b8',
      lineHeight: 1.4,
      paragraphSpace: 0,
      textType: 'content',
    },
  ];

  const endSlide: Slide = polishSlide(
    {
      id: createId('slide'),
      viewportSize: CANVAS_W,
      viewportRatio: CANVAS_H / CANVAS_W,
      theme: DEFAULT_THEME,
      elements: endElements,
      background: { type: 'solid', color: '#f0f9ff' },
      type: 'end',
    },
    { title: '课程结束', keyPoints: job.plan?.focusPoints },
  );

  const endActions: Action[] = [
    {
      id: createId('action'),
      type: 'speech',
      title: 'Course Closing',
      text: `课程《${job.plan?.title ?? job.topic ?? '教案课堂'}》到这里就结束啦！感谢大家的认真学习。希望大家课后及时复习今天学到的内容，我们下节课再见！`,
    },
  ];

  scenes.push({
    id: createId('scene'),
    stageId,
    type: 'slide',
    title: '结束',
    order,
    content: { type: 'slide', canvas: endSlide },
    actions: endActions,
    createdAt: now,
    updatedAt: now,
  });

  log.info(`Converted teaching job ${job.id} to stage ${stageId} with ${scenes.length} scenes`);

  return { stage, scenes };
}
