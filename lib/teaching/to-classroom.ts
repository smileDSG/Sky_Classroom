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
import type { Action } from '@/lib/types/action';
import {
  layoutContentWithTemplate,
  selectTemplateForOutline,
} from '@/lib/generation/classroom-template-layout-agent';
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

    // Build immersive actions for this slide page
    const actions: Action[] = [];
    const titleElementId = currentPageElements[0]?.id;

    const kpText = section.knowledgePoints?.length
      ? `本节重点：${section.knowledgePoints.join('、')}。`
      : '';
    const speechText = pageCount === 0
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

// ── Layout Agent helpers ─────────────────────────────────────────

/** Convert StructuredContent into a Slide using the Layout Agent */
async function structuredToSlide(
  structured: import('@/lib/generation/classroom-content-agent').StructuredContent,
  sectionTitle: string,
): Promise<Slide | null> {
  try {
    const templateName = selectTemplateForOutline(sectionTitle);
    const templateData = await layoutContentWithTemplate(structured, templateName);
    return {
      id: createId('slide'),
      viewportSize: CANVAS_W,
      viewportRatio: CANVAS_H / CANVAS_W,
      theme: DEFAULT_THEME,
      elements: templateData.page.elements as PPTElement[],
      background: (templateData.page.background as SlideBackground) ?? DEFAULT_BACKGROUND,
      type: 'content',
    };
  } catch (err) {
    log.warn(`[ToClassroom] Layout Agent failed for "${sectionTitle}":`, err);
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

  // ── Path 1: Structured content → Layout Agent (rich template slides) ──
  if (structured && !isTestEnv) {
    const slide = await structuredToSlide(structured, section.title);
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
      log.info(`[ToClassroom] Layout Agent produced rich slide for: ${section.title}`);
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
    const summarySlide: Slide = {
      id: createId('slide'),
      viewportSize: CANVAS_W,
      viewportRatio: CANVAS_H / CANVAS_W,
      theme: DEFAULT_THEME,
      elements: summaryElements,
      background: DEFAULT_BACKGROUND,
      type: 'content',
    };
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
      .map((fp) => `<span style="display:inline-block;background:#DBEAFE;color:#1E40AF;padding:4px 12px;border-radius:9999px;font-size:13px;margin:4px;font-family:Microsoft YaHei;">${escapeHtml(fp)}</span>`)
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

  const coverSlide: Slide = {
    id: createId('slide'),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    theme: DEFAULT_THEME,
    elements: coverElements,
    background: { type: 'solid', color: '#f0f9ff' },
    type: 'cover',
  };

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

  const endSlide: Slide = {
    id: createId('slide'),
    viewportSize: CANVAS_W,
    viewportRatio: CANVAS_H / CANVAS_W,
    theme: DEFAULT_THEME,
    elements: endElements,
    background: { type: 'solid', color: '#f0f9ff' },
    type: 'end',
  };

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
