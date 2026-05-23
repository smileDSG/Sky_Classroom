/**
 * POST /api/sky/slides/generate
 * Slide generation endpoint.
 *
 * Two modes:
 * - Template mode (useTemplates=true, default): AI selects templates + fills text. Fast.
 * - Legacy mode (useTemplates=false): AI generates full slide JSON from scratch. Slow.
 */
import { NextRequest } from 'next/server';
import { callLLM } from '@/lib/ai/llm';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';

export const maxDuration = 300;
import { generateSlides, getAvatarById, getTheme } from '@/lib/slides';
import { assembleSlides, getAllTemplateDescriptors } from '@/lib/slides/slide-templates';
import { assembleSlidesV2, getAllTemplateDescriptorsV2 } from '@/lib/slides/slide-templates-v2';
import type { TemplateSlot } from '@/lib/slides/slide-templates';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import type { PptxThemeId } from '@/lib/slides/types';
import type { LanguageModel } from 'ai';
import type { ModelInfo } from '@/lib/types/provider';

const log = createLogger('API:SkySlidesGenerate');

function buildTemplatePrompt(topic: string, slideCount: number, personaPrompt?: string, themeId?: string): { system: string; user: string } {
  const templates = getAllTemplateDescriptorsV2();
  const coverList = templates.filter((t) => t.category === 'cover').map((t) => `- ${t.id}: ${t.name} — ${t.description}\n  视觉: ${t.visualHint}\n  params: ${t.requiredParams.join(', ')}`).join('\n');
  const contentList = templates.filter((t) => t.category === 'content').map((t) => `- ${t.id}: ${t.name} — ${t.description}\n  视觉: ${t.visualHint}\n  params: ${t.requiredParams.join(', ')}`).join('\n');
  const endList = templates.filter((t) => t.category === 'end').map((t) => `- ${t.id}: ${t.name} — ${t.description}\n  视觉: ${t.visualHint}\n  params: ${t.requiredParams.join(', ')}`).join('\n');

  const personaBlock = personaPrompt
    ? `\n## Teaching Style\n${personaPrompt}\nFollow this style when writing ALL text content (titles, body text, bullets, etc.).`
    : '';

  const theme = themeId ? getTheme(themeId as PptxThemeId) : getTheme('sky-blue');
  const themeBlock = theme
    ? `\n## Visual Design Rules (MUST FOLLOW)\n- Cover title font size: ${theme.coverTitleSize}px, color: ${theme.coverTitleColor}, bold, centered or left-aligned per template\n- Cover subtitle font size: ${theme.coverSubSize}px, color: ${theme.coverSubColor}\n- Content title font size: ${theme.titleFontSize}px, color: ${theme.bodyColor}, bold, left-aligned\n- Body text font size: ${theme.bodyFontSize}px, color: ${theme.bodyColor}, line-height: 1.5\n- Bullet points font size: ${theme.bulletSize}px, with ${theme.bulletStyle} markers\n- Use ${theme.fontFamily} for all Chinese text, ${theme.headingFont} for English headings\n- Page margins: ${theme.pageMargin}px on all sides\n- Content max width: ${theme.contentMaxWidth}px\n- Divider lines use color: ${theme.dividerColor}\n- Accent color for highlights: ${theme.accent}\n- Cover background: ${theme.coverBg}${theme.coverBgGradient ? ` (gradient: ${theme.coverBgGradient.from} → ${theme.coverBgGradient.to})` : ''}\n- Content background: ${theme.contentBg}`
    : '';

  const system = `You are an expert educational courseware designer. Your task is to generate a complete classroom lesson slide deck that follows proven pedagogical structure.

## Pedagogical Flow (MUST FOLLOW)
Generate exactly ${slideCount} slides in this teaching order. Every slide MUST include a "pageRole" field.

1.  pageRole: "cover"         → 课程封面 (1页)
2.  pageRole: "toc"           → 目录页：本节课的知识结构 (1页)
3.  pageRole: "objectives"    → 学习目标：3-4个学生可达成的目标 (1页)
4.  pageRole: "introduction"  → 引入：用问题/故事/案例引入主题 (1页)
5.  pageRole: "concept"       → 概念讲解：核心概念定义+解释 (1-2页)
6.  pageRole: "comparison"    → 对比辨析：易混淆概念对比 (0-1页，如需要)
7.  pageRole: "example"       → 例题/案例：具体例子帮助理解 (1页)
8.  pageRole: "concept"       → 深化概念：进阶或扩展内容 (0-1页)
9.  pageRole: "quiz"          → 课堂练习：1道选择题检验理解 (1页)
10. pageRole: "summary"       → 总结：知识点框架回顾 (1页)
11. pageRole: "end"           → 结束：作业布置+下节预告 (1页)

Total: ${slideCount} slides. Adjust the number of "concept" pages to fit exactly ${slideCount} slides.

## PageRole → Recommended Templates
Use these recommendations to pick the right template for each pedagogical role:

- cover:        cover-classic / cover-modern / cover-gradient
- toc:          content-toc (REQUIRED for toc role) / content-bullets
- objectives:   content-objectives (REQUIRED for objectives role) / content-bullets
- introduction: content-highlight / content-big-idea / content-image / content-split-highlight
- concept:      content-title-body / content-bullets / content-steps / content-formula / content-diagram / content-process-h / content-infographic-3
- comparison:   content-two-col / content-pros-cons / content-venn / content-table
- example:      content-steps / content-process-h / content-title-body / content-image / content-grid2x2
- quiz:         content-quiz (REQUIRED for quiz role)
- summary:      content-big-idea / content-diagram / content-pyramid / content-bullets / content-stats
- end:          end-summary / end-qa / end-thanks

## Template Selection Rules by Topic Type
- For math/science topics, concept pages MUST include at least 1 "content-formula"
- For humanities topics, use "content-quote" or "content-bullets" for concept pages
- For history topics, use "content-timeline" for concept/example pages
- For debate/comparison topics, use "content-pros-cons" or "content-venn"
- For programming topics, use "content-code" for concept/example pages
- For data/statistics topics, use "content-stats" or "content-bar-chart" or "content-pie-chart"
- For trend/time-series topics, use "content-line-chart" or "content-timeline"
- For three-element/three-step topics, use "content-infographic-3"
- For process/sequence topics, use "content-process-h" or "content-steps"
- For hierarchy/priority topics, use "content-pyramid"
- For emphasizing a single key concept, use "content-highlight" or "content-split-highlight"
- For concept relationships, use "content-diagram"
- For artistic/soft-tone topics, use "content-gradient-cards" or "content-macaron-bullets"
- Vary templates across slides — don't repeat the same template on consecutive slides
- "content-steps" max 3-4 steps, "content-grid2x2" exactly 4 grid items, "content-process-h" max 4 steps

## Content Quality Rules
- All text content must be in Simplified Chinese
- CRITICAL: Every "params" field listed in "requiredParams" MUST be filled with substantive content. Never leave any field empty or as "undefined".
- CRITICAL: Content must be DETAILED and SUBSTANTIAL. Each slide should have 3-5 key points minimum.
  - Titles: 6-12 words, descriptive and engaging
  - Bullet points: 15-40 words EACH — include explanation, not just keywords. For example, instead of "定义：分数表示部分", write "分数的定义：将一个整体平均分成若干份，取其中的一份或几份，就可以用分数来表示。"
  - Body text (bodyText/subtitle): at least 2-3 sentences with concrete details
  - Example pages: show step-by-step reasoning, not just the final answer
  - Concept pages: define + explain + give 1 concrete example
- Concept pages should explain ideas clearly for students, not just list facts.
- Example pages should use concrete, relatable scenarios (e.g., "垃圾邮件识别", "房价预测", "推荐系统"). Show the complete reasoning process.
- Quiz questions should be thought-provoking, not trivial. Include 4 options with 1 correct answer and a brief explanation of why.
- Summary pages should synthesize key takeaways with 4-6 detailed points, not just repeat bullet points.${personaBlock}${themeBlock}

## Output Format
Output pure JSON only (no markdown fences):
{
  "slots": [
    { "template": "cover-classic", "pageRole": "cover", "params": { "title": "...", "subtitle": "..." } },
    { "template": "content-toc", "pageRole": "toc", "params": { "title": "本节课内容", "sections": [{"title":"..."}, ...] } },
    { "template": "content-objectives", "pageRole": "objectives", "params": { "title": "学习目标", "objectives": [{"text":"..."}, ...] } },
    { "template": "content-highlight", "pageRole": "introduction", "params": { "title": "...", "subtitle": "...", "bodyText": "..." } },
    ...
    { "template": "end-summary", "pageRole": "end", "params": { "title": "总结与作业", "keyPoints": ["...", "..."] } }
  ]
}`;

  const user = `Topic: ${topic}
Slide count: ${slideCount}

## Available Templates

### Cover (use for pageRole "cover")
${coverList}

### Content (use for pageRoles: toc, objectives, introduction, concept, comparison, example, quiz, summary)
${contentList}

### End (use for pageRole "end")
${endList}

Generate a complete ${slideCount}-slide lesson courseware on "${topic}".

Follow the pedagogical flow strictly: cover → toc → objectives → introduction → concepts → comparison (if needed) → example → quiz → summary → end.
Each slide must have a "pageRole" field matching its pedagogical role.
Fill all content fields with substantive, educational text suitable for a classroom setting.`;

  return { system, user };
}

async function runLegacyMode(
  topic: string,
  count: number,
  difficulty: 'junior' | 'senior' | 'college' | undefined,
  language: string | undefined,
  personaPrompt: string | undefined,
  themeId: string | undefined,
  languageModel: LanguageModel,
  modelInfo: ModelInfo | null | undefined,
  modelString: string,
  avatarId: string | undefined,
): Promise<Response> {
  const aiCall: AICallFn = async (system: string, user: string) => {
    const result = await callLLM(
      { model: languageModel, system, prompt: user, maxOutputTokens: modelInfo?.outputWindow ?? 16384 },
      'sky-slides-generate',
      { retries: 2, validate: (text) => text.length > 100 },
    );
    return result.text;
  };

  log.info(`Legacy mode: "${topic}" [model=${modelString}, avatar=${avatarId ?? 'none'}]`);

  const result = await generateSlides(
    topic,
    { topic, difficulty, slideCount: count, language, personaPrompt, themeId: themeId as PptxThemeId | undefined },
    aiCall,
  );

  return apiSuccess({ slides: result.slides, generationTime: result.generationTime });
}

export async function POST(req: NextRequest) {
  let resolvedModel: string | undefined;
  try {
    const body = await req.json();
    const {
      topic,
      difficulty,
      slideCount,
      language,
      avatarId,
      useTemplates,
      themeId,
    } = body as {
      topic?: string;
      difficulty?: 'junior' | 'senior' | 'college';
      slideCount?: number;
      language?: string;
      avatarId?: string;
      useTemplates?: boolean;
      themeId?: string;
    };

    if (!topic || !topic.trim()) {
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing required field: topic');
    }

    const count = slideCount ?? 12;

    // ── Resolve avatar persona ──
    const personaPrompt = avatarId ? getAvatarById(avatarId)?.teachingStylePrompt : undefined;

    // ── Resolve model ──
    const { model: languageModel, modelInfo, modelString } = await resolveModelFromRequest(req, body);
    resolvedModel = modelString;

    // ── Template mode v2 (default) ──
    if (useTemplates !== false) {
      const resolvedThemeId = (themeId as PptxThemeId | undefined) ?? 'sky-blue';
      log.info(`Template mode v2: "${topic}" [model=${modelString}, avatar=${avatarId ?? 'none'}, theme=${resolvedThemeId}]`);
      const startTime = Date.now();

      const { system, user } = buildTemplatePrompt(topic, count, personaPrompt, resolvedThemeId);

      const rawResponse = await callLLM(
        { model: languageModel, system, prompt: user, maxOutputTokens: modelInfo?.outputWindow ?? 16384 },
        'sky-slides-template-v2',
        { retries: 2, validate: (text) => text.length > 100 },
      );

      const parsed = parseJsonResponse<{ slots: import('@/lib/slides/types').TemplateSlotV2[] }>(rawResponse.text);
      if (!parsed || !Array.isArray(parsed.slots)) {
        log.error(`Failed to parse template slots from AI response. Raw response (first 800 chars): ${rawResponse.text.substring(0, 800)}`);
        // Fallback to Legacy mode when template parsing fails
        log.warn('Template mode parsing failed, falling back to Legacy mode');
        return await runLegacyMode(topic, count, difficulty, language, personaPrompt, resolvedThemeId, languageModel, modelInfo, modelString, avatarId);
      }

      const theme = getTheme(resolvedThemeId);
      // Log slot info for debugging empty slides
      parsed.slots.forEach((slot, i) => {
        const paramKeys = Object.keys(slot.params || {});
        const nonEmptyParams = paramKeys.filter((k) => {
          const v = (slot.params as Record<string, unknown>)?.[k];
          return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
        });
        log.info(`[Slot ${i}] template=${slot.template}, params=[${paramKeys.join(',')}], nonEmpty=[${nonEmptyParams.join(',')}]`);
      });
      const slides = assembleSlidesV2(parsed.slots, theme);
      return apiSuccess({ slides, generationTime: Date.now() - startTime });
    }

    // ── Legacy mode (explicit useTemplates=false) ──
    return await runLegacyMode(topic, count, difficulty, language, personaPrompt, themeId, languageModel, modelInfo, modelString, avatarId);
  } catch (err) {
    log.error(`Slide generation failed [topic=${JSON.stringify(resolvedModel)}]:`, err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '幻灯片生成失败', err instanceof Error ? err.message : undefined);
  }
}
