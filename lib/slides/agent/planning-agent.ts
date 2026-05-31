/**
 * Planning Agent — generates a page-level outline with content outlines.
 *
 * Architecture (Scheme B):
 *   Layer 1: planSections()    → SectionSkeleton[] (chapter skeleton + page allocation)
 *   Layer 2: planSectionPages()→ PagePlan[] per section (concurrent)
 *   Merge:   mergeOutline()    → Outline (insert cover/toc/end, renumber pages)
 *
 * Called once per PPT generation. Outputs a Section[] plan that drives
 * Section Agents and Page Design Agents.
 */
import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import type { LanguageModel } from 'ai';
import type { DesignDNA } from './design-dna';
import { cleanJsonText } from './content-schemas';
import { z } from 'zod';
import { getSubjectContext, buildPageTypeList } from './page-type-selector';
import { withConcurrencyLimit } from './concurrency';

const log = createLogger('PlanningAgent');

// ── Output Schema ────────────────────────────────────────────────────

const contentOutlineSchema = z.object({
  focus: z.string(),
  keyConcepts: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const pagePlanSchema = z.object({
  pageNum: z.number(),
  type: z.enum([
    'cover', 'toc', 'end', 'chapter',
    'concept', 'case', 'compare', 'process', 'table', 'formula', 'timeline',
    'summary', 'quiz',
  ]),
  title: z.string().max(20),
  contentOutline: contentOutlineSchema,
});

const sectionPlanSchema = z.object({
  sectionId: z.number(),
  title: z.string(),
  pages: z.array(pagePlanSchema).min(1).max(10),
});

export const outlineSchema = z.object({
  sections: z.array(sectionPlanSchema).min(1).max(8),
});

export type Outline = z.infer<typeof outlineSchema>;
export type SectionPlan = z.infer<typeof sectionPlanSchema>;
export type PagePlan = z.infer<typeof pagePlanSchema>;

// ── Layer 1: Section Skeleton ────────────────────────────────────────

export interface SectionSkeleton {
  sectionId: number;
  title: string;
  focus: string;
  suggestedPages: number;
  pageTypeHints: string[];
  startPageNum?: number;
}

export interface PlanningSkeleton {
  sectionSkeletons: SectionSkeleton[];
  totalPages: number;
}

function buildLayer1SystemPrompt(
  pageTypes: string[],
  preference: string,
  designDNA?: import('./design-dna').DesignDNA,
): string {
  const pageTypeList = buildPageTypeList(pageTypes);

  let styleInjection = '';
  if (designDNA) {
    const densityHint =
      designDNA.decoration.density === 'sparse' ? '每章节3-5页，精炼简洁。' :
      designDNA.decoration.density === 'rich' ? '每章节6-10页，详细展开。' :
      '每章节5-7页，内容均衡。';

    const moodHint =
      /活泼|轻快|生动|趣味/i.test(designDNA.mood) ? '多用 quiz、case 等互动页型。' :
      /严谨|学术|专业|沉稳/i.test(designDNA.mood) ? '多用 formula、concept 等知识密度高的页型。' :
      '页型均衡搭配，按内容自然递进。';

    styleInjection = `
## 风格偏好
- 整体风格：${designDNA.styleName}（${designDNA.mood}）
- 内容密度：${designDNA.decoration.density} — ${densityHint}
- 页型倾向：${moodHint}
`;
  }

  return `## 角色
你是一位教学设计师，为课程规划章节结构和页数分配。

## 可用页面类型（仅限以下，不可自创）
${pageTypeList}

## 硬规则（不可违反）
- 总页数 = 1(cover) + 1(toc) + Σ(各章节页数) + 1(end)
- 每个章节必须包含：1页 chapter（章节封面）+ 2-5页内容页 + 1页 summary（章节总结）
- 当内容涉及3个及以上并列对比项时，该章节必须分配 table 页型
- concept 必须在 case 之前
- 同一章节内避免连续3页以上相同页型

## 页型选择偏好
${preference}${styleInjection}

## 输出格式（纯JSON）`;
}

function buildLayer1UserPrompt(
  topic: string,
  difficulty: string,
  minPages: number,
  maxPages: number,
): string {
  return `主题：${topic}
学段：${difficulty}
页数范围：${minPages}-${maxPages} 页

请规划章节结构。输出每个章节的标题、核心主题、建议页数和页型序列。

输出格式：
{
  "sectionSkeletons": [
    {
      "sectionId": 1,
      "title": "章节标题（≤12字）",
      "focus": "本章核心主题（≤50字）",
      "suggestedPages": 6,
      "pageTypeHints": ["chapter", "concept", "case", "formula", "summary"]
    }
  ],
  "totalPages": 21
}`;
}

export interface SectionSkeletonResult {
  success: boolean;
  skeleton?: PlanningSkeleton;
  error?: string;
}

export async function planSections(
  topic: string,
  difficulty: string,
  minPages: number,
  maxPages: number,
  designDNA: DesignDNA,
  languageModel: LanguageModel,
): Promise<SectionSkeletonResult> {
  try {
    const subjectCtx = getSubjectContext(topic);
    const system = buildLayer1SystemPrompt(subjectCtx.pageTypes, subjectCtx.preference, designDNA);
    const user = buildLayer1UserPrompt(topic, difficulty, minPages, maxPages);

    log.info(`[Layer1] Planning sections for "${topic}" [${minPages}-${maxPages}p]`);

    const validateSkeleton = (text: string): boolean => {
      try {
        const parsed = JSON.parse(cleanJsonText(text));
        const skeletons = parsed.sectionSkeletons;
        if (!Array.isArray(skeletons) || skeletons.length === 0) return false;
        const computedTotal = 1 + 1 + skeletons.reduce((sum: number, s: { suggestedPages?: number }) => sum + (s.suggestedPages || 0), 0) + 1;
        // Only enforce lower bound here; upper-bound trimming happens in planOutline
        return computedTotal >= minPages;
      } catch {
        return false;
      }
    };

    const result = await callLLM(
      { model: languageModel, system, prompt: user, maxOutputTokens: 4096, temperature: 0.7 },
      'planning-layer1',
      { retries: 2, timeoutMs: 180000, validate: validateSkeleton },
      { mode: 'disabled', enabled: false },
    );

    const parsed = JSON.parse(cleanJsonText(result.text));
    const skeletons = parsed.sectionSkeletons as SectionSkeleton[];
    const totalPages = parsed.totalPages as number;

    // Basic validation (upper bound is handled by planOutline trimming)
    if (!Array.isArray(skeletons) || skeletons.length === 0) {
      return { success: false, error: '章节骨架为空' };
    }
    if (typeof totalPages !== 'number' || totalPages < minPages) {
      return { success: false, error: `总页数 ${totalPages} 少于最小要求 ${minPages}` };
    }

    log.info(`[Layer1] Skeleton planned: ${skeletons.length} sections, ${totalPages} pages total`);
    return { success: true, skeleton: { sectionSkeletons: skeletons, totalPages } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`[Layer1] Failed: ${msg}`);
    return { success: false, error: msg };
  }
}

// ── Layer 2: Section Detail Pages ────────────────────────────────────

function buildLayer2SystemPrompt(): string {
  return `## 角色
你是一位教学设计师，为章节规划具体的页面内容和 contentOutline。

## 硬规则
- 严格输出指定页数，一页都不能多也不能少
- 第一页必须是 chapter 类型（章节封面页）
- 最后一页必须是 summary 类型（章节总结页）
- 中间页根据主题自然展开，页型必须在允许列表内
- 每页必须包含完整的 contentOutline：focus（核心内容，≤80字）、keyConcepts（关键概念，≤4个，每个≤15字）、notes（创作指引，≤120字）
- 页面标题字数严格限制：≤20字
- 当 focus 或 keyConcepts 中出现"反应式"、"方程式"、"公式"、"化学式"、"总反应"等关键词时，必须在对应页面输出完整的 LaTeX 方程式。禁止只用文字描述代替公式。

## 输出格式（纯JSON数组）
[
  { "pageNum": N, "type": "chapter", "title": "标题", "contentOutline": { "focus": "...", "keyConcepts": ["..."], "notes": "..." } }
]`;
}

function buildLayer2UserPrompt(
  skeleton: SectionSkeleton,
  topic: string,
  difficulty: string,
  startPageNum: number,
): string {
  return `主题：${topic}
学段：${difficulty}
章节：${skeleton.title}
本章 focus：${skeleton.focus}
建议页型序列：${skeleton.pageTypeHints.join(' → ')}
起始页码：${startPageNum}
严格页数：${skeleton.suggestedPages} 页

请输出 ${skeleton.suggestedPages} 页的具体内容，pageNum 从 ${startPageNum} 开始连续递增。`;
}

export interface SectionPagesResult {
  success: boolean;
  pages?: PagePlan[];
  error?: string;
}

export async function planSectionPages(
  skeleton: SectionSkeleton,
  topic: string,
  difficulty: string,
  designDNA: DesignDNA,
  languageModel: LanguageModel,
  startPageNum: number,
): Promise<SectionPagesResult> {
  try {
    const system = buildLayer2SystemPrompt();
    const user = buildLayer2UserPrompt(skeleton, topic, difficulty, startPageNum);

    log.info(`[Layer2] Planning pages for section ${skeleton.sectionId} "${skeleton.title}" [${skeleton.suggestedPages} pages, start=${startPageNum}]`);

    const validatePages = (text: string): boolean => {
      try {
        const parsed = JSON.parse(cleanJsonText(text));
        if (!Array.isArray(parsed)) return false;
        if (parsed.length !== skeleton.suggestedPages) return false;
        return parsed.every((page: { pageNum?: number; type?: string; title?: string; contentOutline?: unknown }) => {
          return typeof page.pageNum === 'number' &&
                 typeof page.type === 'string' &&
                 typeof page.title === 'string' &&
                 page.contentOutline && typeof (page.contentOutline as Record<string, unknown>).focus === 'string';
        });
      } catch {
        return false;
      }
    };

    const maxTokens = Math.min(8192, skeleton.suggestedPages * 1800 + 400);

    const result = await callLLM(
      { model: languageModel, system, prompt: user, maxOutputTokens: maxTokens, temperature: 0.7 },
      `planning-layer2-sec${skeleton.sectionId}`,
      { retries: 2, timeoutMs: 180000, validate: validatePages },
      { mode: 'disabled', enabled: false },
    );

    const pages = JSON.parse(cleanJsonText(result.text)) as PagePlan[];

    // Post-validation: callLLM returns lastResult even when all validate retries failed
    if (pages.length !== skeleton.suggestedPages) {
      return { success: false, error: `页数不匹配: 期望 ${skeleton.suggestedPages}, 实际 ${pages.length}` };
    }
    for (const page of pages) {
      if (!page.contentOutline?.focus) {
        return { success: false, error: `页面 "${page.title}" 缺少 contentOutline.focus` };
      }
    }

    log.info(`[Layer2] Section ${skeleton.sectionId} planned: ${pages.length} pages`);
    return { success: true, pages };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`[Layer2] Section ${skeleton.sectionId} failed: ${msg}`);
    return { success: false, error: msg };
  }
}

// ── Merge: assemble full outline ─────────────────────────────────────

function mergeOutline(
  sectionSkeletons: SectionSkeleton[],
  sectionResults: SectionPagesResult[],
  topic: string,
): Outline {
  // 1. Assemble sections from Layer 2 results
  const sections: SectionPlan[] = sectionSkeletons.map((skeleton, i) => ({
    sectionId: skeleton.sectionId,
    title: skeleton.title,
    pages: sectionResults[i]?.pages || [],
  }));

  // 2. Build fixed pages
  const coverPage: PagePlan = {
    pageNum: 1,
    type: 'cover',
    title: topic.length > 12 ? topic.slice(0, 11) + '…' : topic,
    contentOutline: {
      focus: topic,
      keyConcepts: [topic],
      notes: '',
    },
  };

  const tocPage: PagePlan = {
    pageNum: 2,
    type: 'toc',
    title: '目录',
    contentOutline: {
      focus: '课程目录',
      keyConcepts: sections.map((s) => s.title),
      notes: '',
    },
  };

  const endPage: PagePlan = {
    pageNum: -1, // temporary, renumbered below
    type: 'end',
    title: '课程结束',
    contentOutline: {
      focus: `《${topic}》课程结束`,
      keyConcepts: [],
      notes: '',
    },
  };

  // 3. Insert fixed pages
  if (sections.length > 0) {
    sections[0].pages.unshift(tocPage);
    sections[0].pages.unshift(coverPage);
    sections[sections.length - 1].pages.push(endPage);
  }

  // 4. Renumber all pages sequentially
  let currentPageNum = 1;
  for (const section of sections) {
    for (const page of section.pages) {
      page.pageNum = currentPageNum++;
    }
  }

  return { sections };
}

// ── Public API ──────────────────────────────────────────────────────

export interface PlanningResult {
  success: boolean;
  outline?: Outline;
  totalPages?: number;
  error?: string;
}

export async function planOutline(
  topic: string,
  difficulty: string,
  minPages: number,
  maxPages: number,
  designDNA: DesignDNA,
  languageModel: LanguageModel,
): Promise<PlanningResult> {
  try {
    // ══ Step 1: Layer 1 — Section Skeleton ══
    const skeletonResult = await planSections(topic, difficulty, minPages, maxPages, designDNA, languageModel);
    if (!skeletonResult.success || !skeletonResult.skeleton) {
      return { success: false, error: skeletonResult.error || '大纲骨架规划失败' };
    }

    let { sectionSkeletons, totalPages: reportedTotalPages } = skeletonResult.skeleton;

    // Use code-computed total (1 cover + 1 toc + Σ sections + 1 end)
    // LLM-reported totalPages may be inconsistent with actual suggestedPages
    let plannedTotalPages = 1 + 1 + sectionSkeletons.reduce((sum, s) => sum + s.suggestedPages, 0) + 1;
    if (reportedTotalPages !== plannedTotalPages) {
      log.warn(`[Planning] LLM reported ${reportedTotalPages} pages but computed ${plannedTotalPages}, using computed value`);
    }

    // Trim excess pages before Layer 2
    if (plannedTotalPages > maxPages) {
      let toRemove = plannedTotalPages - maxPages;
      for (let i = sectionSkeletons.length - 1; i >= 0 && toRemove > 0; i--) {
        const skeleton = sectionSkeletons[i];
        while (toRemove > 0 && skeleton.suggestedPages > 3) {
          skeleton.suggestedPages--;
          toRemove--;
          plannedTotalPages--;
        }
      }
      if (toRemove > 0) {
        return { success: false, error: `无法将大纲削减至 ${maxPages} 页以内` };
      }
    }

    // ══ Step 2: Compute start page numbers for each section ══
    let currentPageNum = 3; // cover=1, toc=2
    for (const skeleton of sectionSkeletons) {
      skeleton.startPageNum = currentPageNum;
      currentPageNum += skeleton.suggestedPages;
    }

    // ══ Step 3: Layer 2 — Concurrent section page planning ══
    log.info(`[Planning] Starting Layer 2 for ${sectionSkeletons.length} sections with concurrency=12`);
    const sectionResults = await withConcurrencyLimit(
      sectionSkeletons,
      12,
      async (skeleton) => {
        return await planSectionPages(
          skeleton,
          topic,
          difficulty,
          designDNA,
          languageModel,
          skeleton.startPageNum!,
        );
      },
      600_000,
      150,
    );

    // ══ Step 4: Check failures ══
    const failed = sectionResults.filter((r) => !r.success || !r.pages);
    if (failed.length > 0) {
      const errors = failed.map((r) => r.error || '未知错误').join('; ');
      log.error(`[Planning] ${failed.length} sections failed in Layer 2: ${errors}`);
      return { success: false, error: `部分章节规划失败: ${errors.slice(0, 200)}` };
    }

    // ══ Step 5: Merge into full outline ══
    const outline = mergeOutline(sectionSkeletons, sectionResults, topic);

    // ══ Step 6: Validate ══
    const validated = outlineSchema.safeParse(outline);
    if (!validated.success) {
      log.error(`[Planning] Merged outline validation failed: ${validated.error.message}`);
      return { success: false, error: `大纲格式校验失败: ${validated.error.message.slice(0, 200)}` };
    }

    const actualTotalPages = validated.data.sections.reduce((sum, s) => sum + s.pages.length, 0);
    if (actualTotalPages < minPages || actualTotalPages > maxPages) {
      return { success: false, error: `大纲页数 ${actualTotalPages} 不在范围 ${minPages}-${maxPages} 内` };
    }

    log.info(`[Planning] Outline complete: ${validated.data.sections.length} sections, ${actualTotalPages} pages`);
    return { success: true, outline: validated.data, totalPages: actualTotalPages };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`[Planning] Failed: ${msg}`);
    return { success: false, error: msg };
  }
}
