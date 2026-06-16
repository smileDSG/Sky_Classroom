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
import type { ContentChunk } from '@/lib/teaching/content-types';
import { createLogger } from '@/lib/logger';

const log = createLogger('TeachingToClassroom');

const CANVAS_W = 1000;
const CANVAS_H = 562.5;

const DEFAULT_THEME: SlideTheme = {
  backgroundColor: '#ffffff',
  themeColors: ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4'],
  fontColor: '#333333',
  fontName: 'Microsoft YaHei',
};

const DEFAULT_BACKGROUND: SlideBackground = {
  type: 'solid',
  color: '#ffffff',
};

/** Approximate chars that fit in a content slide body area */
const MAX_CHARS_PER_SLIDE = 280;

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
  html = html.replace(/`(.+?)`/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;font-family:monospace;">$1</code>');

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
    const slide: Slide = {
      id: createId('slide'),
      viewportSize: CANVAS_W,
      viewportRatio: CANVAS_H / CANVAS_W,
      theme: DEFAULT_THEME,
      elements: currentPageElements,
      background: DEFAULT_BACKGROUND,
      type: 'content',
    };

    const slideContent: SlideContent = {
      type: 'slide',
      canvas: slide,
    };

    scenes.push({
      id: createId('scene'),
      stageId,
      type: 'slide',
      title: pageCount === 0 ? section.title : `${section.title} (${pageCount + 1})`,
      order: baseOrder + pageCount,
      content: slideContent,
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

  const questions: QuizQuestion[] = quizChunks.map((chunk, idx) => {
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

  return {
    id: createId('scene'),
    stageId,
    type: 'quiz',
    title: section.title,
    order,
    content: quizContent,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Convert a single GeneratedSectionData into one or more Scenes.
 * Returns an array because long text sections may be paginated into multiple slide scenes.
 */
export function convertSectionToScenes(
  sectionData: GeneratedSectionData,
  stageId: string,
  order: number,
): Scene[] {
  const { section, chunks } = sectionData;

  // If section is explicitly a quiz or has quiz chunks, create quiz scene(s)
  if (section.contentType === 'quiz') {
    const quizScene = convertSectionToQuizScene(sectionData, stageId, order);
    return quizScene ? [quizScene] : [];
  }

  // Check if there are quiz chunks mixed in
  const hasQuizChunks = chunks.some((c) => c.type === 'quiz');
  const nonQuizChunks = chunks.filter((c) => c.type !== 'quiz');

  const scenes: Scene[] = [];

  if (nonQuizChunks.length > 0) {
    const slideScenes = chunksToSlides(
      { section, chunks: nonQuizChunks },
      stageId,
      order,
    );
    scenes.push(...slideScenes);
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
export function convertTeachingJobToStage(job: TeachingJob): { stage: Stage; scenes: Scene[] } {
  const stageId = createId('stage');
  const now = Date.now();

  const stage: Stage = {
    id: stageId,
    name: job.plan?.title ?? job.topic ?? '教案课堂',
    description: `由 AI 智能授课教案转换而来：${job.topic}`,
    createdAt: now,
    updatedAt: now,
    agentIds: [],
  };

  const scenes: Scene[] = [];
  let order = 0;

  // Add a cover slide
  const coverSlide: Slide = {
    id: createId('slide'),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    theme: DEFAULT_THEME,
    elements: [
      createTitleElement(job.plan?.title ?? job.topic ?? '教案课堂'),
      createBodyElement(
        `<p style="text-align:center;color:#64748b;">${escapeHtml(job.topic)}</p>`,
        200,
        60,
      ),
    ],
    background: { type: 'solid', color: '#f8fafc' },
    type: 'cover',
  };

  scenes.push({
    id: createId('scene'),
    stageId,
    type: 'slide',
    title: '封面',
    order: order++,
    content: { type: 'slide', canvas: coverSlide },
    createdAt: now,
    updatedAt: now,
  });

  // Convert each section
  const sectionDatas = job.sections ?? [];
  for (const sectionData of sectionDatas) {
    const sectionScenes = convertSectionToScenes(sectionData, stageId, order);
    scenes.push(...sectionScenes);
    order += sectionScenes.length;
  }

  // Add an end slide
  const endSlide: Slide = {
    id: createId('slide'),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    theme: DEFAULT_THEME,
    elements: [
      createBodyElement(
        `<p style="text-align:center;font-size:28px;color:#1e3a5f;"><strong>课程结束</strong></p>
         <p style="text-align:center;color:#64748b;margin-top:12px;">感谢学习！</p>`,
        180,
        120,
      ),
    ],
    background: { type: 'solid', color: '#f8fafc' },
    type: 'end',
  };

  scenes.push({
    id: createId('scene'),
    stageId,
    type: 'slide',
    title: '结束',
    order,
    content: { type: 'slide', canvas: endSlide },
    createdAt: now,
    updatedAt: now,
  });

  log.info(`Converted teaching job ${job.id} to stage ${stageId} with ${scenes.length} scenes`);

  return { stage, scenes };
}
