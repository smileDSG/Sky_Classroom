/**
 * Slide Repairer — QA pass for AI-generated decks.
 *
 * Detects degenerate content slides (title with no substantive body — e.g. a
 * page that only contains a bare panel) and asks the LLM to regenerate just
 * that slide with real content. Slides that remain degenerate after the
 * retry budget are dropped: a shorter complete deck beats a broken page.
 */
import type { AICallFn } from '@/lib/generation/pipeline-types';
import type { GeneratedSlideData } from '@/lib/generation/pipeline-types';
import type { Slide, PPTTextElement } from '@/lib/types/slides';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import {
  assembleGeneratedSlide,
  buildSlideSystemPrompt,
  DIFFICULTY_LABELS,
} from './slide-generator';
import { createLogger } from '@/lib/logger';

const log = createLogger('SlideRepairer');

/** Minimum visible body text (CJK-aware length) for a healthy content slide. */
const MIN_CONTENT_LENGTH = 30;
const DEFAULT_MAX_REPAIRS = 4;
const DEFAULT_MAX_ATTEMPTS = 2;

export interface SlideRepairOptions {
  /** Deck-wide style directive (palette/typography), passed into the system prompt. */
  stylePrompt?: string;
  /** Cap on how many slides may be regenerated per deck (cost guard). */
  maxRepairs?: number;
  /** Attempts per slide before dropping it. */
  maxAttempts?: number;
}

export interface SlideRepairResult {
  slides: Slide[];
  /** Slides successfully regenerated with real content. */
  repaired: number;
  /** Slides dropped because they stayed degenerate after all attempts. */
  dropped: number;
}

/** CJK-aware visible text length of a slide (title included). */
export function slideTextLength(slide: Slide): number {
  let len = 0;
  for (const el of slide.elements) {
    if (el.type !== 'text') continue;
    const text = ((el as PPTTextElement).content || '').replace(/<[^>]*>/g, '');
    for (const ch of text.trim()) {
      len += /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/.test(ch) ? 1 : 0.55;
    }
  }
  return len;
}

/** Content slides whose visible text is below the health threshold. */
export function findDegenerateSlides(slides: Slide[]): number[] {
  return slides.reduce<number[]>((acc, slide, idx) => {
    if (slide.type === 'content' && slideTextLength(slide) < MIN_CONTENT_LENGTH) {
      acc.push(idx);
    }
    return acc;
  }, []);
}

export async function repairDegenerateSlides(
  topic: string,
  difficulty: 'junior' | 'senior' | 'college',
  slides: Slide[],
  aiCall: AICallFn,
  options: SlideRepairOptions = {},
): Promise<SlideRepairResult> {
  const {
    stylePrompt,
    maxRepairs = DEFAULT_MAX_REPAIRS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
  } = options;

  const degenerate = findDegenerateSlides(slides);
  if (degenerate.length === 0) {
    return { slides, repaired: 0, dropped: 0 };
  }

  const systemPrompt = buildSlideSystemPrompt({ topic, personaPrompt: stylePrompt });
  if (!systemPrompt) {
    log.warn('failed to build system prompt, skipping slide repair');
    return { slides, repaired: 0, dropped: 0 };
  }

  const targets = degenerate.slice(0, maxRepairs);
  if (degenerate.length > targets.length) {
    log.warn(
      `${degenerate.length} degenerate slides found, repairing only first ${targets.length} (maxRepairs)`,
    );
  }

  const outline = slides.map((s, idx) => {
    const title = firstText(s) || '(untitled)';
    const marker = targets.includes(idx) ? '   ← REGENERATE THIS ONE' : '';
    return `${idx + 1}. [${s.type}] ${title}${marker}`;
  });

  const result = [...slides];
  let repaired = 0;
  let dropped = 0;

  for (const idx of targets) {
    const broken = result[idx];
    const title = firstText(broken) || topic;
    let fixed: Slide | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const raw = await regenerateSlide(
          systemPrompt,
          topic,
          difficulty,
          outline,
          idx + 1,
          title,
          aiCall,
        );
        if (!raw) continue;
        const candidate = assembleGeneratedSlide(raw, 'content');
        if (slideTextLength(candidate) >= MIN_CONTENT_LENGTH) {
          fixed = candidate;
          break;
        }
        log.warn(`repair attempt ${attempt} for slide ${idx + 1} still degenerate, retrying`);
      } catch (err) {
        log.warn(
          `repair attempt ${attempt} for slide ${idx + 1} failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (fixed) {
      result[idx] = fixed;
      repaired++;
      log.info(`slide ${idx + 1} "${title}" regenerated successfully`);
    } else {
      result[idx] = null as unknown as Slide;
      dropped++;
      log.warn(
        `slide ${idx + 1} "${title}" still empty after ${maxAttempts} attempts — dropping page`,
      );
    }
  }

  return {
    slides: result.filter((s): s is Slide => s !== null),
    repaired,
    dropped,
  };
}

async function regenerateSlide(
  systemPrompt: string,
  topic: string,
  difficulty: 'junior' | 'senior' | 'college',
  outline: string[],
  slideNumber: number,
  title: string,
  aiCall: AICallFn,
): Promise<GeneratedSlideData | null> {
  const userPrompt = [
    `One slide in a nearly finished teaching deck has NO body content and must be regenerated.`,
    ``,
    `Topic: ${topic}`,
    `Difficulty Level: ${DIFFICULTY_LABELS[difficulty]}`,
    ``,
    `## Deck outline (slide order)`,
    outline.join('\n'),
    ``,
    `## Task`,
    `Regenerate ONLY slide ${slideNumber} (type: "content").`,
    `- Keep the slide title: "${title}"`,
    `- Fill the page with 4-6 substantive points that fit this slide's position in the outline — real facts, definitions, comparisons, or worked examples for the topic. No placeholder text.`,
    `- Follow ALL composition rules and the Teaching Style Directive in the system prompt (palette, typography, no naked panels, no divider lines).`,
    ``,
    `## Output Format`,
    `Output a valid JSON object with exactly ONE slide:`,
    `{ "slides": [ { "type": "content", "background": { "type": "solid", "color": "<accentLight hex>" }, "elements": [ ... ] } ] }`,
    `Canvas is 1000 x 562.5. All elements must respect margins and stay in-bounds.`,
    `Output pure JSON only — no markdown fences, no explanations.`,
  ].join('\n');

  const raw = await aiCall(systemPrompt, userPrompt);
  const parsed = parseJsonResponse<{ slides: GeneratedSlideData[] }>(raw);
  const slide = parsed?.slides?.[0];
  return slide ?? null;
}

function firstText(slide: Slide): string {
  for (const el of slide.elements) {
    if (el.type === 'text') {
      const text = ((el as PPTTextElement).content || '').replace(/<[^>]*>/g, '').trim();
      if (text) return text.slice(0, 40);
    }
  }
  return '';
}
