/**
 * Sky Classroom — Slide Generator (B-001)
 *
 * Generates a complete multi-slide deck from a teaching topic
 * in a single AI call, reusing the existing slide-content.md prompt template.
 */
import { nanoid } from 'nanoid';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import type { GeneratedSlideData } from '@/lib/generation/pipeline-types';
import type { Slide, SlideTheme, PPTElement, PPTTextElement } from '@/lib/types/slides';
import type { SlideGenerationOptions, SlideGenerationResult } from '@/lib/slides/types';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { buildLanguageText } from '@/lib/generation/prompt-formatters';
import { fixElementDefaults, processLatexElements } from '@/lib/generation/element-fixer';
import { createLogger } from '@/lib/logger';

const log = createLogger('SlideGenerator');

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_SLIDE_COUNTS: Record<string, number> = {
  junior: 12,
  senior: 16,
  college: 20,
};

const DIFFICULTY_GUIDANCE: Record<string, string> = {
  junior:
    'Target audience: junior high school students. Use simple concepts, basic terminology, and intuitive examples. Cover the topic comprehensively — include definitions, worked examples, real-life applications, common mistakes, and practice problems.',
  senior:
    'Target audience: senior high school students. Use moderate depth, standard academic terminology, and clear explanations. Go deep into each sub-topic: theory foundations, derivations, multiple worked examples, edge cases, real-world applications, and exam-style problems.',
  college:
    'Target audience: university/college students. Use deeper analysis, advanced terminology, and theoretical frameworks. Provide thorough coverage: formal definitions, derivations, proofs, comparative analysis, research connections, and challenging problems.',
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

  const { difficulty, slideCount, language, personaPrompt } = options;
  const difficultyLevel = difficulty ?? 'senior';
  const count = slideCount ?? DEFAULT_SLIDE_COUNTS[difficultyLevel] ?? 8;
  const guidance = DIFFICULTY_GUIDANCE[difficultyLevel] ?? DIFFICULTY_GUIDANCE.senior;
  const label = DIFFICULTY_LABELS[difficultyLevel] ?? 'Senior High (高中)';

  // ── Build system prompt from existing template ──
  const languageDirective = buildLanguageText(language);

  // Inject persona (teaching style) into the teacher context
  const teacherContext = personaPrompt
    ? `\n## Teaching Style Directive (CRITICAL)\n${personaPrompt}\n\nEvery slide title and body text MUST follow this style throughout the entire deck.`
    : '';

  const prompts = buildPrompt(PROMPT_IDS.SLIDE_CONTENT_V2, {
    title: 'Topic Overview',
    description: topic,
    keyPoints: 'See user prompt for deck structure requirements.',
    canvas_width: 1000,
    canvas_height: 562.5,
    teacherContext,
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

  // ── Assemble Slide objects ─
  const slides: Slide[] = parsed.slides.map((raw, index) => {
    const slideType = inferSlideType(index, parsed.slides.length, raw);

    const fixedElements = fixElementDefaults(raw.elements ?? []);
    const processedElements = processLatexElements(fixedElements);

    let elements: PPTElement[] = processedElements.map((el) => ({
      ...el,
      id: `${el.type}_${nanoid(8)}`,
      left: el.left ?? 60,
      top: el.top ?? 60,
      width: el.width ?? 400,
      height: el.height ?? 100,
      rotate: 0,
    })) as PPTElement[];

    // Clamp all elements to stay within canvas bounds
    elements = clampElementBounds(elements);

    // Center the title on cover slides (horizontally and vertically)
    if (index === 0) {
      elements = centerCoverTitle(elements);
    }

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
  const bodyCount = Math.max(0, bodySlides);
  const subjectHint = inferSubjectHint(topic);

  // Build per-slide structure hints for body slides
  const slideAssignments = buildSlideAssignments(count, topic);

  const bodyLines = slideAssignments.length > 0
    ? slideAssignments.map((s) => `  - ${s}`).join('\n')
    : `- Slides 2 to ${count - 1}: Content slides (type: "content") — each covering a distinct sub-topic or aspect`;

  return [
    `Generate a complete slide deck on the following topic.`,
    ``,
    `Topic: ${topic}`,
    `Difficulty Level: ${label}`,
    guidance,
    `Number of slides: ${count} (includes cover + ${bodyCount} content + end)`,
    subjectHint,
    ``,
    languageDirective ? `${languageDirective}` : '',
    ``,
    `## Content Structure`,
    `Plan the body slides with variety, depth, and progression:`,
    `- Each slide covers ONE main idea or sub-topic — explain it thoroughly with definition, explanation, and examples`,
    `- For longer decks (10+ slides), each major sub-topic gets 2-3 slides (theory → examples → applications)`,
    `- Middle slides must mix layouts — don't repeat the same pattern on consecutive slides`,
    `- At least 2-3 slides should use a side-by-side layout (theory+example, comparison, or diagram+caption)`,
    `- For math/science topics: use LaTeX formulas on multiple slides, not just one
- Do NOT add thin divider lines or horizontal bar shapes under titles — use whitespace spacing instead`,
    `- For humanities topics: include comparison slides, timeline layouts, and multiple perspectives`,
    `- Progression: introduction → definitions → detailed breakdowns → worked examples → applications → connections → common mistakes → summary`,
    ``,
    `## Content Depth (CRITICAL)`,
    `- 1 main idea per slide, but explain it thoroughly — definition + explanation + example where possible`,
    `- Each bullet point ≤ 20 words (≤ 30 Chinese characters) for the main point; add a sub-line for detail`,
    `- Title ≤ 10 words — titles are signposts, not explanations`,
    `- Aim for 4-6 substantive points per content slide with supporting details`,
    `- Every formula should have a concrete numeric example alongside it`,
    `- Every abstract concept should be followed by a real-world application`,
    `- Do NOT make slides too sparse: each content slide should feel informative and complete`,
    ``,
    `## Deck Structure`,
    `- Slide 1: Cover slide (type: "cover") — eye-catching title, subtitle with topic overview. Do NOT add divider lines, shapes, or any decorative bars on the cover — keep it clean with only title and subtitle text.`,
    bodyLines,
    `- Slide ${count}: End slide (type: "end") — summary, key takeaways, or thank-you. Keep it clean — no divider lines or decorative shapes.`,
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
    `CRITICAL — Bottom margin: ensure top + height ≤ 562 for EVERY element. If a text element would extend past the bottom, reduce its height or move it up.`,
    `CRITICAL — Right margin: ensure left + width ≤ 1000 for EVERY element.`,
    `Default to Simple Layout Mode for text-heavy slides; use complex layouts for comparisons and diagrams.`,
    `Output pure JSON only — no markdown fences, no explanations.`,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

// ── Subject inference ──────────────────────────────────────────────────

const SUBJECT_PATTERNS: Array<{ pattern: RegExp; hint: string }> = [
  {
    pattern: /数学|代数|几何|三角|函数|方程|微积分|概率|统计|数列|向量|math|algebra|calculus/i,
    hint: 'This is a MATH topic. Emphasize formulas (use LatexElement), worked examples, and derivations. Pair theory with concrete numeric examples side by side.',
  },
  {
    pattern: /物理|力学|电|磁|光|热|量子|相对论|physics|force|energy|wave/i,
    hint: 'This is a PHYSICS topic. Use LaTeX formulas for equations, show real-world applications, and include diagrams where helpful.',
  },
  {
    pattern: /化学|元素|反应|分子|原子|chemistry|reaction|molecule|bond/i,
    hint: 'This is a CHEMISTRY topic. Use LaTeX for chemical equations, comparison layouts for reaction types, and structured tables for properties.',
  },
  {
    pattern: /生物|细胞|基因|DNA|遗传|生态|进化|biology|cell|gene|evolution/i,
    hint: 'This is a BIOLOGY topic. Use comparison layouts (e.g. mitosis vs meiosis), structured lists for processes, and diagrams where appropriate.',
  },
  {
    pattern: /历史|朝代|战争|革命|文明|history|war|revolution|civilization/i,
    hint: 'This is a HISTORY topic. Use timeline-style layouts, comparison slides for causes vs effects, and side-by-side layouts for contrasting perspectives.',
  },
  {
    pattern: /地理|气候|地形|人口|经济|geography|climate|population/i,
    hint: 'This is a GEOGRAPHY topic. Use comparison layouts, data presentation with tables, and structured breakdowns of regional characteristics.',
  },
  {
    pattern: /语文|文学|诗歌|散文|小说|诗词|古文|论语|literature|poem|poetry|novel/i,
    hint: 'This is a LITERATURE topic. Use structured analysis layouts, quote+citation pairings, comparison slides for themes/characters, and timeline-style progressions.',
  },
];

function inferSubjectHint(topic: string): string {
  for (const { pattern, hint } of SUBJECT_PATTERNS) {
    if (pattern.test(topic)) {
      return `\n## Subject Guidance\n${hint}`;
    }
  }
  return `\n## Subject Guidance\nGeneral academic topic. Use Simple Layout Mode for definition slides, and side-by-side layouts for examples and applications.`;
}

function buildSlideAssignments(count: number, topic: string): string[] {
  const bodyCount = count - 2;
  if (bodyCount <= 0) return [];

  const assignments: string[] = [];

  const isMath = /数学|代数|几何|函数|方程|微积分|math|algebra|calculus/i.test(topic);
  const isHistory = /历史|朝代|history/i.test(topic);
  const isScience = /物理|化学|生物|physics|chemistry|biology/i.test(topic);

  if (isMath) {
    assignments.push('Slide 2: Topic introduction + core definitions (Simple Layout)');
    assignments.push('Slide 3: Key formula with LaTeX (use LatexElement, side-by-side with explanation)');
    if (bodyCount >= 3) assignments.push('Slide 4: Worked example 1 — basic calculation (step-by-step with LaTeX)');
    if (bodyCount >= 4) assignments.push('Slide 5: Worked example 2 — real-world application (side-by-side: problem + solution)');
    if (bodyCount >= 5) assignments.push('Slide 6: Common mistakes and misconceptions (comparison layout: right vs wrong)');
    if (bodyCount >= 6) assignments.push('Slide 7: Advanced variation or edge case');
    // Fill remaining
    for (let i = assignments.length + 2; i < count - 1; i++) {
      const types = ['Additional worked example', 'Visual proof or geometric interpretation', 'Practice problem with hints', 'Connection to related topics', 'Historical context or discovery story'];
      assignments.push(`Slide ${i}: ${types[(i - assignments.length - 2) % types.length]} (vary layout)`);
    }
  } else if (isHistory) {
    assignments.push('Slide 2: Historical background + context (Simple Layout)');
    assignments.push('Slide 3: Key timeline of major events (structured list with dates)');
    if (bodyCount >= 3) assignments.push('Slide 4: Deep dive — event 1 (cause, course, consequence)');
    if (bodyCount >= 4) assignments.push('Slide 5: Deep dive — event 2 (cause, course, consequence)');
    if (bodyCount >= 5) assignments.push('Slide 6: Key figures and their roles (side-by-side comparison)');
    if (bodyCount >= 6) assignments.push('Slide 7: Causes vs effects analysis (comparison layout)');
    if (bodyCount >= 7) assignments.push('Slide 8: Different historical perspectives or interpretations');
    for (let i = assignments.length + 2; i < count - 1; i++) {
      const types = ['Long-term impact and legacy', 'Primary source analysis', 'Connection to modern parallels', 'Regional variations'];
      assignments.push(`Slide ${i}: ${types[(i - assignments.length - 2) % types.length]} (vary layout)`);
    }
  } else if (isScience) {
    assignments.push('Slide 2: Core concept introduction + definition (Simple Layout)');
    assignments.push('Slide 3: Key principles and mechanisms (step-by-step, use LaTeX for formulas)');
    if (bodyCount >= 3) assignments.push('Slide 4: Detailed breakdown — component 1');
    if (bodyCount >= 4) assignments.push('Slide 5: Detailed breakdown — component 2');
    if (bodyCount >= 5) assignments.push('Slide 6: Real-world example 1 (side-by-side: theory + application)');
    if (bodyCount >= 6) assignments.push('Slide 7: Real-world example 2 or case study');
    if (bodyCount >= 7) assignments.push('Slide 8: Comparison with related concepts (comparison layout)');
    for (let i = assignments.length + 2; i < count - 1; i++) {
      const types = ['Experimental evidence or data', 'Common misconceptions', 'Practical applications', 'Frontier research or future directions'];
      assignments.push(`Slide ${i}: ${types[(i - assignments.length - 2) % types.length]} (vary layout)`);
    }
  } else {
    assignments.push('Slide 2: Topic introduction + overview (Simple Layout)');
    assignments.push('Slide 3: Core concept 1 — definition and explanation');
    if (bodyCount >= 3) assignments.push('Slide 4: Core concept 2 — detailed breakdown');
    if (bodyCount >= 4) assignments.push('Slide 5: Key example or case study (side-by-side layout)');
    if (bodyCount >= 5) assignments.push('Slide 6: Practical applications or real-world relevance');
    if (bodyCount >= 6) assignments.push('Slide 7: Comparison or contrasting perspectives');
    for (let i = assignments.length + 2; i < count - 1; i++) {
      const types = ['Deeper analysis of a sub-topic', 'Additional example or case study', 'Common questions and answers', 'Summary of key points so far'];
      assignments.push(`Slide ${i}: ${types[(i - assignments.length - 2) % types.length]} (vary layout)`);
    }
  }

  return assignments;
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

const CANVAS_W = 1000;
const CANVAS_H = 562.5;
const COVER_TEXT_GAP = 35; // vertical gap between stacked text elements on cover
const MARGIN = 50; // minimum margin from canvas edges

function clampElementBounds(elements: PPTElement[]): PPTElement[] {
  return elements.map((el) => {
    const left = Math.max(0, el.left);
    const top = Math.max(0, el.top);
    const right = left + el.width;
    const width = right > CANVAS_W ? CANVAS_W - left : el.width;

    // Lines don't have a height property — their extent is defined by start/end points
    if (el.type === 'line') {
      if (left !== el.left || top !== el.top || width !== el.width) {
        log.info(
          `[clampElementBounds] line[${el.id?.slice(0, 8)}]: pos=(${el.left},${el.top})→(${left},${top}), width=${el.width}→${width}`,
        );
      }
      return { ...el, left, top, width } as PPTElement;
    }

    const bottom = top + el.height;
    const height = bottom > CANVAS_H ? CANVAS_H - top : el.height;

    if (left !== el.left || top !== el.top || width !== el.width || height !== el.height) {
      log.info(
        `[clampElementBounds] ${el.type}[${el.id?.slice(0, 8)}]: pos=(${el.left},${el.top})→(${left},${top}), size=${el.width}x${el.height}→${width}x${height}`,
      );
    }

    return { ...el, left, top, width, height } as PPTElement;
  });
}

function centerCoverTitle(elements: PPTElement[]): PPTElement[] {
  // Collect all text elements with their indices and sizes
  const textInfos: { idx: number; el: PPTTextElement; area: number }[] = [];
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.type === 'text') {
      const textEl = el as PPTTextElement;
      textInfos.push({ idx: i, el: textEl, area: textEl.width * textEl.height });
    }
  }

  if (textInfos.length === 0) {
    log.warn('[centerCoverTitle] No text elements found');
    return elements;
  }

  // Sort by area descending so the largest text (title) is first
  textInfos.sort((a, b) => b.area - a.area);

  // Calculate total stack height and center the whole block vertically
  const totalStackHeight =
    textInfos.reduce((sum, t) => sum + t.el.height, 0) +
    COVER_TEXT_GAP * (textInfos.length - 1);

  const startY = (CANVAS_H - totalStackHeight) / 2;

  const result = [...elements];
  let cursorY = startY;

  for (const { idx, el } of textInfos) {
    const centerX = (CANVAS_W - el.width) / 2;
    log.info(
      `[centerCoverTitle] text[${idx}] old=(${el.left}, ${el.top}) new=(${centerX.toFixed(1)}, ${cursorY.toFixed(1)}) size=${el.width}x${el.height}`,
    );
    result[idx] = { ...el, left: centerX, top: cursorY };
    cursorY += el.height + COVER_TEXT_GAP;
  }

  return result;
}
