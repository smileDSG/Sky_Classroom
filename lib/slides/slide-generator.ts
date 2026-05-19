/**
 * Sky Classroom — Slide Generator (B-001)
 *
 * Generates a complete multi-slide deck from a teaching topic
 * in a single AI call, reusing the existing slide-content.md prompt template.
 */
import { nanoid } from 'nanoid';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import type { GeneratedSlideData } from '@/lib/generation/pipeline-types';
import type { Slide, SlideTheme, PPTElement } from '@/lib/types/slides';
import type { SlideGenerationOptions, SlideGenerationResult } from '@/lib/slides/types';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { buildLanguageText } from '@/lib/generation/prompt-formatters';
import { fixElementDefaults, processLatexElements } from '@/lib/generation/element-fixer';
import { createLogger } from '@/lib/logger';

const log = createLogger('SlideGenerator');

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_SLIDE_COUNTS: Record<string, number> = {
  junior: 6,
  senior: 8,
  college: 12,
};

const DIFFICULTY_GUIDANCE: Record<string, string> = {
  junior:
    'Target audience: junior high school students. Use simple concepts, basic terminology, and intuitive examples.',
  senior:
    'Target audience: senior high school students. Use moderate depth, standard academic terminology, and clear explanations.',
  college:
    'Target audience: university/college students. Use deeper analysis, advanced terminology, and theoretical frameworks.',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  junior: 'Junior High (初中)',
  senior: 'Senior High (高中)',
  college: 'College (大学)',
};

const DEFAULT_THEME: SlideTheme = {
  backgroundColor: '#ffffff',
  themeColors: ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4'],
  fontColor: '#333333',
  fontName: 'Microsoft YaHei',
  outline: { color: '#d14424', width: 2, style: 'solid' },
  shadow: { h: 0, v: 0, blur: 10, color: '#000000' },
};

// ── Public API ───────────────────────────────────────────────────────

export async function generateSlides(
  topic: string,
  options: SlideGenerationOptions,
  aiCall: AICallFn,
): Promise<SlideGenerationResult> {
  const startTime = Date.now();

  const { difficulty, slideCount, language } = options;
  const difficultyLevel = difficulty ?? 'senior';
  const count = slideCount ?? DEFAULT_SLIDE_COUNTS[difficultyLevel] ?? 8;
  const guidance = DIFFICULTY_GUIDANCE[difficultyLevel] ?? DIFFICULTY_GUIDANCE.senior;
  const label = DIFFICULTY_LABELS[difficultyLevel] ?? 'Senior High (高中)';

  // ── Build system prompt from existing template ──
  const languageDirective = buildLanguageText(language);

  const prompts = buildPrompt(PROMPT_IDS.SLIDE_CONTENT_V2, {
    title: 'Topic Overview',
    description: topic,
    keyPoints: 'See user prompt for deck structure requirements.',
    canvas_width: 1000,
    canvas_height: 562.5,
    teacherContext: '',
    languageDirective: languageDirective || '',
    assignedImages: 'No images available',
    elements: '(auto-generated from key points)',
    imageElementEnabled: false,
    generatedImageEnabled: false,
    generatedVideoEnabled: false,
    mediaElementEnabled: false,
  });

  if (!prompts) {
    log.error('Failed to build prompt for topic:', topic);
    return { slides: [], generationTime: Date.now() - startTime };
  }

  // ── Build user prompt for multi-slide deck ──
  const userPrompt = buildUserPrompt(topic, count, label, guidance, languageDirective);

  // ── AI call ──
  log.info(`Generating ${count} slides for topic: "${topic}" (${label})`);
  const rawResponse = await aiCall(prompts.system, userPrompt);

  // ── Parse ──
  const parsed = parseJsonResponse<{ slides: GeneratedSlideData[] }>(rawResponse);

  if (!parsed || !Array.isArray(parsed.slides)) {
    log.error('Failed to parse slide array from AI response');
    return { slides: [], generationTime: Date.now() - startTime };
  }

  if (parsed.slides.length === 0) {
    log.warn('AI returned empty slides array for topic:', topic);
    return { slides: [], generationTime: Date.now() - startTime };
  }

  // ── Assemble Slide objects ──
  const slides: Slide[] = parsed.slides.map((raw, index) => {
    const slideType = inferSlideType(index, parsed.slides.length, raw);

    const fixedElements = fixElementDefaults(raw.elements ?? []);
    const processedElements = processLatexElements(fixedElements);

    const elements: PPTElement[] = processedElements.map((el) => ({
      ...el,
      id: `${el.type}_${nanoid(8)}`,
      rotate: 0,
    })) as PPTElement[];

    const background = buildSlideBackground(raw.background);

    return {
      id: nanoid(),
      viewportSize: 1000,
      viewportRatio: 0.5625,
      theme: DEFAULT_THEME,
      elements,
      background,
      type: slideType,
    };
  });

  const elapsed = Date.now() - startTime;
  log.info(`Generated ${slides.length} slides for "${topic}" in ${elapsed}ms`);

  return { slides, generationTime: elapsed };
}

// ── Helpers ──────────────────────────────────────────────────────────

function buildUserPrompt(
  topic: string,
  count: number,
  label: string,
  guidance: string,
  languageDirective?: string,
): string {
  const bodySlides = count - 2;
  const bodyLines = bodySlides > 0
    ? `- Slides 2 to ${count - 1}: Content slides (type: "content") — each covering a distinct sub-topic or aspect`
    : '';

  return [
    `Generate a complete slide deck on the following topic.`,
    ``,
    `Topic: ${topic}`,
    `Difficulty Level: ${label}`,
    guidance,
    `Number of slides: ${count}`,
    ``,
    languageDirective ? `${languageDirective}` : '',
    ``,
    `## Deck Structure`,
    `- Slide 1: Cover slide (type: "cover") — eye-catching title, subtitle with topic overview`,
    bodyLines,
    `- Slide ${count}: End slide (type: "end") — summary, key takeaways, or thank-you`,
    ``,
    `## Output Format`,
    `Output a valid JSON object with a "slides" array:`,
    `{`,
    `  "slides": [`,
    `    { "type": "cover", "background": {...}, "elements": [...] },`,
    `    { "type": "content", "background": {...}, "elements": [...] },`,
    `    ...`,
    `    { "type": "end", "background": {...}, "elements": [...] }`,
    `  ]`,
    `}`,
    ``,
    `Each element in "elements" must follow the element type schemas in the system prompt.`,
    `Each slide must respect the canvas dimensions (1000 x 562.5).`,
    `All TextElement heights must come from the lookup table in the system prompt.`,
    `Default to Simple Layout Mode for all content slides.`,
    `Output pure JSON only — no markdown fences, no explanations.`,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

function inferSlideType(
  index: number,
  total: number,
  raw: GeneratedSlideData,
): Slide['type'] {
  if ((raw as unknown as Record<string, unknown>).type) {
    const t = (raw as unknown as Record<string, unknown>).type as string;
    if (t === 'cover' || t === 'content' || t === 'end') return t;
  }
  if (index === 0) return 'cover';
  if (index === total - 1) return 'end';
  return 'content';
}

function buildSlideBackground(
  raw: GeneratedSlideData['background'],
): Slide['background'] {
  if (!raw) return undefined;
  if (raw.type === 'solid' && raw.color) {
    return { type: 'solid', color: raw.color };
  }
  if (raw.type === 'gradient' && raw.gradient) {
    return { type: 'gradient', gradient: raw.gradient };
  }
  return undefined;
}
