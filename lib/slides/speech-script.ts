/**
 * Sky Classroom — Speech Script Builder (B-002)
 *
 * Turns slide content into structured narration scripts with
 * per-sentence element highlighting markers for the avatar.
 */
import type { Slide, PPTElement } from '@/lib/types/slides';

// ── Types ──────────────────────────────────────────────────────────────

export interface SpeechSegment {
  /** Narration text for this segment */
  text: string;
  /** Element ID to highlight during this segment (or null) */
  highlightElementId: string | null;
  /** Index of the slide this segment belongs to */
  slideIndex: number;
}

export interface SlideScript {
  slideIndex: number;
  slideId: string;
  segments: SpeechSegment[];
}

// ── Helpers ────────────────────────────────────────────────────────────

const HTML_TAG_RE = /<[^>]*>/g;
const PUNCT_ONLY_RE = /^[。！？!?.,，、；;：:]+$/;

function stripHtml(html: string): string {
  return html.replace(HTML_TAG_RE, '').trim();
}

function splitToSentences(text: string): string[] {
  return text
    .replace(/\n+/g, ' ')
    .split(/(?<=[。！？!?])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !PUNCT_ONLY_RE.test(s));
}

// ── Element → narration ───────────────────────────────────────────────

function elementToSpeech(
  el: PPTElement,
  slideIndex: number,
): SpeechSegment[] {
  const segments: SpeechSegment[] = [];

  switch (el.type) {
    case 'text': {
      const textContent = stripHtml(el.content);
      if (!textContent) break;
      const sentences = splitToSentences(textContent);
      // First sentence highlights the element, rest follow without highlight
      for (let i = 0; i < sentences.length; i++) {
        segments.push({
          text: sentences[i],
          highlightElementId: i === 0 ? el.id : null,
          slideIndex,
        });
      }
      break;
    }
    case 'latex': {
      const latexEl = el as { latex?: string };
      if (!latexEl.latex?.trim()) break;
      // Read the formula aloud — don't speak raw LaTeX
      const spoken = formulaToSpeech(latexEl.latex.trim());
      segments.push({
        text: spoken,
        highlightElementId: el.id,
        slideIndex,
      });
      break;
    }
    case 'shape': {
      const shapeEl = el as { text?: { content: string } };
      if (!shapeEl.text?.content?.trim()) break;
      const textContent = stripHtml(shapeEl.text.content);
      const sentences = splitToSentences(textContent);
      for (let i = 0; i < sentences.length; i++) {
        segments.push({
          text: sentences[i],
          highlightElementId: i === 0 ? el.id : null,
          slideIndex,
        });
      }
      break;
    }
    case 'table': {
      const tableEl = el as { data?: { text: string }[][] };
      if (!tableEl.data) break;
      const texts: string[] = [];
      for (const row of tableEl.data) {
        for (const cell of row) {
          if (cell.text?.trim()) texts.push(cell.text.trim());
        }
      }
      if (texts.length > 0) {
        segments.push({
          text: texts.join('，'),
          highlightElementId: el.id,
          slideIndex,
        });
      }
      break;
    }
    case 'code': {
      const codeEl = el as { lines?: { content: string }[] };
      if (!codeEl.lines?.length) break;
      const codeText = codeEl.lines.map((l) => l.content).join('\n');
      segments.push({
        text: `请看这段代码：${codeText.substring(0, 200)}`,
        highlightElementId: el.id,
        slideIndex,
      });
      break;
    }
  }

  return segments;
}

// ── LaTeX → spoken Chinese ────────────────────────────────────────────

function formulaToSpeech(latex: string): string {
  return latex
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1除以$2')
    .replace(/\\sqrt\{([^}]+)\}/g, '根号下$1')
    .replace(/\\pm/g, '正负')
    .replace(/\\cdot/g, '乘以')
    .replace(/\\times/g, '乘')
    .replace(/\\div/g, '除以')
    .replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, '从$1到$2求和')
    .replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, '从$1到$2积分')
    .replace(/\\lim_\{([^}]+)\}/g, '$1趋近时的极限')
    .replace(/\\infty/g, '无穷')
    .replace(/\\rightarrow/g, '趋近于')
    .replace(/\\left|\\right|\\big|\\Big/g, '')
    .replace(/[\\{}]/g, '')
    .replace(/\^\{([^}]+)\}/g, '的$1次方')
    .replace(/_\{([^}]+)\}/g, '下标$1')
    .replace(/\^(\w)/g, '的$1次方')
    .replace(/_(\w)/g, '下标$1')
    .replace(/\\alpha/g, '阿尔法')
    .replace(/\\beta/g, '贝塔')
    .replace(/\\theta/g, '西塔')
    .replace(/\\pi/g, '派')
    .replace(/\\delta/g, '德尔塔')
    .replace(/\\Delta/g, '德尔塔')
    .replace(/\\sum/g, '求和')
    .replace(/\\int/g, '积分')
    .replace(/\\log/g, '对数')
    .replace(/\\sin/g, '正弦')
    .replace(/\\cos/g, '余弦')
    .replace(/\\tan/g, '正切')
    .trim();
}

// ── Slide → script ─────────────────────────────────────────────────────

export function buildSlideScript(
  slide: Slide,
  slideIndex: number,
): SlideScript {
  const allSegments: SpeechSegment[] = [];

  // Process elements in order: title-like text first, then body, then others
  const elements = [...(slide.elements || [])];

  // Separate title-like elements (large font, early position) from body
  const titleElements = elements.filter((el) => {
    if (el.type !== 'text') return false;
    const textEl = el as { content?: string };
    const content = textEl.content ?? '';
    return content.includes('font-size: 32px') || content.includes('font-size: 36px');
  });
  const bodyElements = elements.filter((el) => !titleElements.includes(el));

  // Add opening transition for non-cover slides
  if (slideIndex > 0) {
    const typeLabel = slide.type === 'end' ? '最后是总结' : '接下来看';
    allSegments.push({
      text: `${typeLabel}第${slideIndex + 1}页`,
      highlightElementId: null,
      slideIndex,
    });
  }

  // Title segments
  for (const el of titleElements) {
    allSegments.push(...elementToSpeech(el, slideIndex));
  }

  // Body segments
  for (const el of bodyElements) {
    allSegments.push(...elementToSpeech(el, slideIndex));
  }

  return {
    slideIndex,
    slideId: slide.id,
    segments: allSegments,
  };
}

export function buildFullScript(slides: Slide[]): SlideScript[] {
  return slides.map((slide, i) => buildSlideScript(slide, i));
}
