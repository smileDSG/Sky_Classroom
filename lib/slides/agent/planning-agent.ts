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
  title: z.string().max(28),
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

export function buildLayer1SystemPrompt(
  pageTypes: string[],
  preference: string,
  designDNA?: import('./design-dna').DesignDNA,
  educationLevel?: string,
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

  const audienceHint = educationLevel
    ? `\n## 目标受众\n本课件面向${educationLevel}学生设计，章节结构、页数分配和页型选择必须匹配该学段的认知水平和学习节奏。\n`
    : '';

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
${audienceHint}
## 页型选择偏好
${preference}${styleInjection}

## 输出格式（纯JSON）`;
}

export function buildLayer1UserPrompt(
  topic: string,
  difficulty: string,
  minPages: number,
  maxPages: number,
  educationLevel?: string,
): string {
  return `主题：${topic}
内容难度：${difficulty}${educationLevel ? `\n目标受众：${educationLevel}` : ''}
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
  educationLevel?: string,
): Promise<SectionSkeletonResult> {
  try {
    const subjectCtx = getSubjectContext(topic);
    const system = buildLayer1SystemPrompt(subjectCtx.pageTypes, subjectCtx.preference, designDNA, educationLevel);
    const user = buildLayer1UserPrompt(topic, difficulty, minPages, maxPages, educationLevel);

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
- 每页必须包含完整的 contentOutline：
  - focus（核心内容，40-80字，必须足够具体，不能只有一句话概述）
  - keyConcepts（关键概念，至少2个、最多4个，每个≤15字）
  - notes（创作指引，≤120字）
- 页面标题字数约束：12-20字最佳，最多不超过28字
  - 标题要像演讲标题一样简洁有力，避免堆砌关键词
  - 正例：✅"Spring AI 核心架构"(12字) ✅"向量数据库选型与性能对比"(14字)
  - 反例：❌"Spring AI 核心概念与架构设计原理概述及应用场景分析"(太长，信息过载)
- 当 focus 或 keyConcepts 中出现"反应式"、"方程式"、"公式"、"化学式"、"总反应"等关键词时，必须在对应页面输出完整的 LaTeX 方程式。禁止只用文字描述代替公式。

## 页型选择指南（必须严格遵守）
- concept：用于概念讲解、知识梳理、多维度分析。每页至少3个卡片或要点，内容必须充实。
- process：用于步骤流程、反应机理、时间线展示。
- compare：用于对比分析、异同比较。
- table：用于数据对比、参数汇总、分类整理。
- formula：用于公式推导、数学证明、方程展示。
- timeline：用于历史演进、发展脉络。
- **case：仅用于真实案例分析、计算题、应用场景。严禁将概念讲解页分配为 case 类型（概念讲解应使用 concept 或 process）。**
- quiz：用于课堂测验、互动问答。
- summary：用于章节总结、知识回顾。

## 内容密度要求
- concept 页面：focus 必须包含至少3个具体知识点，keyConcepts 至少2个
- summary 页面：keyPoints 至少4个要点，覆盖本章全部核心内容
- 严禁生成内容空洞的页面（如只有标题+一句话概述）

## 单页内容量上限（硬规则，违反会导致页面排版溢出）
- concept 页面：每个 card.desc 不超过 160 字，summary 不超过 150 字
- case 页面：每个 scenario 的 problem 不超过 200 字，solution 不超过 200 字，problem+solution 合计不超过 400 字
- process 页面：每个 step.desc 不超过 140 字，steps 最多 6 个
- compare 页面：left.items 和 right.items 各最多 6 条，每条不超过 100 字，conclusion 不超过 150 字
- table 页面：rows 最多 8 行，summary 不超过 150 字
- summary 页面：keyPoints 最多 6 个，每个不超过 120 字，preview 不超过 80 字
- 通用规则：如果内容超出上限，优先精简冗余表述，保留核心知识点和关键例子，而不是无限扩展。

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
  educationLevel?: string,
): string {
  return `主题：${topic}
内容难度：${difficulty}${educationLevel ? `\n目标受众：${educationLevel}` : ''}
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
  educationLevel?: string,
): Promise<SectionPagesResult> {
  try {
    const system = buildLayer2SystemPrompt();
    const user = buildLayer2UserPrompt(skeleton, topic, difficulty, startPageNum, educationLevel);

    log.info(`[Layer2] Planning pages for section ${skeleton.sectionId} "${skeleton.title}" [${skeleton.suggestedPages} pages, start=${startPageNum}]`);

    const validatePages = (text: string): boolean => {
      try {
        const parsed = JSON.parse(cleanJsonText(text));
        if (!Array.isArray(parsed)) return false;
        // Allow ±2 page deviation — LLMs often miss by 1-2 pages.
        // Rigid exact-match causes callLLM to waste retries on trivial count errors.
        if (parsed.length < skeleton.suggestedPages - 2 || parsed.length > skeleton.suggestedPages + 2) {
          return false;
        }
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
      { retries: 2, timeoutMs: 300_000, validate: validatePages },
      { mode: 'disabled', enabled: false },
    );

    let pages = JSON.parse(cleanJsonText(result.text)) as PagePlan[];

    // ── Adaptive repair: tolerate ±2 page deviation ──
    if (pages.length !== skeleton.suggestedPages) {
      const diff = pages.length - skeleton.suggestedPages;
      if (Math.abs(diff) <= 2) {
        if (diff > 0) {
          // Too many pages: truncate from the middle, never chapter/summary
          log.warn(`[Layer2] Section ${skeleton.sectionId} 页数过多 (${pages.length} vs ${skeleton.suggestedPages})，截断 ${diff} 页`);
          let toRemove = diff;
          while (toRemove > 0) {
            let removeIdx = -1;
            for (let j = pages.length - 2; j > 0; j--) {
              if (pages[j].type !== 'chapter' && pages[j].type !== 'summary') {
                removeIdx = j;
                break;
              }
            }
            if (removeIdx === -1) removeIdx = pages.length - 2;
            pages.splice(removeIdx, 1);
            toRemove--;
          }
        } else {
          // Too few pages: pad with a generic concept page derived from neighbour
          log.warn(`[Layer2] Section ${skeleton.sectionId} 页数过少 (${pages.length} vs ${skeleton.suggestedPages})，补充 ${-diff} 页`);
          let toAdd = -diff;
          while (toAdd > 0) {
            const insertPos = Math.max(1, pages.length - 1);
            const refPage = pages[insertPos - 1] || pages[0];
            const suffix = '（续）';
            const maxTitleLen = 28 - suffix.length;
            const baseTitle = refPage.title.length > maxTitleLen
              ? refPage.title.slice(0, maxTitleLen - 1) + '…'
              : refPage.title;
            pages.splice(insertPos, 0, {
              pageNum: -1,
              type: 'concept',
              title: baseTitle + suffix,
              contentOutline: {
                focus: `${refPage.contentOutline.focus} 的延伸与补充`,
                keyConcepts: ['补充要点'],
                notes: '由系统自动补充的页面',
              },
            });
            toAdd--;
          }
        }
        // Renumber sequentially
        for (let i = 0; i < pages.length; i++) {
          pages[i].pageNum = startPageNum + i;
        }
      } else {
        return { success: false, error: `页数偏差过大: 期望 ${skeleton.suggestedPages}, 实际 ${pages.length}` };
      }
    }

    // Final focus check
    for (const page of pages) {
      if (!page.contentOutline?.focus) {
        return { success: false, error: `页面 "${page.title}" 缺少 contentOutline.focus` };
      }
    }

    log.info(`[Layer2] Section ${skeleton.sectionId} planned: ${pages.length} pages`);
    return { success: true, pages };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const msg = rawMsg.includes('Failed to process successful response')
      ? 'LLM 响应处理失败（可能是响应过大或格式异常），请重试'
      : rawMsg.includes('timeout') || rawMsg.includes('超时')
        ? 'LLM 调用超时，请稍后重试'
        : rawMsg;
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
  educationLevel?: string,
): Promise<PlanningResult> {
  try {
    // ══ Step 1: Layer 1 — Section Skeleton ══
    const skeletonResult = await planSections(topic, difficulty, minPages, maxPages, designDNA, languageModel, educationLevel);
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
          educationLevel,
        );
      },
      900_000,
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

    // Auto-fix: smart-truncate any title exceeding 28 chars before validation
    // LLM sometimes ignores the length rule; we'd rather smart-truncate than fail.
    const REDUNDANT_SUFFIXES = ['及应用场景分析', '原理概述', '概述及', '概述', '及分析', '与分析', '分析', '探讨', '详解', '方法总结', '总结', '介绍', '的原理', '的设计'];
    let truncatedCount = 0;
    for (const section of outline.sections) {
      for (const page of section.pages) {
        if (page.title.length > 28) {
          let t = page.title;
          // Try removing redundant suffixes first
          for (const suffix of REDUNDANT_SUFFIXES) {
            if (t.endsWith(suffix) && t.length - suffix.length >= 8) {
              t = t.slice(0, t.length - suffix.length);
              break;
            }
          }
          // Hard truncate if still too long
          if (t.length > 28) {
            t = t.slice(0, 27) + '…';
          }
          page.title = t;
          truncatedCount++;
        }
      }
    }
    if (truncatedCount > 0) {
      log.warn(`[Planning] Auto-truncated ${truncatedCount} page title(s) exceeding 28 chars`);
    }

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
    const rawMsg = err instanceof Error ? err.message : String(err);
    const msg = rawMsg.includes('Failed to process successful response')
      ? '大纲规划失败：LLM 响应处理异常，请重试'
      : rawMsg.includes('timeout') || rawMsg.includes('超时')
        ? '大纲规划超时，请稍后重试'
        : rawMsg;
    log.error(`[Planning] Failed: ${msg}`);
    return { success: false, error: msg };
  }
}
