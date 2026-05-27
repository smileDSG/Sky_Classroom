/**
 * Section Agent — generates pure content JSON for a section's pages.
 *
 * Receives a SectionPlan (page-level outline with contentOutlines) and
 * outputs content JSON for each page. Does NOT generate layout/design.
 */
import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import type { LanguageModel } from 'ai';
import type { DesignDNA } from './design-dna';
import type { SectionPlan } from './planning-agent';
import { z } from 'zod';
import { SCHEMA_DESCRIPTIONS, CONTENT_SCHEMAS, autoFixContent } from './content-schemas';

const log = createLogger('SectionAgent');

// ── Content Schemas per page type ─────────────────────────────────────

const coverContentSchema = z.object({ title: z.string(), subtitle: z.string(), tagline: z.string().optional() });
const tocContentSchema = z.object({ title: z.string(), items: z.array(z.object({ num: z.string(), title: z.string(), desc: z.string() })) });
const endContentSchema = z.object({ slogan: z.string(), subtitle: z.string(), thanks: z.string().optional() });
const chapterContentSchema = z.object({ num: z.string(), title: z.string(), subtitle: z.string(), preview: z.string().optional() });
const conceptContentSchema = z.object({ title: z.string(), cards: z.array(z.object({ title: z.string(), desc: z.string() })), summary: z.string() });
const caseContentSchema = z.object({ title: z.string(), scenarios: z.array(z.object({ problem: z.string(), solution: z.string() })), highlight: z.string().optional() });
const compareContentSchema = z.object({ title: z.string(), left: z.object({ title: z.string(), items: z.array(z.string()) }), right: z.object({ title: z.string(), items: z.array(z.string()) }), conclusion: z.string() });
const processContentSchema = z.object({ title: z.string(), steps: z.array(z.object({ num: z.string(), title: z.string(), desc: z.string() })) });
const tableContentSchema = z.object({ title: z.string(), headers: z.array(z.string()), rows: z.array(z.array(z.string())), summary: z.string() });
const formulaContentSchema = z.object({ title: z.string(), mainFormula: z.string(), derivation: z.string(), application: z.string().optional() });
const timelineContentSchema = z.object({ title: z.string(), events: z.array(z.object({ date: z.string(), content: z.string() })) });
const summaryContentSchema = z.object({ title: z.string(), keyPoints: z.array(z.string()), preview: z.string().optional() });
const quizContentSchema = z.object({ title: z.string(), questions: z.array(z.object({ q: z.string(), options: z.array(z.string()), answer: z.string() })) });

const pageContentSchema = z.object({
  pageNum: z.number(),
  pageType: z.string(),
  content: z.object({}).passthrough(),
});

export const sectionOutputSchema = z.object({
  sectionId: z.number(),
  pages: z.array(pageContentSchema),
});

export type SectionOutput = z.infer<typeof sectionOutputSchema>;

// ── Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(
  topic: string,
  difficulty: string,
  designDNA: DesignDNA,
  pageTypes: string[],
): string {
  // Only inject schemas relevant to this section
  const relevantSchemas = [...new Set(pageTypes)]
    .filter((t) => SCHEMA_DESCRIPTIONS[t])
    .map((t) => `### ${t}\n${SCHEMA_DESCRIPTIONS[t]}`)
    .join('\n\n');

  return `## 角色
你是一位${difficulty}学科教师，正在编写"${topic}"课程的课件内容。

## 风格
- 风格名：${designDNA.styleName}
- 氛围：${designDNA.mood}

## 内容 Schema（必须严格遵守，违反会导致页面不合格）

${relevantSchemas}

## 重要规则
1. 严格遵循 contentOutline 的 focus 和 keyConcepts
2. 所有内容必须围绕"${topic}"，严禁引入无关学科内容
3. 技术术语用 LaTeX 格式（如 $a^2+b^2=c^2$）
4. 严格按照上面的 Schema 格式输出，字段名和类型必须完全匹配
5. 字符串不能超过 Schema 中标注的字数上限
6. 数组长度必须在 Schema 标注的范围内
7. 匹配 ${difficulty} 学段难度

## 输出格式
只输出纯 JSON：
{ "sectionId": number, "pages": [{ "pageNum": number, "pageType": "concept", "content": { ... } }] }`;
}

function buildUserPrompt(section: SectionPlan, topic: string): string {
  const pagesDesc = section.pages.map((p) =>
    `- Page ${p.pageNum} [${p.type}]: "${p.title}" — focus: ${p.contentOutline.focus}`
  ).join('\n');

  return `主题：${topic}
章节：${section.title}（共 ${section.pages.length} 页）

## 本章大纲
${pagesDesc}

请逐页生成完整内容JSON。`;
}

// ── JSON Cleanup ────────────────────────────────────────────────────

function cleanJsonText(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1').replace(/[\x00-\x1f\x7f-\x9f]/g, '');
  return cleaned;
}

// ── Public API ──────────────────────────────────────────────────────

export interface SectionResult {
  success: boolean;
  output?: SectionOutput;
  error?: string;
}

export async function generateSectionContent(
  section: SectionPlan,
  topic: string,
  difficulty: string,
  designDNA: DesignDNA,
  languageModel: LanguageModel,
): Promise<SectionResult> {
  try {
    const pageTypes = section.pages.map((p) => p.type);
    const system = buildSystemPrompt(topic, difficulty, designDNA, pageTypes);
    const user = buildUserPrompt(section, topic);

    log.info(`Generating content for section ${section.sectionId} (${section.pages.length} pages) [types: ${pageTypes.join(',')}]`);

    const result = await callLLM(
      { model: languageModel, system, prompt: user, maxOutputTokens: 16384, temperature: 0.7 },
      `section-agent-${section.sectionId}`,
      { retries: 1, validate: (text) => {
        const t = text.trim();
        return t.length > 500 && t.includes('pages') && (t.endsWith('}') || t.endsWith('}]'));
      } },
    );

    const jsonText = cleanJsonText(result.text);
    const parsed = JSON.parse(jsonText);
    const validated = sectionOutputSchema.safeParse(parsed);

    if (!validated.success) {
      log.error(`Section ${section.sectionId} output validation failed`);
      return { success: false, error: validated.error.message };
    }

    // ── Per-page content schema validation + auto-fix ──
    let fixCount = 0;
    for (const page of validated.data.pages) {
      const schema = CONTENT_SCHEMAS[page.pageType];
      if (!schema) continue;
      const contentResult = schema.safeParse(page.content);
      if (!contentResult.success) {
        log.warn(`Section ${section.sectionId} Page ${page.pageNum} (${page.pageType}) content failed schema, auto-fixing`);
        page.content = autoFixContent(page.pageType, page.content as Record<string, unknown>);
        fixCount++;
        // Re-validate after fix
        const reResult = schema.safeParse(page.content);
        if (!reResult.success) {
          log.warn(`Section ${section.sectionId} Page ${page.pageNum} auto-fix insufficient: ${reResult.error.message.slice(0, 120)}`);
        }
      }
    }
    if (fixCount > 0) {
      log.info(`Section ${section.sectionId}: auto-fixed ${fixCount} pages`);
    }

    return { success: true, output: validated.data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Section ${section.sectionId} failed: ${msg}`);
    return { success: false, error: msg };
  }
}
